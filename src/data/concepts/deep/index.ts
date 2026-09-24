import type { CategoryId, ConceptDepth } from '@/types';
import type { DepthMap } from './types';

export type { DepthMap } from './types';

/**
 * The long-form teaching content is roughly 700 KB of prose - larger than the
 * rest of the application put together - and it is only ever read as the
 * Lesson under the Diagram of one concept. So it is never imported statically:
 * each category is its own chunk, fetched when a learner opens a concept in it.
 *
 * Keep these lazy. A static import here would put every word of it into the
 * main bundle and undo the code splitting the rest of the app relies on.
 */
const LOADERS: Record<CategoryId, () => Promise<DepthMap>> = {
  'getting-started': () => import('./getting-started').then((module) => module.gettingStartedDepth),
  scaling: () => import('./scaling').then((module) => module.scalingDepth),
  networking: () => import('./networking').then((module) => module.networkingDepth),
  data: () => import('./data').then((module) => module.dataDepth),
  performance: () => import('./performance').then((module) => module.performanceDepth),
  distributed: () => import('./distributed').then((module) => module.distributedDepth),
  communication: () => import('./communication').then((module) => module.communicationDepth),
  async: () => import('./async').then((module) => module.asyncDepth),
  reliability: () => import('./reliability').then((module) => module.reliabilityDepth),
  security: () => import('./security').then((module) => module.securityDepth),
  architecture: () => import('./architecture').then((module) => module.architectureDepth),
  observability: () => import('./observability').then((module) => module.observabilityDepth),
  patterns: () => import('./patterns').then((module) => module.patternsDepth),
};

/** Every category, for the coverage check in scripts/check-content.mjs. */
export const DEPTH_CATEGORIES = Object.keys(LOADERS) as CategoryId[];

export const loadCategoryDepth = (category: CategoryId): Promise<DepthMap> => LOADERS[category]();

/** Resolves to undefined rather than throwing, so a missing entry degrades. */
export const loadDepth = async (
  category: CategoryId,
  slug: string,
): Promise<ConceptDepth | undefined> => (await loadCategoryDepth(category))[slug];
