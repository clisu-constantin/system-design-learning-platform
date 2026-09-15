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

/** Share of traffic a component passes on to its downstream dependencies. */
const PASS_THROUGH: Partial<Record<NodeKind, number>> = {
  cdn: 0.15,
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
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const edge of edges) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
    incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge.source]);
  }

  const load: Record<string, number> = Object.fromEntries(nodes.map((node) => [node.id, 0]));
  let dropped = 0;

  // Breadth-first propagation with a visit cap, so a cycle cannot loop forever.
  const clients = nodes.filter((node) => node.data.kind === 'client');
  const queue: { id: string; amount: number; depth: number }[] = clients.map((node) => ({
    id: node.id,
    amount: traffic / Math.max(clients.length, 1),
    depth: 0,
  }));

  while (queue.length) {
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

    for (const target of targets) {
      queue.push({ id: target, amount: split, depth: item.depth + 1 });
    }
  }

  const bottlenecks = nodes
    .filter((node) => node.data.capacity > 0 && node.data.status !== 'down' && load[node.id] > node.data.capacity)
    .map((node) => node.id);

  // ---- Risk detection -------------------------------------------------------
  const risks: AnalysisResult['risks'] = [];
  const countByKind = (kind: NodeKind) => nodes.filter((node) => node.data.kind === kind).length;
  const has = (kind: NodeKind) => countByKind(kind) > 0;

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
  if (nodes.length > 0 && clients.length === 0) {
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

  return { load, bottlenecks, risks, scores: { scalability, availability, performance }, complexity, cost, dropped };
}

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
