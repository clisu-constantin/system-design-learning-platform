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

// Kept in its own module so the dashboard does not download every concept diagram;
// re-exported here for scripts/check-visuals.mjs.
export { HERO_VISUAL } from './hero';
