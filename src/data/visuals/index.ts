import type { VisualSpec } from '@/components/architecture/FlowVisual';
import { foundationVisuals } from './foundations';
import { scalingVisuals } from './scaling';
import { dataVisuals } from './data-performance';
import { systemVisuals } from './systems';

/**
 * Concept slug -> animated diagram.
 *
 * The diagram is the primary content of a concept page, so every concept should
 * eventually have one. `hasVisual` lets the page fall back gracefully while a
 * concept is still waiting for its diagram.
 */
export const VISUALS: Record<string, VisualSpec> = {
  ...foundationVisuals,
  ...scalingVisuals,
  ...dataVisuals,
  ...systemVisuals,
};

export const getVisual = (slug: string): VisualSpec | undefined => VISUALS[slug];

export const hasVisual = (slug: string) => slug in VISUALS;

/** The dashboard hero: users -> load balancer -> servers -> cache and database. */
export const HERO_VISUAL: VisualSpec = {
  width: 760,
  height: 399,
  nodes: [
    { id: 'users', kind: 'client', label: 'Users', sub: '3,400 req/sec', x: 300, y: 8, w: 170, h: 80 },
    { id: 'lb', kind: 'load-balancer', label: 'Load Balancer', x: 295, y: 106, w: 180, h: 70 },
    { id: 's1', kind: 'server', label: 'API 1', x: 55, y: 210, w: 140, h: 84, stat: ['CPU', '41%'] },
    { id: 's2', kind: 'server', label: 'API 2', x: 305, y: 210, w: 140, h: 84, stat: ['CPU', '38%'] },
    { id: 's3', kind: 'server', label: 'API 3', x: 555, y: 210, w: 140, h: 84, stat: ['CPU', '44%'] },
    { id: 'cache', kind: 'cache', label: 'Redis', sub: 'hit 91%', x: 120, y: 305, w: 150, h: 80 },
    { id: 'db', kind: 'sql', label: 'PostgreSQL', x: 480, y: 305, w: 150, h: 68 },
  ],
  edges: [
    { from: 'users', to: 'lb', tone: 'brand', rate: 6 },
    { from: 'lb', to: 's1', tone: 'ok', rate: 2 },
    { from: 'lb', to: 's2', tone: 'ok', rate: 2 },
    { from: 'lb', to: 's3', tone: 'ok', rate: 2 },
    { from: 's1', to: 'cache', tone: 'danger', rate: 1.8, outcome: 'cache-hit' },
    { from: 's2', to: 'cache', tone: 'danger', rate: 1.4, outcome: 'cache-hit' },
    { from: 's3', to: 'db', tone: 'info', rate: 0.8 },
  ],
};
