import type { CategoryId, Concept, LabId } from '@/types';
import { CATEGORIES } from '../categories';
import { gettingStartedConcepts } from './getting-started';
import { scalingConcepts } from './scaling';
import { networkingConcepts } from './networking';
import { dataConcepts } from './data';
import { performanceConcepts } from './performance';
import { distributedConcepts } from './distributed';
import { communicationConcepts } from './communication';
import { asyncConcepts } from './async';
import { reliabilityConcepts } from './reliability';
import { securityConcepts } from './security';
import { architectureConcepts } from './architecture';
import { observabilityConcepts } from './observability';
import { patternConcepts } from './patterns';

/**
 * The full concept catalogue. Order inside a category is the order shown in the
 * sidebar, so new concepts should be inserted where they belong pedagogically.
 *
 * Long-form teaching content is NOT here: it lives in ./deep and is loaded per
 * category on demand, because it is several times the size of this file and is
 * only read on one tab of one concept.
 */
export const CONCEPTS: Concept[] = [
  ...gettingStartedConcepts,
  ...scalingConcepts,
  ...networkingConcepts,
  ...dataConcepts,
  ...performanceConcepts,
  ...distributedConcepts,
  ...communicationConcepts,
  ...asyncConcepts,
  ...reliabilityConcepts,
  ...securityConcepts,
  ...architectureConcepts,
  ...observabilityConcepts,
  ...patternConcepts,
];

export const CONCEPT_BY_SLUG = new Map(CONCEPTS.map((concept) => [concept.slug, concept]));

export const CONCEPTS_BY_CATEGORY = CATEGORIES.reduce<Record<CategoryId, Concept[]>>(
  (accumulator, category) => {
    accumulator[category.id] = CONCEPTS.filter((concept) => concept.category === category.id);
    return accumulator;
  },
  {} as Record<CategoryId, Concept[]>,
);

export const getConcept = (slug: string | undefined) =>
  slug ? CONCEPT_BY_SLUG.get(slug) : undefined;

/** Related links are resolved defensively so a typo cannot break a page. */
export const resolveRelated = (concept: Concept): Concept[] =>
  (concept.related ?? [])
    .map((slug) => CONCEPT_BY_SLUG.get(slug))
    .filter((value): value is Concept => Boolean(value));

export const conceptsWithLab = CONCEPTS.filter((concept) => concept.lab);

/** First concept that owns a given lab - used to link a lab back to its lesson. */
export const conceptForLab = (lab: LabId) => conceptsWithLab.find((concept) => concept.lab === lab);

export const LAB_COUNT = new Set(conceptsWithLab.map((concept) => concept.lab)).size;
