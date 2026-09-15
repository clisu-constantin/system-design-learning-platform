import type { Difficulty, TradeOff } from '@/types';

export interface EstimationStep {
  label: string;
  formula: string;
  result: string;
}

export interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'WS';
  path: string;
  note: string;
}

export interface BottleneckItem {
  problem: string;
  solution: string;
}

export interface RequirementItem {
  label: string;
  /** Core requirements drive the architecture; the rest are explicitly out of scope. */
  core: boolean;
  note?: string;
}

/**
 * A full design walkthrough. The section order matches how an interview or a
 * design document usually proceeds.
 */
export interface Scenario {
  slug: string;
  title: string;
  tagline: string;
  difficulty: Difficulty;
  functional: RequirementItem[];
  nonFunctional: { label: string; target: string; implication: string }[];
  capacity: EstimationStep[];
  highLevel: string;
  database: { choice: string; reasoning: string; alternatives: string };
  api: ApiEndpoint[];
  scaling: string[];
  caching: string[];
  reliability: string[];
  bottlenecks: BottleneckItem[];
  tradeoffs: TradeOff[];
  /** Concept slugs the learner should read alongside this scenario. */
  concepts: string[];
}
