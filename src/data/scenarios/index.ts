import { coreScenarios } from './core';
import { moreScenarios } from './more';

export * from './types';

/** All design walkthroughs, in suggested reading order (easiest first). */
export const SCENARIOS = [...coreScenarios, ...moreScenarios];

export const SCENARIO_BY_SLUG = new Map(SCENARIOS.map((scenario) => [scenario.slug, scenario]));

export const getScenario = (slug: string | undefined) =>
  slug ? SCENARIO_BY_SLUG.get(slug) : undefined;
