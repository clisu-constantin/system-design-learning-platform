import { useCallback, useMemo, useRef, useState } from 'react';
import { Check, ListChecks, Sliders } from 'lucide-react';
import {
  ArchNode,
  DiagramCanvas,
  NodeStatRow,
  ParticleLegend,
  type DiagramEdge,
  type EdgeTone,
  type Layout,
  type ParticleView,
} from '@/components/architecture';
import { Insight, LabShell, MetricsPanel } from '@/components/learning';
import { Badge, SegmentedControl, Slider, Toggle } from '@/components/ui';
import { advanceParticles, nextParticleId, useEventLog, useTicker, type Particle } from '@/simulations/engine';
import { useRerender } from '@/hooks/useRerender';
import { sampleArrivals } from '@/utils/math';
import { formatCompact, formatNumber } from '@/utils/format';
import type { LabFocus, LabProps, NodeKind, RequestOutcome } from '@/types';

type Product = 'whatsapp' | 'instagram' | 'uber';

const PRODUCTS: { value: Product; label: string }[] = [
  { value: 'whatsapp', label: 'Design WhatsApp' },
  { value: 'instagram', label: 'Design Instagram' },
  { value: 'uber', label: 'Design Uber' },
];

/**
 * The kinds of traffic a requirement creates. Each one needs certain parts, and
 * the diagram is built from the union of them - so a part appears only when some
 * requirement sends traffic through it.
 */
type FlowKind =
  | 'write' // a user action stored in the database
  | 'read' // a user reads stored data
  | 'push' // the server pushes to a phone over a held-open connection
  | 'upload' // a file lands in object storage after processing
  | 'job' // slow work done later by background workers
  | 'index-sync' // workers keep a search index in step with the database
  | 'index-write' // the app writes straight into an in-memory index
  | 'index-read' // the app queries that index
  | 'call' // voice and video relayed by media servers
  | 'media'; // images, video or static files served by the CDN

type PartId = 'users' | 'cdn' | 'lb' | 'media' | 'objects' | 'api' | 'ws' | 'db' | 'async' | 'index' | 'cache' | 'region2';

const FLOW_PARTS: Record<FlowKind, PartId[]> = {
  write: ['api', 'db'],
  read: ['api', 'db'],
  push: ['api', 'ws'],
  upload: ['api', 'async', 'objects'],
  job: ['api', 'async', 'db'],
  'index-sync': ['api', 'async', 'index'],
  'index-write': ['api', 'index'],
  'index-read': ['api', 'index'],
  call: ['media'],
  media: ['cdn', 'objects'],
};

interface RequirementOption {
  id: string;
  label: string;
  /** How the part subtitles name this requirement. */
  short: string;
  core: boolean;
  /** What including this requirement forces into the architecture. */
  implication: string;
  flows: FlowKind[];
}

const REQUIREMENTS: Record<Product, RequirementOption[]> = {
  whatsapp: [
    { id: 'send', label: 'Send messages', short: 'send', core: true, implication: 'Durable message store plus an ordered write path per conversation', flows: ['write', 'read'] },
    { id: 'receive', label: 'Receive messages in real time', short: 'live delivery', core: true, implication: 'Persistent connections (WebSocket) and a connection registry', flows: ['push', 'read'] },
    { id: 'groups', label: 'Group conversations', short: 'group fan-out', core: true, implication: 'Fan-out on write or read, done by background workers', flows: ['job'] },
    { id: 'receipts', label: 'Delivery and read receipts', short: 'receipts', core: true, implication: 'A second message class and per-device state', flows: ['write', 'push'] },
    { id: 'images', label: 'Send images', short: 'images', core: false, implication: 'Object storage, a CDN and a processing pipeline', flows: ['upload', 'media'] },
    { id: 'calls', label: 'Voice and video calls', short: 'calls', core: false, implication: 'Media servers (TURN relays) and call signalling - a different system', flows: ['call', 'push'] },
    { id: 'stories', label: 'Stories', short: 'stories', core: false, implication: 'Ephemeral storage with a 24 hour TTL and a separate read path', flows: ['upload', 'media'] },
  ],
  instagram: [
    { id: 'upload', label: 'Upload a photo', short: 'upload', core: true, implication: 'Object storage for the file plus async thumbnailing', flows: ['upload', 'write'] },
    { id: 'feed', label: 'View a home feed', short: 'home feed', core: true, implication: 'Precomputed timelines - a join at read time will not hold up', flows: ['read', 'job'] },
    { id: 'follow', label: 'Follow accounts', short: 'follows', core: true, implication: 'A social graph, and the celebrity problem it brings', flows: ['write', 'read'] },
    { id: 'like', label: 'Like and comment', short: 'likes', core: true, implication: 'Denormalised counters updated asynchronously', flows: ['job'] },
    { id: 'search', label: 'Search users and tags', short: 'search', core: false, implication: 'A separate search index kept in sync via events', flows: ['index-sync', 'index-read'] },
    { id: 'dm', label: 'Direct messages', short: 'DMs', core: false, implication: 'A chat system - see the WhatsApp design', flows: ['write', 'push'] },
    { id: 'reels', label: 'Short video', short: 'video', core: false, implication: 'Video transcoding, adaptive bitrate, far more bandwidth', flows: ['upload', 'media'] },
  ],
  uber: [
    { id: 'location', label: 'Drivers publish location', short: 'locations', core: true, implication: 'Very high write rate into an in-memory geospatial index', flows: ['index-write'] },
    { id: 'request', label: 'Request a ride', short: 'ride requests', core: true, implication: 'A trip state machine with strong consistency', flows: ['write', 'read'] },
    { id: 'match', label: 'Match rider to driver', short: 'matching', core: true, implication: 'Cell-based proximity search, sharded by city', flows: ['index-read'] },
    { id: 'track', label: 'Track the trip live', short: 'live tracking', core: true, implication: 'Streaming updates to the rider app', flows: ['push'] },
    { id: 'pay', label: 'Automatic payment', short: 'payments', core: true, implication: 'Idempotent charges and a saga with compensation', flows: ['job', 'write'] },
    { id: 'pool', label: 'Ride pooling', short: 'pooling', core: false, implication: 'A much harder optimisation problem and shared trip state', flows: ['index-read', 'job'] },
    { id: 'schedule', label: 'Scheduled rides', short: 'scheduling', core: false, implication: 'A scheduler plus capacity forecasting', flows: ['job', 'write'] },
  ],
};

interface NfrSpec {
  id: NfrId;
  label: string;
  values: string[];
  /**
   * Implications per index. Levels 1+ accumulate; level 0 is the relaxed
   * baseline and is dropped as soon as the target is raised.
   */
  implications: string[][];
}

type NfrId = 'availability' | 'latency' | 'users' | 'consistency' | 'durability';
type Nfr = Record<NfrId, number>;

const NFRS: NfrSpec[] = [
  {
    id: 'availability',
    label: 'Availability',
    values: ['99%', '99.9%', '99.99%', '99.999%'],
    implications: [
      ['Single instance is acceptable', 'Manual recovery is fine'],
      ['Redundant instances behind a load balancer', 'Health checks and automated restarts'],
      ['Multi-zone deployment', 'Automated database failover', 'Replicated storage', 'On-call rotation with runbooks'],
      ['Multi-region active-active', 'Automated failover measured in seconds', 'No manual step in any recovery path', 'Usually requires weaker consistency'],
    ],
  },
  {
    id: 'latency',
    label: 'P95 latency',
    values: ['500 ms', '200 ms', '100 ms', '20 ms'],
    implications: [
      ['A straightforward database query per request is fine'],
      ['Indexes on every query path', 'Connection pooling'],
      ['Caching layer for hot reads', 'Denormalised read models', 'CDN for static content'],
      ['In-memory data for the hot path', 'Edge compute close to users', 'Precomputed answers - no joins at read time'],
    ],
  },
  {
    id: 'users',
    label: 'Daily active users',
    values: ['1k', '100k', '10M', '100M'],
    implications: [
      ['One server and one database'],
      ['Horizontal app tier', 'Read replicas'],
      ['Caching, sharding or a partitioned store', 'Async processing for anything slow', 'Capacity planning and autoscaling'],
      ['Multi-region', 'Sharded data with a routing layer', 'Dedicated platform and SRE investment'],
    ],
  },
  {
    id: 'consistency',
    label: 'Consistency',
    values: ['Eventual', 'Read-your-writes', 'Strong'],
    implications: [
      ['Replicas can serve all reads', 'Conflict resolution must be designed'],
      ['Route a user to the primary briefly after a write', 'Session-aware routing'],
      ['Quorum or leader reads', 'Higher write latency', 'Reduced availability during partitions (CP)'],
    ],
  },
  {
    id: 'durability',
    label: 'Durability',
    values: ['Best effort', 'Normal', 'Critical'],
    implications: [
      ['In-memory storage acceptable for some data'],
      ['Replicated storage', 'Daily backups'],
      ['Synchronous replication', 'Point-in-time recovery', 'Cross-region backups with tested restores'],
    ],
  },
];

const valueOf = (id: NfrId, level: number) => NFRS.find((spec) => spec.id === id)?.values[level] ?? '';

/** Which half of the controls is open: the feature checklist or the quality targets. */
type Panel = 'features' | 'targets';

interface Setup {
  product: Product;
  selected: Record<string, boolean>;
  nfr: Nfr;
  panel: Panel;
}

const coreOf = (product: Product) =>
  Object.fromEntries(REQUIREMENTS[product].filter((item) => item.core).map((item) => [item.id, true]));

const RELAXED: Nfr = { availability: 0, latency: 0, users: 0, consistency: 0, durability: 0 };

/** What the lab opens on at /labs/requirements: the core features at everyday targets. */
const DEFAULT_SETUP: Setup = {
  product: 'whatsapp',
  selected: coreOf('whatsapp'),
  nfr: { availability: 1, latency: 1, users: 1, consistency: 0, durability: 1 },
  panel: 'features',
};

/**
 * The Lab focus of each Concept that hosts this lab.
 * - What is System Design? starts from one requirement at relaxed targets, so the
 *   diagram is three boxes and every tick adds the parts that requirement forces.
 * - Functional Requirements opens on the feature checklist at the default targets.
 * - Non-Functional Requirements keeps the core features and opens on the quality
 *   sliders at their relaxed baseline, so every raised target adds parts.
 */
const FOCUS_SETUPS: Record<LabFocus<'requirements'>, Setup> = {
  'what-is-system-design': { ...DEFAULT_SETUP, selected: { send: true }, nfr: RELAXED },
  'functional-requirements': DEFAULT_SETUP,
  'non-functional-requirements': { ...DEFAULT_SETUP, nfr: RELAXED, panel: 'targets' },
};

// ---------------------------------------------------------------------------
// The architecture a setup forces
// ---------------------------------------------------------------------------

/**
 * Traffic model behind the server counts. Simplified, not a measurement: 20
 * requests per user per day, a peak of 5x the daily average, and about 1,000
 * requests per second per app server.
 */
const DAU = [1_000, 100_000, 10_000_000, 100_000_000];
const REQUESTS_PER_USER = 20;
const PEAK_FACTOR = 5;
const RPS_PER_SERVER = 1000;
/** Share of reads the cache answers and share of files the CDN serves from its edge. Illustrative. */
const CACHE_HIT = 0.8;
const CDN_HIT = 0.85;

interface PartView {
  id: PartId;
  kind: NodeKind;
  title: string;
  reasons: string[];
  stat?: { label: string; value: string; tone?: string };
}

interface Architecture {
  parts: Partial<Record<PartId, PartView>>;
  /** Traffic classes, one entry per requirement that creates them (a multiset). */
  flows: FlowKind[];
  region2: boolean;
  instances: number;
  peakRps: number;
  dbCopies: number;
  syncToRegion2: boolean;
  singlePoints: string[];
}

const PART_KIND: Record<PartId, NodeKind> = {
  users: 'client',
  cdn: 'cdn',
  lb: 'load-balancer',
  media: 'server',
  objects: 'storage',
  api: 'server',
  ws: 'service',
  db: 'sql',
  async: 'queue',
  index: 'search',
  cache: 'cache',
  region2: 'server',
};

const PART_TITLE: Record<PartId, string> = {
  users: 'Users',
  cdn: 'CDN',
  lb: 'Load balancer',
  media: 'Media servers',
  objects: 'Object storage',
  api: 'App server',
  ws: 'WebSocket tier',
  db: 'Database',
  async: 'Queue + workers',
  index: 'Index',
  cache: 'Cache',
  region2: 'Region 2',
};

function architecture(setup: Setup): Architecture {
  const { product, selected, nfr } = setup;
  const chosen = REQUIREMENTS[product].filter((option) => selected[option.id]);
  const parts: Partial<Record<PartId, PartView>> = {};
  const flows: FlowKind[] = [];
  const add = (id: PartId, reason: string) => {
    const part = parts[id] ?? (parts[id] = { id, kind: PART_KIND[id], title: PART_TITLE[id], reasons: [] });
    if (!part.reasons.includes(reason)) part.reasons.push(reason);
  };

  const peakRps = (DAU[nfr.users] * REQUESTS_PER_USER * PEAK_FACTOR) / 86_400;
  add('users', `${valueOf('users', nfr.users)} daily users`);

  if (chosen.length === 0) {
    return { parts, flows, region2: false, instances: 0, peakRps, dbCopies: 0, syncToRegion2: false, singlePoints: [] };
  }

  for (const option of chosen) {
    for (const flow of option.flows) {
      flows.push(flow);
      for (const id of FLOW_PARTS[flow]) add(id, option.short);
    }
  }

  const availability = valueOf('availability', nfr.availability);
  const users = `${valueOf('users', nfr.users)} users`;
  const latency = `p95 ${valueOf('latency', nfr.latency)}`;

  // Quality targets. Every requirement goes through the app servers, so they exist here.
  if (nfr.availability >= 1) add('lb', availability);
  if (nfr.users >= 1) add('lb', users);

  const region2 = nfr.availability >= 3 || nfr.users >= 3;
  if (nfr.availability >= 3) add('region2', availability);
  if (nfr.users >= 3) add('region2', users);

  if (nfr.latency >= 2) {
    // Static files (the app itself, images) served from the edge; object storage is the CDN origin.
    flows.push('media');
    add('cdn', latency);
    add('objects', 'CDN origin');
  }
  if (nfr.users >= 2) {
    // Anything slow (emails, notifications, exports) leaves the request path.
    flows.push('job');
    for (const id of FLOW_PARTS.job) add(id, users);
  }
  if (flows.includes('read')) {
    if (nfr.latency >= 2) add('cache', latency);
    if (nfr.users >= 2) add('cache', users);
  }

  // App tier size: enough copies for the availability target, enough servers for the load.
  const perRegion = region2 ? peakRps / 2 : peakRps;
  const instances = Math.max([1, 2, 3, 3][nfr.availability], nfr.users >= 1 ? 2 : 1, Math.ceil(perRegion / RPS_PER_SERVER));
  if (nfr.availability >= 1) add('api', availability);
  const api = parts.api;
  if (api) {
    api.title = instances > 1 ? `App servers x${instances}` : 'App server';
    api.stat = { label: 'Peak load', value: `~${formatCompact(perRegion)} req/s` };
  }
  if (parts.ws) parts.ws.title = instances > 1 ? `WebSocket x${instances}` : 'WebSocket server';

  let dbCopies = 0;
  const syncToRegion2 = region2 && nfr.consistency >= 2;
  if (parts.db) {
    const db = parts.db;
    const standby = nfr.availability >= 2 || nfr.durability >= 1 ? 1 : 0;
    const readReplicas = nfr.users >= 1 ? 2 : 0;
    const shards = [1, 1, 4, 16][nfr.users];
    dbCopies = 1 + standby + readReplicas;
    if (nfr.availability >= 2) add('db', `${availability} failover`);
    if (nfr.durability >= 1) add('db', `${valueOf('durability', nfr.durability).toLowerCase()} durability`);
    if (readReplicas > 0) add('db', users);
    db.title = shards > 1 ? `DB: ${shards} shards x${dbCopies}` : dbCopies > 1 ? `Database x${dbCopies}` : 'Database';
    db.stat = {
      label: 'Reads from',
      value:
        nfr.consistency === 2
          ? 'leader only'
          : readReplicas === 0
            ? 'primary'
            : nfr.consistency === 1
              ? 'own writes: primary'
              : 'any replica',
      tone: nfr.consistency === 0 && readReplicas > 0 ? 'text-warn' : 'text-ink',
    };
  }
  if (parts.index) {
    parts.index.title = product === 'uber' ? 'Geo index' : 'Search index';
    parts.index.kind = product === 'uber' ? 'nosql' : 'search';
  }
  if (parts.cache) parts.cache.stat = { label: 'Hit rate', value: `${CACHE_HIT * 100}% (model)`, tone: 'text-ok' };
  if (parts.cdn) parts.cdn.stat = { label: 'Edge hits', value: `${CDN_HIT * 100}% (model)`, tone: 'text-ok' };
  // Anything that fronts the whole system runs as a pair.
  if (parts.lb) parts.lb.title = 'Load balancer x2';

  const singlePoints: string[] = [];
  if (instances === 1) singlePoints.push(parts.ws ? 'app and WebSocket server' : 'app server');
  if (parts.db && dbCopies === 1) singlePoints.push('database');

  return { parts, flows, region2, instances, peakRps, dbCopies, syncToRegion2, singlePoints };
}

// ---------------------------------------------------------------------------
// Traffic
// ---------------------------------------------------------------------------

interface RouteVariant {
  route: string[];
  outcome: RequestOutcome;
  weight: number;
}

/** Every path one request of this kind can take, with its share. */
function routesFor(flow: FlowKind, arch: Architecture): RouteVariant[] {
  const { parts } = arch;
  const entry = parts.lb ? ['users', 'lb'] : ['users'];
  const viaApp = (tail: string[], outcome: RequestOutcome = 'success', weight = 1): RouteVariant => ({
    route: [...entry, 'api', ...tail],
    outcome,
    weight,
  });

  let variants: RouteVariant[];
  switch (flow) {
    case 'write':
      variants = [viaApp(['db'])];
      break;
    case 'read':
      variants = parts.cache
        ? [viaApp(['cache'], 'cache-hit', CACHE_HIT), viaApp(['db'], 'success', 1 - CACHE_HIT)]
        : [viaApp(['db'])];
      break;
    case 'upload':
      variants = [viaApp(['async', 'objects'])];
      break;
    case 'job':
      variants = [viaApp(['async', 'db'])];
      break;
    case 'index-sync':
      variants = [viaApp(['async', 'index'])];
      break;
    case 'index-write':
    case 'index-read':
      variants = [viaApp(['index'])];
      break;
    case 'push':
      // Server to phone over the held-open connection (through the load balancer when there is one).
      return [{ route: ['api', 'ws', ...(parts.lb ? ['lb'] : []), 'users'], outcome: 'success', weight: 1 }];
    case 'call':
      return [{ route: ['users', 'media'], outcome: 'success', weight: 1 }];
    case 'media':
      return [
        { route: ['users', 'cdn'], outcome: 'cache-hit', weight: CDN_HIT },
        { route: ['users', 'cdn', 'objects'], outcome: 'success', weight: 1 - CDN_HIT },
      ];
  }

  if (!arch.region2) return variants;
  // Two regions: DNS sends each user to the nearest one, so region 2 serves about half.
  return [
    { route: ['users', 'r2-users'], outcome: 'success', weight: 0.5 },
    ...variants.map((variant) => ({ ...variant, weight: variant.weight * 0.5 })),
  ];
}

function pick(variants: RouteVariant[]) {
  let roll = Math.random() * variants.reduce((sum, variant) => sum + variant.weight, 0);
  for (const variant of variants) {
    roll -= variant.weight;
    if (roll <= 0) return variant;
  }
  return variants[variants.length - 1];
}

function toneFor(a: string, b: string): EdgeTone {
  const pair = [a, b];
  if (pair.includes('ws')) return 'violet';
  if (pair.includes('async')) return 'info';
  if (pair.includes('cache') || pair.includes('cdn')) return 'ok';
  return 'brand';
}

/** One wire per pair of parts that some request actually travels between. */
function edgesFor(arch: Architecture): DiagramEdge[] {
  const edges = new Map<string, DiagramEdge>();
  const addEdge = (edge: DiagramEdge) => {
    const key = [edge.from, edge.to].sort().join('|');
    if (!edges.has(key)) edges.set(key, edge);
  };
  for (const flow of new Set(arch.flows)) {
    for (const { route } of routesFor(flow, arch)) {
      for (let index = 0; index < route.length - 1; index += 1) {
        const [from, to] = [route[index], route[index + 1]];
        if (to === 'r2-users') continue;
        addEdge({ from, to, tone: toneFor(from, to), width: 2 });
      }
    }
  }
  if (arch.region2) {
    addEdge({ from: 'users', to: 'r2-users', tone: 'brand', width: 2, label: 'nearest region' });
    if (arch.parts.db) addEdge({ from: 'db', to: 'r2-db', tone: 'info', width: 2, dashed: true });
  }
  return [...edges.values()];
}

// ---------------------------------------------------------------------------
// Layout: four columns (users | edge | app | data), fixed slots so a part always
// appears in the same place. Every wire runs between neighbouring slots or
// through an empty gap, so none passes under a card.
// ---------------------------------------------------------------------------

const H = 90;
const MID = 260;
const ROW = [104, 208, 312, 416];
const COL = [
  { x: 16, w: 152 },
  { x: 224, w: 176 },
  { x: 456, w: 196 },
  { x: 708, w: 236 },
];
const HEIGHT = 520;
const slot = (col: number, y: number) => ({ x: COL[col].x, y, w: COL[col].w, h: H });

const SLOTS: Record<Exclude<PartId, 'region2'>, { x: number; y: number; w: number; h: number }> = {
  users: slot(0, MID),
  cdn: slot(1, ROW[0]),
  lb: slot(1, MID),
  media: slot(0, ROW[3]),
  objects: slot(2, ROW[0]),
  api: slot(2, MID),
  ws: slot(2, ROW[3]),
  db: slot(3, ROW[0]),
  async: slot(3, ROW[1]),
  index: slot(3, ROW[2]),
  cache: slot(3, ROW[3]),
};

/** Region 2 is one band across the top: a collapsed copy of everything below it. */
const REGION2 = { x: 16, y: 10, w: 928, h: 74 };
/** Where the wires from Users and from the database meet that band. */
const REGION2_PORTS: Layout = {
  'r2-users': { x: COL[0].x, y: REGION2.y, w: COL[0].w, h: REGION2.h },
  'r2-db': { x: COL[3].x, y: REGION2.y, w: COL[3].w, h: REGION2.h },
};

const PART_ORDER: PartId[] = ['region2', 'users', 'cdn', 'lb', 'media', 'objects', 'api', 'ws', 'db', 'async', 'index', 'cache'];

const PARTICLE_BUDGET = 80;
/** Particles emitted per second: a sample that grows with the user count, not the real rate. */
const VISUAL_RATE = [5, 8, 12, 16];

interface State {
  particles: Particle[];
}

export function RequirementsLab({ focus }: LabProps<'requirements'>) {
  // The page keys this lab by Concept, so the focus never changes under a mounted lab.
  const start = focus ? FOCUS_SETUPS[focus] : DEFAULT_SETUP;
  // Every control lives in one object, so Reset cannot miss one.
  const [setup, setSetup] = useState<Setup>(start);
  const [running, setRunning] = useState(true);
  const state = useRef<State>({ particles: [] });
  const rerender = useRerender(30);
  const { events, log, clear } = useEventLog();

  const { product, selected, nfr, panel } = setup;
  const arch = useMemo(() => architecture(setup), [setup]);
  const edges = useMemo(() => edgesFor(arch), [arch]);
  const variants = useMemo(() => arch.flows.map((flow) => routesFor(flow, arch)), [arch]);
  const layout = useMemo<Layout>(() => {
    const placed: Layout = {};
    for (const id of PART_ORDER) {
      if (!arch.parts[id]) continue;
      if (id === 'region2') Object.assign(placed, REGION2_PORTS);
      else placed[id] = SLOTS[id];
    }
    return placed;
  }, [arch]);

  const options = REQUIREMENTS[product];
  const chosen = options.filter((option) => selected[option.id]);
  const scopeCreep = chosen.filter((option) => !option.core).length;

  /** Applies a new setup and logs which parts the change added or removed. */
  const commit = (next: Setup) => {
    const before = architecture(setup);
    const after = architecture(next);
    for (const id of PART_ORDER) {
      const was = before.parts[id];
      const now = after.parts[id];
      if (!was && now) log(`Added ${now.title} - for ${now.reasons.join(', ')}`, 'ok');
      else if (was && !now) log(`Removed ${was.title} - no requirement needs it now`, 'warn');
      else if (was && now && was.title !== now.title) log(`${was.title} became ${now.title}`, 'info');
    }
    // Drop requests travelling through parts that just disappeared.
    const alive = new Set<string>(PART_ORDER.filter((id) => after.parts[id]));
    if (after.region2) ['r2-users', 'r2-db'].forEach((id) => alive.add(id));
    state.current.particles = state.current.particles.filter((particle) => particle.route.every((id) => alive.has(id)));
    setSetup(next);
  };

  const reset = useCallback(() => {
    // Back to this Concept's starting setup, not the lab's global default.
    setSetup(start);
    state.current = { particles: [] };
    clear();
  }, [start, clear]);

  useTicker(running, (dt) => {
    const current = state.current;
    if (variants.length > 0) {
      const arrivals = sampleArrivals(VISUAL_RATE[nfr.users], dt);
      for (let index = 0; index < arrivals; index += 1) {
        const variant = pick(variants[Math.floor(Math.random() * variants.length)]);
        current.particles.push({
          id: nextParticleId(),
          route: variant.route,
          leg: 0,
          t: 0,
          speed: 1.2 + Math.random() * 0.3,
          outcome: variant.outcome,
        });
      }
    }
    const { alive, finished } = advanceParticles(current.particles, dt);
    // Writes that reach the database are copied to region 2.
    if (arch.region2) {
      for (const particle of finished) {
        if (particle.route[particle.route.length - 1] !== 'db' || Math.random() > 0.5) continue;
        alive.push({ id: nextParticleId(), route: ['db', 'r2-db'], leg: 0, t: 0, speed: 1.4, outcome: 'success' });
      }
    }
    current.particles = alive.length > PARTICLE_BUDGET ? alive.slice(-PARTICLE_BUDGET) : alive;
    rerender();
  });

  const implications = useMemo(() => {
    const set = new Set<string>();
    for (const spec of NFRS) {
      const level = nfr[spec.id] ?? 0;
      // Index 0 is the relaxed baseline ("single instance is acceptable"). It only
      // holds while the target stays at that level; stricter targets replace it.
      for (let index = level === 0 ? 0 : 1; index <= level; index += 1) {
        for (const item of spec.implications[index] ?? []) set.add(item);
      }
    }
    return [...set];
  }, [nfr]);

  const complexity = Math.min(
    100,
    Math.round(implications.length * 4 + chosen.length * 3 + scopeCreep * 6 + nfr.availability * 8 + nfr.users * 6),
  );

  const partCount = PART_ORDER.filter((id) => id !== 'users' && arch.parts[id]).length;

  const particleViews: ParticleView[] = state.current.particles.map((particle) => ({
    id: particle.id,
    from: particle.route[particle.leg],
    to: particle.route[particle.leg + 1],
    t: particle.t,
    outcome: particle.outcome ?? 'success',
  }));

  const toggleFeature = (id: string) => commit({ ...setup, selected: { ...selected, [id]: !selected[id] } });
  const setTarget = (id: NfrId) => (value: number) => commit({ ...setup, nfr: { ...nfr, [id]: value } });

  return (
    <LabShell
      title="Requirements Lab"
      description="Pick what the system must do, then set how well it must do it - and watch each choice add the parts it forces to the diagram."
      running={running}
      onToggleRun={() => setRunning((value) => !value)}
      onReset={reset}
      actions={
        <SegmentedControl
          value={product}
          options={PRODUCTS}
          onChange={(value) => commit({ ...setup, product: value, selected: coreOf(value) })}
        />
      }
      legend={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ParticleLegend outcomes={['success', 'cache-hit']} />
          <span className="text-[11px] text-muted">
            Violet wires: pushes to phones. Cyan: background work. Dashed: copy to region 2. Server counts and hit
            rates are a simplified model.
          </span>
        </div>
      }
      events={events}
      insight={<Insight>{insightFor(setup, arch, implications.length, scopeCreep)}</Insight>}
      metrics={
        <>
          <MetricsPanel
            items={[
              { key: 'chosen', label: 'Requirements', value: chosen.length, hint: 'Features in scope.' },
              {
                key: 'parts',
                label: 'Parts on diagram',
                value: partCount,
                tone: 'brand',
                hint: 'Boxes the requirements forced, not counting the users. Each one is built, paid for and operated.',
              },
              {
                key: 'spof',
                label: 'Single points',
                value: chosen.length === 0 ? '-' : arch.singlePoints.length,
                tone: chosen.length === 0 ? 'neutral' : arch.singlePoints.length > 0 ? 'warn' : 'ok',
                hint:
                  arch.singlePoints.length > 0
                    ? `Parts with one copy, so their failure stops the system: ${arch.singlePoints.join(', ')}.`
                    : 'Parts with only one copy, so their failure stops the system.',
              },
              {
                key: 'creep',
                label: 'Beyond core',
                value: scopeCreep,
                tone: scopeCreep > 1 ? 'warn' : 'neutral',
                hint: 'Each of these is a subsystem with its own scaling story.',
              },
              {
                key: 'implications',
                label: 'Forced decisions',
                value: implications.length,
                tone: 'brand',
                hint: 'Architecture consequences implied by your quality targets.',
              },
              {
                key: 'complexity',
                label: 'Complexity score',
                // With no functional requirement there is nothing to design, so no score.
                value: chosen.length === 0 ? '-' : complexity,
                tone: chosen.length === 0 ? 'neutral' : complexity > 70 ? 'danger' : complexity > 40 ? 'warn' : 'ok',
                hint: 'An educational heuristic, not an engineering measurement.',
              },
              {
                key: 'peak',
                label: 'Peak traffic',
                value: formatNumber(arch.peakRps),
                unit: 'req/s',
                hint: `${valueOf('users', nfr.users)} daily users x ${REQUESTS_PER_USER} requests each, spread over a day, times ${PEAK_FACTOR} for the peak.`,
                simulated: true,
              },
              {
                key: 'users',
                label: 'Target scale',
                value: valueOf('users', nfr.users),
                hint: 'Daily active users you are designing for.',
              },
            ]}
          />

          <div className="card p-4">
            <p className="label mb-3 flex items-center gap-2">
              <Sliders className="h-3.5 w-3.5" /> Architecture consequences
            </p>
            {implications.length === 0 ? (
              <p className="text-sm text-muted">Move a slider to see what it implies.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {implications.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-ok" />
                    {item}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-faint">
              Every line here costs money and operational effort. That is the point of naming the target first: it makes
              the price visible before anyone builds.
            </p>
          </div>

          <div className="card p-4">
            <p className="label mb-2">Scope summary</p>
            <p className="text-sm text-muted">
              {chosen.length === 0
                ? 'Nothing selected - with no functional requirements there is nothing to design.'
                : `Designing for ${chosen.length} requirement${chosen.length > 1 ? 's' : ''} at ${valueOf('users', nfr.users)} daily active users (about ${formatCompact(
                    DAU[nfr.users] * REQUESTS_PER_USER,
                  )} requests/day at ${REQUESTS_PER_USER} requests per user).`}
            </p>
          </div>
        </>
      }
      controls={
        <>
          <SegmentedControl
            size="sm"
            className="w-full"
            value={panel}
            options={[
              { value: 'features', label: 'What it must do' },
              { value: 'targets', label: 'How well' },
            ]}
            onChange={(value) => setSetup((current) => ({ ...current, panel: value }))}
          />

          {panel === 'features' ? (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-xs font-medium text-muted">
                <ListChecks className="h-3.5 w-3.5 text-brand" /> Functional requirements
              </p>
              {options.map((option) => (
                <Toggle
                  key={option.id}
                  checked={Boolean(selected[option.id])}
                  onChange={() => toggleFeature(option.id)}
                  label={
                    <>
                      <span className="text-ink">{option.label}</span>
                      {option.core ? <Badge tone="ok">core</Badge> : <Badge>extra</Badge>}
                    </>
                  }
                  description={option.implication}
                />
              ))}
            </div>
          ) : (
            <>
              <p className="text-xs font-medium text-muted">Non-functional targets</p>
              {NFRS.map((spec) => (
                <Slider
                  key={spec.id}
                  label={spec.label}
                  value={nfr[spec.id]}
                  min={0}
                  max={spec.values.length - 1}
                  onChange={setTarget(spec.id)}
                  format={(value) => spec.values[value]}
                  scale={[spec.values[0], spec.values[spec.values.length - 1]]}
                  tone={nfr[spec.id] >= spec.values.length - 1 ? 'danger' : 'brand'}
                />
              ))}
              <div className="rounded-xl border border-line bg-elevated p-3 text-[11px] text-muted">
                <p className="label mb-2">Availability in practice</p>
                <ul className="space-y-0.5 font-mono">
                  <li>99% {'->'} 3.65 days down/year</li>
                  <li>99.9% {'->'} 8.8 hours</li>
                  <li>99.99% {'->'} 52 minutes</li>
                  <li>99.999% {'->'} 5.3 minutes</li>
                </ul>
              </div>
            </>
          )}
        </>
      }
    >
      <DiagramCanvas
        layout={layout}
        edges={edges}
        particles={particleViews}
        height={HEIGHT}
        className="bg-canvas"
        underlay={<Zones nfr={nfr} region2={arch.region2} empty={chosen.length === 0} />}
      >
        {arch.parts.region2 ? (
          <ArchNode
            key="region2"
            kind="server"
            title="Region 2"
            subtitle={`Full copy of region 1 below, data copied ${arch.syncToRegion2 ? 'synchronously' : 'asynchronously'} - for ${arch.parts.region2.reasons.join(', ')}`}
            placed={REGION2}
            compact
          />
        ) : null}
        {PART_ORDER.filter((id) => id !== 'region2').map((id) => {
          const part = arch.parts[id];
          if (!part) return null;
          return (
            <ArchNode
              key={id}
              kind={part.kind}
              title={part.title}
              subtitle={id === 'users' ? part.reasons[0] : `for ${part.reasons.join(', ')}`}
              placed={SLOTS[id]}
              compact
            >
              {part.stat ? <NodeStatRow label={part.stat.label} value={part.stat.value} tone={part.stat.tone} /> : null}
            </ArchNode>
          );
        })}
      </DiagramCanvas>
    </LabShell>
  );
}

/** The data center or zones everything runs in, drawn under the wiring. */
function Zones({ nfr, region2, empty }: { nfr: Nfr; region2: boolean; empty: boolean }) {
  if (empty) {
    return (
      <text x={560} y={MID + 50} textAnchor="middle" className="fill-faint" style={{ fontSize: 13 }}>
        Nothing is required yet, so nothing is built. Tick a requirement.
      </text>
    );
  }
  return (
    <g>
      <rect x={8} y={96} width={944} height={HEIGHT - 104} rx={14} className="fill-info/5 stroke-line" strokeDasharray="4 4" />
      <text x={24} y={ROW[0] + 16} className="fill-faint font-mono" style={{ fontSize: 11 }}>
        {region2 ? 'REGION 1' : 'ONE REGION'}
      </text>
      <text x={24} y={ROW[0] + 30} className="fill-faint font-mono" style={{ fontSize: 11 }}>
        {nfr.availability >= 2 ? '3 ZONES' : 'ONE ZONE'}
      </text>
    </g>
  );
}

function insightFor(setup: Setup, arch: Architecture, forced: number, scopeCreep: number) {
  const chosen = REQUIREMENTS[setup.product].filter((option) => setup.selected[option.id]);
  if (chosen.length === 0) {
    return <>No requirement, no system: the diagram holds only the users. Tick a feature to see the first parts appear.</>;
  }
  const parts = PART_ORDER.filter((id) => id !== 'users' && arch.parts[id]).length;
  return (
    <>
      Functional requirements decide <strong className="text-ink">what the system does</strong>, and each one pulls in
      the parts its traffic needs - every box names the requirement that forced it. Non-functional requirements decide{' '}
      <strong className="text-ink">how well</strong>: they add copies, caches and regions. Right now {chosen.length}{' '}
      requirement{chosen.length > 1 ? 's' : ''} and your quality targets force {parts} part{parts === 1 ? '' : 's'} and{' '}
      {forced} structural decision{forced === 1 ? '' : 's'}.
      {arch.singlePoints.length > 0 ? (
        <> Still one copy of: {arch.singlePoints.join(', ')} - fine at 99%, not above it.</>
      ) : null}
      {scopeCreep > 0 ? (
        <>
          {' '}
          You have also included {scopeCreep} non-core feature{scopeCreep > 1 ? 's' : ''} - each one is a separate
          subsystem, not a checkbox.
        </>
      ) : null}
    </>
  );
}

export default RequirementsLab;
