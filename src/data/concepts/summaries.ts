import type { Concept, ConceptSummary } from '@/types';
import { ALL_CONCEPTS } from './all';

/**
 * Build-time entry for the `virtual:concept-index` module
 * (scripts/vite-plugin-concept-index.ts bundles this file, runs it and inlines
 * the result as JSON). Like all.ts, never import it from application code.
 *
 * Typed against ConceptSummary so a field added to the summary type cannot be
 * forgotten here.
 */
const toSummary = (concept: Concept): ConceptSummary => ({
  slug: concept.slug,
  title: concept.title,
  tagline: concept.tagline,
  category: concept.category,
  difficulty: concept.difficulty,
  lab: concept.lab,
  keywords: concept.keywords,
});

export const SUMMARIES: ConceptSummary[] = ALL_CONCEPTS.map(toSummary);
