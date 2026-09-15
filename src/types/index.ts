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
