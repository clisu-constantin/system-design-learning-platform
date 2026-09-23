/**
 * A simplified Raft cluster for the Consensus Lab.
 *
 * What it keeps from Raft (Ongaro and Ousterhout, "In Search of an Understandable
 * Consensus Algorithm", 2014): terms, one vote per node per term, a majority to
 * win an election, the rule that a voter only votes for a candidate whose log is
 * at least as up to date as its own, a leader that replicates its log and commits
 * an entry of its own term once a majority stores it, the empty entry a new leader
 * appends to start its term, and stepping down on seeing a higher term.
 *
 * What it simplifies, on purpose:
 * - An append message carries the whole leader log instead of the entries after
 *   a matching index. The follower still applies the Raft rule: keep matching
 *   entries, drop everything from the first conflicting one, append the rest.
 * - Time runs slowed down so a message is visible on its wire: a hop takes about
 *   0.35 s and the leader sends a heartbeat every 0.6 s. Real clusters use a few
 *   milliseconds per hop (etcd defaults: 100 ms heartbeat, 1000 ms election timeout).
 * - The client can reach every node, and learns who the leader is right after a
 *   write fails. A partition only cuts links between cluster nodes.
 * - No pre-vote, no log compaction, no membership changes.
 */

export type Role = 'follower' | 'candidate' | 'leader';

export interface Entry {
  term: number;
  /** Unique across the cluster, so two different entries at one index never look alike. */
  id: number;
  /** The empty entry a new leader appends to start its term. */
  noop: boolean;
  /** The client write this entry carries, when it carries one. */
  writeId?: number;
  /** A write sent with the "Send one write" button - its commit is logged. */
  manual?: boolean;
}

export interface RaftNode {
  id: string;
  name: string;
  up: boolean;
  /** Set while a paused node (a long garbage-collection stop) does nothing. */
  pausedUntil: number | null;
  role: Role;
  term: number;
  votedFor: string | null;
  votes: string[];
  log: Entry[];
  /** How many log entries this node knows are committed. */
  commit: number;
  leaderId: string | null;
  /** When the election timer runs out (followers and candidates). */
  electionAt: number;
  /** The timeout drawn for the current wait - the bar on the node shows what is left of it. */
  timeoutS: number;
  heartbeatAt: number;
  /** Leader only: how much of its log each follower is known to store. */
  match: Record<string, number>;
}

export type Payload =
  | { type: 'append'; term: number; log: Entry[]; commit: number }
  | { type: 'append-reply'; term: number; ok: boolean; match: number }
  | { type: 'vote'; term: number; lastTerm: number; lastIndex: number }
  | { type: 'vote-reply'; term: number; granted: boolean }
  | { type: 'write'; writeId: number; manual: boolean; hops: number }
  | { type: 'write-reply'; writeId: number; ok: boolean; leaderHint: string | null; manual: boolean; hops: number };

export interface Message {
  id: number;
  from: string;
  to: string;
  t: number;
  /** Wires per second. */
  speed: number;
  /** Dropped at send time (dead receiver, cut link): drawn halfway, then gone. */
  lost: boolean;
  payload: Payload;
}

export interface PendingWrite {
  writeId: number;
  entryId: number;
  node: string;
  index: number;
  sentAt: number;
  manual: boolean;
}

export type PartitionMode = 'none' | 'leader-cut' | 'followers-cut';

export interface Timing {
  timeoutS: number;
  randomTimeouts: boolean;
}

export interface ClusterState {
  now: number;
  nodes: RaftNode[];
  messages: Message[];
  pending: PendingWrite[];
  partitionMode: PartitionMode;
  /** Node ids on the cut-off side of the partition. */
  cutOff: string[];
  clientTarget: string;
  writeCarry: number;
  nextWriteId: number;
  nextEntryId: number;
  nextMessageId: number;
  acked: number;
  failed: number;
  elections: number;
  failedElections: number;
  leaderlessSince: number | null;
  lastGap: number | null;
  lastTimeoutLogAt: number;
}

export type LogFn = (message: string, tone?: 'info' | 'ok' | 'warn' | 'danger') => void;

/** Simulated seconds - slowed down so every message is visible (see the header). */
export const HEARTBEAT_S = 0.6;
export const HOP_S = 0.35;
export const CLIENT_TIMEOUT_S = 3;
export const PAUSE_S = 4;
export const CLIENT = 'client';

export const majority = (size: number) => Math.floor(size / 2) + 1;

const lastTerm = (log: Entry[]) => (log.length ? log[log.length - 1].term : 0);

export function drawTimeout({ timeoutS, randomTimeouts }: Timing) {
  // Raft draws each election timeout at random from a range (150-300 ms in the
  // paper), so one follower usually times out well before the others. With the
  // option off every node waits the same time, give or take a little jitter.
  return randomTimeouts ? timeoutS * (1 + Math.random()) : timeoutS * (0.92 + Math.random() * 0.16);
}

export function createCluster(size: number, timing: Timing): ClusterState {
  const opening: Entry = { term: 1, id: 1, noop: true };
  const nodes: RaftNode[] = Array.from({ length: size }, (_, index) => {
    const id = `n${index + 1}`;
    const timeoutS = drawTimeout(timing);
    return {
      id,
      name: `Node ${index + 1}`,
      up: true,
      pausedUntil: null,
      role: index === 0 ? 'leader' : 'follower',
      term: 1,
      votedFor: 'n1',
      votes: [],
      log: [opening],
      commit: 1,
      leaderId: 'n1',
      electionAt: timeoutS,
      timeoutS,
      heartbeatAt: 0,
      match: {},
    };
  });
  nodes[0].match = Object.fromEntries(nodes.map((node) => [node.id, 1]));
  return {
    now: 0,
    nodes,
    messages: [],
    pending: [],
    partitionMode: 'none',
    cutOff: [],
    clientTarget: 'n1',
    writeCarry: 0,
    nextWriteId: 1,
    nextEntryId: 2,
    nextMessageId: 1,
    acked: 0,
    failed: 0,
    elections: 0,
    failedElections: 0,
    leaderlessSince: null,
    lastGap: null,
    lastTimeoutLogAt: -10,
  };
}

const find = (state: ClusterState, id: string) => state.nodes.find((node) => node.id === id);

/** Whether a node can do anything right now: not crashed and not paused. */
export const active = (state: ClusterState, node: RaftNode) =>
  node.up && (node.pausedUntil === null || state.now >= node.pausedUntil);

/** Whether the network carries a message between two parties. The client reaches everyone. */
export function linkUp(state: ClusterState, a: string, b: string) {
  if (a === CLIENT || b === CLIENT || state.cutOff.length === 0) return true;
  return state.cutOff.includes(a) === state.cutOff.includes(b);
}

/** The nodes a node can currently talk to, itself included, counting only active ones. */
export function reachableGroup(state: ClusterState, node: RaftNode) {
  return state.nodes.filter((other) => active(state, other) && linkUp(state, node.id, other.id));
}

/** The size of the largest group of active nodes that can all talk to each other. */
export function largestGroup(state: ClusterState) {
  let best = 0;
  for (const node of state.nodes) if (active(state, node)) best = Math.max(best, reachableGroup(state, node).length);
  return best;
}

/** A leader that can actually commit: active, and able to reach a majority. */
export function workingLeader(state: ClusterState) {
  const size = state.nodes.length;
  return state.nodes
    .filter((node) => node.role === 'leader' && active(state, node) && reachableGroup(state, node).length >= majority(size))
    .sort((a, b) => b.term - a.term)[0];
}

/** Leaders that still believe they lead but cannot reach a majority - the stale side of a partition. */
export function staleLeaders(state: ClusterState) {
  const working = workingLeader(state);
  return state.nodes.filter((node) => node.role === 'leader' && active(state, node) && node !== working);
}

function send(state: ClusterState, from: string, to: string, payload: Payload) {
  const receiver = to === CLIENT ? null : find(state, to);
  const lost = (receiver !== null && (!receiver || !active(state, receiver))) || !linkUp(state, from, to);
  state.messages.push({
    id: state.nextMessageId++,
    from,
    to,
    t: 0,
    speed: 1 / (HOP_S * (0.85 + Math.random() * 0.3)),
    lost,
    payload,
  });
}

function broadcastAppend(state: ClusterState, leader: RaftNode) {
  for (const node of state.nodes) {
    if (node === leader) continue;
    send(state, leader.id, node.id, { type: 'append', term: leader.term, log: leader.log.slice(), commit: leader.commit });
  }
  leader.heartbeatAt = state.now + HEARTBEAT_S;
}

function resetTimer(state: ClusterState, node: RaftNode, timing: Timing) {
  node.timeoutS = drawTimeout(timing);
  node.electionAt = state.now + node.timeoutS;
}

function stepDown(state: ClusterState, node: RaftNode, term: number, timing: Timing, log: LogFn) {
  if (node.role === 'leader') {
    log(`${node.name} sees term ${term}, which is newer than its term ${node.term} - it steps down to follower`, 'warn');
  }
  node.term = term;
  node.role = 'follower';
  node.votedFor = null;
  node.votes = [];
  node.leaderId = null;
  resetTimer(state, node, timing);
}

function startElection(state: ClusterState, node: RaftNode, timing: Timing, log: LogFn) {
  const need = majority(state.nodes.length);
  const retry = node.role === 'candidate';
  if (retry) {
    state.failedElections += 1;
    log(
      `${node.name} got only ${node.votes.length} of the ${need} votes it needs in term ${node.term} - it tries again for term ${node.term + 1}`,
      'warn',
    );
  }
  node.term += 1;
  node.role = 'candidate';
  node.votedFor = node.id;
  node.votes = [node.id];
  node.leaderId = null;
  state.elections += 1;
  if (!retry) log(`${node.name} heard no heartbeat for ${node.timeoutS.toFixed(1)} s - it stands for term ${node.term} and asks for votes`, 'info');
  resetTimer(state, node, timing);
  for (const other of state.nodes) {
    if (other === node) continue;
    send(state, node.id, other.id, { type: 'vote', term: node.term, lastTerm: lastTerm(node.log), lastIndex: node.log.length });
  }
}

function becomeLeader(state: ClusterState, node: RaftNode, log: LogFn) {
  node.role = 'leader';
  node.leaderId = node.id;
  node.log.push({ term: node.term, id: state.nextEntryId++, noop: true });
  node.match = Object.fromEntries(state.nodes.map((other) => [other.id, 0]));
  node.match[node.id] = node.log.length;
  log(`${node.name} won term ${node.term} with ${node.votes.length} of ${state.nodes.length} votes - it is the leader`, 'ok');
  broadcastAppend(state, node);
}

function advanceCommit(state: ClusterState, leader: RaftNode, log: LogFn) {
  const need = majority(state.nodes.length);
  for (let index = leader.log.length; index > leader.commit; index -= 1) {
    // Raft only counts copies of an entry from the current term; older entries
    // commit along with it. The empty entry at the start of a term makes that quick.
    if (leader.log[index - 1].term !== leader.term) continue;
    const copies = state.nodes.filter((node) => (node === leader ? leader.log.length : leader.match[node.id] ?? 0) >= index).length;
    if (copies < need) continue;
    for (const entry of leader.log.slice(leader.commit, index)) {
      if (entry.manual) {
        log(`Write #${entry.writeId} committed: ${copies} of ${state.nodes.length} nodes store it, a majority`, 'ok');
      }
    }
    leader.commit = index;
    return;
  }
}

/** Keep matching entries, drop everything from the first conflict, append the rest (Raft section 5.3). */
function mergeLog(node: RaftNode, incoming: Entry[]) {
  for (let index = 0; index < incoming.length; index += 1) {
    const mine = node.log[index];
    if (!mine) {
      node.log.push(...incoming.slice(index));
      return;
    }
    if (mine.term !== incoming[index].term || mine.id !== incoming[index].id) {
      node.log = node.log.slice(0, index).concat(incoming.slice(index));
      return;
    }
  }
}

/** Where the client sends its writes next: the working leader, else any leader, else unchanged. */
function discoverLeader(state: ClusterState) {
  const leader = workingLeader(state) ?? state.nodes.filter((node) => node.role === 'leader' && node.up).sort((a, b) => b.term - a.term)[0];
  if (leader) state.clientTarget = leader.id;
}

/**
 * A write that reached a crashed or paused node vanishes. The client only finds
 * out by timing out, so it is tracked as a pending write that can never commit.
 */
function dropWrite(state: ClusterState, node: string, writeId: number, manual: boolean) {
  state.pending.push({ writeId, entryId: -1, node, index: 0, sentAt: state.now, manual });
}

function sendWrite(state: ClusterState, manual: boolean) {
  send(state, CLIENT, state.clientTarget, { type: 'write', writeId: state.nextWriteId++, manual, hops: 0 });
}

function deliver(state: ClusterState, message: Message, timing: Timing, log: LogFn) {
  const payload = message.payload;

  if (message.to === CLIENT) {
    if (payload.type !== 'write-reply') return;
    if (payload.ok) {
      state.acked += 1;
      return;
    }
    // "I am not the leader, try this one" - the client follows the hint once or twice.
    if (payload.leaderHint) state.clientTarget = payload.leaderHint;
    else discoverLeader(state);
    if (payload.hops < 2) {
      send(state, CLIENT, state.clientTarget, { type: 'write', writeId: payload.writeId, manual: payload.manual, hops: payload.hops + 1 });
    } else {
      state.failed += 1;
    }
    return;
  }

  const node = find(state, message.to);
  if (!node || !active(state, node) || !linkUp(state, message.from, message.to)) {
    if (payload.type === 'write') dropWrite(state, message.to, payload.writeId, payload.manual);
    return;
  }

  switch (payload.type) {
    case 'append': {
      if (payload.term < node.term) {
        send(state, node.id, message.from, { type: 'append-reply', term: node.term, ok: false, match: 0 });
        return;
      }
      if (payload.term > node.term || node.role !== 'follower') {
        if (node.role === 'leader') log(`${node.name} hears from the term ${payload.term} leader and steps down`, 'warn');
        if (payload.term > node.term) node.votedFor = null;
        node.term = payload.term;
        node.role = 'follower';
        node.votes = [];
      }
      node.leaderId = message.from;
      resetTimer(state, node, timing);
      mergeLog(node, payload.log);
      node.commit = Math.max(node.commit, Math.min(payload.commit, payload.log.length));
      send(state, node.id, message.from, { type: 'append-reply', term: node.term, ok: true, match: payload.log.length });
      return;
    }
    case 'append-reply': {
      if (payload.term > node.term) {
        stepDown(state, node, payload.term, timing, log);
        return;
      }
      if (node.role !== 'leader' || payload.term !== node.term || !payload.ok) return;
      node.match[message.from] = Math.max(node.match[message.from] ?? 0, payload.match);
      advanceCommit(state, node, log);
      return;
    }
    case 'vote': {
      if (payload.term > node.term) stepDown(state, node, payload.term, timing, log);
      const upToDate =
        payload.lastTerm > lastTerm(node.log) || (payload.lastTerm === lastTerm(node.log) && payload.lastIndex >= node.log.length);
      const granted =
        payload.term === node.term && (node.votedFor === null || node.votedFor === message.from) && upToDate;
      if (granted) {
        node.votedFor = message.from;
        resetTimer(state, node, timing);
      }
      send(state, node.id, message.from, { type: 'vote-reply', term: node.term, granted });
      return;
    }
    case 'vote-reply': {
      if (payload.term > node.term) {
        stepDown(state, node, payload.term, timing, log);
        return;
      }
      if (node.role !== 'candidate' || payload.term !== node.term || !payload.granted) return;
      if (!node.votes.includes(message.from)) node.votes.push(message.from);
      if (node.votes.length >= majority(state.nodes.length)) becomeLeader(state, node, log);
      return;
    }
    case 'write': {
      if (node.role !== 'leader') {
        send(state, node.id, CLIENT, {
          type: 'write-reply',
          writeId: payload.writeId,
          ok: false,
          leaderHint: node.leaderId,
          manual: payload.manual,
          hops: payload.hops,
        });
        return;
      }
      const entry: Entry = { term: node.term, id: state.nextEntryId++, noop: false, writeId: payload.writeId, manual: payload.manual };
      node.log.push(entry);
      node.match[node.id] = node.log.length;
      state.pending.push({
        writeId: payload.writeId,
        entryId: entry.id,
        node: node.id,
        index: node.log.length,
        sentAt: state.now,
        manual: payload.manual,
      });
      if (payload.manual) log(`${node.name} appends write #${payload.writeId} at index ${node.log.length} and copies it to the followers`, 'info');
      broadcastAppend(state, node);
      return;
    }
    default:
      return;
  }
}

/** One simulation step of `dt` seconds. */
export function stepCluster(state: ClusterState, dt: number, writeRate: number, timing: Timing, log: LogFn) {
  state.now += dt;
  const now = state.now;

  for (const node of state.nodes) {
    if (node.pausedUntil !== null && now >= node.pausedUntil) {
      node.pausedUntil = null;
      if (node.role === 'leader') {
        log(`${node.name} wakes up from its pause and still believes it leads term ${node.term}`, 'warn');
        node.heartbeatAt = now;
      } else {
        resetTimer(state, node, timing);
      }
    }
  }

  // Move messages; deliver the ones that arrived. Delivery can send new ones.
  const arrived: Message[] = [];
  state.messages = state.messages.filter((message) => {
    message.t += message.speed * dt;
    if (message.lost) {
      if (message.t < 0.5) return true;
      if (message.payload.type === 'write') dropWrite(state, message.to, message.payload.writeId, message.payload.manual);
      return false;
    }
    if (message.t >= 1) {
      arrived.push(message);
      return false;
    }
    return true;
  });
  for (const message of arrived) deliver(state, message, timing, log);

  for (const node of state.nodes) {
    if (!active(state, node)) continue;
    if (node.role === 'leader') {
      if (now >= node.heartbeatAt) broadcastAppend(state, node);
    } else if (now >= node.electionAt) {
      startElection(state, node, timing, log);
    }
  }

  state.writeCarry += writeRate * dt;
  while (state.writeCarry >= 1) {
    state.writeCarry -= 1;
    sendWrite(state, false);
  }

  // Answer committed writes; time out the ones that cannot commit.
  state.pending = state.pending.filter((write) => {
    const node = find(state, write.node);
    const entry = node?.log[write.index - 1];
    if (node && active(state, node) && entry?.id === write.entryId && node.commit >= write.index) {
      send(state, node.id, CLIENT, { type: 'write-reply', writeId: write.writeId, ok: true, leaderHint: null, manual: write.manual, hops: 0 });
      return false;
    }
    if (now - write.sentAt < CLIENT_TIMEOUT_S) return true;
    state.failed += 1;
    if (write.manual || now - state.lastTimeoutLogAt > 3) {
      state.lastTimeoutLogAt = now;
      const reason = write.entryId === -1 || !node || !active(state, node)
        ? `${node?.name ?? 'the node'} was crashed or paused and never answered`
        : node.role !== 'leader'
          ? `${node.name} lost its leadership before the entry committed`
          : `${node.name} cannot reach a majority to store it`;
      log(`Write #${write.writeId} timed out after ${CLIENT_TIMEOUT_S} s: ${reason}`, 'danger');
    }
    discoverLeader(state);
    return false;
  });

  const working = workingLeader(state);
  if (!working && state.leaderlessSince === null) state.leaderlessSince = now;
  if (working && state.leaderlessSince !== null) {
    state.lastGap = now - state.leaderlessSince;
    state.leaderlessSince = null;
    log(`Writes can commit again: ${working.name} leads after ${state.lastGap.toFixed(1)} s without a working leader`, 'ok');
  }
}

export function killNode(state: ClusterState, id: string, log: LogFn) {
  const node = find(state, id);
  if (!node || !node.up) return;
  const wasLeader = node.role === 'leader';
  node.up = false;
  node.pausedUntil = null;
  node.role = 'follower';
  node.votes = [];
  log(
    wasLeader
      ? `${node.name}, the leader, crashed - the followers stop hearing heartbeats`
      : `${node.name} crashed`,
    'danger',
  );
}

export function reviveNode(state: ClusterState, id: string, timing: Timing, log: LogFn) {
  const node = find(state, id);
  if (!node || node.up) return;
  // Raft keeps the term, the vote and the log on disk, so they survive a restart.
  node.up = true;
  node.role = 'follower';
  node.leaderId = null;
  resetTimer(state, node, timing);
  log(`${node.name} restarts as a follower with its log and term ${node.term} from disk`, 'ok');
}

export function pauseLeader(state: ClusterState, log: LogFn) {
  const leader = workingLeader(state) ?? staleLeaders(state)[0];
  if (!leader) return;
  leader.pausedUntil = state.now + PAUSE_S;
  log(`${leader.name}, the leader, freezes for ${PAUSE_S} s - like a long garbage-collection pause`, 'warn');
}

export function clientWrite(state: ClusterState) {
  sendWrite(state, true);
}

export function setPartition(state: ClusterState, mode: PartitionMode, log: LogFn) {
  if (mode === state.partitionMode) return;
  state.partitionMode = mode;
  if (mode === 'none') {
    state.cutOff = [];
    log('Partition healed - every node can reach every other node again', 'ok');
    return;
  }
  const leader = workingLeader(state) ?? state.nodes.find((node) => node.role === 'leader' && node.up) ?? state.nodes[0];
  const followers = state.nodes.filter((node) => node !== leader);
  // The cut-off side is always the minority: 1 of 3, or 2 of 5.
  const minority = state.nodes.length - majority(state.nodes.length);
  state.cutOff =
    mode === 'leader-cut'
      ? [leader.id, ...followers.slice(0, minority - 1).map((node) => node.id)]
      : followers.slice(-minority).map((node) => node.id);
  const names = state.cutOff.map((id) => find(state, id)?.name).join(' and ');
  log(`Network partition: ${names} can no longer reach the other nodes`, 'danger');
}
