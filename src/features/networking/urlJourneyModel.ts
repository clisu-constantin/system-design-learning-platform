import type { RequestOutcome } from '@/types';

/**
 * The URL journey as a list of stages, each one a set of hops between the parts
 * of the diagram. Pure: the Lab draws what this returns.
 *
 * Every number here is a simplified, illustrative round trip - the right order of
 * magnitude for a user on a decent connection, not a measurement. The Lab says so
 * next to every number it shows.
 */

/** Which part of the journey the request walks in a loop. */
export type Scope = 'all' | 'dns' | 'connect' | 'http';

/** How long ago the recursive resolver last looked this name up. `never`: its cache is empty. */
export type ResolverCache = 'never' | '30s' | '10min' | '3h';

export type TlsVersion = '1.2' | '1.3';

export interface JourneySetup {
  scope: Scope;
  /** Where the request starts walking. The Lab focus uses it to open on one stage. */
  startStage: StageId;
  https: boolean;
  tls: TlsVersion;
  /** An open, already encrypted connection to this host is reused: no DNS, TCP or TLS. */
  warm: boolean;
  /** TTL on the A record of example.com, in seconds. */
  ttlS: number;
  resolverCache: ResolverCache;
  cdn: boolean;
  /** Round trip between the user and the origin data centre. */
  originRttMs: number;
  cacheHit: boolean;
}

export type NodeId = 'browser' | 'resolver' | 'root' | 'tld' | 'auth' | 'edge' | 'lb' | 'app' | 'cache' | 'db';

export type StageId =
  | 'browser'
  | 'dns-ask'
  | 'dns-root'
  | 'dns-tld'
  | 'dns-auth'
  | 'tcp'
  | 'tls'
  | 'request'
  | 'cdn'
  | 'lb'
  | 'app'
  | 'cache'
  | 'db'
  | 'response'
  | 'render';

export interface Hop {
  from: NodeId;
  to: NodeId;
  outcome: RequestOutcome;
}

export interface StagePlan {
  id: StageId;
  title: string;
  short: string;
  /** The Play scope this stage belongs to, besides `all`. Null: only the whole journey plays it. */
  group: Exclude<Scope, 'all'> | null;
  /** Simplified time this stage adds. 0 when skipped. */
  ms: number;
  /** Why this stage does not happen in this setup, or null when it does. */
  skipped: string | null;
  hops: Hop[];
  /** Where the request waits during a stage with no hops (work done inside one part). */
  at: NodeId;
  /** Parts this stage touches, highlighted on the diagram. */
  nodes: NodeId[];
  concept?: string;
}

// ---- Simplified timings (illustrative, not measured) ----------------------
/** Browser to the recursive resolver of its ISP or a public DNS service, and back. */
export const RESOLVER_RTT_MS = 10;
export const ROOT_RTT_MS = 20;
export const TLD_RTT_MS = 20;
export const AUTH_RTT_MS = 40;
/** Browser to a nearby CDN edge and back. */
export const EDGE_RTT_MS = 10;
export const LB_MS = 1;
export const APP_MS = 20;
export const CACHE_MS = 2;
export const DB_MS = 35;
export const RENDER_MS = 120;
export const BROWSER_MS = 1;

/**
 * TTL of the .com delegation (the NS records for com.) in the root zone: 172800 s,
 * two days. A resolver that has looked up any .com name in the last two days
 * already knows the .com servers and skips the root.
 */
export const COM_REFERRAL_TTL_S = 172800;

export const RESOLVER_CACHE_AGE_S: Record<ResolverCache, number | null> = {
  never: null,
  '30s': 30,
  '10min': 600,
  '3h': 10800,
};

export const TTL_OPTIONS: { value: number; label: string }[] = [
  { value: 60, label: '60 s' },
  { value: 300, label: '5 min' },
  { value: 3600, label: '1 h' },
  { value: 86400, label: '1 day' },
];

/** A TTL, or a time counted against one, in whole units the way a TTL is set: "45 s", "5 min", "1 h", "2 days". */
export const formatTtl = (seconds: number) =>
  seconds >= 86400
    ? `${Math.round(seconds / 86400)} day${seconds >= 172800 ? 's' : ''}`
    : seconds >= 3600
      ? `${Math.round(seconds / 3600)} h`
      : seconds >= 60
        ? `${Math.round(seconds / 60)} min`
        : `${Math.round(seconds)} s`;

export interface DnsState {
  /** The resolver still holds a fresh copy of the A record. */
  answerCached: boolean;
  /** The resolver already knows the .com servers, so it does not ask a root server. */
  referralCached: boolean;
  /** Seconds the cached answer may still be used, when it is cached. */
  ttlLeftS: number | null;
}

export function dnsState(setup: JourneySetup): DnsState {
  const age = RESOLVER_CACHE_AGE_S[setup.resolverCache];
  const answerCached = age !== null && age < setup.ttlS;
  return {
    answerCached,
    referralCached: age !== null && age < COM_REFERRAL_TTL_S,
    ttlLeftS: answerCached && age !== null ? setup.ttlS - age : null,
  };
}

/** The part the browser opens its connection to: the CDN edge, or the origin load balancer. */
export const frontOf = (setup: JourneySetup): NodeId => (setup.cdn ? 'edge' : 'lb');
export const frontRttOf = (setup: JourneySetup) => (setup.cdn ? EDGE_RTT_MS : setup.originRttMs);

const there = (from: NodeId, to: NodeId, outcome: RequestOutcome = 'success'): Hop[] => [
  { from, to, outcome },
  { from: to, to: from, outcome },
];

export function planJourney(setup: JourneySetup): StagePlan[] {
  const dns = dnsState(setup);
  const front = frontOf(setup);
  const frontRtt = frontRttOf(setup);
  // Plain HTTP is readable on every public hop; inside the data centre nothing changes.
  const wire: RequestOutcome = setup.https ? 'success' : 'warning';
  const reused = 'Connection reused - the browser already has an open connection to this host';

  const dnsSkip = (answerSkip: boolean, reason: string) =>
    setup.warm ? reused : answerSkip ? reason : null;

  const list: (Omit<StagePlan, 'ms'> & { cost: number })[] = [
    {
      id: 'browser',
      title: 'Browser processing',
      short: 'URL parsed, caches checked',
      group: null,
      cost: BROWSER_MS,
      skipped: null,
      hops: [],
      at: 'browser',
      nodes: ['browser'],
    },
    {
      id: 'dns-ask',
      title: 'DNS: ask the resolver',
      short: dns.answerCached ? 'answer cached at the resolver' : 'resolver cache miss',
      group: 'dns',
      cost: RESOLVER_RTT_MS,
      skipped: setup.warm ? reused : null,
      hops: dns.answerCached
        ? [
            { from: 'browser', to: 'resolver', outcome: 'success' },
            { from: 'resolver', to: 'browser', outcome: 'cache-hit' },
          ]
        : [{ from: 'browser', to: 'resolver', outcome: 'success' }],
      at: 'resolver',
      nodes: ['browser', 'resolver'],
      concept: 'dns',
    },
    {
      id: 'dns-root',
      title: 'DNS: root server',
      short: 'where are the .com servers?',
      group: 'dns',
      cost: ROOT_RTT_MS,
      skipped: dnsSkip(
        dns.answerCached || dns.referralCached,
        dns.answerCached
          ? 'The resolver had the answer cached'
          : 'The resolver already knows the .com servers (that referral is cached for 2 days)',
      ),
      hops: there('resolver', 'root'),
      at: 'root',
      nodes: ['resolver', 'root'],
      concept: 'dns',
    },
    {
      id: 'dns-tld',
      title: 'DNS: .com TLD server',
      short: 'who answers for example.com?',
      group: 'dns',
      cost: TLD_RTT_MS,
      skipped: dnsSkip(dns.answerCached, 'The resolver had the answer cached'),
      hops: there('resolver', 'tld'),
      at: 'tld',
      nodes: ['resolver', 'tld'],
      concept: 'dns',
    },
    {
      id: 'dns-auth',
      title: 'DNS: authoritative server',
      short: `A record + TTL ${formatTtl(setup.ttlS)}`,
      group: 'dns',
      cost: AUTH_RTT_MS,
      skipped: dnsSkip(dns.answerCached, 'The resolver had the answer cached'),
      hops: [...there('resolver', 'auth'), { from: 'resolver', to: 'browser', outcome: 'success' }],
      at: 'auth',
      nodes: ['resolver', 'auth', 'browser'],
      concept: 'dns',
    },
    {
      id: 'tcp',
      title: 'TCP connection',
      short: 'SYN, SYN-ACK - one round trip',
      group: 'connect',
      cost: frontRtt,
      skipped: setup.warm ? reused : null,
      hops: there('browser', front),
      at: front,
      nodes: ['browser', front],
    },
    {
      id: 'tls',
      title: 'TLS handshake',
      short: setup.tls === '1.3' ? 'TLS 1.3: one round trip' : 'TLS 1.2: two round trips',
      group: 'connect',
      cost: frontRtt * (setup.tls === '1.3' ? 1 : 2),
      skipped: !setup.https
        ? 'Plain HTTP - no encryption, so no handshake'
        : setup.warm
          ? 'Connection reused - it is already encrypted'
          : null,
      hops: setup.tls === '1.3' ? there('browser', front) : [...there('browser', front), ...there('browser', front)],
      at: front,
      nodes: ['browser', front],
      concept: 'tls-https',
    },
    {
      id: 'request',
      title: 'HTTP request sent',
      short: 'GET /products/42 with headers',
      group: 'http',
      cost: frontRtt / 2,
      skipped: null,
      hops: [{ from: 'browser', to: front, outcome: wire }],
      at: front,
      nodes: ['browser', front],
      concept: 'http-https',
    },
    {
      id: 'cdn',
      title: 'CDN edge',
      short: 'dynamic page: miss, forward',
      group: 'http',
      cost: setup.originRttMs / 2,
      skipped: setup.cdn ? null : 'No CDN in front - the browser talks to the origin directly',
      hops: [{ from: 'edge', to: 'lb', outcome: wire }],
      at: 'edge',
      nodes: ['edge', 'lb'],
      concept: 'cdn',
    },
    {
      id: 'lb',
      title: 'Load balancer',
      short: 'pick a healthy server',
      group: 'http',
      cost: LB_MS,
      skipped: null,
      hops: [{ from: 'lb', to: 'app', outcome: 'success' }],
      at: 'lb',
      nodes: ['lb', 'app'],
      concept: 'load-balancing',
    },
    {
      id: 'app',
      title: 'Application server',
      short: 'your code runs',
      group: 'http',
      cost: APP_MS,
      skipped: null,
      hops: [],
      at: 'app',
      nodes: ['app'],
    },
    {
      id: 'cache',
      title: 'Cache lookup',
      short: setup.cacheHit ? 'Redis: hit' : 'Redis: miss',
      group: 'http',
      cost: CACHE_MS,
      skipped: null,
      hops: [
        { from: 'app', to: 'cache', outcome: 'success' },
        { from: 'cache', to: 'app', outcome: setup.cacheHit ? 'cache-hit' : 'success' },
      ],
      at: 'cache',
      nodes: ['app', 'cache'],
      concept: 'caching',
    },
    {
      id: 'db',
      title: 'Database query',
      short: 'indexed lookup',
      group: 'http',
      cost: DB_MS,
      skipped: setup.cacheHit ? 'Cache hit - the database is not touched' : null,
      hops: there('app', 'db'),
      at: 'db',
      nodes: ['app', 'db'],
      concept: 'database-indexing',
    },
    {
      id: 'response',
      title: 'HTTP response',
      short: '200 OK, headers, body',
      group: 'http',
      cost: frontRtt / 2 + (setup.cdn ? setup.originRttMs / 2 : 0),
      skipped: null,
      hops: setup.cdn
        ? [
            { from: 'app', to: 'lb', outcome: 'success' },
            { from: 'lb', to: 'edge', outcome: wire },
            { from: 'edge', to: 'browser', outcome: wire },
          ]
        : [
            { from: 'app', to: 'lb', outcome: 'success' },
            { from: 'lb', to: 'browser', outcome: wire },
          ],
      at: 'browser',
      nodes: setup.cdn ? ['app', 'lb', 'edge', 'browser'] : ['app', 'lb', 'browser'],
      concept: 'http-https',
    },
    {
      id: 'render',
      title: 'Browser rendering',
      short: 'parse, layout, paint',
      group: null,
      cost: RENDER_MS,
      skipped: null,
      hops: [],
      at: 'browser',
      nodes: ['browser'],
    },
  ];

  return list.map(({ cost, ...stage }) => ({ ...stage, ms: stage.skipped ? 0 : cost }));
}

export const inScope = (stage: StagePlan, scope: Scope) => scope === 'all' || stage.group === scope;

const sumOf = (plans: StagePlan[], ids: StageId[]) =>
  plans.filter((stage) => ids.includes(stage.id)).reduce((sum, stage) => sum + stage.ms, 0);

export interface JourneyTotals {
  total: number;
  setup: number;
  backend: number;
  render: number;
  stages: number;
}

export function journeyTotals(plans: StagePlan[]): JourneyTotals {
  return {
    total: plans.reduce((sum, stage) => sum + stage.ms, 0),
    setup: sumOf(plans, ['dns-ask', 'dns-root', 'dns-tld', 'dns-auth', 'tcp', 'tls']),
    backend: sumOf(plans, ['lb', 'app', 'cache', 'db']),
    render: sumOf(plans, ['render']),
    stages: plans.filter((stage) => !stage.skipped).length,
  };
}
