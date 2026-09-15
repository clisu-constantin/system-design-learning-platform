import type { LazyExoticComponent, ComponentType } from 'react';
import { lazyWithRetry } from '@/utils/lazyWithRetry';
import type { CategoryId, Difficulty, LabId } from '@/types';

export interface LabDefinition {
  id: LabId;
  title: string;
  blurb: string;
  category: CategoryId;
  difficulty: Difficulty;
  /** Concept page this lab belongs to. */
  concept: string;
  /** Shown on the home page as a featured lab. */
  featured?: boolean;
  Component: LazyExoticComponent<ComponentType>;
}

/**
 * Every interactive lab in one registry.
 *
 * Adding a lab is: build the component, add a row here, and set `lab: '<id>'`
 * on the concept that should host it. Nothing else needs to change.
 */
export const LABS: LabDefinition[] = [
  {
    id: 'requirements',
    title: 'Requirements Lab',
    blurb: 'Pick what a system must do, set how well it must do it, and see the architecture that follows.',
    category: 'getting-started',
    difficulty: 'Beginner',
    concept: 'functional-requirements',
    Component: lazyWithRetry(() => import('@/features/fundamentals/RequirementsLab')),
  },
  {
    id: 'capacity',
    title: 'Capacity Estimation Playground',
    blurb: 'Turn daily active users into requests per second, storage and bandwidth, step by step.',
    category: 'getting-started',
    difficulty: 'Beginner',
    concept: 'capacity-estimation',
    Component: lazyWithRetry(() => import('@/features/fundamentals/CapacityLab')),
  },
  {
    id: 'url-journey',
    title: 'What Happens When You Type a URL?',
    blurb: 'Twelve stages from Enter to painted pixels, each one clickable.',
    category: 'networking',
    difficulty: 'Beginner',
    concept: 'what-happens-when-you-type-a-url',
    featured: true,
    Component: lazyWithRetry(() => import('@/features/networking/UrlJourneyLab')),
  },
  {
    id: 'vertical-scaling',
    title: 'Vertical Scaling Lab',
    blurb: 'Overload one machine, upgrade it, and find what an upgrade does not fix.',
    category: 'scaling',
    difficulty: 'Beginner',
    concept: 'vertical-scaling',
    Component: lazyWithRetry(() => import('@/features/scaling/VerticalScalingLab')),
  },
  {
    id: 'horizontal-scaling',
    title: 'Horizontal Scaling Lab',
    blurb: 'Add servers behind a load balancer and watch load, latency and errors redistribute.',
    category: 'scaling',
    difficulty: 'Beginner',
    concept: 'horizontal-scaling',
    Component: lazyWithRetry(() => import('@/features/scaling/HorizontalScalingLab')),
  },
  {
    id: 'load-balancer',
    title: 'Load Balancer Lab',
    blurb: 'Traffic, algorithms, health checks and a kill switch on every server.',
    category: 'scaling',
    difficulty: 'Beginner',
    concept: 'load-balancing',
    featured: true,
    Component: lazyWithRetry(() => import('@/features/load-balancing/LoadBalancerLab')),
  },
  {
    id: 'auto-scaling',
    title: 'Auto Scaling Lab',
    blurb: 'Set thresholds and cooldown, then watch the fleet chase a traffic spike.',
    category: 'scaling',
    difficulty: 'Intermediate',
    concept: 'auto-scaling',
    Component: lazyWithRetry(() => import('@/features/scaling/AutoScalingLab')),
  },
  {
    id: 'stateless',
    title: 'Stateless vs Stateful Lab',
    blurb: 'Local sessions, sticky sessions, Redis and JWT - and what breaks in each.',
    category: 'scaling',
    difficulty: 'Beginner',
    concept: 'stateless-applications',
    Component: lazyWithRetry(() => import('@/features/scaling/StatelessLab')),
  },
  {
    id: 'caching',
    title: 'Caching Lab',
    blurb: 'Hit and miss paths, TTL, eviction, and the database load that disappears.',
    category: 'performance',
    difficulty: 'Beginner',
    concept: 'caching',
    featured: true,
    Component: lazyWithRetry(() => import('@/features/caching/CachingLab')),
  },
  {
    id: 'cache-strategies',
    title: 'Cache Strategies Lab',
    blurb: 'Step through cache-aside, read-through, write-through, write-behind and write-around.',
    category: 'performance',
    difficulty: 'Intermediate',
    concept: 'cache-strategies',
    Component: lazyWithRetry(() => import('@/features/caching/CacheStrategiesLab')),
  },
  {
    id: 'cdn',
    title: 'CDN Lab',
    blurb: 'Three regions, one origin, and the speed of light as a hard constraint.',
    category: 'networking',
    difficulty: 'Beginner',
    concept: 'cdn',
    Component: lazyWithRetry(() => import('@/features/networking/CdnLab')),
  },
  {
    id: 'api-gateway',
    title: 'API Gateway Lab',
    blurb: 'Auth, rate limits, routing and transformation - one pipeline, one request.',
    category: 'networking',
    difficulty: 'Intermediate',
    concept: 'api-gateway',
    Component: lazyWithRetry(() => import('@/features/networking/ApiGatewayLab')),
  },
  {
    id: 'indexing',
    title: 'Database Indexing Lab',
    blurb: 'Scan 8,000 rows, then build a B-tree and do it in thirteen.',
    category: 'data',
    difficulty: 'Beginner',
    concept: 'database-indexing',
    featured: true,
    Component: lazyWithRetry(() => import('@/features/databases/IndexingLab')),
  },
  {
    id: 'replication',
    title: 'Database Replication Lab',
    blurb: 'Replication lag, stale reads, and what a failover costs you.',
    category: 'data',
    difficulty: 'Intermediate',
    concept: 'replication',
    featured: true,
    Component: lazyWithRetry(() => import('@/features/databases/ReplicationLab')),
  },
  {
    id: 'sharding',
    title: 'Database Sharding Lab',
    blurb: 'Choose a shard key and watch a bad one create a hot shard.',
    category: 'data',
    difficulty: 'Advanced',
    concept: 'sharding',
    Component: lazyWithRetry(() => import('@/features/databases/ShardingLab')),
  },
  {
    id: 'queue',
    title: 'Message Queue Lab',
    blurb: 'Producers, workers, queue depth and backpressure you can watch grow.',
    category: 'async',
    difficulty: 'Beginner',
    concept: 'message-queues',
    featured: true,
    Component: lazyWithRetry(() => import('@/features/queues/QueueLab')),
  },
  {
    id: 'rate-limiting',
    title: 'Rate Limiting Lab',
    blurb: 'Fixed window, sliding window, token bucket and leaky bucket, side by side.',
    category: 'security',
    difficulty: 'Intermediate',
    concept: 'rate-limiting',
    Component: lazyWithRetry(() => import('@/features/security/RateLimitingLab')),
  },
  {
    id: 'circuit-breaker',
    title: 'Circuit Breaker Lab',
    blurb: 'Break a dependency and watch the state machine protect the caller.',
    category: 'reliability',
    difficulty: 'Intermediate',
    concept: 'circuit-breaker',
    Component: lazyWithRetry(() => import('@/features/reliability/CircuitBreakerLab')),
  },
  {
    id: 'retry-backoff',
    title: 'Retry and Backoff Lab',
    blurb: 'One request retrying, and the retry storm thousands of clients create.',
    category: 'reliability',
    difficulty: 'Intermediate',
    concept: 'retry',
    Component: lazyWithRetry(() => import('@/features/reliability/RetryBackoffLab')),
  },
  {
    id: 'cap-theorem',
    title: 'CAP Theorem Lab',
    blurb: 'Partition the network and choose: reject the write, or accept divergence.',
    category: 'distributed',
    difficulty: 'Intermediate',
    concept: 'cap-theorem',
    Component: lazyWithRetry(() => import('@/features/distributed/CapTheoremLab')),
  },
  {
    id: 'monolith-microservices',
    title: 'Monolith vs Microservices Lab',
    blurb: 'Same product, two architectures, and an honest comparison of both.',
    category: 'architecture',
    difficulty: 'Advanced',
    concept: 'microservices',
    Component: lazyWithRetry(() => import('@/features/architecture/MonolithMicroservicesLab')),
  },
  {
    id: 'tracing',
    title: 'Distributed Tracing Lab',
    blurb: 'A waterfall of spans that shows exactly where the time went.',
    category: 'observability',
    difficulty: 'Intermediate',
    concept: 'distributed-tracing',
    Component: lazyWithRetry(() => import('@/features/observability/TracingLab')),
  },
];

export const LAB_BY_ID = new Map(LABS.map((lab) => [lab.id, lab]));

export const getLab = (id: string | undefined) => (id ? LAB_BY_ID.get(id as LabId) : undefined);

export const FEATURED_LABS = LABS.filter((lab) => lab.featured);
