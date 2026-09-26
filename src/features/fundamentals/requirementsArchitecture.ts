/**
 * The Requirements Lab picture as data: which parts a setup forces, how big they are, the routes
 * its traffic takes, the wires those routes draw, the legend for them and the forced decisions.
 * The component only lays it out and animates it.
 *
 * Pure: no React and only relative imports, so `npm test` runs it.
 */
import type { DiagramEdge, EdgeTone } from '../../components/architecture/DiagramCanvas.tsx';
import type { LabFocus, NodeKind, RequestOutcome } from '../../types/index.ts';
import { formatCompact } from '../../utils/format.ts';
import {
  CACHE_HIT,
  DAU,
  scaleImplications,
  sizeRequirements,
  type Product,
  type Sizing,
  type TierSize,
} from './requirementsSizing.ts';

/**
 * The kinds of traffic a requirement creates. Each one needs certain parts, and
 * the diagram is built from the union of them - so a part appears only when some
 * requirement sends traffic through it.
 */
export type FlowKind =
  | 'write' // a user action stored in the database
  | 'read' // a user reads stored data
  | 'push' // the server pushes to a phone over a held-open connection
  | 'fan-out' // workers deliver one message to every member of a group, over their connections
  | 'upload' // a file goes through the app server into object storage
  | 'process' // a queued job turns the stored file into thumbnails or other sizes
  | 'job' // slow work done later by background workers
  | 'index-sync' // workers keep a search index in step with the database
  | 'index-write' // the app writes straight into an in-memory index
  | 'index-read' // the app queries that index
  | 'call' // voice and video relayed by media servers
  | 'media'; // images, video or static files served by the CDN

export type PartId =
  | 'users'
  | 'cdn'
  | 'lb'
  | 'media'
  | 'objects'
  | 'api'
  | 'ws'
  | 'db'
  | 'async'
  | 'index'
  | 'cache'
  | 'region2';

const FLOW_PARTS: Record<FlowKind, PartId[]> = {
  write: ['api', 'db'],
  read: ['api', 'db'],
  push: ['api', 'ws'],
  'fan-out': ['api', 'async', 'ws'],
  upload: ['api', 'objects'],
  process: ['api', 'async', 'objects'],
  job: ['api', 'async', 'db'],
  'index-sync': ['api', 'async', 'index'],
  'index-write': ['api', 'index'],
  'index-read': ['api', 'index'],
  call: ['media'],
  media: ['cdn', 'objects'],
};

/** Flows that store something in the database - the only traffic copied to region 2. */
export const WRITE_FLOWS: ReadonlySet<FlowKind> = new Set<FlowKind>(['write', 'job']);

export interface RequirementOption {
  id: string;
  label: string;
  /** How the part subtitles name this requirement. */
  short: string;
  core: boolean;
  /** What including this requirement forces into the architecture. */
  implication: string;
  flows: FlowKind[];
}

export const REQUIREMENTS: Record<Product, RequirementOption[]> = {
  whatsapp: [
    { id: 'send', label: 'Send messages', short: 'send', core: true, implication: 'Durable message store plus an ordered write path per conversation', flows: ['write', 'read'] },
    { id: 'receive', label: 'Receive messages in real time', short: 'live delivery', core: true, implication: 'Persistent connections (WebSocket) and a connection registry', flows: ['push', 'read'] },
    { id: 'groups', label: 'Group conversations', short: 'group fan-out', core: true, implication: 'Fan-out on write or read, done by background workers', flows: ['fan-out'] },
    { id: 'receipts', label: 'Delivery and read receipts', short: 'receipts', core: true, implication: 'A second message class and per-device state', flows: ['write', 'push'] },
    { id: 'images', label: 'Send images', short: 'images', core: false, implication: 'Object storage, a CDN and a processing pipeline', flows: ['upload', 'process', 'media'] },
    { id: 'calls', label: 'Voice and video calls', short: 'calls', core: false, implication: 'Media servers (TURN relays) and call signalling - a different system', flows: ['call', 'push'] },
    { id: 'stories', label: 'Stories', short: 'stories', core: false, implication: 'Ephemeral storage with a 24 hour TTL and a separate read path', flows: ['upload', 'media'] },
  ],
  instagram: [
    { id: 'upload', label: 'Upload a photo', short: 'upload', core: true, implication: 'Object storage for the file plus async thumbnailing', flows: ['upload', 'process', 'write'] },
    { id: 'feed', label: 'View a home feed', short: 'home feed', core: true, implication: 'Precomputed timelines - a join at read time will not hold up', flows: ['read', 'job'] },
    { id: 'follow', label: 'Follow accounts', short: 'follows', core: true, implication: 'A social graph, and the celebrity problem it brings', flows: ['write', 'read'] },
    { id: 'like', label: 'Like and comment', short: 'likes', core: true, implication: 'Denormalised counters updated asynchronously', flows: ['job'] },
    { id: 'search', label: 'Search users and tags', short: 'search', core: false, implication: 'A separate search index kept in sync via events', flows: ['index-sync', 'index-read'] },
    { id: 'dm', label: 'Direct messages', short: 'DMs', core: false, implication: 'A chat system - see the WhatsApp design', flows: ['write', 'push'] },
    { id: 'reels', label: 'Short video', short: 'video', core: false, implication: 'Video transcoding, adaptive bitrate, far more bandwidth', flows: ['upload', 'process', 'media'] },
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

// ---------------------------------------------------------------------------
// Quality targets
// ---------------------------------------------------------------------------

export type NfrId = 'availability' | 'latency' | 'users' | 'consistency' | 'durability';
export type Nfr = Record<NfrId, number>;

/**
 * Something a forced-decision line talks about. A line is shown only while it is on the diagram,
 * so no line names a part that is not drawn.
 */
type Needs = 'db' | 'cache' | 'cdn' | 'replicas' | 'one-read-copy' | 'region2';

type Implication = string | { text: string; needs: Needs };

export interface NfrSpec {
  id: NfrId;
  label: string;
  values: string[];
  /**
   * Implications per index. Levels 1+ accumulate; level 0 is the relaxed
   * baseline and is dropped as soon as the target is raised.
   */
  implications: Implication[][];
}

export const NFRS: NfrSpec[] = [
  {
    id: 'availability',
    label: 'Availability',
    values: ['99%', '99.9%', '99.99%', '99.999%'],
    implications: [
      ['Single instance is acceptable', 'Manual recovery is fine'],
      ['Redundant instances behind a load balancer', 'Health checks and automated restarts'],
      [
        'Multi-zone deployment',
        { text: 'Automated database failover', needs: 'db' },
        { text: 'A standby database copy', needs: 'db' },
        'On-call rotation with runbooks',
      ],
      ['Multi-region active-active', 'Automated failover measured in seconds', 'No manual step in any recovery path', 'Usually requires weaker consistency'],
    ],
  },
  {
    id: 'latency',
    label: 'P95 latency',
    values: ['500 ms', '200 ms', '100 ms', '20 ms'],
    implications: [
      [{ text: 'A straightforward database query per request is fine', needs: 'db' }],
      [{ text: 'Indexes on every query path', needs: 'db' }, { text: 'Connection pooling', needs: 'db' }],
      [
        { text: 'Caching layer for hot reads', needs: 'cache' },
        { text: 'Denormalised read models', needs: 'db' },
        { text: 'CDN for images and static files', needs: 'cdn' },
      ],
      ['In-memory data for the hot path', 'Edge compute close to users', 'Precomputed answers - no joins at read time'],
    ],
  },
  {
    id: 'users',
    label: 'Daily active users',
    values: ['1k', '100k', '10M', '100M'],
    // Read from the sizing instead (`scaleImplications`): what a user count forces depends on the
    // traffic of the product, so fixed lines would name replicas the diagram does not draw.
    implications: [],
  },
  {
    id: 'consistency',
    label: 'Consistency',
    values: ['Eventual', 'Read-your-writes', 'Strong'],
    implications: [
      [
        { text: 'Replicas can serve all reads', needs: 'replicas' },
        { text: 'Conflict resolution between regions must be designed', needs: 'region2' },
        { text: 'Reads come from one copy, so they already see the latest write', needs: 'one-read-copy' },
      ],
      [
        { text: 'Route a user to the primary briefly after a write', needs: 'replicas' },
        { text: 'Session-aware routing', needs: 'replicas' },
        { text: 'Reads come from one copy, so they already see the latest write', needs: 'one-read-copy' },
      ],
      [
        { text: 'Quorum or leader reads', needs: 'replicas' },
        { text: 'Higher write latency', needs: 'replicas' },
        { text: 'Synchronous copy to region 2: higher write latency', needs: 'region2' },
        { text: 'Reduced availability during partitions (CP)', needs: 'replicas' },
        { text: 'Reads come from one copy, so they already see the latest write', needs: 'one-read-copy' },
      ],
    ],
  },
  {
    id: 'durability',
    label: 'Durability',
    values: ['Best effort', 'Normal', 'Critical'],
    implications: [
      ['In-memory storage acceptable for some data'],
      [{ text: 'Replicated disks under the database', needs: 'db' }, { text: 'Daily backups', needs: 'db' }],
      [
        { text: 'Synchronous replication to a standby', needs: 'db' },
        { text: 'Point-in-time recovery', needs: 'db' },
        { text: 'Cross-region backups with tested restores', needs: 'db' },
      ],
    ],
  },
];

export const valueOf = (id: NfrId, level: number) => NFRS.find((spec) => spec.id === id)?.values[level] ?? '';

// ---------------------------------------------------------------------------
// Setups and Lab focuses
// ---------------------------------------------------------------------------

/** Which half of the controls is open: the feature checklist or the quality targets. */
export type Panel = 'features' | 'targets';

/** What a switch of product ticks: every core feature, or only the first one. */
export type Start = 'core' | 'first';

export interface Setup {
  product: Product;
  selected: Record<string, boolean>;
  nfr: Nfr;
  panel: Panel;
  start: Start;
}

export const coreOf = (product: Product) =>
  Object.fromEntries(REQUIREMENTS[product].filter((item) => item.core).map((item) => [item.id, true]));

const firstOf = (product: Product): Record<string, boolean> => {
  const first = REQUIREMENTS[product].find((item) => item.core);
  return first ? { [first.id]: true } : {};
};

const selectionFor = (product: Product, start: Start) => (start === 'core' ? coreOf(product) : firstOf(product));

/** Every target at its lowest, except durability: a message store is durable from the start. */
export const RELAXED: Nfr = { availability: 0, latency: 0, users: 0, consistency: 0, durability: 1 };

/** What the lab opens on at /labs/requirements: the core features at everyday targets. */
export const DEFAULT_SETUP: Setup = {
  product: 'whatsapp',
  selected: coreOf('whatsapp'),
  nfr: { availability: 1, latency: 1, users: 1, consistency: 0, durability: 1 },
  panel: 'features',
  start: 'core',
};

/**
 * The Lab focus of each Concept that hosts this lab.
 * - What is System Design? starts from one requirement at relaxed targets, so the
 *   diagram is three boxes and every tick adds the parts that requirement forces.
 * - Functional Requirements opens on the feature checklist at the default targets.
 * - Non-Functional Requirements keeps the core features and opens on the quality
 *   sliders at their relaxed baseline, so every raised target adds parts.
 */
export const FOCUS_SETUPS: Record<LabFocus<'requirements'>, Setup> = {
  'what-is-system-design': { ...DEFAULT_SETUP, selected: firstOf('whatsapp'), nfr: RELAXED, start: 'first' },
  'functional-requirements': DEFAULT_SETUP,
  'non-functional-requirements': { ...DEFAULT_SETUP, nfr: RELAXED, panel: 'targets' },
};

/**
 * Another product, with the features the focus starts from for it - so a focus that opens on one
 * requirement still has one after switching away and back. The targets stay as they are.
 */
export function switchProduct(setup: Setup, product: Product): Setup {
  return { ...setup, product, selected: selectionFor(product, setup.start) };
}

// ---------------------------------------------------------------------------
// The architecture a setup forces
// ---------------------------------------------------------------------------

/** Share of files the CDN serves from its edge. Illustrative. */
export const CDN_HIT = 0.85;

export interface PartView {
  id: PartId;
  kind: NodeKind;
  title: string;
  reasons: string[];
  stat?: { label: string; value: string; tone?: string };
  /** Replaces the status line, e.g. the database decision. */
  status?: string;
}

export interface Architecture {
  parts: Partial<Record<PartId, PartView>>;
  /** Traffic classes, one entry per requirement that creates them (a multiset). */
  flows: FlowKind[];
  region2: boolean;
  /** Availability zones region 1 runs in: one, or three from 99.99% up. */
  zones: 1 | 3;
  sizing: Sizing;
  /** Database copies per partition: the primary, a standby and read replicas. */
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

/** The parts in the order they are laid out and logged. */
export const PART_ORDER: PartId[] = ['region2', 'users', 'cdn', 'lb', 'media', 'objects', 'api', 'ws', 'db', 'async', 'index', 'cache'];

export const chosenOf = (setup: Setup) => REQUIREMENTS[setup.product].filter((option) => setup.selected[option.id]);

export function architecture(setup: Setup): Architecture {
  const { product, nfr } = setup;
  const chosen = chosenOf(setup);
  const parts: Partial<Record<PartId, PartView>> = {};
  const flows: FlowKind[] = [];
  const add = (id: PartId, reason: string) => {
    const part = parts[id] ?? (parts[id] = { id, kind: PART_KIND[id], title: PART_TITLE[id], reasons: [] });
    if (!part.reasons.includes(reason)) part.reasons.push(reason);
  };

  const sizeFor = (cache: boolean) =>
    sizeRequirements({
      product,
      dau: DAU[nfr.users],
      availability: nfr.availability,
      locationWrites: chosen.some((option) => option.flows.includes('index-write')),
      cache,
    });
  add('users', `${valueOf('users', nfr.users)} daily users`);
  const zones = nfr.availability >= 2 ? 3 : 1;

  if (chosen.length === 0) {
    return { parts, flows, region2: false, zones, sizing: sizeFor(false), dbCopies: 0, syncToRegion2: false, singlePoints: [] };
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

  const cached = flows.includes('read') && (nfr.latency >= 2 || nfr.users >= 2);
  const sizing = sizeFor(cached);
  const { app, ws, database } = sizing;

  // Quality targets. Every requirement goes through the app servers, so they exist here.
  // A load balancer fronts more than one server: for the availability target or for the load.
  if (nfr.availability >= 1) add('lb', availability);
  if (app.forLoad > 1) add('lb', users);

  const region2 = nfr.availability >= 3 || nfr.users >= 3;
  if (nfr.availability >= 3) add('region2', availability);
  if (nfr.users >= 3) add('region2', users);

  // A tight latency target serves files from the edge - but only when a feature sends files.
  if (nfr.latency >= 2 && parts.cdn) add('cdn', latency);
  if (nfr.users >= 2) {
    // Anything slow (emails, notifications, exports) leaves the request path.
    flows.push('job');
    for (const id of FLOW_PARTS.job) add(id, users);
  }
  if (cached) {
    if (nfr.latency >= 2) add('cache', latency);
    if (nfr.users >= 2) add('cache', users);
  }

  // App tier size: the Capacity Lab count for the load, or the copies the availability target asks
  // for when that is more. Each region is a full copy, sized to take all traffic if the other fails.
  if (nfr.availability >= 1) add('api', availability);
  if (parts.api) {
    parts.api.title = app.count > 1 ? `App servers x${app.count}` : 'App server';
    parts.api.stat = tierStat(app, availability, { label: 'Peak load', value: `${about(sizing.peakQps)} req/s` });
  }
  // The WebSocket tier holds connections open, so it is sized by how many, not by requests.
  if (parts.ws) {
    parts.ws.title = ws.count > 1 ? `WebSocket x${ws.count}` : 'WebSocket server';
    parts.ws.stat = tierStat(ws, availability, { label: 'Open connections', value: about(ws.connections) });
  }

  let dbCopies = 0;
  const syncToRegion2 = region2 && nfr.consistency >= 2;
  if (parts.db) {
    const db = parts.db;
    // A standby for automated failover (99.99%) or for synchronous replication (critical durability).
    const standby = nfr.availability >= 2 || nfr.durability >= 2 ? 1 : 0;
    const { readReplicas, partitioned, partitions } = database;
    dbCopies = 1 + standby + readReplicas;
    if (nfr.availability >= 2) add('db', `${availability} failover`);
    if (nfr.durability >= 2) add('db', `${valueOf('durability', nfr.durability).toLowerCase()} durability`);
    if (readReplicas > 0 || partitioned) add('db', users);
    db.title = partitioned ? `DB: ${partitions} partitions x${dbCopies}` : dbCopies > 1 ? `Database x${dbCopies}` : 'Database';
    db.stat = {
      label: 'Peak writes',
      value: `${about(database.peakWriteQps)}/s`,
      tone: partitioned ? 'text-warn' : 'text-ink',
    };
    // With replicas, where reads go is the consistency choice; without, the Capacity Lab decision.
    db.status =
      readReplicas > 0
        ? ['Reads: any replica', 'Reads: own writes on primary', 'Reads: leader only'][nfr.consistency]
        : partitioned
          ? 'Partition the writes'
          : 'One primary is enough';
  }
  if (parts.index) {
    parts.index.title = product === 'uber' ? 'Geo index' : 'Search index';
    parts.index.kind = product === 'uber' ? 'nosql' : 'search';
    // Drivers publishing locations: the write rate that sets Uber apart.
    if (sizing.index.peakWriteQps > 0) {
      parts.index.stat = { label: 'Peak writes', value: `${about(sizing.index.peakWriteQps)}/s`, tone: 'text-warn' };
    }
  }
  if (parts.cache) parts.cache.stat = { label: 'Hit rate', value: `${CACHE_HIT * 100}% (model)`, tone: 'text-ok' };
  if (parts.cdn) parts.cdn.stat = { label: 'Edge hits', value: `${CDN_HIT * 100}% (model)`, tone: 'text-ok' };
  // Anything that fronts the whole system runs as a pair.
  if (parts.lb) parts.lb.title = 'Load balancer x2';

  const singlePoints: string[] = [];
  if (app.count === 1) singlePoints.push('app server');
  if (parts.ws && ws.count === 1) singlePoints.push('WebSocket server');
  if (parts.db && dbCopies === 1) singlePoints.push('database');

  return { parts, flows, region2, zones, sizing, dbCopies, syncToRegion2, singlePoints };
}

/** A model number on a stat row: "~12", "~11.6K", or "<1" rather than "~0" for a trickle. */
const about = (value: number) => (value < 1 ? '<1' : `~${formatCompact(value)}`);

/**
 * The stat row of a sized tier: its load, or - when the availability target asked for more copies
 * than the load needs - how many are for the load and how many for availability.
 */
function tierStat(tier: TierSize, availability: string, load: { label: string; value: string }) {
  if (tier.setBy === 'load') return load;
  return { label: `${tier.forLoad} for load`, value: `+${tier.count - tier.forLoad} for ${availability}` };
}

/**
 * A part subtitle names the first requirement that forced it and counts the rest ("for send +3
 * more"), so it never runs past its box. Users and Region 2 describe themselves instead.
 */
export function subtitleFor(part: PartView, arch: Architecture): string {
  if (part.id === 'users') return part.reasons[0] ?? '';
  if (part.id === 'region2') {
    return `Full copy of region 1 below, sized to take all traffic, writes copied ${arch.syncToRegion2 ? 'synchronously' : 'asynchronously'} - for ${part.reasons.join(', ')}`;
  }
  const [first, ...rest] = part.reasons;
  return rest.length > 0 ? `for ${first} +${rest.length} more` : `for ${first}`;
}

// ---------------------------------------------------------------------------
// Forced decisions
// ---------------------------------------------------------------------------

function isDrawn(needs: Needs, arch: Architecture) {
  const replicas = Boolean(arch.parts.db) && arch.sizing.database.readReplicas > 0;
  switch (needs) {
    case 'db':
      return Boolean(arch.parts.db);
    case 'cache':
      return Boolean(arch.parts.cache);
    case 'cdn':
      return Boolean(arch.parts.cdn);
    case 'replicas':
      return replicas;
    case 'one-read-copy':
      return Boolean(arch.parts.db) && !replicas && !arch.region2;
    case 'region2':
      return arch.region2;
  }
}

/** The structural decisions the quality targets force, naming only parts that are drawn. */
export function implicationsFor(setup: Setup, arch: Architecture): string[] {
  if (chosenOf(setup).length === 0) return [];
  const lines = new Set<string>();
  for (const spec of NFRS) {
    const level = setup.nfr[spec.id] ?? 0;
    if (spec.id === 'users') {
      for (const line of scaleImplications(arch.sizing, level, Boolean(arch.parts.db))) lines.add(line);
      continue;
    }
    // Index 0 is the relaxed baseline ("single instance is acceptable"). It only
    // holds while the target stays at that level; stricter targets replace it.
    for (let index = level === 0 ? 0 : 1; index <= level; index += 1) {
      for (const item of spec.implications[index] ?? []) {
        if (typeof item === 'string') lines.add(item);
        else if (isDrawn(item.needs, arch)) lines.add(item.text);
      }
    }
  }
  return [...lines];
}

// ---------------------------------------------------------------------------
// Traffic
// ---------------------------------------------------------------------------

export interface RouteVariant {
  route: string[];
  outcome: RequestOutcome;
  weight: number;
}

/** Every path one request of this kind can take, with its share. */
export function routesFor(flow: FlowKind, arch: Architecture): RouteVariant[] {
  const { parts } = arch;
  const entry = parts.lb ? ['users', 'lb'] : ['users'];
  const toPhones = ['ws', ...(parts.lb ? ['lb'] : []), 'users'];
  const viaApp = (tail: string[], outcome: RequestOutcome = 'success', weight = 1): RouteVariant => ({
    route: [...entry, 'api', ...tail],
    outcome,
    weight,
  });
  // Region 2 keeps a copy of every write: a stored write carries on along the dashed wire.
  const stored = (tail: string[]) => (arch.region2 && tail[tail.length - 1] === 'db' ? [...tail, 'r2-db'] : tail);

  let variants: RouteVariant[];
  switch (flow) {
    case 'write':
      variants = [viaApp(stored(['db']))];
      break;
    case 'read':
      variants = parts.cache
        ? [viaApp(['cache'], 'cache-hit', CACHE_HIT), viaApp(['db'], 'success', 1 - CACHE_HIT)]
        : [viaApp(['db'])];
      break;
    case 'upload':
      variants = [viaApp(['objects'])];
      break;
    case 'process':
      // The stored file is processed later; the worker writes the new sizes back to object storage.
      variants = [viaApp(['async', 'objects'])];
      break;
    case 'fan-out':
      // Workers hand one copy of a group message to the connection of every member.
      variants = [viaApp(['async', ...toPhones])];
      break;
    case 'job':
      variants = [viaApp(['async', ...stored(['db'])])];
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
      return [{ route: ['api', ...toPhones], outcome: 'success', weight: 1 }];
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

function toneFor(a: string, b: string): EdgeTone {
  const pair = [a, b];
  if (pair.includes('ws')) return 'violet';
  if (pair.includes('async')) return 'info';
  if (pair.includes('cache') || pair.includes('cdn')) return 'ok';
  return 'brand';
}

/** Region 2 is drawn as one band; these are where wires meet it, not parts of region 1. */
const REGION2_PORTS = new Set(['r2-users', 'r2-db']);

/** One wire per pair of parts that some request actually travels between. */
export function edgesFor(arch: Architecture): DiagramEdge[] {
  const edges = new Map<string, DiagramEdge>();
  const addEdge = (edge: DiagramEdge) => {
    const key = [edge.from, edge.to].sort().join('|');
    if (!edges.has(key)) edges.set(key, edge);
  };
  for (const flow of new Set(arch.flows)) {
    for (const { route } of routesFor(flow, arch)) {
      for (let index = 0; index < route.length - 1; index += 1) {
        const [from, to] = [route[index], route[index + 1]];
        if (REGION2_PORTS.has(to)) continue;
        addEdge({ from, to, tone: toneFor(from, to), width: 2 });
      }
    }
  }
  if (arch.region2) {
    addEdge({ from: 'users', to: 'r2-users', tone: 'brand', width: 2, label: 'nearest region' });
    if (arch.parts.db) addEdge({ from: 'db', to: 'r2-db', tone: 'default', width: 2, dashed: true });
  }
  return [...edges.values()];
}

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------

/** A wire tone, or 'dashed' for the copy to region 2 (drawn dashed whatever its tone). */
export type WireKey = EdgeTone | 'dashed';

export interface Legend {
  wires: { tone: WireKey; label: string }[];
  outcomes: { outcome: RequestOutcome; label: string }[];
}

const WIRE_LABEL: Partial<Record<WireKey, string>> = {
  brand: 'Blue wires: requests and replies',
  violet: 'Violet: pushed to phones over held-open connections',
  info: 'Indigo: queued work for background workers',
  ok: 'Green: answered by a cache or the CDN edge',
  dashed: 'Dashed: writes copied to region 2',
};
const WIRE_ORDER: WireKey[] = ['brand', 'violet', 'info', 'ok', 'dashed'];

/** The legend for what is on screen: only the wire tones drawn and the particle shapes that travel. */
export function legendFor(arch: Architecture): Legend {
  const drawn = new Set<WireKey>(edgesFor(arch).map((edge) => (edge.dashed ? 'dashed' : (edge.tone ?? 'default'))));
  const wires = WIRE_ORDER.filter((tone) => drawn.has(tone)).map((tone) => ({ tone, label: WIRE_LABEL[tone] ?? '' }));

  const travelling = new Set<RequestOutcome>(
    arch.flows.flatMap((flow) => routesFor(flow, arch).map((variant) => variant.outcome)),
  );
  const hitLabel = arch.parts.cache && arch.parts.cdn ? 'Cache or edge hit' : arch.parts.cdn ? 'CDN edge hit' : 'Cache hit';
  const outcomes: Legend['outcomes'] = [];
  if (travelling.has('success')) outcomes.push({ outcome: 'success', label: 'Request or message' });
  if (travelling.has('cache-hit')) outcomes.push({ outcome: 'cache-hit', label: hitLabel });
  return { wires, outcomes };
}

// ---------------------------------------------------------------------------
// Layout: four columns (users | edge | app | data), fixed slots so a part always
// appears in the same place. Every wire runs between neighbouring slots or
// through an empty gap, so none passes under a card.
// ---------------------------------------------------------------------------

export const H = 90;
export const MID = 260;
export const ROW = [104, 208, 312, 416];
const COL = [
  { x: 16, w: 152 },
  { x: 224, w: 176 },
  { x: 456, w: 196 },
  { x: 708, w: 236 },
];
export const HEIGHT = 520;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const slot = (col: number, y: number): Box => ({ x: COL[col].x, y, w: COL[col].w, h: H });

export const SLOTS: Record<Exclude<PartId, 'region2'>, Box> = {
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
export const REGION2: Box = { x: 16, y: 10, w: 928, h: 74 };
/** Where the wires from Users and from the database meet that band. */
export const REGION2_BOXES: Record<'r2-users' | 'r2-db', Box> = {
  'r2-users': { x: COL[0].x, y: REGION2.y, w: COL[0].w, h: REGION2.h },
  'r2-db': { x: COL[3].x, y: REGION2.y, w: COL[3].w, h: REGION2.h },
};
