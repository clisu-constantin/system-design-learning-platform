/**
 * The simulation behind the Event Log Lab: a topic of partitions (append-only
 * logs with offsets), a producer that is also the write model of a tiny bank,
 * a consumer group called "billing" and a projector that folds the events into
 * a read model of balances.
 *
 * Simplified on purpose, and the UI says so:
 * - one event is one record, and rates are events per second, not bytes;
 * - the partition of a key is `account % partitions`, standing in for a hash;
 * - partitions are handed to group members round robin;
 * - retention keeps the newest RETAINED_RECORDS records of each partition
 *   (size-based retention), real brokers delete whole segments;
 * - records below the log start offset are only marked as deleted, never freed,
 *   so the model can still say what the correct state would have been.
 */

export const ACCOUNTS = 6;
/** Events already in the log when the Lab opens, so replay has history to work on. */
export const PREFILL = 480;
/** The projector saves a snapshot after this many applied events, when snapshots are on. */
export const SNAPSHOT_EVERY = 100;
/** Size-based retention: records kept per partition when retention is on. */
export const RETAINED_RECORDS = 120;
/** Time a group spends rebalancing after a member joins or leaves. Simplified. */
export const REBALANCE_SECONDS = 1;
/** Reads per second the Query client makes against the read model. */
export const QUERY_RATE = 4;
/** How many recent reads the stale-read share is computed over. */
export const READ_WINDOW = 40;

export interface PartitionLog {
  /** Record fields, indexed by offset. */
  account: number[];
  delta: number[];
  /** Simulation clock (seconds) at which each record was appended. */
  time: number[];
  /** Log start offset: records below it were deleted by retention. */
  start: number;
}

export interface Snapshot {
  offsets: number[];
  balances: number[];
}

export interface Rebuild {
  startedAt: number;
  events: number;
  fromSnapshot: boolean;
}

export interface RebuildResult {
  events: number;
  seconds: number;
  fromSnapshot: boolean;
  wrong: number;
}

export interface LogState {
  /** Simulation clock in seconds; stops when the Lab is paused. */
  clock: number;
  partitions: PartitionLog[];
  /** The write model: current balance per account, used to refuse overdrafts. */
  truth: number[];
  rejected: number;
  billing: {
    /** Committed offset per partition - the group keeps it, not the member. */
    offsets: number[];
    /** Highest offset ever processed per partition, to count re-reads after a rewind. */
    highWater: number[];
    /** Round-robin position of each member over its partitions, so none is starved. */
    cursors: number[];
    processed: number;
    reread: number;
    skipped: number;
    pausedUntil: number;
  };
  projector: {
    offsets: number[];
    /** The read model the projector writes. */
    balances: number[];
    /** What the read model would hold with correct code and no lost records, at the same offsets. */
    correct: number[];
    carry: number;
    /** Round-robin position over the partitions, so a replay advances all of them evenly. */
    cursor: number;
    sinceSnapshot: number;
    skipped: number;
    rebuild: Rebuild | null;
    lastRebuild: RebuildResult | null;
  };
  snapshot: Snapshot | null;
  queryCarry: number;
  /** Recent reads, true when the read returned a balance that differs from the write model. */
  reads: boolean[];
}

export const partitionOf = (account: number, partitions: number) => account % partitions;

/** Partitions a member owns: round robin, so a member past the partition count owns none. */
export const ownedBy = (member: number, members: number, partitions: number) =>
  Array.from({ length: partitions }, (_, index) => index).filter((index) => index % members === member);

const zeros = (count: number) => Array.from({ length: count }, () => 0);

/**
 * One command against the write model. Deposits always succeed; a withdrawal
 * that would overdraw the account is refused before anything is appended - the
 * write model guards the invariant, the log only records what was accepted.
 */
function command(state: LogState, random: () => number) {
  const account = Math.floor(random() * ACCOUNTS);
  const deposit = random() < 0.55;
  const amount = deposit ? 10 + Math.floor(random() * 5) * 10 : 5 + Math.floor(random() * 8) * 5;
  const delta = deposit ? amount : -amount;
  if (state.truth[account] + delta < 0) {
    state.rejected += 1;
    return null;
  }
  state.truth[account] += delta;
  const partition = partitionOf(account, state.partitions.length);
  const log = state.partitions[partition];
  log.account.push(account);
  log.delta.push(delta);
  log.time.push(state.clock);
  return partition;
}

export function createLogState(partitions: number, rebuildOnStart: boolean, random: () => number = Math.random): LogState {
  const state: LogState = {
    clock: 0,
    partitions: Array.from({ length: partitions }, () => ({ account: [], delta: [], time: [], start: 0 })),
    truth: zeros(ACCOUNTS),
    rejected: 0,
    billing: {
      offsets: zeros(partitions),
      highWater: zeros(partitions),
      cursors: [],
      processed: 0,
      reread: 0,
      skipped: 0,
      pausedUntil: 0,
    },
    projector: {
      offsets: zeros(partitions),
      balances: zeros(ACCOUNTS),
      correct: zeros(ACCOUNTS),
      carry: 0,
      cursor: 0,
      sinceSnapshot: 0,
      skipped: 0,
      rebuild: null,
      lastRebuild: null,
    },
    snapshot: null,
    queryCarry: 0,
    reads: [],
  };
  // History written over the last minute before the Lab opened.
  for (let index = 0; index < PREFILL; index += 1) {
    state.clock = -60 + (60 * index) / PREFILL;
    command(state, random);
  }
  state.clock = 0;
  state.rejected = 0;
  const ends = state.partitions.map((log) => log.account.length);
  state.billing.offsets = [...ends];
  state.billing.highWater = [...ends];
  if (rebuildOnStart) {
    state.projector.rebuild = { startedAt: 0, events: ends.reduce((sum, end) => sum + end, 0), fromSnapshot: false };
  } else {
    state.projector.offsets = [...ends];
    state.projector.balances = [...state.truth];
    state.projector.correct = [...state.truth];
  }
  return state;
}

export const endOffset = (log: PartitionLog) => log.account.length;

/** Appends `count` commands; returns the partition of each accepted one. */
export function write(state: LogState, count: number, random: () => number = Math.random) {
  const partitions: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const partition = command(state, random);
    if (partition !== null) partitions.push(partition);
  }
  return partitions;
}

/** Size-based retention: move each log start offset up to keep only the newest records. */
export function applyRetention(state: LogState) {
  for (const log of state.partitions) {
    log.start = Math.max(log.start, endOffset(log) - RETAINED_RECORDS);
  }
}

/**
 * What a consumer does when its committed offset points at a record that is not
 * in the log (Kafka's `auto.offset.reset`): start again at the oldest record
 * still kept, or jump to the end and read only new records.
 */
export type OffsetReset = 'earliest' | 'latest';

/** Where `auto.offset.reset` sends an offset that is below the log start offset. */
const resetTarget = (log: PartitionLog, reset: OffsetReset) => (reset === 'earliest' ? log.start : endOffset(log));

/**
 * The billing group, whose committed offset fell below the log start offset,
 * cannot read those records any more: `auto.offset.reset` moves it to the
 * oldest kept record (earliest) or to the log end (latest). Returns how many
 * records it had never read and now never will - records it read before a
 * rewind are not lost to it.
 */
export function skipDeleted(state: LogState, reset: OffsetReset) {
  const billing = state.billing;
  let skipped = 0;
  state.partitions.forEach((log, partition) => {
    const offset = billing.offsets[partition];
    if (offset >= log.start) return;
    const landed = resetTarget(log, reset);
    skipped += Math.max(0, landed - Math.max(offset, billing.highWater[partition]));
    billing.offsets[partition] = landed;
    billing.highWater[partition] = Math.max(billing.highWater[partition], landed);
  });
  billing.skipped += skipped;
  return skipped;
}

export interface SeekResult {
  partition: number;
  /** The offset the group actually committed. */
  landed: number;
  /** `kept`: the offset is in the log. `deleted`: retention removed it. `past-end`: not written yet. */
  outcome: 'kept' | 'deleted' | 'past-end';
  /** Records it will read a second time. */
  replay: number;
  /** Records it had never read and now jumped over. */
  skipped: number;
}

/**
 * Where a seek of every partition to `offset` would land, without moving
 * anything: the Lab previews it next to the control.
 */
export function previewSeek(state: LogState, offset: number, reset: OffsetReset): SeekResult[] {
  const billing = state.billing;
  return state.partitions.map((log, partition) => {
    const end = endOffset(log);
    const outcome = offset > end ? 'past-end' : offset < log.start ? 'deleted' : 'kept';
    const landed = outcome === 'past-end' ? end : outcome === 'deleted' ? resetTarget(log, reset) : offset;
    const highWater = billing.highWater[partition];
    return {
      partition,
      landed,
      outcome,
      replay: Math.max(0, highWater - landed),
      skipped: Math.max(0, landed - Math.max(billing.offsets[partition], highWater)),
    };
  });
}

/**
 * Commits `offset` for the billing group on every partition, like
 * `kafka-consumer-groups --reset-offsets --to-offset`. An offset retention
 * already deleted cannot be served, so `auto.offset.reset` decides where the
 * group lands; an offset past the log end lands on the end.
 * Simplified: the Lab resolves the reset at once, a real consumer does it on
 * its next fetch, when the broker answers OFFSET_OUT_OF_RANGE.
 */
export function seekBilling(state: LogState, offset: number, reset: OffsetReset) {
  const results = previewSeek(state, offset, reset);
  const billing = state.billing;
  for (const result of results) {
    billing.offsets[result.partition] = result.landed;
    billing.highWater[result.partition] = Math.max(billing.highWater[result.partition], result.landed);
    billing.skipped += result.skipped;
  }
  return results;
}

/** Folds one record into a set of balances, the way the projection code does. */
export function applyRecord(balances: number[], log: PartitionLog, offset: number, skipWithdrawals: boolean) {
  const delta = log.delta[offset];
  if (skipWithdrawals && delta < 0) return;
  balances[log.account[offset]] += delta;
}

/** The correct fold of every record below `offsets`, deleted ones included. */
export function foldUpTo(state: LogState, offsets: number[]) {
  const balances = zeros(ACCOUNTS);
  state.partitions.forEach((log, partition) => {
    for (let offset = 0; offset < offsets[partition]; offset += 1) applyRecord(balances, log, offset, false);
  });
  return balances;
}

/** Records a group has not read yet, summed over partitions. */
export const lagOf = (offsets: number[], state: LogState) =>
  state.partitions.reduce((sum, log, partition) => sum + Math.max(0, endOffset(log) - offsets[partition]), 0);

/** Age in seconds of the oldest record the projector has not applied yet. */
export function readLagSeconds(state: LogState) {
  let oldest = 0;
  state.partitions.forEach((log, partition) => {
    const offset = state.projector.offsets[partition];
    if (offset < endOffset(log)) oldest = Math.max(oldest, state.clock - log.time[offset]);
  });
  return oldest;
}

/** Accounts whose read-model balance differs from the correct fold at the same offsets. */
export const wrongAccounts = (state: LogState) =>
  state.projector.balances.filter((balance, account) => balance !== state.projector.correct[account]).length;

/**
 * Starts a rebuild of the read model: throw the balances away and replay the
 * log, from the latest snapshot when there is one and it is wanted, otherwise
 * from the oldest record still kept.
 */
export function startRebuild(state: LogState, useSnapshot: boolean): Rebuild {
  const snapshot = useSnapshot ? state.snapshot : null;
  const projector = state.projector;
  if (snapshot) {
    projector.offsets = [...snapshot.offsets];
    projector.balances = [...snapshot.balances];
  } else {
    projector.offsets = state.partitions.map((log) => log.start);
    projector.balances = zeros(ACCOUNTS);
  }
  projector.correct = foldUpTo(state, projector.offsets);
  projector.carry = 0;
  projector.sinceSnapshot = 0;
  const rebuild = { startedAt: state.clock, events: lagOf(projector.offsets, state), fromSnapshot: Boolean(snapshot) };
  projector.rebuild = rebuild;
  return rebuild;
}

/**
 * Moves the committed offsets of one group member forward, one record at a time
 * and round robin over the partitions it owns, for as many records as `budget`
 * allows. Returns the unused budget and calls `onRead` for every record read.
 */
export function stepMember(
  state: LogState,
  member: number,
  owned: number[],
  budget: number,
  onRead: (partition: number) => void,
) {
  const billing = state.billing;
  let cursor = billing.cursors[member] ?? 0;
  while (budget >= 1) {
    let partition = -1;
    for (let tried = 0; tried < owned.length; tried += 1) {
      const candidate = owned[(cursor + tried) % owned.length];
      if (billing.offsets[candidate] < endOffset(state.partitions[candidate])) {
        partition = candidate;
        cursor = (cursor + tried + 1) % owned.length;
        break;
      }
    }
    if (partition < 0) {
      billing.cursors[member] = cursor;
      return 0; // caught up: idle capacity is not banked
    }
    const offset = billing.offsets[partition];
    if (offset < billing.highWater[partition]) billing.reread += 1;
    billing.offsets[partition] = offset + 1;
    billing.highWater[partition] = Math.max(billing.highWater[partition], offset + 1);
    billing.processed += 1;
    budget -= 1;
    onRead(partition);
  }
  billing.cursors[member] = cursor;
  return budget;
}

/**
 * Moves the projector forward: skips records retention already deleted (they
 * are lost to the read model, but still counted in the correct fold), then
 * applies up to `budget` records that are older than `cutoff`, the projection
 * delay. Saves a snapshot every SNAPSHOT_EVERY records when snapshots are on.
 */
export function stepProjector(
  state: LogState,
  budget: number,
  cutoff: number,
  options: { skipWithdrawals: boolean; snapshots: boolean },
  on: { apply: (partition: number) => void; snapshot: () => void },
) {
  const projector = state.projector;
  state.partitions.forEach((log, partition) => {
    const offset = projector.offsets[partition];
    if (offset >= log.start) return;
    for (let index = offset; index < log.start; index += 1) applyRecord(projector.correct, log, index, false);
    projector.skipped += log.start - offset;
    projector.offsets[partition] = log.start;
  });

  const count = state.partitions.length;
  while (budget >= 1) {
    let partition = -1;
    for (let tried = 0; tried < count; tried += 1) {
      const candidate = (projector.cursor + tried) % count;
      const log = state.partitions[candidate];
      const offset = projector.offsets[candidate];
      if (offset < endOffset(log) && log.time[offset] <= cutoff) {
        partition = candidate;
        projector.cursor = (candidate + 1) % count;
        break;
      }
    }
    if (partition < 0) return { carry: 0, caughtUp: true };
    const log = state.partitions[partition];
    const offset = projector.offsets[partition];
    applyRecord(projector.balances, log, offset, options.skipWithdrawals);
    applyRecord(projector.correct, log, offset, false);
    projector.offsets[partition] = offset + 1;
    budget -= 1;
    on.apply(partition);
    projector.sinceSnapshot += 1;
    if (options.snapshots && projector.sinceSnapshot >= SNAPSHOT_EVERY) {
      state.snapshot = { offsets: [...projector.offsets], balances: [...projector.balances] };
      projector.sinceSnapshot = 0;
      on.snapshot();
    }
  }
  return { carry: budget, caughtUp: false };
}
