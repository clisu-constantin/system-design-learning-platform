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
    lab: 'bulkhead',
    keywords: ['isolation', 'thread pool', 'connection pool', 'semaphore', 'concurrency limit', 'blast radius', 'cell'],
    what: 'The bulkhead pattern partitions a finite resource - threads, connections, instances - per dependency or per tenant, so exhaustion in one partition cannot starve the others.',
    why: 'Shared pools couple unrelated failures. Every call to a slow dependency holds a thread until it answers or times out, so one slow dependency can occupy every thread in a shared pool, and then requests that never touch it fail too. A partial failure becomes a total one.',
    how: [
      'Give each downstream dependency its own bounded pool or concurrency limit, next to its own timeout.',
      'When a pool is full, reject the call at once (or after a very short wait) and serve a fallback, instead of queueing it behind the slow calls.',
      'Size each pool from measured concurrency: peak calls per second x p99 latency in seconds, plus headroom - not an even split.',
      'Separate critical from non-critical traffic (checkout versus recommendations) so the critical path keeps its capacity.',
      'For multi-tenant systems, cap per-tenant concurrency, or place tenants in separate instances or cells, so one tenant cannot consume the service.',
    ],
    when: [
      'One service calls several dependencies with blocking calls, and a slow one could take every thread or connection.',
      'Critical and non-critical features share one process or one connection pool.',
      'Several tenants or clients share a service and one of them can send far more load than the rest.',
    ],
    advantages: [
      'A slow or failing dependency affects only the features that use it - the blast radius stays small.',
      'Critical paths keep reserved capacity during a partial failure.',
      'A full pool rejects fast, so callers get an answer (or a fallback) in milliseconds instead of hanging.',
      'Per-pool metrics show at once which dependency is in trouble.',
    ],
    diagram: `SHARED POOL (200 threads)          BULKHEADS (same 200 threads)
recommendations hangs              checkout          80 threads   fine
 -> all 200 threads wait on it     search            60 threads   fine
 -> checkout and search fail too   recommendations   20 threads   full, fallback
                                   other             40 threads   fine`,
    tradeoffs: [
      {
        approach: 'One shared pool',
        gains: ['Highest utilisation - any request can use any idle thread', 'One pool to size and monitor'],
        costs: [
          'One slow dependency can hold every thread, so unrelated features fail with it',
          'The failure spreads to the whole service: the largest blast radius',
        ],
      },
      {
        approach: 'Concurrency limit per dependency (semaphore)',
        gains: ['A few lines, no extra threads or context switches', 'Stops the most common cascade'],
        costs: [
          'The calling thread still makes the call, so it cannot walk away from a slow call - it relies on the client timeout',
          'Each limit still has to be sized from measurements',
        ],
      },
      {
        approach: 'Thread pool per dependency',
        gains: [
          'The caller can give up on a slow call and keep its own thread',
          'Contains blocking inside misbehaving client libraries',
        ],
        costs: [
          'Extra threads, queueing and context switches - a few ms at p99 in the Netflix measurements',
          'Reserved threads sit idle while another pool is full',
        ],
      },
      {
        approach: 'Separate instances or cells',
        gains: ['Contains crashes, memory leaks and CPU hogs, not just slow calls', 'A failure reaches only one slice of the customers'],
        costs: ['More infrastructure and operational cost', 'Routing, deployment and capacity planning per cell'],
      },
    ],
    mistakes: [
      'Sizing every bulkhead identically instead of by measured concurrency and criticality.',
      'Making a pool so small that it rejects its own healthy traffic.',
      'Letting a full pool queue callers for a long time instead of failing fast - the wait just moves the pile-up.',
      'Adding bulkheads without timeouts, so the slow calls hold their threads forever inside the compartment.',
      'Partitioning threads while every dependency still shares one database connection pool.',
    ],
    related: ['circuit-breaker', 'fault-tolerance', 'backpressure', 'connection-pooling'],
    quiz: [
      {
        id: 'bh-1',
        prompt:
          'An API has one pool of 200 request threads. The recommendations service starts taking 30 seconds to answer, and 100 product page requests per second call it. Checkout never calls recommendations. What happens to checkout?',
        options: [
          'Nothing - checkout does not use recommendations',
          'Checkout slows by a few milliseconds because the CPU is busier',
          'Within about 2 seconds every thread is waiting on recommendations, and checkout requests fail for lack of a thread',
          'Checkout fails only after the 30 seconds have passed',
        ],
        answer: 2,
        explanation:
          '100 calls/s x 30 s wants 3,000 threads; 200 are gone in 2 seconds, and then every request waits for a thread or is rejected - checkout included. The tempting answer is that checkout is safe because it does not call recommendations, but it shares the threads. That is what the Lab shows with bulkheads off.',
      },
      {
        id: 'bh-2',
        prompt:
          'In the Lab, bulkheads are off and Recommendations latency is 5 s. Checkout success has fallen and Payments shows healthy. Which single change keeps checkout working however slow Recommendations gets?',
        options: [
          'Turn on bulkheads so checkout has threads recommendations cannot take',
          'Raise the call timeout to 10 s',
          'Add more checkout load so it wins more threads',
          'Restart Payments',
        ],
        answer: 0,
        explanation:
          'With separate pools, recommendations can fill only its own threads, and checkout keeps the rest. Raising the timeout does the opposite of helping: each slow call holds its thread longer. Payments was never the problem.',
      },
      {
        id: 'bh-3',
        prompt:
          'Recommendations gets 20 calls per second and has a bulkhead of 10 threads. It starts taking 5 seconds per call. What does the product page see?',
        options: [
          'Every product page request hangs for 5 seconds',
          'About 2 calls per second are answered after 5 s; the rest are rejected at once and the page is shown without recommendations',
          'All 20 calls per second are answered, just later',
          'The whole API is rejected, like with a shared pool',
        ],
        answer: 1,
        explanation:
          'A pool of 10 threads with 5 s calls completes 10 / 5 = 2 calls per second (concurrency = rate x time). The other calls find the pool full and fail fast into the fallback. Nothing makes them all wait: that is what the bulkhead is for, and the rest of the API is untouched.',
      },
      {
        id: 'bh-4',
        prompt:
          'A team splits 40 threads evenly: 20 for checkout and 20 for recommendations. Checkout runs at 300 requests per second and each call takes 100 ms. Nothing is slow. What happens?',
        options: [
          'Nothing - 20 threads is plenty',
          'Recommendations fails because it has too many threads',
          'The API crashes because 40 threads are not enough for any load',
          'Checkout needs about 30 threads, so its own bulkhead rejects healthy checkout requests',
        ],
        answer: 3,
        explanation:
          '300/s x 0.1 s = 30 threads in use at once, and the pool has 20. A bulkhead sized by an even split instead of measured concurrency fails its own traffic. In the Lab, set Checkout load to 300 and Threads for recommendations to 20 to see it.',
      },
      {
        id: 'bh-5',
        prompt:
          'How should you size the thread pool for a dependency that peaks at 50 calls per second with a p99 latency of 200 ms?',
        options: [
          'About 10 threads, plus some headroom',
          'An equal share of all threads, whatever the dependency does',
          '50 threads, one per call per second',
          '200 threads, one per millisecond of latency',
        ],
        answer: 0,
        explanation:
          'Concurrency = rate x time: 50/s x 0.2 s = 10 calls in flight at the p99, so about 10 threads plus breathing room - the guideline in the Hystrix documentation. One thread per call per second ignores how long each call holds its thread; an equal share ignores the load entirely.',
      },
      {
        id: 'bh-6',
        prompt:
          'A service already has a 1-second timeout on every dependency call. An engineer says bulkheads are therefore unnecessary. When is that wrong?',
        options: [
          'Never - a timeout always prevents thread exhaustion',
          'Only when the dependency returns errors quickly',
          'When a slow dependency gets enough calls: 300 calls/s x 1 s still wants 300 threads, more than the pool has',
          'Only when the timeout is longer than 30 seconds',
        ],
        answer: 2,
        explanation:
          'A timeout bounds how long one call holds a thread; the bulkhead bounds how many threads a dependency may hold. At high enough load, even short holds add up to the whole pool. In the Lab, a short timeout saves checkout at 20 recs calls/s, and raising the product page load breaks it again. Fast errors are the harmless case, not the dangerous one.',
      },
      {
        id: 'bh-7',
        prompt:
          'The recommendations bulkhead is full. The team debates two settings: reject extra calls at once, or let them wait up to 30 seconds for a thread. What does waiting 30 seconds do?',
        options: [
          'It protects the service better, because no call is lost',
          'Nothing different - both settings behave the same',
          'It makes the recommendations service recover faster',
          'The waiting callers hold their own request threads, so the pile-up moves back into the shared pool the bulkhead was protecting',
        ],
        answer: 3,
        explanation:
          'A caller blocked while waiting for a bulkhead slot is itself holding a thread. A long wait rebuilds the cascade one layer up. That is why Resilience4j defaults maxWaitDuration to 0: reject fast and serve the fallback. Waiting does not help the slow service recover either - it is still slow.',
      },
      {
        id: 'bh-8',
        prompt:
          'A service uses a semaphore bulkhead of 25 concurrent calls around a dependency, with no timeout on the HTTP client. The dependency hangs. What is true?',
        options: [
          'The semaphore times out the call after a few seconds',
          'At most 25 caller threads hang, but those 25 hang until the client timeout - here, forever',
          'The semaphore moves the call to another thread, so the caller is free',
          'No threads hang, because semaphores never block',
        ],
        answer: 1,
        explanation:
          'A semaphore only counts; the calling thread makes the call itself. It caps the damage at 25 threads, but it cannot walk away from a slow call - that needs a client timeout, or a thread pool bulkhead that lets the caller stop waiting. The Hystrix documentation describes exactly this difference.',
      },
      {
        id: 'bh-9',
        prompt:
          'A service has separate thread pools per dependency, but all of them run queries through one database connection pool of 20. One report query starts taking 60 seconds, 30 times a minute. What happens?',
        options: [
          'The report connections fill the shared connection pool, and every feature that needs the database waits - the bulkhead was on the wrong resource',
          'Nothing, because the thread pools are separate',
          'The database refuses the report queries',
          'Only the report feature slows down',
        ],
        answer: 0,
        explanation:
          '30 per minute is 0.5/s, x 60 s = 30 connections wanted, more than 20. A bulkhead has to partition the resource that saturates first; here it is the connection pool, so reports need their own small pool. Separate thread pools cannot help when every thread ends up waiting on the same connections.',
      },
      {
        id: 'bh-10',
        prompt:
          'A multi-tenant API serves 500 customers from one pool of workers. One customer runs a batch job that sends 50 times its normal traffic, and every other customer sees timeouts. Which bulkhead fits?',
        options: [
          'A bigger shared pool for everyone',
          'A circuit breaker on the database',
          'A per-tenant concurrency limit, or separate instances or cells for groups of tenants',
          'A longer timeout for every tenant',
        ],
        answer: 2,
        explanation:
          'The resource here is shared by tenants, so it is partitioned per tenant: a cap on the concurrency one tenant may use, or tenants spread across isolated instances or cells. A bigger shared pool only raises the amount the noisy tenant can take. A circuit breaker on the database does not stop one tenant crowding out the rest.',
      },
      {
        id: 'bh-11',
        prompt:
          'With bulkheads, 40 threads are split 30 for checkout and 10 for recommendations. Checkout is idle at night while recommendations is briefly busy and rejects some calls. What is going on?',
        options: [
          'A bug: bulkheads should lend idle threads to any pool that needs them',
          'The cost of the pattern: reserved capacity sits idle so it is guaranteed when checkout needs it',
          'Recommendations is down',
          'Checkout is leaking threads',
        ],
        answer: 1,
        explanation:
          'Partitioned capacity is used less efficiently - that is the premium paid for containment. A pool that lent its reserved threads away would not have them when a failure elsewhere hits, which is the whole point. If the rejections matter, resize the pools from measurements.',
      },
      {
        id: 'bh-12',
        prompt:
          'Recommendations hangs. The service has a 1 s timeout, a 10-thread bulkhead for recommendations, and a circuit breaker. Which job does each one do?',
        options: [
          'All three do the same job; one of them is enough',
          'The bulkhead retries, the timeout isolates, the breaker queues',
          'The timeout caps how long a call holds a thread, the bulkhead caps how many threads recommendations may hold, and the breaker stops calling it once it is clearly down',
          'The circuit breaker caps concurrency, and the bulkhead opens after failures',
        ],
        answer: 2,
        explanation:
          'They combine, each covering a different gap: how long (timeout), how many (bulkhead), and whether to call at all (circuit breaker). Mixing them up leads to the belief that one replaces the others - a breaker takes several failures to open, and the bulkhead is what protects the rest of the service meanwhile.',
      },
    ],
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
];
