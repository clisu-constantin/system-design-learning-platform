import type { Concept } from '@/types';

export const patternConcepts: Concept[] = [
  {
    slug: 'fan-out',
    title: 'Fan-out',
    tagline: 'Write once to many places, or read from many places once.',
    category: 'patterns',
    difficulty: 'Intermediate',
    keywords: ['feed', 'push', 'pull', 'celebrity problem', 'timeline'],
    what: 'Fan-out is the pattern of distributing one event to many destinations - most visibly in social feeds, where a post must reach every follower.',
    why: 'It is the canonical read-vs-write trade. Fan-out on write precomputes every timeline (fast reads, expensive writes); fan-out on read assembles at query time (cheap writes, expensive reads).',
    how: [
      'Fan-out on write: when a user posts, insert into every follower timeline.',
      'Fan-out on read: when a user opens the app, query the posts of everyone they follow and merge.',
      'Hybrid: precompute for normal users, query at read time for accounts with millions of followers.',
    ],
    diagram: `FAN-OUT ON WRITE            FAN-OUT ON READ
post -> 5,000 timelines     post -> 1 row
read = 1 lookup             read = merge 300 sources
celebrity with 50M          celebrity costs nothing extra
followers = 50M writes      but every read is expensive`,
    tradeoffs: [
      {
        approach: 'Fan-out on write',
        gains: ['Very fast reads', 'Predictable read cost'],
        costs: ['Write amplification', 'The celebrity problem', 'Storage duplication', 'Deletes must fan out too'],
      },
      {
        approach: 'Fan-out on read',
        gains: ['Cheap writes', 'No duplication', 'No celebrity problem'],
        costs: ['Expensive, variable reads', 'Hard to keep p99 low'],
      },
    ],
    mistakes: ['Choosing one globally instead of hybridising by follower count.'],
    related: ['pub-sub', 'denormalization', 'caching', 'backpressure'],
  },
  {
    slug: 'backpressure',
    title: 'Backpressure',
    tagline: 'Telling the producer to slow down instead of quietly falling over.',
    category: 'patterns',
    difficulty: 'Advanced',
    lab: 'queue',
    keywords: ['flow control', 'bounded queue', 'load shedding', 'queue depth'],
    what: 'Backpressure is explicit feedback from an overloaded consumer to its producer: slow down, or I will reject your work.',
    why: 'Without it, an overloaded system buffers until memory is gone or latency is so high that every response is useless anyway. Failing fast is a feature.',
    how: [
      'Use bounded queues - an unbounded queue is a memory leak with a timer.',
      'When the bound is reached, reject (429/503), block the producer, or shed low-priority work.',
      'Propagate the signal upstream so the pressure reaches the actual source.',
      'Monitor queue depth and oldest-message age, not only throughput.',
    ],
    diagram: `Producer 1000/s -> [bounded queue: 10,000] -> Consumers 400/s
queue full after 16 s
  -> reject new work with 429 (fast, honest)
  -> or block the producer (flow control)
  -> NOT: grow forever, then OOM and lose everything`,
    tradeoffs: [
      {
        approach: 'Bounded queue + rejection',
        gains: ['Bounded memory and latency', 'Clear signal to clients', 'System stays responsive'],
        costs: ['Some work is refused', 'Clients must handle rejection properly'],
      },
      {
        approach: 'Unbounded buffering',
        gains: ['Nothing is refused immediately'],
        costs: ['Latency grows without limit', 'Eventual OOM loses everything at once'],
      },
    ],
    mistakes: ['Increasing the queue size as a fix - it delays the failure and makes it bigger.'],
    related: ['message-queues', 'rate-limiting', 'bulkhead', 'circuit-breaker'],
    quiz: [
      {
        id: 'bp-1',
        prompt: 'A worker pool cannot keep up and the queue grows for hours. What is the best response?',
        options: [
          'Increase the queue size limit',
          'Add consumer capacity, and bound the queue so excess work is rejected or shed rather than buffered indefinitely',
          'Retry failed messages faster',
          'Reduce the visibility timeout',
        ],
        answer: 1,
        explanation:
          'A permanent deficit cannot be buffered away. Either process faster or refuse work explicitly, so latency and memory stay bounded.',
      },
    ],
  },
  {
    slug: 'bulkhead',
    title: 'Bulkhead',
    tagline: 'Separate resource pools so one flooded compartment does not sink the ship.',
    category: 'patterns',
    difficulty: 'Intermediate',
    keywords: ['isolation', 'thread pool', 'connection pool', 'blast radius'],
    what: 'The bulkhead pattern partitions resources - threads, connections, instances - per dependency or per tenant, so exhaustion in one partition cannot starve the others.',
    why: 'Shared pools couple unrelated failures. One slow dependency consuming every thread turns a partial failure into a total one.',
    how: [
      'Give each downstream dependency its own bounded pool with its own timeout.',
      'Separate critical from non-critical traffic (checkout versus recommendations).',
      'For multi-tenant systems, cap per-tenant concurrency so one tenant cannot consume the service.',
    ],
    diagram: `SHARED POOL (200 threads)         BULKHEADS
recommendations hangs             recs:     40 threads (exhausted)
 -> all 200 threads blocked       checkout: 80 threads (fine)
 -> checkout also down            search:   40 threads (fine)`,
    tradeoffs: [
      {
        approach: 'Per-dependency bulkheads',
        gains: ['Failures stay contained', 'Critical paths keep capacity'],
        costs: ['Lower peak utilisation - reserved capacity sits idle', 'More pools to size and monitor'],
      },
    ],
    mistakes: ['Sizing every bulkhead identically instead of by criticality.'],
    related: ['circuit-breaker', 'fault-tolerance', 'backpressure', 'connection-pooling'],
  },
  {
    slug: 'circuit-breaker-pattern',
    title: 'Circuit Breaker (Pattern)',
    tagline: 'The state machine, viewed as a reusable structural pattern.',
    category: 'patterns',
    difficulty: 'Intermediate',
    lab: 'circuit-breaker',
    keywords: ['state machine', 'threshold', 'cooldown', 'fallback'],
    what: 'As a pattern, the circuit breaker is a three-state machine (closed, open, half-open) wrapping any operation that can fail repeatedly.',
    why: 'The same structure protects HTTP calls, database connections, queue consumers and third-party SDKs. Recognising it as a pattern means you configure it rather than reinvent it.',
    how: [
      'Count failures over a rolling window, not since process start.',
      'Trip on failure ratio with a minimum request volume, so three calls cannot open the circuit.',
      'Cooldown, then allow limited trial traffic; success closes, failure reopens.',
      'Always pair with a fallback and with per-dependency isolation.',
    ],
    diagram: `CLOSED --(failure ratio > 50% over 20 calls)--> OPEN
OPEN --(cooldown 30 s)--> HALF-OPEN
HALF-OPEN --(3 successes)--> CLOSED
HALF-OPEN --(1 failure)--> OPEN`,
    tradeoffs: [
      {
        approach: 'Wrap a dependency in a circuit breaker',
        gains: ['A failing dependency is skipped fast instead of tying up threads on timeouts', 'Gives the dependency room to recover instead of a retry storm'],
        costs: ['Thresholds and cooldowns must be tuned, or it trips too early or too late', 'While open, callers get a fallback or an error even if the dependency has recovered'],
      },
      {
        approach: 'Separate breakers per endpoint or host instead of one per dependency',
        gains: ['One bad route or host is cut off while healthy ones keep serving', 'Fallbacks can be tailored to what each endpoint returns'],
        costs: ['More state, thresholds and dashboards to maintain', 'Each breaker sees less traffic, so it needs longer to gather enough calls to trip reliably'],
      },
    ],
    related: ['circuit-breaker', 'retry', 'bulkhead', 'fault-tolerance'],
  },
  {
    slug: 'saga-pattern',
    title: 'Saga Pattern',
    tagline: 'A sequence of local transactions with compensations instead of a distributed one.',
    category: 'patterns',
    difficulty: 'Advanced',
    keywords: ['compensation', 'orchestration', 'choreography', 'consistency', 'rollback'],
    what: 'A saga implements a business transaction spanning several services as a series of local transactions, each with a compensating action that semantically undoes it.',
    why: 'Two-phase commit across services is fragile and blocks. Sagas accept temporary inconsistency and define explicitly how to get back to a consistent state.',
    how: [
      'Break the workflow into steps, each a local transaction in one service.',
      'Define a compensation for each step - refund a charge, release a reservation.',
      'On failure, run compensations for completed steps in reverse order.',
      'Every step and compensation must be idempotent, because retries are guaranteed.',
    ],
    when: ['Multi-service workflows: order + payment + inventory + shipping.'],
    diagram: `1. reserve inventory   ok
2. charge payment      ok
3. schedule shipping   FAILED
   -> compensate 2: refund payment
   -> compensate 1: release inventory

The user may briefly see a charge that is later refunded.
That window is a product decision, not a bug.`,
    tradeoffs: [
      {
        approach: 'Saga',
        gains: ['No distributed locks or blocking coordinator', 'Each service stays autonomous', 'Scales across teams'],
        costs: [
          'Compensations must exist for every step - some actions cannot be undone (an email was sent)',
          'Intermediate states are visible to users',
          'Testing failure paths is substantial work',
        ],
      },
      {
        approach: 'Two-phase commit',
        gains: ['Atomic across participants'],
        costs: ['Coordinator failure blocks participants', 'Poor availability and throughput', 'Rarely supported across heterogeneous systems'],
      },
    ],
    mistakes: ['Designing the happy path and treating compensations as an afterthought.'],
    related: ['microservices', 'idempotency', 'outbox-pattern', 'event-driven-architecture'],
  },
  {
    slug: 'outbox-pattern',
    title: 'Outbox Pattern',
    tagline: 'Never write to the database and publish an event in two separate steps.',
    category: 'patterns',
    difficulty: 'Advanced',
    keywords: ['dual write', 'atomicity', 'cdc', 'relay', 'consistency'],
    what: 'The outbox pattern writes the domain change and the event to publish in the same database transaction, into an outbox table. A separate relay reads that table and publishes to the broker.',
    why: 'It removes the dual-write problem: a crash between "commit to database" and "publish to broker" otherwise leaves the system permanently inconsistent, with no way to detect it.',
    how: [
      'In one transaction: update the entity and insert a row into outbox.',
      'A relay polls the outbox (or reads the change log via CDC) and publishes.',
      'Mark rows as published; retry failures. Delivery is at-least-once, so consumers must be idempotent.',
    ],
    diagram: `BEGIN
  UPDATE orders SET status='placed' WHERE id=123;
  INSERT INTO outbox (type, payload) VALUES ('OrderPlaced', {...});
COMMIT                      <- atomic: both or neither

relay -> reads outbox -> publishes to Kafka -> marks sent`,
    tradeoffs: [
      {
        approach: 'Outbox + relay',
        gains: ['No lost or phantom events', 'Uses the database transaction you already have'],
        costs: ['Publishing latency (poll interval)', 'Outbox table needs cleanup', 'Another moving part to operate'],
      },
    ],
    mistakes: ['Publishing inside the transaction to a broker - if the transaction rolls back, the event was still sent.'],
    related: ['event-driven-architecture', 'idempotency', 'saga-pattern', 'kafka'],
  },
  {
    slug: 'leader-follower',
    title: 'Leader / Follower',
    tagline: 'One node decides, the others copy.',
    category: 'patterns',
    difficulty: 'Intermediate',
    keywords: ['primary', 'replica', 'ordering', 'failover'],
    what: 'A structural pattern where one node accepts all writes and orders them, and follower nodes replicate that ordered stream.',
    why: 'Ordering writes in one place removes write conflicts entirely, which is why it underpins most databases, brokers and coordination services.',
    how: [
      'Writes go to the leader, which assigns an order and streams it to followers.',
      'Followers serve reads (possibly stale) and stand ready for promotion.',
      'Leader failure triggers election; a quorum prevents two leaders.',
    ],
    diagram: `writes -> [LEADER] -> ordered log -> FOLLOWER (reads)
                               -> FOLLOWER (reads)
leader fails -> elect the most up-to-date follower`,
    tradeoffs: [
      {
        approach: 'Single leader',
        gains: ['No write conflicts', 'Simple ordering and reasoning'],
        costs: ['Write throughput capped by one node', 'Brief unavailability during failover'],
      },
      {
        approach: 'Multi-leader',
        gains: ['Writes accepted in several regions', 'Survives leader loss without failover'],
        costs: ['Write conflicts are unavoidable and must be resolved', 'Much harder to reason about'],
      },
    ],
    related: ['replication', 'leader-election', 'consensus', 'failover'],
  },
  {
    slug: 'producer-consumer',
    title: 'Producer / Consumer',
    tagline: 'A buffer between work creation and work execution.',
    category: 'patterns',
    difficulty: 'Beginner',
    lab: 'queue',
    keywords: ['queue', 'decoupling', 'throughput', 'workers'],
    what: 'Producers create work items and place them in a shared buffer; consumers take items and process them, at their own pace.',
    why: 'It decouples rates. Producers can burst, consumers can be scaled independently, and the buffer absorbs the difference - within its bounds.',
    how: [
      'Size the consumer pool from required throughput: arrival rate / per-consumer rate.',
      'Bound the buffer so overload is visible and controlled.',
      'Each item should be processed by exactly one consumer, and processing should be idempotent.',
    ],
    diagram: `Producers --> [ bounded buffer ] --> Consumers
 100/s                depth                 3 x 40/s = 120/s
stable: consumption >= production`,
    tradeoffs: [
      {
        approach: 'Buffered producer/consumer',
        gains: ['Absorbs bursts', 'Independent scaling', 'Failure isolation'],
        costs: ['Latency between production and processing', 'Buffer is state that can be lost or grow'],
      },
    ],
    related: ['message-queues', 'backpressure', 'background-workers', 'pub-sub'],
  },
  {
    slug: 'request-response',
    title: 'Request / Response',
    tagline: 'The synchronous default - and the coupling it creates.',
    category: 'patterns',
    difficulty: 'Beginner',
    keywords: ['synchronous', 'timeout', 'coupling', 'latency budget'],
    what: 'The caller sends a request and waits for a response, blocking (logically) until it arrives or the timeout fires.',
    why: 'It is the simplest model and the right one when the caller genuinely needs the answer to continue. The cost is temporal coupling: the callee must be available right now.',
    how: [
      'Set a timeout on every call, derived from the overall latency budget.',
      'Chained synchronous calls multiply failure probability - keep chains short.',
      'Where the answer is not needed immediately, publish an event instead.',
    ],
    diagram: `A -> B -> C -> D   each 99.9% available
combined ~99.7%, and latency is the sum of all hops.
Every synchronous hop is a shared fate decision.`,
    tradeoffs: [
      {
        approach: 'Synchronous request/response',
        gains: ['Immediate result', 'Simple error handling', 'Easy to reason about'],
        costs: ['Temporal coupling', 'Latency accumulates', 'Failure propagates upstream'],
      },
      {
        approach: 'Asynchronous messaging',
        gains: ['Callee can be down temporarily', 'Load smoothing'],
        costs: ['Eventual completion', 'Requires status tracking and idempotency'],
      },
    ],
    related: ['rest-apis', 'message-queues', 'circuit-breaker', 'microservices'],
  },
  {
    slug: 'publish-subscribe',
    title: 'Publish / Subscribe',
    tagline: 'Broadcast a fact; let interested parties decide what it means.',
    category: 'patterns',
    difficulty: 'Beginner',
    keywords: ['topic', 'broadcast', 'decoupling', 'fan-out'],
    what: 'The publish/subscribe pattern delivers each message to all current subscribers of a topic, with publishers unaware of who is listening.',
    why: 'It is how you add behaviour without modifying the source of the event - the structural core of event-driven systems.',
    how: [
      'Publishers emit to a topic; subscribers register independently.',
      'Each subscriber tracks its own position and backlog.',
      'Delivery is typically at-least-once, so handlers must be idempotent.',
    ],
    diagram: `publish("payment.captured")
   |-> accounting service
   |-> email service
   |-> analytics
Adding a fourth subscriber requires no change to the publisher.`,
    tradeoffs: [
      {
        approach: 'Pub/sub',
        gains: ['Extensible without touching producers', 'Independent failure and scaling'],
        costs: ['No delivery confirmation to the publisher', 'Harder to trace end to end', 'Ordering guarantees are limited'],
      },
    ],
    related: ['pub-sub', 'event-driven-architecture', 'fan-out', 'kafka'],
  },
];
