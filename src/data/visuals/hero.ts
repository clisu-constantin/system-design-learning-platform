import type { VisualSpec } from '@/components/architecture/FlowVisual';

/**
 * The dashboard hero: users -> load balancer -> servers -> cache and database.
 *
 * Every API instance reaches both the cache and the database, because that is
 * what interchangeable instances means - a diagram where only one of them talks
 * to Redis teaches a system where the instances are not interchangeable.
 */
export const HERO_VISUAL: VisualSpec = {
  width: 760,
  height: 399,
  nodes: [
    { id: 'users', kind: 'client', label: 'Users', sub: '3,400 req/sec', x: 300, y: 8, w: 170, h: 80 },
    { id: 'lb', kind: 'load-balancer', label: 'Load Balancer', sub: '2 nodes, multi-AZ', x: 288, y: 104, w: 190, h: 78 },
    { id: 's1', kind: 'server', label: 'API 1', x: 40, y: 206, w: 140, h: 90, stat: ['CPU', '41%'] },
    { id: 's2', kind: 'server', label: 'API 2', x: 310, y: 206, w: 140, h: 90, stat: ['CPU', '38%'] },
    { id: 's3', kind: 'server', label: 'API 3', x: 580, y: 206, w: 140, h: 90, stat: ['CPU', '44%'] },
    { id: 'cache', kind: 'cache', label: 'Redis', sub: 'hit 91%', x: 150, y: 312, w: 150, h: 80 },
    { id: 'db', kind: 'sql', label: 'PostgreSQL', x: 455, y: 312, w: 150, h: 80 },
  ],
  edges: [
    { from: 'users', to: 'lb', tone: 'brand', rate: 6 },
    { from: 'lb', to: 's1', tone: 'ok', rate: 2 },
    { from: 'lb', to: 's2', tone: 'ok', rate: 2 },
    { from: 'lb', to: 's3', tone: 'ok', rate: 2 },
    { from: 's1', to: 'cache', tone: 'danger', rate: 1.8, outcome: 'cache-hit' },
    { from: 's2', to: 'cache', tone: 'danger', rate: 1.6, outcome: 'cache-hit' },
    { from: 's3', to: 'cache', tone: 'danger', rate: 1.7, outcome: 'cache-hit' },
    { from: 's1', to: 'db', tone: 'info', rate: 0.7 },
    { from: 's2', to: 'db', tone: 'info', rate: 0.6 },
    { from: 's3', to: 'db', tone: 'info', rate: 0.8 },
  ],
};
