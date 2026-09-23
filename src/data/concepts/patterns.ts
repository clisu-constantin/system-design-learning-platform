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
    labFocus: 'backpressure',
    keywords: ['flow control', 'bounded queue', 'load shedding', 'queue depth', '429', 'retry-after'],
    what: 'Backpressure is explicit feedback from an overloaded consumer to its producer: slow down, or I will reject your work.',
    why: 'Without it, an overloaded system buffers until memory is gone or latency is so high that every response is useless anyway. Failing fast is a feature.',
    how: [
      'Use bounded queues - an unbounded queue is a memory leak with a timer.',
      'When the bound is reached, reject (429/503 with Retry-After), block the producer, or shed low-priority work.',
      'Propagate the signal upstream so the pressure reaches the actual source.',
      'Monitor queue depth and oldest-message age, not only throughput.',
    ],
    when: [
      'A producer can, even briefly, send faster than its consumer can process.',
      'A sustained overload is possible and memory or latency must stay bounded.',
      'Clients can slow down or retry later when told to.',
    ],
    advantages: [
      'Memory and waiting time stay bounded under any load.',
      'Overload becomes visible at the source instead of hiding in a buffer.',
      'The system keeps serving what it accepted instead of collapsing.',
    ],
    diagram: `Clients -> Producer 1000/s -> [bounded queue: 10,000] -> Consumers 400/s
queue full after 10,000 / 600 = about 16 s
  -> reject new work with 429 + Retry-After (fast, honest)
  -> or block the producer (flow control)
  -> NOT: grow forever, then OOM and lose everything`,
    tradeoffs: [
      {
        approach: 'Bounded queue + rejection',
        gains: ['Bounded memory and latency', 'Clear signal to clients', 'System stays responsive'],
        costs: ['Some work is refused', 'Clients must handle rejection properly'],
      },
      {
        approach: 'Blocking the producer',
        gains: ['Nothing is refused or lost', 'The producer runs at exactly the rate the consumer can take'],
        costs: ['The producer stalls, and its own callers wait', 'Can deadlock when producer and consumer wait on each other'],
      },
      {
        approach: 'Dropping (shedding) work',
        gains: ['The producer never waits', 'Keeps the stream live - fits metrics, telemetry and video frames'],
        costs: ['Data is lost on purpose', 'Only acceptable where a missing item costs little'],
      },
      {
        approach: 'Unbounded buffering',
        gains: ['Nothing is refused immediately'],
        costs: ['Latency grows without limit', 'Eventual OOM loses everything at once'],
      },
    ],
    mistakes: [
      'Increasing the queue size as a fix - it delays the failure and makes it bigger.',
      'Retrying a 429 at once, or at every layer, so the rejection multiplies the load it was meant to reduce.',
      'Stopping the signal at one hop - the service rejects, but the real source never slows down.',
      'Processing work whose caller already timed out, so an overloaded system stays overloaded.',
    ],
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
          'A permanent deficit cannot be buffered away. A bigger limit only makes the backlog and the wait longer before the same failure. Either process faster or refuse work explicitly, so latency and memory stay bounded.',
      },
      {
        id: 'bp-2',
        prompt:
          'In the Lab, 300 msg/sec arrive, 2 workers do 40 msg/sec each and the queue is bounded at 1,000. About when do rejections start, and at what rate?',
        options: [
          'Never - the queue holds 1,000 messages',
          'After about 3.3 s, at 300 per second',
          'After about 4.5 s, at about 220 per second',
          'At once, at 80 per second',
        ],
        answer: 2,
        explanation:
          'The queue gains 300 - 80 = 220 msg/sec, so it is full after 1,000 / 220 = about 4.5 s. From then on the workers still take 80/sec and the other 220/sec are refused - the Rejected metric climbs at that rate. 3.3 s would ignore the workers draining.',
      },
      {
        id: 'bp-3',
        prompt: 'Same Lab: you turn Bounded queue off. What changes?',
        options: [
          'Rejections stop; depth and the wait of every new message grow without limit - in a real process until memory runs out',
          'Nothing - the workers catch up',
          'The producer slows down to match the workers',
          'The workers get faster',
        ],
        answer: 0,
        explanation:
          'Without a bound nothing tells the producer to slow down, so the 220 msg/sec surplus piles up forever. The Oldest message metric keeps climbing: the queue converted errors into a delay that has no limit. The workers do not change.',
      },
      {
        id: 'bp-4',
        prompt: 'An agent samples CPU every second and ships the samples to a collector, which is overloaded. Which full-buffer policy fits?',
        options: [
          'Block the application until the collector catches up',
          'Spill to local disk with no limit',
          'Return 429 to the end user',
          'Drop samples when the buffer is full - a missing sample costs little and the application must never stall',
        ],
        answer: 3,
        explanation:
          'The right policy depends on the data. A lost CPU sample is barely noticed, while blocking the application for monitoring would make the monitoring the outage. An unlimited spill is an unbounded buffer on disk.',
      },
      {
        id: 'bp-5',
        prompt: 'The order queue of a checkout API is full. Which policy fits new orders?',
        options: [
          'Drop them silently',
          'Reject with 503 or 429 and a Retry-After header, so the client knows and can try again later',
          'Accept them into an unbounded overflow buffer',
          'Hold each HTTP request open for minutes until space frees up',
        ],
        answer: 1,
        explanation:
          'An order must not vanish, so dropping is out, and an unbounded overflow is the same deferred crash. Holding requests open just moves the queue into threads and connections. A fast, honest rejection tells the client exactly what to do.',
      },
      {
        id: 'bp-6',
        prompt:
          'Service C is overloaded and answers 429. B retries each call to C 3 times at once, and A retries each call to B 3 times. In the worst case, how much traffic does one user request send to C?',
        options: ['1 call', '4 calls', 'Up to 16 calls', '3 calls'],
        answer: 2,
        explanation:
          'A makes up to 4 attempts at B, and each of those makes up to 4 attempts at C: 4 x 4 = 16. Retries at every layer multiply the load exactly when C asked for less. Retry at one layer, honour Retry-After, and back off.',
      },
      {
        id: 'bp-7',
        prompt: 'A fast sender streams data to a slow receiver over TCP, and the receiving application stops reading from its socket. What does TCP do?',
        options: [
          'The receive window shrinks to zero and the sender stops sending until the receiver reads again',
          'The receiver drops packets until the sender notices',
          'The receive buffer grows without limit',
          'The connection is closed at once',
        ],
        answer: 0,
        explanation:
          'TCP flow control is built-in backpressure: the receiver advertises how much buffer space it has left, and at zero the sender must wait. Buffers are bounded on both sides, so nothing grows forever and nothing is dropped.',
      },
      {
        id: 'bp-8',
        prompt:
          'During an overload the queue wait is 40 s, but clients time out after 10 s. Workers keep processing requests from the front of the queue. What goes wrong, and what is the fix?',
        options: [
          'Nothing - every request is eventually processed',
          'The workers need more memory',
          'Raise the client timeout to 60 s',
          'Workers spend their time on requests whose clients left 30 s ago; drop work past its deadline and reject at the door when the expected wait exceeds the timeout',
        ],
        answer: 3,
        explanation:
          'A request whose caller has given up is pure waste, and working on it keeps the system overloaded. Checking the deadline before doing the work - and refusing early - spends capacity only on answers someone will read. A longer timeout makes every user wait 40 s.',
      },
      {
        id: 'bp-9',
        prompt:
          'A queue normally holds 50,000 messages and drains them in 20 s. At a quiet hour, when 10 messages a minute arrive, its consumer silently stops. Which alert fires first?',
        options: [
          'Queue depth above 100,000',
          'Oldest message older than 2 minutes',
          'Producer error rate above 1%',
          'CPU of the producers above 80%',
        ],
        answer: 1,
        explanation:
          'At 10 messages a minute the depth would need days to reach 100,000, but the oldest message passes 2 minutes after 2 minutes. Producers see nothing wrong at all. Oldest-message age measures the delay directly, whatever the traffic.',
      },
      {
        id: 'bp-10',
        prompt: 'A service runs at 150% of its capacity. Health checks, checkouts from paying customers and bulk export requests all arrive. What should be shed first?',
        options: [
          'Health checks - they are not real traffic',
          'Checkouts - they are the heaviest requests',
          'An equal share of every kind of request',
          'Bulk exports, so checkouts and health checks keep their capacity',
        ],
        answer: 3,
        explanation:
          'Load shedding is choosing what to lose. Dropping health checks gets healthy instances removed from the pool and makes the overload worse; dropping checkouts loses revenue. Low-priority bulk work can be retried later at the lowest cost.',
      },
      {
        id: 'bp-11',
        prompt:
          'A producer thread puts items into a bounded in-memory queue that blocks when full. To make room, the consumer needs a lock that the blocked producer is holding. What happens?',
        options: [
          'The queue grows past its bound',
          'Deadlock - each waits for the other; blocking backpressure needs care with circular waits',
          'The consumer skips the item',
          'The producer drops the item',
        ],
        answer: 1,
        explanation:
          'Blocking is the simplest form of backpressure, but a producer blocked while holding something the consumer needs can never be released. A bounded queue never grows past its bound, and neither side gives up on its own.',
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
    labFocus: 'producer-consumer',
    keywords: ['queue', 'decoupling', 'throughput', 'workers', 'competing consumers', 'bounded buffer'],
    what: 'Producers create work items and place them in a shared buffer; consumers take items and process them, at their own pace.',
    why: 'It decouples rates. Producers can burst, consumers can be scaled independently, and the buffer absorbs the difference - within its bounds.',
    how: [
      'Size the consumer pool from required throughput: arrival rate / per-consumer rate, plus headroom to drain bursts.',
      'Bound the buffer so overload is visible and controlled.',
      'Each item goes to one consumer at a time (competing consumers); a redelivery can repeat it, so processing should be idempotent.',
      'Acknowledge after the work is done, and partition by key when order matters.',
    ],
    when: [
      'Work is created at a different rate, or in bursts, from the rate it can be done.',
      'The creating side and the working side should scale, deploy or fail independently.',
      'Items are independent enough to be processed in parallel.',
    ],
    advantages: [
      'Short bursts become a short delay instead of errors.',
      'Consumers scale out without touching the producers.',
      'A slow or restarting consumer does not stop the producers.',
    ],
    diagram: `Producers --> [ bounded buffer ] --> Consumers
 100/s                depth                 3 x 40/s = 120/s
stable: consumption >= production (20/s of headroom)
throughput = min(production, consumption)`,
    tradeoffs: [
      {
        approach: 'Buffered producer/consumer',
        gains: ['Absorbs bursts', 'Independent scaling', 'Failure isolation'],
        costs: ['Latency between production and processing', 'Buffer is state that can be lost or grow'],
      },
      {
        approach: 'Producer calls the consumer directly',
        gains: ['No buffer to run, size or monitor', 'The producer knows at once whether the work succeeded'],
        costs: ['The producer can only go as fast as the consumer', 'A consumer outage stops the producer too'],
      },
    ],
    mistakes: [
      'Sizing consumers for the average rate, so every burst leaves a backlog that never quite drains.',
      'An unbounded buffer that hides a rate mismatch until memory runs out.',
      'Adding consumers past the partition count, where the extra ones sit idle.',
      'Acknowledging on receipt, so a crash loses the item.',
    ],
    related: ['message-queues', 'backpressure', 'background-workers', 'pub-sub'],
    quiz: [
      {
        id: 'pc-1',
        prompt: 'Producers create 100 items/sec and one consumer handles 40/sec. How many consumers do you run, and why?',
        options: [
          '2 - that is close enough to the average',
          '3 - 120/sec keeps up and leaves 20/sec to drain bursts',
          '100 - one per item per second',
          '1 with a much bigger buffer',
        ],
        answer: 1,
        explanation:
          '2 consumers do 80/sec and fall 20/sec behind forever. 3 do 120/sec: they keep up, and the spare 20/sec is what empties the buffer after a burst. A bigger buffer only stores the deficit.',
      },
      {
        id: 'pc-2',
        prompt: 'In the Lab, 100 items/sec are produced and 3 workers consume 40/sec each. You lower Workers to 2. What happens?',
        options: [
          'Nothing visible - the buffer absorbs it',
          'The buffer stays empty but the workers look busier',
          'Depth grows by 20/sec, the 500-message buffer is full after about 25 s, then producers are rejected',
          'Depth grows by 80/sec',
        ],
        answer: 2,
        explanation:
          'Two workers consume 80/sec against 100 produced, so the buffer gains 20/sec and reaches 500 after 500 / 20 = 25 s. From then on backpressure refuses the surplus. The buffer absorbs bursts, not a permanent gap.',
      },
      {
        id: 'pc-3',
        prompt: 'A Kafka topic has 4 partitions. The team scales its consumer group from 4 to 16 consumers, and lag does not improve at all. Why?',
        options: [
          'Each partition is read by one consumer of the group, so 4 consumers work and 12 sit idle',
          'Kafka limits every group to 4 consumers',
          'The new consumers need a warm-up period',
          'Lag only improves when producers slow down',
        ],
        answer: 0,
        explanation:
          'Within one consumer group a partition is assigned to one consumer, so parallelism is capped at the partition count. More partitions, faster consumers or a faster downstream are the levers - more consumers are not.',
      },
      {
        id: 'pc-4',
        prompt: 'Several consumers take items from one buffer. Updates for the same account must be applied in order. What do you do?',
        options: [
          'Nothing - a buffer is first in, first out, so completion order is kept',
          'Add more consumers',
          'Make the buffer bigger',
          'Route items by account id so one consumer handles each account in sequence',
        ],
        answer: 3,
        explanation:
          'Items leave the buffer in order but finish in any order when several consumers work in parallel. Partitioning by account keeps each account sequential while different accounts still run in parallel. More consumers make the reordering more likely, not less.',
      },
      {
        id: 'pc-5',
        prompt:
          'The buffer holds 5 items and producers block when it is full. Producers send 100 items in one second every minute; consumers handle 10/sec. What happens?',
        options: [
          'Producers block for most of every burst - the buffer is too small for the burst it is meant to absorb',
          'Items are lost when the buffer is full',
          'The consumers speed up during the burst',
          'Nothing - 100 items a minute is well under 10/sec',
        ],
        answer: 0,
        explanation:
          'The average (100 a minute) is fine, but the burst is 100 at once. With room for only 5, the producers wait until the consumers have taken about 95 - roughly 10 s of every minute. Sizing the buffer for the burst (about 100) keeps the producers free. Blocking loses nothing, it just stalls.',
      },
      {
        id: 'pc-6',
        prompt: 'The buffer is unbounded and consumers are 5% slower than producers, all day, every day. When does anyone notice?',
        options: [
          'Immediately - producers get errors',
          'Late: the wait grows quietly for hours until items are hours old or the process runs out of memory',
          'Never - 5% is within tolerance',
          'After exactly one buffer size',
        ],
        answer: 1,
        explanation:
          'An unbounded buffer never pushes back, so producers see nothing. A small permanent gap adds up: 5% of 1,000/sec is 180,000 items an hour. A bound and an oldest-item alert surface it on day one.',
      },
      {
        id: 'pc-7',
        prompt: 'A consumer acknowledges each item as soon as it receives it, then processes it. It crashes halfway through an item. What happens to that item?',
        options: [
          'It is redelivered to another consumer',
          'The producer sends it again',
          'It is lost - acknowledge after the work is done, and make processing idempotent for the redeliveries that brings',
          'It stays in the buffer until the consumer restarts',
        ],
        answer: 2,
        explanation:
          'The acknowledgement told the buffer the item was finished, so it was removed. Acknowledging after the work means a crash leads to a redelivery instead - the safe direction, as long as a repeat does no harm.',
      },
      {
        id: 'pc-8',
        prompt:
          'Consumers run at 30% CPU but lag keeps growing. Each item makes one call to a downstream API that allows 500 requests per second. What helps most?',
        options: [
          'Doubling the consumers',
          'Giving each consumer more CPU',
          'A bigger buffer',
          'Batching many items per API call, since the downstream limit is the real ceiling',
        ],
        answer: 3,
        explanation:
          'The consumers are waiting on the API, not computing, so more consumers or more CPU just queue at the same 500 req/sec. Sending 50 items per call raises the ceiling fifty-fold. Scale the side that is actually slow.',
      },
      {
        id: 'pc-9',
        prompt: 'Consumers can do 200 items/sec and producers make 50/sec. The buffer is empty and consumers are idle 75% of the time. Is this a problem?',
        options: [
          'Yes - consumers should always be fully busy',
          'No - the idle time is headroom that absorbs the next burst; scale down only if enough is left for the peaks',
          'Yes - an empty buffer means items are being lost',
          'No - but producers should be made faster to match',
        ],
        answer: 1,
        explanation:
          'Consumers faster than producers is the stable state: throughput is min(production, consumption), so it is 50/sec either way. Idle capacity costs money but buys burst absorption. An empty buffer means items are processed at once, not lost.',
      },
      {
        id: 'pc-10',
        prompt:
          'Producers double to 200 items/sec. Consumers still handle 120/sec in total. How many items per second are completed, and where do the rest go?',
        options: [
          '200 - the buffer speeds up the consumers',
          '160 - the average of the two',
          '120; the other 80/sec pile up in the buffer until it is full, then are refused',
          '0 - the pipeline stalls',
        ],
        answer: 2,
        explanation:
          'Throughput is the minimum of the two rates, so 120/sec get done. The buffer takes the 80/sec surplus until it hits its bound, and then backpressure refuses it. A buffer changes when work is done, never how much can be done.',
      },
    ],
  },
  {
    slug: 'request-response',
    title: 'Request / Response',
    tagline: 'The synchronous default - and the coupling it creates.',
    category: 'patterns',
    difficulty: 'Beginner',
    lab: 'queue',
    labFocus: 'request-response',
    keywords: ['synchronous', 'timeout', 'coupling', 'latency budget', 'deadline', '202 accepted'],
    what: 'The caller sends a request and waits for a response, blocking (logically) until it arrives or the timeout fires.',
    why: 'It is the simplest model and the right one when the caller genuinely needs the answer to continue. The cost is temporal coupling: the callee must be available right now.',
    how: [
      'Set a timeout on every call, derived from the overall latency budget.',
      'Chained synchronous calls multiply failure probability and add their latencies - keep chains short and run independent calls in parallel.',
      'Propagate the remaining deadline, and stop work when the caller has gone.',
      'Where the answer is not needed immediately, publish an event or a job instead.',
    ],
    when: [
      'The caller needs the answer to continue: reads, logins, validation, a payment result the page must show.',
      'The work is fast compared with the time the user is willing to wait.',
      'Immediate, simple error handling matters more than surviving a dependency outage.',
    ],
    advantages: [
      'The result, or the error, arrives on the next line.',
      'Easy to write, read, trace and debug.',
      'No broker, job status or eventual completion to explain to users.',
    ],
    diagram: `A -> B -> C -> D   each 99.9% available
the request needs all four: 0.999^4 = ~99.6%,
and latency is the sum of all hops.
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
    mistakes: [
      'Calls with no timeout, or a timeout longer than the budget of the caller.',
      'Long chains of sequential calls where some could run in parallel or not at all.',
      'Doing work the user does not need (emails, analytics) inside the request.',
      'Retrying at every layer of a chain, multiplying load on the slowest service.',
    ],
    related: ['rest-apis', 'message-queues', 'circuit-breaker', 'microservices'],
    quiz: [
      {
        id: 'rr-1',
        prompt: 'A calls B, B calls C and C calls D, all synchronously. Each of the four is up 99.9% of the time, independently. About how available is the endpoint of A?',
        options: ['99.9%', '99.6%', '99.99%', '96%'],
        answer: 1,
        explanation:
          'The request succeeds only if all four are up: 0.999^4 = about 0.996. Each synchronous dependency multiplies availability down, so A is worse than any single service. 96% would be 99% each.',
      },
      {
        id: 'rr-2',
        prompt: 'An endpoint makes three calls in sequence, taking 50, 80 and 120 ms. None of them needs the result of another. What does running them in parallel give?',
        options: ['About 250 ms', 'About 83 ms', 'About 120 ms - the slowest call', 'About 50 ms - the fastest call'],
        answer: 2,
        explanation:
          'In sequence the latencies add: 250 ms. In parallel you wait for all three, so the slowest one, 120 ms, sets the time. The average and the fastest are not how waiting for several answers works.',
      },
      {
        id: 'rr-3',
        prompt:
          'In the Lab the queue is off: 12 requests/sec arrive and 3 workers finish 3 each per second (333 ms a job). What do you see?',
        options: [
          'Every user waits about 333 ms and nothing fails',
          'Callers pile up because only 9 of the 12 per second can be served; waits grow until callers hit the 2 s timeout, and some jobs finish after their caller has gone',
          'The API rejects 3 requests per second at once with 429',
          'Workers speed up to 4 per second',
        ],
        answer: 1,
        explanation:
          'Capacity is 3 x 3 = 9/sec against 12, so about 3 callers per second have to wait, holding a connection. Waits grow until the timeout cuts them off: the Timed out and Wasted work metrics climb. Nothing rejects early, which is exactly the problem.',
      },
      {
        id: 'rr-4',
        prompt: 'Same Lab: you turn the Queue on. What changes for users?',
        options: [
          'Nothing - the workers are still too slow',
          'Every request now succeeds at once and all the work is done',
          'The workers get faster',
          'Users get an answer in 20 ms, but the work still falls behind: the queue grows by about 3 per second, as a delay instead of timeouts',
        ],
        answer: 3,
        explanation:
          'The queue takes the job off the request path, so the user is answered at once. It does not add capacity: 12 in and 9 out still leaves 3 per second waiting - now in the queue, visible as depth and oldest-message age. Decoupling moves the wait; only more capacity removes it.',
      },
      {
        id: 'rr-5',
        prompt: 'A service calls a dependency with no timeout. The dependency starts hanging. What happens to the service?',
        options: [
          'Its threads or connections wait on the hanging calls until none are left, and it stops answering even requests that do not use that dependency',
          'Nothing - the operating system cancels the calls',
          'Only the requests that call the dependency slow down',
          'The dependency is removed automatically',
        ],
        answer: 0,
        explanation:
          'Each hanging call holds a thread or a connection. With no timeout they are never released, the pool runs dry, and the whole service stops - a cascading failure. A timeout shorter than the budget of the caller frees the resource and turns the hang into an error it can handle.',
      },
      {
        id: 'rr-6',
        prompt:
          'The user-facing budget is 1 s. After A and B have used 900 ms, C receives the call with the remaining deadline attached. C needs about 300 ms. What should C do?',
        options: [
          'Do the work anyway - the answer might still be useful',
          'Wait for more capacity, then do the work',
          'Refuse at once, because the answer cannot arrive within the 100 ms that is left',
          'Double the deadline and continue',
        ],
        answer: 2,
        explanation:
          'With 100 ms left and 300 ms of work, the result would arrive after the user has already been given an error. Deadline propagation lets C see that and save its capacity for requests that can still succeed.',
      },
      {
        id: 'rr-7',
        prompt: 'A login form must tell the user whether the password is correct. Should the password check be a request/response call or a message on a queue?',
        options: [
          'A request/response call - the user cannot continue without the answer',
          'A queue - it is always more reliable',
          'A queue, with the result emailed to the user',
          'Either - the user does not notice',
        ],
        answer: 0,
        explanation:
          'Synchronous is right when the caller needs the answer to proceed, and a login needs it immediately. A queue would only add a status to poll for. Reliability is not the question when the user is waiting at the form.',
      },
      {
        id: 'rr-8',
        prompt:
          'A report takes 2 minutes to generate. Clients hold the HTTP connection open, and many are cut off after 60 s by the load balancer. What design fits?',
        options: [
          'Raise every timeout on the path to 5 minutes',
          'Answer 202 Accepted with a status URL; a worker builds the report, and the client polls or is notified',
          'Generate the report twice to make it faster',
          'Ask users to retry until it works',
        ],
        answer: 1,
        explanation:
          'Long work should not hold a connection. 202 Accepted keeps the interaction request/response for the client - submit, then check status - while the server does the work in the background. Longer timeouts hold threads and connections for minutes, and retries start the work again.',
      },
      {
        id: 'rr-9',
        prompt: 'Users often close the page while a 5-second search is running. The server keeps computing every search to the end. What does this cost under load, and what is the fix?',
        options: [
          'Nothing - the results are cached anyway',
          'Only network bandwidth',
          'Nothing, because closed pages do not count as traffic',
          'Capacity spent on answers nobody reads; honour the cancellation signal and stop the work when the client disconnects',
        ],
        answer: 3,
        explanation:
          'Work for a caller who has gone is pure waste, and it takes capacity from users who are still waiting. Most frameworks expose a cancellation signal when the client disconnects; using it stops the work early.',
      },
      {
        id: 'rr-10',
        prompt:
          'Service B is redeployed with 30 seconds of downtime. A calls B synchronously for every order. What do customers see, compared with A publishing an OrderPlaced event that B consumes?',
        options: [
          'The same in both designs',
          'Synchronously, orders fail for 30 s; with the event, orders succeed and B catches up when it is back',
          'With the event, orders fail for 30 s',
          'Synchronously, orders are delayed 30 s but never fail',
        ],
        answer: 1,
        explanation:
          'Request/response needs both sides up at the same moment - temporal coupling. With an event in between, B being down only delays its part of the work. The price is eventual completion and status tracking.',
      },
      {
        id: 'rr-11',
        prompt: 'The user-facing budget is 800 ms. A calls B, then C, in sequence. Which timeouts make sense for those two calls?',
        options: [
          '2 s for B and 2 s for C',
          'No timeouts - the budget is enforced by the user',
          '300 ms for B and 300 ms for C, leaving room for the own work of A',
          '800 ms for B and 800 ms for C',
        ],
        answer: 2,
        explanation:
          'Sequential timeouts add up: 300 + 300 = 600 ms leaves 200 ms for A itself, inside 800 ms. 800 ms each could spend 1.6 s before A answers, and 2 s each is worse still. Timeouts come from the budget, not from a default.',
      },
    ],
  },
];
