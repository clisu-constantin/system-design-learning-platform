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
    lab: 'outbox',
    keywords: ['dual write', 'atomicity', 'cdc', 'relay', 'consistency', 'transactional outbox', 'skip locked'],
    what: 'The outbox pattern writes the domain change and the event to publish in the same database transaction, into an outbox table. A separate relay reads that table and publishes to the broker.',
    why: 'It removes the dual-write problem: a crash between "commit to database" and "publish to broker" leaves an order with no event (commit first) or an event with no order (publish first), and nothing records that it happened, so nothing repairs it.',
    how: [
      'In one transaction: update the entity and insert a row into outbox. Both commit or neither does.',
      'Nothing is published from the request path. A relay polls the outbox for unsent rows (or reads the database log via CDC) and publishes them.',
      'The relay marks rows as sent after the broker accepts them. A crash in between publishes them again, so delivery is at-least-once and consumers must be idempotent.',
      'Key published messages by aggregate id (the order id) so the events of one order stay in order.',
      'Alert on the age of the oldest unsent row, and delete sent rows on a schedule.',
    ],
    when: [
      'A service must change its own data and tell other services about it: OrderPlaced, PaymentCaptured, UserRegistered.',
      'Each step of a choreographed saga, where a lost event stalls the whole workflow.',
      'Anywhere a missing or invented event would be found later by a customer, not by a test.',
    ],
    advantages: [
      'An event exists for every committed change, and no event exists for a change that rolled back.',
      'Uses the local database transaction the service already has - no distributed transaction.',
      'A stopped relay or broker delays events instead of losing them: the rows wait in the outbox.',
      'The outbox is a record of what was published and when, useful for debugging and replays.',
    ],
    diagram: `BEGIN
  UPDATE orders SET status='placed' WHERE id=123;
  INSERT INTO outbox (type, payload) VALUES ('OrderPlaced', {...});
COMMIT                      <- atomic: both or neither

relay -> reads unsent outbox rows -> publishes to Kafka -> marks sent
crash after publish, before mark -> published again (at least once)`,
    tradeoffs: [
      {
        approach: 'Dual write (commit, then publish - or the reverse)',
        gains: ['Simplest code: no extra table or process', 'Lowest publish delay - one hop after the commit'],
        costs: [
          'A crash between the steps loses the event (commit first) or invents one (publish first)',
          'Nothing records the failure, so nothing retries it',
          'Found later, usually by a customer',
        ],
      },
      {
        approach: 'Outbox + polling relay',
        gains: ['No lost or phantom events', 'Uses the database transaction you already have', 'No new infrastructure'],
        costs: [
          'Publish delay of up to one poll interval',
          'A query every interval, even when nothing changed',
          'Outbox table needs cleanup',
          'At-least-once: consumers must deduplicate',
        ],
      },
      {
        approach: 'Outbox + change data capture (for example Debezium)',
        gains: ['Lower delay - changes stream as they commit', 'No polling queries on the database', 'Rows can be deleted soon after insert'],
        costs: ['A CDC pipeline to run (Kafka Connect, access to the database log)', 'More moving parts to learn and monitor', 'Still at-least-once'],
      },
      {
        approach: 'Two-phase commit across database and broker',
        gains: ['One atomic commit across both systems'],
        costs: [
          'Both systems must support the same protocol - most brokers do not out of the box',
          'Participants block if the coordinator fails mid-commit',
          'Slower commits and harder operations',
        ],
      },
    ],
    mistakes: [
      'Publishing inside the transaction to a broker - if the transaction rolls back, the event was still sent.',
      'Assuming the outbox gives exactly-once delivery and writing consumers that are not idempotent.',
      'Running several relay instances without SELECT ... FOR UPDATE SKIP LOCKED (or another claim), so two instances publish the same row.',
      'Publishing with no message key, so the events of one order land on different partitions and arrive out of order.',
      'Never pruning sent rows, and never alerting on the oldest unsent row, so a stalled relay goes unnoticed.',
    ],
    realWorld: [
      'Debezium ships an Outbox Event Router that reads outbox inserts from the database log and uses the aggregateid column as the Kafka message key.',
      'microservices.io describes two relays for the same pattern: Polling publisher and Transaction log tailing.',
      'PostgreSQL (9.5+) and MySQL (8.0+) support FOR UPDATE SKIP LOCKED, which lets several relay workers claim different rows.',
    ],
    related: ['event-driven-architecture', 'idempotency', 'saga-pattern', 'kafka'],
    quiz: [
      {
        id: 'outbox-1',
        prompt:
          'An Order service commits the order, then publishes OrderPlaced to Kafka. A deploy kills the pod right after the commit. What is the state an hour later?',
        options: [
          'Kafka retries the publish when the pod comes back',
          'The database rolls the order back because the publish never happened',
          'The order exists, no event was ever published, and nothing will retry it',
          'The event is published twice when the new pod starts',
        ],
        answer: 2,
        explanation:
          'The commit is done, and the publish lived only in the memory of the killed process, so no record says it is missing and nothing retries it. The database does not roll back - the commit already succeeded and it knows nothing about Kafka. This is the Lost events counter in the Lab on Commit, publish.',
      },
      {
        id: 'outbox-2',
        prompt:
          'To avoid lost events, a team publishes OrderPlaced first and commits the order second. The commit then fails on a constraint violation. What happens?',
        options: [
          'Fulfilment acts on an order that does not exist',
          'Nothing - the event is discarded because the commit failed',
          'The broker waits for the commit before delivering the event',
          'The order is committed anyway because the event proves it happened',
        ],
        answer: 0,
        explanation:
          'Swapping the order only swaps the failure: the event is already on the broker and consumers act on it, while the order rolled back. The broker does not wait for the commit and does not know it failed. In the Lab, Publish, commit shows these as phantom events (red crosses).',
      },
      {
        id: 'outbox-3',
        prompt:
          'A developer moves the Kafka publish inside the database transaction, before COMMIT, and says "now it is atomic". The transaction then rolls back. What happened to the event?',
        options: [
          'It was rolled back together with the order',
          'It was sent anyway - the broker is not part of the database transaction',
          'Kafka holds it until the transaction commits',
          'It was never sent, because nothing is sent before COMMIT',
        ],
        answer: 1,
        explanation:
          'Code running between BEGIN and COMMIT is not made transactional by being there - only the writes to that database are. The broker accepted the message the moment it was published, so a rollback leaves a phantom event. Writing the event as an outbox row is what puts it inside the transaction.',
      },
      {
        id: 'outbox-4',
        prompt:
          'With the outbox, the Order service crashes after inserting the order row and the outbox row but before COMMIT. What does the system look like after the restart?',
        options: [
          'An order with no event, as with the dual write',
          'An outbox row with no order, which the relay publishes as a phantom',
          'The order and its event, because both inserts had already run',
          'No order and no event - both rows rolled back together, and the client got an error it can retry',
        ],
        answer: 3,
        explanation:
          'Uncommitted inserts are discarded together when the transaction does not commit, so the order row and the outbox row can never disagree. That is the whole point: both or neither. The Lab counts these as Rolled back, and the Lost and Phantom counters stay still.',
      },
      {
        id: 'outbox-5',
        prompt:
          'The relay publishes three outbox rows, Kafka accepts them, and the relay crashes before it marks them sent. What happens when it restarts?',
        options: [
          'The three events are lost, because the relay forgot them',
          'Kafka rejects the repeats automatically',
          'The rows are still unsent, so the relay publishes the same three events again',
          'The rows are marked sent by the database once Kafka accepts them',
        ],
        answer: 2,
        explanation:
          'The outbox table still says unsent, and it is the only memory the relay has, so it publishes them again - duplicates, not losses. That is why the outbox gives at-least-once delivery, not exactly-once. In the Lab, raise Relay crash chance and watch the Published again counter and the amber triangles.',
      },
      {
        id: 'outbox-6',
        prompt:
          'In the Lab, with Outbox on and Relay crash chance above 0, you turn Idempotent consumer off and Shipped twice starts climbing. What is the fix?',
        options: [
          'Have the consumer record each processed event id in the same transaction as its effect, and skip ids it has seen',
          'Set Relay crash chance to 0 in production',
          'Switch back to Commit, publish, which never sends duplicates',
          'Make the relay publish each row only once by deleting it before publishing',
        ],
        answer: 0,
        explanation:
          'Duplicates are the accepted price of never losing an event, so the consumer must deduplicate - recording the id with the effect (the inbox pattern) gives an effectively-once result. Relays do crash, and deleting the row before publishing turns a crash into a lost event. Going back to the dual write trades duplicates for silent losses.',
      },
      {
        id: 'outbox-7',
        prompt:
          'The relay process hung for 20 minutes. Orders kept committing and nobody noticed until fulfilment asked why nothing was shipping. Which alert would have fired within seconds?',
        options: [
          'Broker error rate',
          'Age of the oldest unsent outbox row',
          'Order service CPU',
          'Consumer lag on the fulfilment consumer group',
        ],
        answer: 1,
        explanation:
          'A stopped relay produces no errors anywhere - it simply stops publishing, so the broker error rate and consumer lag stay calm (lag cannot grow if nothing new is published). Only the outbox shows it: unsent rows pile up and the oldest one gets older. Stop the relay in the Lab and watch Oldest unsent row climb.',
      },
      {
        id: 'outbox-8',
        prompt:
          'The polling relay runs every 5 s, and product wants events within 1 s of the commit. What is the honest trade-off?',
        options: [
          'Publish directly from the request path again - it is faster and just as safe',
          'Nothing can be done, the outbox is always 5 s behind',
          'Remove the outbox table and make consumers poll the orders table',
          'Poll more often, which costs more queries on the database, or move to CDC, which costs a new pipeline to run',
        ],
        answer: 3,
        explanation:
          'The publish delay of a polling relay is set by its interval, so a shorter interval buys latency with query load; CDC streams committed changes from the log with no polling, and costs infrastructure. Publishing from the request path brings back the dual write and its lost events - it is faster, not as safe.',
      },
      {
        id: 'outbox-9',
        prompt:
          'You run two relay instances for availability. Even with no crashes, some events are published twice. What is the cause and the fix?',
        options: [
          'Kafka duplicates messages under load; enable compression',
          'Both instances read the same unsent rows; claim rows with SELECT ... FOR UPDATE SKIP LOCKED so each row goes to one instance',
          'The outbox table has no primary key; add one',
          'Two instances are never safe; run exactly one relay and accept the single point of failure',
        ],
        answer: 1,
        explanation:
          'Two pollers issuing the same plain SELECT both see the same unsent rows and both publish them. FOR UPDATE SKIP LOCKED locks the rows one instance claims and makes the other skip them. A single relay also works, but it is not the only option - claiming rows is the usual answer.',
      },
      {
        id: 'outbox-10',
        prompt:
          'Fulfilment sometimes receives OrderCancelled before OrderPlaced for the same order. The relay publishes to a 12-partition topic with no message key. What do you change?',
        options: [
          'Key each message by its order id, so all events of one order go to one partition and stay in order',
          'Use one partition for the whole topic',
          'Add a sleep between the two events in the Order service',
          'Make the consumer idempotent',
        ],
        answer: 0,
        explanation:
          'Kafka keeps order only within a partition, and with no key the two events land on different partitions. Keying by aggregate id keeps each order in sequence while different orders still spread over all 12 partitions. One partition also fixes it but throws away all parallelism; idempotency handles repeats, not reordering.',
      },
      {
        id: 'outbox-11',
        prompt:
          'After two years the outbox table holds 400 million rows and the relay poll query is getting slow. What is the fix?',
        options: [
          'Add more relay instances',
          'Move the outbox to a separate database',
          'Delete or archive sent rows on a schedule, keeping only a short window',
          'Poll less often',
        ],
        answer: 2,
        explanation:
          'Sent rows have done their job, and keeping them forever makes every poll scan a growing table. Pruning them on a schedule keeps the table small. A separate database would break the pattern itself: the outbox row must be in the same database, and the same transaction, as the order.',
      },
      {
        id: 'outbox-12',
        prompt:
          'An architect proposes a two-phase commit across Postgres and the broker instead of an outbox. What is the main problem?',
        options: [
          'Two-phase commit cannot guarantee atomicity',
          'Postgres cannot take part in two-phase commit',
          'It would publish events twice',
          'Both systems must support the same protocol, and participants block while the coordinator is down mid-commit - the outbox gets the same guarantee with one local transaction',
        ],
        answer: 3,
        explanation:
          'Two-phase commit does give atomicity (Postgres supports PREPARE TRANSACTION), but most brokers do not join it out of the box, and a coordinator failure leaves participants holding locks until it returns. The outbox reaches the same both-or-neither result with a transaction the service already has, at the price of at-least-once delivery.',
      },
    ],
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
