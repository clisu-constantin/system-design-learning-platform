import type { Edge, Node } from 'reactflow';
import type { NodeKind } from '@/types';
import type { PlaygroundNodeData } from './nodes';

export interface AnalysisResult {
  /** Incoming load per node id, in requests per second. */
  load: Record<string, number>;
  bottlenecks: string[];
  risks: { id: string; severity: 'high' | 'medium' | 'low'; message: string; fix: string }[];
  scores: { scalability: number; availability: number; performance: number };
  complexity: 'Low' | 'Medium' | 'High';
  cost: 'Low' | 'Medium' | 'High';
  /** Requests per second that never reach a working component. */
  dropped: number;
}

/** Stores a cache could sit in front of. */
const STORES: ReadonlySet<NodeKind> = new Set<NodeKind>(['sql', 'nosql', 'storage', 'search']);

/**
 * Share of traffic a component passes on to its downstream dependencies.
 * A CDN only answers static assets; the Client traffic here is mostly dynamic
 * API calls, so nearly all of it still reaches the load balancer. The Redis
 * cache, not the CDN, is what shields the database.
 */
const PASS_THROUGH: Partial<Record<NodeKind, number>> = {
  cdn: 0.9,
  cache: 0.2,
  queue: 1,
};

/**
 * Propagates traffic from client nodes through the graph and derives an
 * educational health score.
 *
 * This is a heuristic, not a capacity planner: it exists to make the effect of
 * adding a cache, a replica or a load balancer visible and arguable.
 */
export function analyze(
  nodes: Node<PlaygroundNodeData>[],
  edges: Edge[],
  traffic: number,
): AnalysisResult {
  if (nodes.length === 0) {
    // Nothing to score. Returning the base heuristic scores here showed
    // "Performance 40 / 100" and gateway advice for a canvas with no components.
    return {
      load: {},
      bottlenecks: [],
      risks: [
        {
          id: 'empty',
          severity: 'low',
          message: 'The canvas is empty, so there is nothing to analyze yet.',
          fix: 'Add a Client and a Server from the palette and connect them, or load a preset.',
        },
      ],
      scores: { scalability: 0, availability: 0, performance: 0 },
      complexity: 'Low',
      cost: 'Low',
      dropped: 0,
    };
  }

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const edge of edges) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
    incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge.source]);
  }

  const load: Record<string, number> = Object.fromEntries(nodes.map((node) => [node.id, 0]));
  let dropped = 0;

  /**
   * Breadth-first propagation. Each item remembers the path it took, and traffic
   * never re-enters a component already on its path: a request that reaches the
   * database does not come back around to the server as a brand-new request. A
   * depth cap alone let a two node cycle multiply the load six times over.
   */
  const clients = nodes.filter((node) => node.data.kind === 'client');
  const queue: { id: string; amount: number; depth: number; path: string[] }[] = clients.map((node) => ({
    id: node.id,
    amount: traffic / Math.max(clients.length, 1),
    depth: 0,
    path: [node.id],
  }));

  // Fan-out multiplies paths, so a densely wired canvas is capped by total work, not just depth.
  let budget = 20000;
  while (queue.length && budget-- > 0) {
    const item = queue.shift();
    if (!item || item.depth > 12) continue;
    const node = byId.get(item.id);
    if (!node) continue;

    if (node.data.kind !== 'client') {
      if (node.data.status === 'down') {
        dropped += item.amount;
        continue;
      }
      load[node.id] += item.amount;
    }

    const targets = outgoing.get(item.id) ?? [];
    if (targets.length === 0) continue;

    const pass = node.data.kind === 'client' ? 1 : (PASS_THROUGH[node.data.kind] ?? 1);
    const forwarded = item.amount * pass;
    if (forwarded <= 0.01) continue;

    // Load balancers and gateways split traffic; other components fan it out.
    const split =
      node.data.kind === 'load-balancer' || node.data.kind === 'api-gateway' || node.data.kind === 'queue'
        ? forwarded / targets.length
        : forwarded;

    /**
     * Cache-aside: a component wired to both a cache and the store behind it
     * checks the cache on every read, but only the misses continue to the
     * store. Without this the direct edge carried full traffic *and* the cache
     * added its own share on top, so dragging in a cache made the database
     * busier - the exact opposite of what the lab is meant to show.
     */
    const cacheShare = targets.reduce((lowest, id) => {
      const kind = byId.get(id)?.data.kind;
      if (kind !== 'cache' && kind !== 'cdn') return lowest;
      return Math.min(lowest, PASS_THROUGH[kind] ?? 1);
    }, 1);

    for (const target of targets) {
      if (item.path.includes(target)) continue;
      const kind = byId.get(target)?.data.kind;
      /**
       * The playground models cache-aside only: the application reads the
       * cache and, on a miss, goes to the store itself. When the caller is also
       * wired to this store, its direct edge already carries the misses, so the
       * Cache -> store edge carries none - otherwise every miss counts twice.
       * Without a direct edge the Cache -> store edge is the only way to draw
       * the miss path, so the misses flow through it.
       */
      const caller = item.path[item.path.length - 2];
      if (node.data.kind === 'cache' && kind && STORES.has(kind) && caller && outgoing.get(caller)?.includes(target)) {
        continue;
      }
      const fronted = kind === 'cache' || kind === 'cdn';
      queue.push({
        id: target,
        amount: fronted ? split : split * cacheShare,
        depth: item.depth + 1,
        path: [...item.path, target],
      });
    }
  }

  const bottlenecks = nodes
    .filter((node) => node.data.capacity > 0 && node.data.status !== 'down' && load[node.id] > node.data.capacity)
    .map((node) => node.id);

  // ---- Risk detection -------------------------------------------------------
  const risks: AnalysisResult['risks'] = [];
  /**
   * Only wired components count. A component with no edges receives no
   * traffic, so dropping fifteen unconnected boxes on the canvas must not score
   * as a redundant, cached, load balanced system. Monitoring is the exception:
   * it observes everything and is conventionally drawn without request edges.
   */
  const wired = new Set(edges.flatMap((edge) => [edge.source, edge.target]));
  const counts = (node: Node<PlaygroundNodeData>) => node.data.kind === 'monitoring' || wired.has(node.id);
  const countByKind = (kind: NodeKind) => nodes.filter((node) => node.data.kind === kind && counts(node)).length;
  const has = (kind: NodeKind) => countByKind(kind) > 0;
  const unwired = nodes.filter((node) => !counts(node));

  const servers = countByKind('server') + countByKind('service');
  const databases = countByKind('sql') + countByKind('nosql');

  if (databases === 1) {
    risks.push({
      id: 'single-db',
      severity: 'high',
      message: 'Single database instance - it is a single point of failure and a write bottleneck.',
      fix: 'Add a replica for reads and failover, or partition the data.',
    });
  }
  if (servers === 1) {
    risks.push({
      id: 'single-server',
      severity: 'high',
      message: 'Only one application instance - losing it is a full outage.',
      fix: 'Run at least two instances behind a load balancer.',
    });
  }
  if (servers > 1 && !has('load-balancer') && !has('api-gateway')) {
    risks.push({
      id: 'no-lb',
      severity: 'medium',
      message: 'Several application instances with nothing distributing traffic between them.',
      fix: 'Put a load balancer in front of the instances.',
    });
  }
  // Whatever fronts the whole system is redundant in a real deployment (see CLAUDE.md).
  const frontDoors = (['load-balancer', 'api-gateway'] as const).filter((kind) => countByKind(kind) === 1);
  for (const kind of frontDoors) {
    const name = kind === 'load-balancer' ? 'load balancer' : 'API gateway';
    risks.push({
      id: `single-${kind}`,
      severity: 'medium',
      message: `Only one ${name} - every request passes through it, so it is a single point of failure.`,
      fix: `Run the ${name} as a redundant pair (for example two nodes in different availability zones).`,
    });
  }
  if (!has('cache') && databases > 0) {
    risks.push({
      id: 'no-cache',
      severity: 'medium',
      message: 'No cache - every read reaches the database.',
      fix: 'Add a cache in front of the hottest read path.',
    });
  }
  if (!has('cdn') && has('client')) {
    risks.push({
      id: 'no-cdn',
      severity: 'low',
      message: 'No CDN - distant users pay full round-trip latency for every asset.',
      fix: 'Serve static content from an edge cache.',
    });
  }
  if (!has('api-gateway') && !has('load-balancer')) {
    risks.push({
      id: 'no-rate-limit',
      severity: 'medium',
      message: 'No gateway or load balancer, so no place to apply rate limiting or TLS termination.',
      fix: 'Add an API gateway as the single entry point.',
    });
  }
  if (!has('monitoring')) {
    risks.push({
      id: 'no-monitoring',
      severity: 'low',
      message: 'No monitoring component - you would discover failures from users.',
      fix: 'Add monitoring and define what pages a human.',
    });
  }
  if (bottlenecks.length > 0) {
    risks.push({
      id: 'bottleneck',
      severity: 'high',
      message: `${bottlenecks.length} component(s) receiving more traffic than they can serve.`,
      fix: 'Add capacity, cache in front of them, or move the work to a queue.',
    });
  }
  if (unwired.length > 0) {
    const names = unwired.map((node) => node.data.label).join(', ');
    risks.push({
      id: 'unwired',
      severity: 'medium',
      message: `Not connected to anything: ${names}. Unconnected components receive no traffic and do not count in the scores.`,
      fix: 'Drag from the bottom handle of one component to the top handle of another to connect them.',
    });
  }
  if (clients.length === 0) {
    risks.push({
      id: 'no-client',
      severity: 'low',
      message: 'No client node, so no traffic enters the system.',
      fix: 'Add a Client component to generate traffic.',
    });
  }

  // ---- Scores (educational heuristics) -------------------------------------
  const scalability = clampScore(
    30 +
      (has('load-balancer') ? 20 : 0) +
      (servers > 1 ? 15 : 0) +
      (servers > 2 ? 5 : 0) +
      (has('cache') ? 15 : 0) +
      (has('queue') ? 10 : 0) +
      (databases > 1 ? 10 : 0) -
      bottlenecks.length * 12,
  );

  const availability = clampScore(
    25 +
      (servers > 1 ? 25 : 0) +
      (databases > 1 ? 20 : 0) +
      (has('load-balancer') ? 15 : 0) +
      (has('monitoring') ? 10 : 0) +
      (has('queue') ? 5 : 0) -
      frontDoors.length * 10 -
      risks.filter((risk) => risk.severity === 'high').length * 15,
  );

  const performance = clampScore(
    40 +
      (has('cache') ? 25 : 0) +
      (has('cdn') ? 20 : 0) +
      (has('queue') ? 5 : 0) +
      (has('search') ? 5 : 0) -
      bottlenecks.length * 15,
  );

  const complexity = nodes.length > 12 ? 'High' : nodes.length > 6 ? 'Medium' : 'Low';
  const cost =
    nodes.length + servers > 16 ? 'High' : nodes.length > 8 || databases > 2 ? 'Medium' : 'Low';

  // Nothing is connected yet, so there is no architecture to score - only loose boxes.
  const scores = wired.size > 0 ? { scalability, availability, performance } : { scalability: 0, availability: 0, performance: 0 };

  return { load, bottlenecks, risks, scores, complexity, cost, dropped };
}

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
