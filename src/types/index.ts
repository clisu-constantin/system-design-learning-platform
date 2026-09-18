export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';

export type CategoryId =
  | 'getting-started'
  | 'scaling'
  | 'networking'
  | 'data'
  | 'performance'
  | 'distributed'
  | 'communication'
  | 'async'
  | 'reliability'
  | 'security'
  | 'architecture'
  | 'observability'
  | 'patterns';

export interface Category {
  id: CategoryId;
  title: string;
  blurb: string;
  icon: string;
  accent: 'brand' | 'ok' | 'warn' | 'danger' | 'info' | 'violet';
}

/** A single trade-off row: what you gain vs what it costs. */
export interface TradeOff {
  approach: string;
  gains: string[];
  costs: string[];
}

/**
 * A memorable everyday comparison. Juniors remember the picture long after they
 * forget the definition, so every concept gets exactly one.
 */
export interface Analogy {
  /** Short label for the picture, e.g. "The supermarket checkout". */
  title: string;
  /** Two to four sentences that map the picture back onto the concept. */
  body: string;
}

/** One teaching section of the long-form explanation. */
export interface DeepDiveSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
  /** Optional fixed-width block: code, a config snippet or a small table. */
  code?: { caption?: string; body: string };
}

/** A concrete worked example with real numbers a junior can follow along with. */
export interface WorkedExample {
  title: string;
  /** The situation, in one or two sentences. */
  setup: string;
  /** Ordered steps. Each one should carry a concrete number or value. */
  walkthrough: string[];
  /** What the numbers end up saying - the point of the example. */
  result: string;
}

/** A word seniors use without explaining it, translated into plain language. */
export interface JargonTerm {
  term: string;
  plain: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  /** index into options */
  answer: number;
  explanation: string;
}

/**
 * Educational payload for one concept page. Every field is optional except the
 * identity fields so that a concept can start as an outline and grow.
 */
export interface Concept {
  slug: string;
  title: string;
  /** One sentence shown under the title. */
  tagline: string;
  category: CategoryId;
  difficulty: Difficulty;
  /** Registered interactive lab id, if this concept has one. */
  lab?: LabId;
  keywords?: string[];
  what?: string;
  why?: string;
  how?: string[];
  when?: string[];
  advantages?: string[];
  tradeoffs?: TradeOff[];
  mistakes?: string[];
  realWorld?: string[];
  diagram?: string;
  related?: string[];
  quiz?: QuizQuestion[];
}

/**
 * The long-form, junior-friendly half of a lesson, shown on the "Full
 * explanation" tab. It is deliberately not part of `Concept`: it is far larger
 * than the rest of the catalogue and is loaded on demand, per category, from
 * `src/data/concepts/deep`.
 */
export interface ConceptDepth {
  analogy: Analogy;
  deepDive: DeepDiveSection[];
  examples: WorkedExample[];
  jargon: JargonTerm[];
  /** Three to five one-line takeaways worth memorising. */
  remember: string[];
}

export type LabId =
  | 'requirements'
  | 'capacity'
  | 'vertical-scaling'
  | 'horizontal-scaling'
  | 'load-balancer'
  | 'auto-scaling'
  | 'stateless'
  | 'caching'
  | 'cache-strategies'
  | 'cdn'
  | 'indexing'
  | 'replication'
  | 'sharding'
  | 'queue'
  | 'rate-limiting'
  | 'circuit-breaker'
  | 'retry-backoff'
  | 'cap-theorem'
  | 'monolith-microservices'
  | 'api-gateway'
  | 'tracing'
  | 'url-journey';

export type NodeStatus = 'healthy' | 'degraded' | 'down' | 'starting';

/** Conceptual model of an infrastructure component inside a simulation. */
export interface SystemNode {
  id: string;
  type: NodeKind;
  label: string;
  /** Requests per second this node can absorb before saturating. */
  capacity: number;
  currentLoad: number;
  status: NodeStatus;
}

export type NodeKind =
  | 'client'
  | 'dns'
  | 'cdn'
  | 'load-balancer'
  | 'api-gateway'
  | 'server'
  | 'service'
  | 'cache'
  | 'sql'
  | 'nosql'
  | 'queue'
  | 'worker'
  | 'storage'
  | 'search'
  | 'monitoring';

export type RequestOutcome = 'success' | 'cache-hit' | 'warning' | 'failure';

/** A single simulated request travelling through the architecture. */
export interface SimulatedRequest {
  id: number;
  createdAt: number;
  currentNode: string;
  status: 'active' | 'completed' | 'failed';
  outcome: RequestOutcome;
  latency: number;
  path: string[];
  method?: string;
  endpoint?: string;
  notes?: string[];
}
