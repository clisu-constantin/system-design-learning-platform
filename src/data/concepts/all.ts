import type { Concept } from '@/types';
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
 * The full concept catalogue, every field of every lesson. Order inside a
 * category is the order shown in the sidebar, so new concepts should be
 * inserted where they belong pedagogically.
 *
 * NEVER import this from application code: it is ~200 KB of lesson text and
 * would land in the main bundle. The app reads the light index from
 * `@/data/concepts` and loads a category's lessons with `loadConcept`. This file
 * feeds the build-time index (summaries.ts) and the check scripts only.
 */
export const ALL_CONCEPTS: Concept[] = [
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
