import type { Edge, Node } from 'reactflow';
import type { NodeKind } from '@/types';
import { NODE_KINDS } from '@/components/architecture';
import type { PlaygroundNodeData } from './nodes';

let sequence = 0;
export const nextNodeId = () => `n${(sequence += 1)}`;

export function makeNode(kind: NodeKind, x: number, y: number, label?: string): Node<PlaygroundNodeData> {
  return {
    id: nextNodeId(),
    type: 'component',
    position: { x, y },
    data: {
      kind,
      label: label ?? NODE_KINDS[kind].label,
      capacity: NODE_KINDS[kind].capacity,
      load: 0,
      status: 'healthy',
      bottleneck: false,
    },
  };
}

const edge = (source: string, target: string): Edge => ({
  id: `${source}-${target}`,
  source,
  target,
  type: 'request',
  data: { running: false, intensity: 0, tone: 'muted' },
});

export interface Preset {
  id: string;
  name: string;
  description: string;
  build: () => { nodes: Node<PlaygroundNodeData>[]; edges: Edge[] };
}

/** Starting points that match the stages taught in the evolution page. */
export const PRESETS: Preset[] = [
  {
    id: 'blank',
    name: 'Blank canvas',
    description: 'Start from nothing and build your own.',
    build: () => ({ nodes: [], edges: [] }),
  },
  {
    id: 'basic',
    name: 'Client - Server - Database',
    description: 'The simplest thing that works. Run traffic and find where it stops working.',
    build: () => {
      const client = makeNode('client', 340, 0);
      const server = makeNode('server', 340, 150);
      const db = makeNode('sql', 340, 300);
      return { nodes: [client, server, db], edges: [edge(client.id, server.id), edge(server.id, db.id)] };
    },
  },
  {
    id: 'scaled',
    name: 'Load balanced web tier',
    description: 'Three app servers behind a load balancer, one database.',
    build: () => {
      const client = makeNode('client', 340, -40);
      const lb = makeNode('load-balancer', 340, 90);
      const a = makeNode('server', 120, 240, 'API 1');
      const b = makeNode('server', 340, 240, 'API 2');
      const c = makeNode('server', 560, 240, 'API 3');
      const db = makeNode('sql', 340, 400);
      return {
        nodes: [client, lb, a, b, c, db],
        edges: [
          edge(client.id, lb.id),
          edge(lb.id, a.id),
          edge(lb.id, b.id),
          edge(lb.id, c.id),
          edge(a.id, db.id),
          edge(b.id, db.id),
          edge(c.id, db.id),
        ],
      };
    },
  },
  {
    id: 'full',
    name: 'Cached, queued and replicated',
    description: 'CDN, load balancer, cache, queue, workers and a replicated database.',
    build: () => {
      const client = makeNode('client', 420, -120);
      const cdn = makeNode('cdn', 420, -10);
      const lb = makeNode('load-balancer', 420, 100);
      const a = makeNode('server', 200, 230, 'API 1');
      const b = makeNode('server', 420, 230, 'API 2');
      const c = makeNode('server', 640, 230, 'API 3');
      const cache = makeNode('cache', 60, 380);
      const queue = makeNode('queue', 700, 380);
      const worker = makeNode('worker', 700, 510);
      const primary = makeNode('sql', 340, 380, 'Primary DB');
      const replica = makeNode('sql', 340, 520, 'Read Replica');
      const monitoring = makeNode('monitoring', 920, 230);
      return {
        nodes: [client, cdn, lb, a, b, c, cache, queue, worker, primary, replica, monitoring],
        edges: [
          edge(client.id, cdn.id),
          edge(cdn.id, lb.id),
          edge(lb.id, a.id),
          edge(lb.id, b.id),
          edge(lb.id, c.id),
          edge(a.id, cache.id),
          edge(b.id, cache.id),
          edge(c.id, queue.id),
          edge(queue.id, worker.id),
          edge(cache.id, primary.id),
          edge(b.id, primary.id),
          edge(primary.id, replica.id),
        ],
      };
    },
  },
];
