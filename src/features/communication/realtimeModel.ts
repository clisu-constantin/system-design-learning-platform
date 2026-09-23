/**
 * The numbers behind the Realtime Lab: what each way of getting updates to a
 * browser costs the server, for the same clients and the same events.
 *
 * Simplified model, not a measurement. It keeps the shape of the real trade-off
 * and nothing more:
 * - one server node, one network hop of 50 ms each way;
 * - events are broadcast (every client wants every event) and arrive at random
 *   (Poisson) at the chosen rate;
 * - a full HTTP request costs the server 1 unit of work (parse headers, check the
 *   session, route, write a response); a 304 Not Modified costs 0.3 when the ETag
 *   is cheap to compute; a message on an open connection (an SSE event or a
 *   WebSocket frame) costs 0.02;
 * - the server can do 5,000 units a second, and has 2 GB set aside for open
 *   connections at about 50 KB each (40,000 connections);
 * - an HTTP request plus its response carries about 800 bytes of headers; a
 *   WebSocket frame about 6 bytes (RFC 6455: 2-14); an SSE event about 30 bytes
 *   of `id:` / `data:` lines;
 * - SSE streams and WebSockets send a keep-alive every 30 s.
 */

export type Technique = 'polling' | 'long-polling' | 'sse' | 'websockets';

export interface RealtimeInput {
  technique: Technique;
  clients: number;
  /** Events the server publishes per minute, each one wanted by every client. */
  eventsPerMin: number;
  /** Messages each client sends to the server per minute (chat, cursor moves...). */
  sendsPerMin: number;
  /** Polling interval, seconds. */
  intervalS: number;
  /** Long polling: how long the server holds a request before answering empty, seconds. */
  holdS: number;
  /** Polling: the client sends If-None-Match, so an unchanged answer is a cheap 304. */
  etag: boolean;
}

export interface RealtimeResult {
  /** Average time from an event reaching the server to a client having it, ms. */
  delayMs: number;
  /** HTTP requests per second the server answers (polls, long polls, POSTs). */
  httpPerSec: number;
  /** Responses per second that carry nothing new (unchanged polls, empty long-poll timeouts). */
  wastedPerSec: number;
  /** Connections or requests the server holds open at any moment. */
  openConnections: number;
  /** Share of the server CPU budget, 1 = full. */
  cpu: number;
  /** Share of the memory set aside for open connections, 1 = full. */
  memory: number;
  /** Header and framing bytes per second - bytes that are not the event itself. */
  overheadBytesPerSec: number;
}

export const ONE_WAY_MS = 50;
export const RTT_S = (2 * ONE_WAY_MS) / 1000;
export const REQUEST_COST = 1;
export const NOT_MODIFIED_COST = 0.3;
export const MESSAGE_COST = 0.02;
export const CPU_BUDGET = 5000;
export const CONNECTION_BUDGET = 40000;
export const HEADER_BYTES = 800;
export const WS_FRAME_BYTES = 6;
export const SSE_EVENT_BYTES = 30;
export const KEEPALIVE_S = 30;

export const TECHNIQUE_LABEL: Record<Technique, string> = {
  polling: 'Polling',
  'long-polling': 'Long polling',
  sse: 'Server-Sent Events',
  websockets: 'WebSockets',
};

export function realtimeModel(input: RealtimeInput): RealtimeResult {
  const { technique, clients, eventsPerMin, sendsPerMin, intervalS, holdS, etag } = input;
  const lambda = eventsPerMin / 60;
  const sends = (clients * sendsPerMin) / 60;

  if (technique === 'polling') {
    const polls = clients / intervalS;
    // Chance that at least one event landed since the last poll of this client.
    const useful = 1 - Math.exp(-lambda * intervalS);
    const wasted = polls * (1 - useful);
    const httpPerSec = polls + sends;
    const work = polls * useful * REQUEST_COST + wasted * (etag ? NOT_MODIFIED_COST : REQUEST_COST) + sends * REQUEST_COST;
    const openConnections = httpPerSec * RTT_S;
    return {
      // On average an event waits half an interval for the next poll, then one hop back.
      delayMs: (intervalS / 2) * 1000 + ONE_WAY_MS,
      httpPerSec,
      wastedPerSec: wasted,
      openConnections,
      cpu: work / CPU_BUDGET,
      memory: openConnections / CONNECTION_BUDGET,
      overheadBytesPerSec: httpPerSec * HEADER_BYTES,
    };
  }

  if (technique === 'long-polling') {
    // Time a request is held: until the next event or the hold timeout, whichever is first.
    const held = lambda > 0 ? (1 - Math.exp(-lambda * holdS)) / lambda : holdS;
    const cycle = held + RTT_S;
    const polls = clients / cycle;
    const wasted = polls * Math.exp(-lambda * holdS);
    const httpPerSec = polls + sends;
    // An event that lands while the client is between two requests waits for the next one.
    const gapShare = RTT_S / cycle;
    const openConnections = clients * (held / cycle) + sends * RTT_S;
    return {
      delayMs: ONE_WAY_MS + gapShare * (RTT_S / 2) * 1000,
      httpPerSec,
      wastedPerSec: wasted,
      openConnections,
      cpu: (httpPerSec * REQUEST_COST) / CPU_BUDGET,
      memory: openConnections / CONNECTION_BUDGET,
      overheadBytesPerSec: httpPerSec * HEADER_BYTES,
    };
  }

  const pushed = clients * (lambda + 1 / KEEPALIVE_S);
  if (technique === 'sse') {
    // SSE is one-way: what the client sends goes up as ordinary HTTP POSTs.
    const openConnections = clients + sends * RTT_S;
    return {
      delayMs: ONE_WAY_MS,
      httpPerSec: sends,
      wastedPerSec: 0,
      openConnections,
      cpu: (pushed * MESSAGE_COST + sends * REQUEST_COST) / CPU_BUDGET,
      memory: openConnections / CONNECTION_BUDGET,
      overheadBytesPerSec: pushed * SSE_EVENT_BYTES + sends * HEADER_BYTES,
    };
  }

  // WebSockets: both directions are frames on the socket that is already open.
  return {
    delayMs: ONE_WAY_MS,
    httpPerSec: 0,
    wastedPerSec: 0,
    openConnections: clients,
    cpu: ((pushed + sends) * MESSAGE_COST) / CPU_BUDGET,
    memory: clients / CONNECTION_BUDGET,
    overheadBytesPerSec: (pushed + sends) * WS_FRAME_BYTES,
  };
}
