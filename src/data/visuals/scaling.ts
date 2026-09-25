import type { VisualSpec } from '@/components/architecture/FlowVisual';

/**
 * Visual specs for the scaling concepts.
 *
 * Every spec is a working diagram with traffic flowing through it - these are
 * the primary content of a concept page, not decoration for the text.
 */
export const scalingVisuals: Record<string, VisualSpec> = {
  'vertical-scaling': {
    width: 760,
    height: 330,
    caption: 'Before and after one resize: still one server, now on a bigger machine. Same code, same database.',
    nodes: [
      { id: 'users', kind: 'client', label: 'Users', sub: '550 req/sec', x: 60, y: 120, w: 150, h: 80 },
      { id: 'small', kind: 'server', label: 'Small server', sub: 'before: 2 vCPU / 4 GB', x: 290, y: 30, w: 190, h: 96, stat: ['CPU', '100%'], alert: true, status: 'degraded' },
      { id: 'large', kind: 'server', label: 'Large server', sub: 'after: 8 vCPU / 32 GB', x: 290, y: 200, w: 190, h: 96, stat: ['CPU', '26%'] },
      { id: 'db', kind: 'sql', label: 'Database', x: 570, y: 120, w: 150, h: 76 },
    ],
    edges: [
      { from: 'users', to: 'small', tone: 'danger', rate: 3.5, outcome: 'warning', label: 'overloaded' },
      { from: 'small', to: 'db', tone: 'warn', rate: 1.4, outcome: 'warning' },
      { from: 'users', to: 'large', tone: 'ok', rate: 3.5 },
      { from: 'large', to: 'db', tone: 'info', rate: 1.6 },
    ],
    steps: [
      { from: 'users', to: 'small', label: 'Before: 550/sec, capacity 500', outcome: 'failure' },
      { from: 'small', to: 'db', label: 'Slow: queued before the query', outcome: 'warning' },
      { from: 'users', to: 'large', label: 'After: resized to 8 vCPU' },
      { from: 'large', to: 'db', label: 'Same code, same database' },
    ],
  },

  'horizontal-scaling': {
    width: 760,
    height: 470,
    caption: 'Same traffic, split across identical instances. Losing one costs a share of capacity, not the service. All of them share one database.',
    nodes: [
      { id: 'users', kind: 'client', label: 'Users', sub: '900 req/sec', x: 305, y: 14, w: 150, h: 80 },
      { id: 'lb', kind: 'load-balancer', label: 'Load Balancer', sub: '2 nodes', x: 300, y: 125, w: 160, h: 80 },
      { id: 's1', kind: 'server', label: 'API 1', x: 80, y: 250, w: 140, h: 90, stat: ['CPU', '56%'] },
      { id: 's2', kind: 'server', label: 'API 2', x: 310, y: 250, w: 140, h: 90, stat: ['CPU', '57%'] },
      { id: 's3', kind: 'server', label: 'API 3', x: 540, y: 250, w: 140, h: 90, stat: ['CPU', '55%'] },
      { id: 'db', kind: 'sql', label: 'Database', sub: 'shared by all', x: 305, y: 380, w: 150, h: 80 },
    ],
    edges: [
      { from: 'users', to: 'lb', tone: 'brand', rate: 5 },
      { from: 'lb', to: 's1', tone: 'ok', rate: 1.7 },
      { from: 'lb', to: 's2', tone: 'ok', rate: 1.7 },
      { from: 'lb', to: 's3', tone: 'ok', rate: 1.7 },
      { from: 's1', to: 'db', tone: 'info', rate: 1.2 },
      { from: 's2', to: 'db', tone: 'info', rate: 1.2 },
      { from: 's3', to: 'db', tone: 'info', rate: 1.2 },
    ],
    steps: [
      { from: 'users', to: 'lb', label: 'All traffic hits one address' },
      { from: 'lb', to: 's1', label: 'Request 1 to API 1' },
      { from: 'lb', to: 's2', label: 'Request 2 to API 2' },
      { from: 'lb', to: 's3', label: 'Request 3 to API 3' },
      { from: 's3', to: 'db', label: 'Every API queries one database' },
    ],
  },

  'load-balancing': {
    width: 760,
    height: 360,
    caption: 'Round robin spreads requests in turn; a failed health check takes Server 2 out of the rotation.',
    nodes: [
      { id: 'users', kind: 'client', label: 'Users', sub: '500 req/sec', x: 305, y: 10, w: 150, h: 80 },
      { id: 'lb', kind: 'load-balancer', label: 'Load Balancer', sub: 'round robin', x: 295, y: 120, w: 170, h: 80 },
      { id: 's1', kind: 'server', label: 'Server 1', x: 70, y: 255, w: 145, h: 90, stat: ['CPU', '35%'] },
      { id: 's2', kind: 'server', label: 'Server 2', x: 305, y: 255, w: 145, h: 90, stat: ['CPU', '0%'], status: 'down' },
      { id: 's3', kind: 'server', label: 'Server 3', x: 540, y: 255, w: 145, h: 90, stat: ['CPU', '51%'] },
    ],
    edges: [
      { from: 'users', to: 'lb', tone: 'brand', rate: 5 },
      { from: 'lb', to: 's1', tone: 'ok', rate: 2.4 },
      { from: 'lb', to: 's2', tone: 'muted', dashed: true, label: 'health check failed' },
      { from: 'lb', to: 's3', tone: 'ok', rate: 2.4 },
    ],
    steps: [
      { from: 'users', to: 'lb', label: 'One address for clients' },
      { from: 'lb', to: 's2', label: 'Health check to Server 2 fails', outcome: 'failure' },
      { from: 'lb', to: 's1', label: 'Round robin: request to Server 1' },
      { from: 'lb', to: 's3', label: 'Next request skips to Server 3' },
    ],
  },

  'auto-scaling': {
    width: 760,
    height: 343,
    caption: 'Average CPU above the 70% threshold launches an instance; it serves traffic only once its health check passes.',
    nodes: [
      { id: 'users', kind: 'client', label: 'Traffic doubles', sub: '600 to 1,200 req/sec', x: 290, y: 12, w: 180, h: 80 },
      { id: 'lb', kind: 'load-balancer', label: 'Load Balancer', sub: '2 nodes', x: 300, y: 122, w: 160, h: 80 },
      { id: 'a1', kind: 'server', label: 'api-1', x: 60, y: 245, w: 135, h: 90, stat: ['CPU', '80%'], alert: true },
      { id: 'a2', kind: 'server', label: 'api-2', x: 235, y: 245, w: 135, h: 90, stat: ['CPU', '76%'], alert: true },
      { id: 'a3', kind: 'server', label: 'api-3', x: 410, y: 245, w: 135, h: 90, stat: ['CPU', '78%'], alert: true },
      { id: 'a4', kind: 'server', label: 'api-4', sub: 'booting', x: 585, y: 245, w: 135, h: 84, status: 'starting' },
    ],
    edges: [
      { from: 'users', to: 'lb', tone: 'brand', rate: 6 },
      { from: 'lb', to: 'a1', tone: 'warn', rate: 2 },
      { from: 'lb', to: 'a2', tone: 'warn', rate: 2 },
      { from: 'lb', to: 'a3', tone: 'warn', rate: 2 },
      { from: 'lb', to: 'a4', tone: 'muted', dashed: true, label: 'warming up' },
    ],
    steps: [
      { from: 'users', to: 'lb', label: 'Traffic doubles to 1,200/sec' },
      { from: 'lb', to: 'a1', label: 'api-1 climbs to 80% CPU', outcome: 'warning' },
      { from: 'lb', to: 'a2', label: 'api-2 climbs to 76% CPU', outcome: 'warning' },
      { from: 'lb', to: 'a3', label: 'Average 78%: over 70% threshold', outcome: 'warning' },
      // No request goes to an instance that is still booting.
      { from: 'lb', to: 'a4', label: 'api-4 launched, still booting', skipped: true },
      { from: 'lb', to: 'a4', label: 'Health check passes, api-4 joins' },
    ],
  },

  'stateless-applications': {
    width: 760,
    height: 359,
    caption: 'Sessions live in Redis, so any server can serve any user.',
    nodes: [
      { id: 'user', kind: 'client', label: 'User A', x: 305, y: 10, w: 150, h: 69 },
      { id: 'lb', kind: 'load-balancer', label: 'Load Balancer', x: 300, y: 115, w: 160, h: 70 },
      { id: 's1', kind: 'server', label: 'Server 1', sub: 'no local state', x: 100, y: 220, w: 150, h: 80 },
      { id: 's2', kind: 'server', label: 'Server 2', sub: 'no local state', x: 510, y: 220, w: 150, h: 80 },
      { id: 'redis', kind: 'cache', label: 'Redis', sub: 'shared sessions', x: 305, y: 265, w: 150, h: 80 },
    ],
    edges: [
      { from: 'user', to: 'lb', tone: 'brand', rate: 3 },
      { from: 'lb', to: 's1', tone: 'ok', rate: 1.6 },
      { from: 'lb', to: 's2', tone: 'ok', rate: 1.6 },
      { from: 's1', to: 'redis', tone: 'danger', rate: 1.4, outcome: 'cache-hit' },
      { from: 's2', to: 'redis', tone: 'danger', rate: 1.4, outcome: 'cache-hit' },
    ],
    steps: [
      { from: 'user', to: 'lb', label: 'Request 1' },
      { from: 'lb', to: 's1', label: 'Lands on Server 1' },
      { from: 's1', to: 'redis', label: 'Session loaded from Redis', outcome: 'cache-hit' },
      { from: 'lb', to: 's2', label: 'Request 2 lands elsewhere' },
      { from: 's2', to: 'redis', label: 'Same session, still found', outcome: 'cache-hit' },
    ],
  },

  'stateful-applications': {
    width: 760,
    height: 320,
    caption: 'State is concentrated in a few systems that are replicated and backed up.',
    nodes: [
      { id: 'app', kind: 'server', label: 'Stateless tier', sub: 'scale by copies', x: 60, y: 120, w: 170, h: 82 },
      { id: 'db', kind: 'sql', label: 'PostgreSQL', sub: 'replicated', x: 320, y: 30, w: 160, h: 80 },
      { id: 'cache', kind: 'cache', label: 'Redis', sub: 'in memory', x: 320, y: 200, w: 160, h: 80 },
      { id: 'queue', kind: 'queue', label: 'Kafka', sub: 'durable log', x: 560, y: 115, w: 160, h: 80 },
    ],
    edges: [
      { from: 'app', to: 'db', tone: 'info', rate: 1.6 },
      { from: 'app', to: 'cache', tone: 'danger', rate: 2.2, outcome: 'cache-hit' },
      { from: 'app', to: 'queue', tone: 'warn', rate: 1.2 },
    ],
    steps: [
      { from: 'app', to: 'db', label: 'Rows persist in replicated Postgres' },
      { from: 'app', to: 'cache', label: 'Hot data served from Redis', outcome: 'cache-hit' },
      { from: 'app', to: 'queue', label: 'Events appended to Kafka log' },
    ],
  },
};
