/**
 * A packet-level model of one client streaming to one server across a lossy
 * network, delivered TCP-style (numbered, acknowledged, resent, handed to the
 * app in order) or UDP-style (each datagram handed over as it arrives, or never).
 *
 * It is a teaching model, not a TCP implementation. Simplified on purpose:
 * - the sender paces packets at a fixed rate; congestion control is not modelled
 *   (real TCP also slows down after a loss, so a real file would finish later still);
 * - a lost packet is resent after 3 duplicate ACKs (fast retransmit, RFC 5681),
 *   which is modelled as one round trip plus three packet gaps after the send;
 *   when there are not 3 packets behind it, or the resend is lost too, the
 *   sender waits a timeout of twice the round trip, at least 200 ms, doubling each time;
 * - the handshake packets and the ACKs are never dropped, and every data packet
 *   gets its own ACK;
 * - jitter is a random extra delay per packet, so packets can overtake each other.
 */

export type Transport = 'tcp' | 'udp';
export type Payload = 'voice' | 'file';

/** The network all four streams share. Each stream knows its own transport and payload. */
export interface NetworkSetup {
  /** Share of data packets the network drops, 0..1. */
  lossRate: number;
  /** One-way delay in ms. The round trip is twice this. */
  delayMs: number;
  /** Each packet gets a random extra delay between 0 and this, in ms. */
  jitterMs: number;
}

/** A voice codec sends one frame of audio every 20 ms (the usual RTP packet size). */
export const VOICE_FRAME_MS = 20;
/** The file sender puts a packet on the wire every 10 ms. */
export const FILE_PACING_MS = 10;
export const FILE_PACKETS = 60;
/** The receiver plays each voice frame this long after it would arrive with no jitter. */
export const PLAYOUT_BUFFER_MS = 60;
export const DUP_ACK_THRESHOLD = 3;
/** Linux does not let the retransmission timeout go below 200 ms. */
export const MIN_RTO_MS = 200;
const PAUSE_BETWEEN_FILES_MS = 500;

export type FlightKind = 'syn' | 'syn-ack' | 'data' | 'retransmit' | 'ack';

/** One packet on the wire. */
export interface Flight {
  id: number;
  transfer: number;
  kind: FlightKind;
  seq: number;
  toServer: boolean;
  sentAt: number;
  arriveAt: number;
  /** The network drops it halfway, at the Network node. */
  dropped: boolean;
}

export type FrameVerdict = 'on-time' | 'late' | 'lost';

export interface PacketRecord {
  seq: number;
  sentAt: number;
  /** Voice only: the moment the receiver must play this frame. */
  deadline: number;
  attempts: number;
  arrivedAt: number | null;
  /** When the app on the server got it. TCP holds it back until every earlier packet is there. */
  deliveredAt: number | null;
  /** The resend is scheduled (TCP). */
  resending: boolean;
  /** When the latest transmission was dropped at the Network node, if it was. */
  droppedAt: number | null;
  /** UDP only: its one and only transmission was dropped. */
  gone: boolean;
  /** Voice only: decided at the deadline. */
  verdict: FrameVerdict | null;
}

export interface StreamStats {
  sent: number;
  dropped: number;
  retransmits: number;
  /** Arrivals with a lower number than a packet that already arrived. */
  outOfOrder: number;
  /** TCP: packets that arrived but had to wait for an earlier one (head-of-line blocking). */
  held: number;
  /** Longest time an arrived packet waited in the receive buffer. */
  maxHoldMs: number;
  onTime: number;
  late: number;
  lost: number;
  files: number;
  filesComplete: number;
  missing: number;
  fileMsTotal: number;
}

export interface Stream {
  transport: Transport;
  payload: Payload;
  transfer: number;
  phase: 'waiting' | 'handshake' | 'sending' | 'draining';
  /** When the next connection opens, while waiting. */
  opensAt: number;
  connStart: number;
  dataStart: number;
  nextSeq: number;
  /** TCP: the packet the app is waiting for next. */
  expected: number;
  lastDeliveredAt: number;
  highestArrived: number;
  packets: Map<number, PacketRecord>;
  flights: Flight[];
  resends: { seq: number; attempt: number; at: number; fast: boolean; after: number }[];
  dropNext: boolean;
  stats: StreamStats;
  lastFile: { ms: number; missing: number } | null;
}

export interface StreamEvent {
  transport: Transport;
  tone: 'info' | 'ok' | 'warn' | 'danger';
  /** Written without the transport or payload; the lab prefixes both. */
  message: string;
  /** Events with the same key (per stream) are rate-limited by the lab. */
  key?: string;
}

let flightId = 0;

export const emptyStats = (): StreamStats => ({
  sent: 0,
  dropped: 0,
  retransmits: 0,
  outOfOrder: 0,
  held: 0,
  maxHoldMs: 0,
  onTime: 0,
  late: 0,
  lost: 0,
  files: 0,
  filesComplete: 0,
  missing: 0,
  fileMsTotal: 0,
});

export function createStream(transport: Transport, payload: Payload, opensAt: number): Stream {
  return {
    transport,
    payload,
    transfer: 0,
    phase: 'waiting',
    opensAt,
    connStart: opensAt,
    dataStart: opensAt,
    nextSeq: 0,
    expected: 0,
    lastDeliveredAt: 0,
    highestArrived: -1,
    packets: new Map(),
    flights: [],
    resends: [],
    dropNext: false,
    stats: emptyStats(),
    lastFile: null,
  };
}

/**
 * The same random draw for the same packet on both transports, so TCP and UDP
 * face exactly the same network luck and the comparison is fair.
 */
function draw(seed: number, transfer: number, seq: number, attempt: number, salt: number) {
  let h = mix(seed);
  for (const part of [transfer, seq, attempt, salt]) h = mix(h + part + 0x9e3779b9);
  return h / 4294967296;
}

/** The murmur3 finaliser: spreads every input bit over the whole 32-bit result. */
function mix(value: number) {
  let h = value >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export const intervalFor = (payload: Payload) => (payload === 'voice' ? VOICE_FRAME_MS : FILE_PACING_MS);

/**
 * Retransmission timeout after transmission `attempt` (0 = the first send) was lost:
 * twice the round trip, never below 200 ms, doubling for every resend lost after the first.
 */
export const timeoutFor = (delayMs: number, attempt: number) =>
  Math.max(MIN_RTO_MS, 4 * delayMs) * 2 ** Math.max(0, attempt - 1);

function transmit(
  s: Stream,
  seq: number,
  attempt: number,
  at: number,
  setup: NetworkSetup,
  seed: number,
) {
  const forced = attempt === 0 && s.dropNext;
  if (forced) s.dropNext = false;
  const dropped = forced || draw(seed, s.transfer, seq, attempt, 0) < setup.lossRate;
  const arriveAt = at + setup.delayMs + draw(seed, s.transfer, seq, attempt, 1) * setup.jitterMs;
  s.flights.push({
    id: (flightId += 1),
    transfer: s.transfer,
    kind: attempt === 0 ? 'data' : 'retransmit',
    seq,
    toServer: true,
    sentAt: at,
    arriveAt,
    dropped,
  });
  const record = s.packets.get(seq);
  if (record) {
    record.attempts += 1;
    record.resending = false;
    record.droppedAt = dropped ? at + (arriveAt - at) / 2 : null;
  }
  if (!dropped) return;
  s.stats.dropped += 1;
  if (s.transport === 'udp') {
    if (record) record.gone = true;
    return;
  }
  // TCP only learns about the loss from the ACKs, one round trip later.
  if (record) record.resending = true;
  const interval = intervalFor(s.payload);
  const packetsBehind = s.payload === 'voice' ? Infinity : FILE_PACKETS - 1 - seq;
  const fast = attempt === 0 && packetsBehind >= DUP_ACK_THRESHOLD;
  const resendAt = fast
    ? at + 2 * setup.delayMs + DUP_ACK_THRESHOLD * interval
    : at + timeoutFor(setup.delayMs, attempt);
  s.resends.push({ seq, attempt: attempt + 1, at: resendAt, fast, after: resendAt - at });
}

function send(s: Stream, flight: Omit<Flight, 'id' | 'transfer'>) {
  s.flights.push({ ...flight, id: (flightId += 1), transfer: s.transfer });
}

function finishFile(s: Stream, now: number, finishedAt: number, emit: (event: StreamEvent) => void) {
  let missing = 0;
  for (const record of s.packets.values()) if (record.deliveredAt === null) missing += 1;
  const ms = finishedAt - s.connStart;
  s.stats.files += 1;
  s.stats.fileMsTotal += ms;
  s.stats.missing += missing;
  if (missing === 0) s.stats.filesComplete += 1;
  s.lastFile = { ms, missing };
  emit({
    transport: s.transport,
    tone: missing ? 'danger' : 'ok',
    message:
      missing === 0
        ? `done in ${Math.round(ms)} ms, all ${FILE_PACKETS} packets in order.`
        : `done in ${Math.round(ms)} ms, but ${missing} of ${FILE_PACKETS} packets never came. The file is corrupt unless the app asks for them again.`,
  });
  s.transfer += 1;
  s.phase = 'waiting';
  s.opensAt = now + PAUSE_BETWEEN_FILES_MS;
  s.nextSeq = 0;
  s.expected = 0;
  s.highestArrived = -1;
  s.packets = new Map();
  s.resends = [];
}

/** Advances one stream to simulated time `now` (ms). Mutates the stream in place. */
export function stepStream(
  s: Stream,
  now: number,
  setup: NetworkSetup,
  seed: number,
  emit: (event: StreamEvent) => void,
) {
  const interval = intervalFor(s.payload);

  if (s.phase === 'waiting' && now >= s.opensAt) {
    s.connStart = s.opensAt;
    if (s.transport === 'tcp') {
      s.phase = 'handshake';
      send(s, { kind: 'syn', seq: -1, toServer: true, sentAt: s.opensAt, arriveAt: s.opensAt + setup.delayMs, dropped: false });
    } else {
      s.phase = 'sending';
      s.dataStart = s.opensAt;
    }
  }

  if (s.phase === 'sending') {
    while (s.payload === 'voice' || s.nextSeq < FILE_PACKETS) {
      const at = s.dataStart + s.nextSeq * interval;
      if (at > now) break;
      const seq = s.nextSeq;
      s.nextSeq += 1;
      s.packets.set(seq, {
        seq,
        sentAt: at,
        deadline: at + setup.delayMs + PLAYOUT_BUFFER_MS,
        attempts: 0,
        arrivedAt: null,
        deliveredAt: null,
        resending: false,
        droppedAt: null,
        gone: false,
        verdict: null,
      });
      s.stats.sent += 1;
      transmit(s, seq, 0, at, setup, seed);
    }
    if (s.payload === 'file' && s.nextSeq >= FILE_PACKETS) s.phase = 'draining';
  }

  if (s.resends.length) {
    const due = s.resends.filter((resend) => resend.at <= now);
    if (due.length) {
      s.resends = s.resends.filter((resend) => resend.at > now);
      for (const resend of due) {
        s.stats.retransmits += 1;
        transmit(s, resend.seq, resend.attempt, resend.at, setup, seed);
      }
    }
  }

  // Arrivals, in the order they happen.
  let arrived = s.flights.filter((flight) => flight.arriveAt <= now);
  while (arrived.length) {
    s.flights = s.flights.filter((flight) => flight.arriveAt > now);
    arrived.sort((a, b) => a.arriveAt - b.arriveAt);
    for (const flight of arrived) arrive(s, flight, setup, emit);
    arrived = s.flights.filter((flight) => flight.arriveAt <= now);
  }

  if (s.payload === 'voice') {
    for (const record of s.packets.values()) {
      if (record.verdict !== null || record.deadline > now) continue;
      if (record.deliveredAt !== null && record.deliveredAt <= record.deadline) {
        record.verdict = 'on-time';
        s.stats.onTime += 1;
      } else if (record.gone) {
        record.verdict = 'lost';
        s.stats.lost += 1;
      } else {
        record.verdict = 'late';
        s.stats.late += 1;
      }
    }
    // Keep the last few hundred frames; older ones are decided and no longer drawn.
    for (const seq of s.packets.keys()) {
      if (seq >= s.nextSeq - 300) break;
      const record = s.packets.get(seq);
      if (record && record.verdict !== null) s.packets.delete(seq);
    }
  } else if (s.phase === 'draining') {
    if (s.transport === 'tcp' && s.expected >= FILE_PACKETS) {
      finishFile(s, now, s.lastDeliveredAt, emit);
    } else if (
      s.transport === 'udp' &&
      !s.flights.some((flight) => flight.transfer === s.transfer && flight.toServer)
    ) {
      let last = s.dataStart;
      for (const record of s.packets.values()) if (record.arrivedAt !== null) last = Math.max(last, record.arrivedAt);
      finishFile(s, now, last, emit);
    }
  }
}

function arrive(s: Stream, flight: Flight, setup: NetworkSetup, emit: (event: StreamEvent) => void) {
  if (flight.transfer !== s.transfer) return;
  if (flight.kind === 'syn') {
    send(s, {
      kind: 'syn-ack',
      seq: -1,
      toServer: false,
      sentAt: flight.arriveAt,
      arriveAt: flight.arriveAt + setup.delayMs,
      dropped: false,
    });
    return;
  }
  if (flight.kind === 'syn-ack') {
    // The client ACKs the SYN-ACK and sends its first data in the same moment.
    s.phase = 'sending';
    s.dataStart = flight.arriveAt;
    emit({
      transport: 'tcp',
      tone: 'info',
      key: 'tcp-handshake',
      message: `SYN, SYN-ACK: the handshake took one round trip (${Math.round(flight.arriveAt - s.connStart)} ms) before the first data packet.`,
    });
    return;
  }
  if (flight.kind === 'ack') return;
  if (flight.dropped) {
    if (s.transport === 'udp') {
      emit({
        transport: 'udp',
        tone: 'danger',
        key: 'udp-drop',
        message:
          s.payload === 'voice'
            ? `datagram #${flight.seq} dropped. Nobody resends it: the call plays on and the codec hides the 20 ms gap.`
            : `datagram #${flight.seq} dropped. Nobody resends it, so the file will be missing it.`,
      });
      return;
    }
    const resend = s.resends.find((item) => item.seq === flight.seq);
    emit({
      transport: 'tcp',
      tone: 'warn',
      key: 'tcp-drop',
      message: !resend
        ? `packet #${flight.seq} dropped. TCP will send it again.`
        : resend.fast
          ? `packet #${flight.seq} dropped. ${DUP_ACK_THRESHOLD} duplicate ACKs tell the sender, and it resends #${flight.seq} ${Math.round(resend.after)} ms after that try.`
          : `packet #${flight.seq} dropped${resend.attempt > 1 ? ' again' : ''}. No duplicate ACKs come back, so the sender waits its ${Math.round(resend.after)} ms timeout before resending.`,
    });
    return;
  }

  const record = s.packets.get(flight.seq);
  if (!record || record.arrivedAt !== null) return;
  record.arrivedAt = flight.arriveAt;
  if (flight.seq < s.highestArrived) {
    s.stats.outOfOrder += 1;
    if (s.transport === 'udp') {
      emit({
        transport: 'udp',
        tone: 'info',
        key: 'udp-order',
        message: `#${flight.seq} arrived after #${s.highestArrived} (jitter). UDP hands it to the app out of order.`,
      });
    }
  }
  s.highestArrived = Math.max(s.highestArrived, flight.seq);

  if (s.transport === 'udp') {
    record.deliveredAt = flight.arriveAt;
    return;
  }

  send(s, { kind: 'ack', seq: flight.seq, toServer: false, sentAt: flight.arriveAt, arriveAt: flight.arriveAt + setup.delayMs, dropped: false });
  if (flight.seq > s.expected) s.stats.held += 1;

  let released = 0;
  let longest = 0;
  for (;;) {
    const next = s.packets.get(s.expected);
    if (!next || next.arrivedAt === null) break;
    next.deliveredAt = Math.max(next.arrivedAt, s.lastDeliveredAt);
    const held = next.deliveredAt - next.arrivedAt;
    longest = Math.max(longest, held);
    s.stats.maxHoldMs = Math.max(s.stats.maxHoldMs, held);
    s.lastDeliveredAt = next.deliveredAt;
    s.expected += 1;
    released += 1;
  }
  if (flight.kind === 'retransmit' && released > 1) {
    emit({
      transport: 'tcp',
      tone: 'warn',
      key: 'tcp-release',
      message: `#${flight.seq} arrived on its resend, ${Math.round(flight.arriveAt - record.sentAt)} ms after it was first sent. ${released - 1} packets that were already there waited behind it for up to ${Math.round(longest)} ms (head-of-line blocking).`,
    });
  }
}

/** What the receiver shows for one packet number in the strip under the diagram. */
export type CellState = 'unsent' | 'flight' | 'resend' | 'held' | 'ok' | 'late' | 'lost';

export function cellState(record: PacketRecord | undefined, payload: Payload, now: number): CellState {
  if (!record) return 'unsent';
  // Until the drop happens at the Network node, a dropped packet is just in flight.
  if (record.droppedAt !== null && now < record.droppedAt) return 'flight';
  if (payload === 'voice' && record.verdict === 'late') return 'late';
  if (payload === 'voice' && record.verdict === 'lost') return 'lost';
  if (record.deliveredAt !== null) {
    if (payload === 'voice') return 'ok';
    const waited = record.attempts > 1 || record.deliveredAt - (record.arrivedAt ?? 0) > 0.5;
    return waited ? 'late' : 'ok';
  }
  if (record.gone) return 'lost';
  if (record.arrivedAt !== null) return 'held';
  if (record.resending) return 'resend';
  return 'flight';
}
