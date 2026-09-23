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
    lab: 'saga',
    keywords: ['compensation', 'orchestration', 'choreography', 'consistency', 'rollback', 'pivot'],
    what: 'A saga implements a business transaction spanning several services as a series of local transactions, each with a compensating action that semantically undoes it. If a step fails, the compensations of the steps that already committed run in reverse order.',
    why: 'Each service owns its database, so no single transaction can cover them all. Two-phase commit across them blocks when the coordinator fails and is not supported by many databases, brokers and third-party APIs. A saga accepts temporary inconsistency and defines explicitly how to get back to a consistent state.',
    how: [
      'Break the workflow into steps, each a local transaction in one service.',
      'Define a compensation for each step - refund a charge, release a reservation.',
      'On failure, run compensations for completed steps in reverse order.',
      'Coordinate it with an orchestrator that sends commands, or by choreography - services reacting to each other events.',
      'Every step and compensation must be idempotent, because retries are guaranteed.',
    ],
    when: [
      'Multi-service workflows: order + inventory + payment + shipping, each with its own database.',
      'A business process that must end fully done or fully undone, and can tolerate seconds of visible in-between state.',
      'Participants that cannot take part in two-phase commit - a message broker, a NoSQL store, a payment provider.',
    ],
    advantages: [
      'No distributed locks: each step commits locally and releases its locks at once.',
      'Each service keeps its own database and stays deployable on its own.',
      'The failure path is written down - every step has a named compensation.',
    ],
    diagram: `1. create order         PENDING
2. reserve inventory     ok
3. charge payment        ok
4. schedule shipping     FAILED
   -> compensate 3: refund payment
   -> compensate 2: release inventory
   -> compensate 1: reject order

The user may briefly see a charge that is later refunded.
That window is a product decision, not a bug.`,
    tradeoffs: [
      {
        approach: 'Orchestrated saga',
        gains: [
          'The whole sequence and its compensations are written in one place',
          'Easy to see where a saga is stuck, and to resume it if its state is persisted',
          'Participants stay simple: they answer commands',
        ],
        costs: [
          'A coordinator that knows every participant',
          'The orchestrator must be highly available, or no saga moves',
        ],
      },
      {
        approach: 'Choreographed saga',
        gains: ['No central component to build or run', 'Services only know the events they react to'],
        costs: [
          'The workflow exists nowhere as one piece of code - you infer it from every participant',
          'Nobody owns a saga that stalls; a pending order can stay pending unnoticed',
          'Harder to test end to end, and cyclic event dependencies creep in as steps are added',
        ],
      },
      {
        approach: 'Two-phase commit',
        gains: ['Atomic across participants', 'No intermediate state is visible'],
        costs: [
          'Participants hold locks while waiting, and block if the coordinator fails',
          'Every participant must support prepare and commit - many brokers, NoSQL stores and external APIs do not',
        ],
      },
    ],
    mistakes: [
      'Designing the happy path and treating compensations as an afterthought.',
      'Compensations that are not idempotent - a retried refund pays the customer twice.',
      'Putting an irreversible step (an email, a shipment) before steps that can still fail.',
      'No escalation path: a compensation that keeps failing needs a queue a human actually watches.',
      'Forgetting that other requests see the intermediate state - reserved stock, a pending order.',
    ],
    related: ['microservices', 'idempotency', 'outbox-pattern', 'event-driven-architecture'],
    quiz: [
      {
        id: 'saga-1',
        prompt:
          'An order saga has committed "reserve 2 units" in Inventory and "charge 89 euro" in Payment. Then Shipping rejects the address. What has to happen next?',
        options: [
          'Nothing - the database rolls back the first two steps automatically',
          'Refund the 89 euro, then release the 2 units, then reject the order',
          'Release the 2 units, then refund, and leave the order as PENDING for a retry',
          'Retry the shipping step until it succeeds, however long that takes',
        ],
        answer: 1,
        explanation:
          'Each step committed in its own database, so there is no shared transaction to roll back: the saga runs a compensation for every committed step, in reverse order, and ends by rejecting the order. Automatic rollback is the tempting answer, but it only exists inside one database. Retrying forever does not help here - an undeliverable address will not become deliverable.',
      },
      {
        id: 'saga-2',
        prompt:
          'In the Saga Lab with Shipping failing, the customer statement shows +89 euro and then -89 euro. A product manager asks you to make the charge disappear from the statement. What is true?',
        options: [
          'The refund deletes the charge, so the statement can simply drop both lines',
          'The charge only shows because the Lab is simplified; real sagas hide it',
          'The charge really happened and was visible; the refund is a second transaction, so the product should explain the state, not hide it',
          'Switching from orchestration to choreography removes the charge line',
        ],
        answer: 2,
        explanation:
          'Compensation is semantic, not erasure: the refund is a new, opposing entry, and the charge was committed and visible before it. Sagas have no isolation, so intermediate states are real and the product has to design for them. Neither coordination style changes that - the Lab shows the same two lines in both.',
      },
      {
        id: 'saga-3',
        prompt:
          'The orchestrator sends "refund 89 euro". Payment refunds, but the reply is lost, so the orchestrator times out and sends the refund again. How do you stop the customer getting 178 euro back?',
        options: [
          'Stop retrying compensations - a timed-out refund should be treated as done',
          'Use a longer timeout so the reply is never lost',
          'Switch to choreography, where messages are delivered exactly once',
          'Send the saga id as an idempotency key, so Payment recognises the repeat and does nothing',
        ],
        answer: 3,
        explanation:
          'Retries are guaranteed in a saga, so every step and compensation must be idempotent: Payment stores the key and answers the repeat without refunding again - turn the key off in the Lab and the statement shows two refunds. Treating a timeout as done is tempting, but the refund may never have run. Choreography does not help: a bus delivers at least once, so it redelivers too.',
      },
      {
        id: 'saga-4',
        prompt:
          'A compensation keeps failing: the refund has timed out on 3 attempts with backoff, because Payment is down. What should the saga do?',
        options: [
          'Park the saga in a queue that raises an alert, so a human finishes it',
          'Skip the refund, release the stock and mark the order as rejected',
          'Retry the refund immediately in a tight loop until Payment answers',
          'Charge the customer again, so the books balance',
        ],
        answer: 0,
        explanation:
          'Compensations fail too, and money is involved, so after bounded retries the saga needs an escalation path that somebody actually monitors - the Lab parks it in Manual review. Skipping the refund is the tempting shortcut, but it marks the order rejected while the customer is still charged. A tight retry loop hammers a service that is already down.',
      },
      {
        id: 'saga-5',
        prompt:
          'A checkout saga has four steps: reserve stock, charge card, send the confirmation email, schedule shipment. Shipping sometimes rejects an address. What change reduces the damage?',
        options: [
          'Add a compensation that deletes the email from the inbox of the customer',
          'Move the email to the end, after shipping has succeeded',
          'Send the email twice, so the customer notices the correction',
          'Charge the card last, so the email goes out sooner',
        ],
        answer: 1,
        explanation:
          'An email cannot be unsent, so irreversible steps go last, after every step that can still fail. Then a shipping failure never needs a "please ignore our email" message. A compensation that deletes an email does not exist - once read, it is read.',
      },
      {
        id: 'saga-6',
        prompt:
          'A choreographed saga now spans seven services. A new engineer asks what happens after PaymentCharged, and nobody can answer without reading every service. The team considers orchestration. What does the switch trade?',
        options: [
          'Nothing - orchestration only renames the events',
          'It removes the need for compensations, because the orchestrator can roll back',
          'It gains one place where the sequence and its compensations are written, and costs a coordinator that knows every participant and must stay available',
          'It gains exactly-once delivery, and costs more messages',
        ],
        answer: 2,
        explanation:
          'In choreography the workflow exists nowhere as one piece of code; an orchestrator writes it in one place, at the cost of a component that is coupled to every participant and that no saga can move without. Compensations are still needed - the orchestrator runs them, it cannot roll back committed steps.',
      },
      {
        id: 'saga-7',
        prompt:
          'When an order ships, the Loyalty service adds points. Nothing ever needs undoing. A teammate proposes a saga orchestrator for it. What is the honest assessment?',
        options: [
          'Orchestration is required whenever two services take part',
          'An event that Loyalty reacts to covers it; an orchestrator would add a component to run and keep available with little to coordinate',
          'It needs two-phase commit, because points and shipments must be atomic',
          'Choreography cannot work here, because events can be delivered twice',
        ],
        answer: 1,
        explanation:
          'Choreography suits short flows with few participants and no compensation: one event and one idempotent consumer. An orchestrator would pay its costs - a coordinator to build, run and keep available - for no benefit. Duplicate events are handled by making the consumer idempotent, not by giving up on events.',
      },
      {
        id: 'saga-8',
        prompt:
          'A saga reserves the last 2 units, then fails at payment and releases them 3 seconds later. In those 3 seconds another customer was told "out of stock" and left. Why did that happen?',
        options: [
          'The saga forgot to take a lock on the stock',
          'Inventory should have been the last step',
          'The release ran in the wrong order',
          'Sagas have no isolation: the reservation was committed and visible to others while the saga was still running',
        ],
        answer: 3,
        explanation:
          'Each saga step commits for real, so other requests see intermediate state. The RESERVED mark is a semantic lock - it deliberately stops others from buying stock that may still be sold - and its cost is exactly this lost sale when the saga later compensates. Moving Inventory last would let two customers pay for the same last units.',
      },
      {
        id: 'saga-9',
        prompt:
          'An architect proposes two-phase commit across the Order database, Kafka and an external payment provider, instead of a saga. What is the main problem?',
        options: [
          'Kafka and the payment provider do not take part in prepare and commit, and a coordinator failure would leave the participants blocked',
          'Two-phase commit is not atomic, so it would lose orders',
          'Two-phase commit only works across more than three participants',
          'There is no problem: two-phase commit is the standard way to join microservices',
        ],
        answer: 0,
        explanation:
          'Two-phase commit needs every participant to support a prepare phase, and holds locks until the coordinator decides - if it fails in between, participants block. Message brokers and external APIs generally cannot take part. It is atomic - that is its gain - but the costs make it unusable here, which is why sagas exist.',
      },
      {
        id: 'saga-10',
        prompt:
          'The orchestrator process crashes right after the card was charged and before the shipping command was sent. It restarts a minute later. What makes the saga finish correctly?',
        options: [
          'Nothing needs to be done: the saga state lived in memory and restarts from step 1',
          'The customer places the order again',
          'The orchestrator persisted the saga state after each step, so it resumes by sending the shipping command',
          'Payment notices the crash and refunds the charge on its own',
        ],
        answer: 2,
        explanation:
          'An orchestrator that stores its progress resumes where it stopped, which is one of its gains. Restarting from step 1 is tempting, but it would charge the card again unless every step is idempotent - and it still wastes work. Payment does not know the saga exists, so it cannot decide to refund.',
      },
      {
        id: 'saga-11',
        prompt:
          'In the Saga Lab, choreography with Payment down: the ShippingFailed event ends in the dead-letter queue, and the Order service still shows PENDING. Why does the order not say anything went wrong?',
        options: [
          'The Order service crashed',
          'No component owns the whole saga; the Order service only learns from events, and none reached it',
          'Choreography does not support compensations',
          'The event bus dropped the event without telling anyone',
        ],
        answer: 1,
        explanation:
          'In choreography nobody tracks the saga as a whole, so a stalled saga is silent unless someone watches the dead-letter queue or times out old pending orders. The bus did not drop the event silently - it dead-lettered it after failed deliveries. Choreography does support compensations; here the compensation itself could not run.',
      },
      {
        id: 'saga-12',
        prompt:
          'An order saga is: create order, reserve stock, charge card, schedule shipment. Inventory reports out of stock. How many compensations run?',
        options: [
          'Three: refund, release stock, reject the order',
          'Two: release stock and reject the order',
          'None: nothing was committed',
          'One: reject the order - only step 1 had committed',
        ],
        answer: 3,
        explanation:
          'Compensations run only for steps that committed. Reserving failed and the card was never charged, so the only committed step is the PENDING order, and rejecting it is the only compensation. Try Inventory fails in the Lab: one compensation, and nothing on the statement.',
      },
      {
        id: 'saga-13',
        prompt:
          'A saga ships a parcel - after that, it cannot be recalled. A later step, "create the invoice", fails because the invoicing service is briefly down. What should the saga do?',
        options: [
          'Compensate everything, including a request to return the parcel',
          'Retry the invoice step until it succeeds - the shipment was the pivot, so the saga can only go forward',
          'Mark the order as rejected and keep the money',
          'Skip the invoice step',
        ],
        answer: 1,
        explanation:
          'Once the pivot step commits, the saga can no longer be undone, so the steps after it are designed to be retryable and idempotent and are retried until they succeed. Compensating a shipped parcel is the tempting symmetric answer, but the step is not reversible - that is what made it the pivot.',
      },
    ],
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
