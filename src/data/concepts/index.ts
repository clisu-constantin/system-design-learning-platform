import type { CategoryId, Concept, ConceptSummary, LabId } from '@/types';
import SUMMARIES from 'virtual:concept-index';
import { CATEGORIES } from '../categories';

/**
 * The concept index: slug, title, tagline, category, difficulty, lab and
 * keywords for every concept, in catalogue order. It is generated at build time
 * from the full catalogue (all.ts -> summaries.ts, via the concept-index Vite
 * plugin), so there is nothing to keep in sync by hand.
 *
 * The lesson body is NOT here: the sidebar, search and progress need only this,
 * and it keeps ~60 KB (gzip) of lesson text out of the main bundle. A concept
 * page loads its category with `loadConcept`. The long-form "Full explanation"
 * content is separate again, in ./deep.
 */
export const CONCEPTS: ConceptSummary[] = SUMMARIES;

export const CONCEPT_BY_SLUG = new Map(CONCEPTS.map((concept) => [concept.slug, concept]));

export const CONCEPTS_BY_CATEGORY = CATEGORIES.reduce<Record<CategoryId, ConceptSummary[]>>(
  (accumulator, category) => {
    accumulator[category.id] = CONCEPTS.filter((concept) => concept.category === category.id);
    return accumulator;
  },
  {} as Record<CategoryId, ConceptSummary[]>,
);

export const getConcept = (slug: string | undefined) =>
  slug ? CONCEPT_BY_SLUG.get(slug) : undefined;

/** Related links are resolved defensively so a typo cannot break a page. */
export const resolveRelated = (concept: Pick<Concept, 'related'>): ConceptSummary[] =>
  (concept.related ?? [])
    .map((slug) => CONCEPT_BY_SLUG.get(slug))
    .filter((value): value is ConceptSummary => Boolean(value));

export const conceptsWithLab = CONCEPTS.filter((concept) => concept.lab);

/** First concept that owns a given lab - used to link a lab back to its lesson. */
export const conceptForLab = (lab: LabId) => conceptsWithLab.find((concept) => concept.lab === lab);

export const LAB_COUNT = new Set(conceptsWithLab.map((concept) => concept.lab)).size;

/*
 * Full lessons, one chunk per category. Every concept lives in the file named
 * after its category - scripts/check-content.mjs fails the build otherwise,
 * because `loadConcept` would never find it.
 */
const LOADERS: Record<CategoryId, () => Promise<Concept[]>> = {
  'getting-started': () => import('./getting-started').then((module) => module.gettingStartedConcepts),
  scaling: () => import('./scaling').then((module) => module.scalingConcepts),
  networking: () => import('./networking').then((module) => module.networkingConcepts),
  data: () => import('./data').then((module) => module.dataConcepts),
  performance: () => import('./performance').then((module) => module.performanceConcepts),
  distributed: () => import('./distributed').then((module) => module.distributedConcepts),
  communication: () => import('./communication').then((module) => module.communicationConcepts),
  async: () => import('./async').then((module) => module.asyncConcepts),
  reliability: () => import('./reliability').then((module) => module.reliabilityConcepts),
  security: () => import('./security').then((module) => module.securityConcepts),
  architecture: () => import('./architecture').then((module) => module.architectureConcepts),
  observability: () => import('./observability').then((module) => module.observabilityConcepts),
  patterns: () => import('./patterns').then((module) => module.patternConcepts),
};

const loaded = new Map<CategoryId, Map<string, Concept>>();

/** The full lesson if its category has already been fetched - lets a revisit render without a spinner. */
export const peekConcept = (category: CategoryId, slug: string): Concept | undefined =>
  loaded.get(category)?.get(slug);

/** Fetches the category chunk once, then serves every concept in it from memory. */
export const loadConcept = async (category: CategoryId, slug: string): Promise<Concept | undefined> => {
  let bySlug = loaded.get(category);
  if (!bySlug) {
    const concepts = await LOADERS[category]();
    bySlug = new Map(concepts.map((concept) => [concept.slug, concept]));
    loaded.set(category, bySlug);
  }
  return bySlug.get(slug);
};
