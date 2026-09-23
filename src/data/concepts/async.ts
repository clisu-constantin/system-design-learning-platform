import type { Concept } from '@/types';

export const asyncConcepts: Concept[] = [
  {
    slug: 'message-queues',
    title: 'Message Queues',
    tagline: 'A buffer that lets producers and consumers run at different speeds.',
    category: 'async',
    difficulty: 'Beginner',
    lab: 'queue',
    keywords: ['backpressure', 'workers', 'queue depth', 'dead letter', 'at least once'],
    what: 'A message queue stores work items durably between the service that creates them and the workers that process them.',
    why: 'It decouples a fast, user-facing request from slow work. The API returns as soon as the job is enqueued, and a spike becomes a longer queue rather than a wall of timeouts.',
    how: [
      'The producer enqueues a message and returns immediately.',
      'Workers pull messages, process them and acknowledge; unacknowledged messages become visible again.',
      'Queue depth is the key signal: it grows whenever arrival rate exceeds total consumer throughput.',
      'Messages that keep failing go to a dead-letter queue for inspection instead of blocking the queue.',
    ],
    when: [
      'Email, notifications, thumbnails, exports, invoicing - anything the user need not wait for.',
      'Smoothing bursty traffic in front of a slower downstream system.',
      'Fan-out to several independent consumers.',
    ],
    diagram: `Producer 100 msg/s
    |
    v
 [ Queue ]  depth: 12   . . . . . . . . . . . .
    |
    +--> Worker 1  20 msg/s
    +--> Worker 2  20 msg/s
    +--> Worker 3  20 msg/s
                   = 60 msg/s consumed

100 in, 60 out -> depth grows 40/s -> latency grows without bound.
Fix: more workers, faster workers, or fewer messages.`,
    advantages: [
      'Absorbs bursts instead of dropping them.',
      'Failure isolation: a slow downstream service does not take down the API.',
      'Retries and dead-lettering come built in.',
    ],
    tradeoffs: [
      {
        approach: 'Asynchronous processing via a queue',
        gains: ['Fast API responses', 'Elastic worker scaling', 'Natural retry semantics'],
        costs: [
          'Eventual completion - the user must be told the work is pending',
          'At-least-once delivery means consumers must be idempotent',
          'Another system to monitor, and queue depth becomes a new alert',
        ],
      },
      {
        approach: 'Synchronous processing',
        gains: ['Immediate, simple result', 'No extra infrastructure'],
        costs: ['Request latency includes all the slow work', 'Spikes cause timeouts and lost work'],
      },
    ],
    mistakes: [
      'Unbounded queues that hide a permanent capacity shortfall until the backlog is hours deep.',
      'Consumers that are not idempotent, so a redelivery sends the email twice.',
      'No dead-letter queue: one poison message blocks a partition forever.',
      'Treating a queue as a database - it is a pipe, not a store.',
    ],
    realWorld: [
      'SQS, RabbitMQ and Kafka differ in ordering, retention and delivery semantics, but the capacity arithmetic is identical.',
      'Autoscaling workers on queue depth is the standard production pattern.',
    ],
    related: ['backpressure', 'background-workers', 'kafka', 'idempotency'],
    quiz: [
      {
        id: 'mq-1',
        prompt: 'Producers send 500 msg/s. Five workers process 80 msg/s each. What happens?',
        options: [
          'The queue stays empty',
          'Depth grows by 100 msg/s and processing latency increases without bound',
          'Producers are automatically throttled',
          'Messages are dropped',
        ],
        answer: 1,
        explanation:
          'Consumption is 400 msg/s against 500 arriving. The 100/s difference accumulates - the queue absorbs a burst, but it cannot fix a permanent deficit.',
      },
      {
        id: 'mq-2',
        prompt: 'Why must queue consumers usually be idempotent?',
        options: [
          'Because queues are slow',
          'Because at-least-once delivery means a message can be delivered more than once',
          'Because messages arrive out of order',
          'Because workers share memory',
        ],
        answer: 1,
        explanation:
          'If a worker crashes after doing the work but before acknowledging, the message is redelivered. Only idempotent processing makes that safe.',
      },
    ],
  },
  {
    slug: 'kafka',
    title: 'Kafka',
    tagline: 'A partitioned, replayable log - not a traditional queue.',
    category: 'async',
    difficulty: 'Advanced',
    keywords: ['log', 'partition', 'offset', 'consumer group', 'retention', 'ordering'],
    what: 'Kafka stores records in an append-only log split into partitions. Consumers track their own offset, so data is replayable and multiple independent consumer groups can read the same stream.',
    why: 'When several systems need the same events, and you want to reprocess history after a bug or a new feature, a retained log beats a queue that deletes on acknowledgement.',
    how: [
      'Producers write to a topic; the partition is chosen by key (same key = same partition = ordered).',
      'Each partition is replicated; a leader handles writes and in-sync replicas follow.',
      'Consumer groups divide partitions among members - parallelism is capped by partition count.',
      'Retention is time- or size-based, independent of whether anyone consumed the data.',
    ],
    when: ['Event streaming between many teams.', 'High-throughput ingestion.', 'Event sourcing and stream processing.'],
    diagram: `topic: orders   (6 partitions)
 P0 [0][1][2][3]...     <- consumer group A member 1
 P1 [0][1][2]...        <- consumer group A member 2
 ...
 group B reads the same partitions independently at its own offsets

Ordering is guaranteed within a partition, not across the topic.`,
    tradeoffs: [
      {
        approach: 'Kafka log',
        gains: ['Replay and multiple consumers', 'Very high throughput', 'Ordering per key'],
        costs: [
          'Operationally heavy compared to a managed queue',
          'No per-message acknowledgement or delay',
          'Parallelism limited by partitions; repartitioning is disruptive',
        ],
      },
      {
        approach: 'Traditional queue (SQS, RabbitMQ)',
        gains: ['Simple, per-message ack and retry', 'Easy scaling of consumers'],
        costs: ['No replay after acknowledgement', 'Fan-out to many consumers needs extra queues'],
      },
    ],
    mistakes: [
      'Using one partition and wondering why consumers cannot scale.',
      'Treating a topic as a database because retention is long.',
      'Assuming global ordering across partitions.',
    ],
    related: ['message-queues', 'event-driven-architecture', 'pub-sub', 'event-sourcing'],
  },
  {
    slug: 'rabbitmq-concepts',
    title: 'RabbitMQ Concepts',
    tagline: 'Exchanges, bindings and queues - routing decided by the broker.',
    category: 'async',
    difficulty: 'Intermediate',
    lab: 'broker-routing',
    labFocus: 'rabbitmq-concepts',
    keywords: ['exchange', 'binding', 'routing key', 'ack', 'prefetch', 'dlq'],
    what: 'RabbitMQ is a broker where producers publish to an exchange, bindings route messages into queues by routing key or pattern, and consumers acknowledge each message.',
    why: 'Its routing model expresses complex delivery rules (fan-out, topic matching, per-tenant queues) declaratively, without the producer knowing who consumes.',
    how: [
      'Exchange types: direct (exact routing key), topic (pattern), fanout (all bound queues), headers (message attributes).',
      'A message that matches no binding is dropped - or returned to the publisher, if it set the mandatory flag.',
      'Consumers acknowledge messages; unacked messages are redelivered when the channel or connection closes.',
      'Prefetch limits how many unacked messages a consumer holds - the main throughput/fairness dial.',
      'Dead-letter exchanges capture rejected or expired messages.',
    ],
    when: [
      'Task distribution where the routing rules differ per consumer, tenant or environment.',
      'Work that needs per-message acknowledgement, retry, TTL or priority.',
      'Fan-out of events to a handful of services that do not need to replay history.',
    ],
    diagram: `publish(routing_key="order.created")
        |
   [ topic exchange ]
     |            |
 order.*      *.created
     v            v
 [orders q]   [audit q]`,
    advantages: [
      'Producers stay unaware of consumers: a new queue and binding needs no producer change.',
      'Per-message acknowledgement and redelivery.',
      'Rich routing in configuration: exact keys, patterns, broadcast and headers.',
    ],
    tradeoffs: [
      {
        approach: 'Broker-side routing (RabbitMQ)',
        gains: ['Flexible topologies without producer changes', 'Per-message ack and retry'],
        costs: ['Broker state to manage', 'No replay after ack', 'Queue depth in memory can hurt the broker'],
      },
      {
        approach: 'Log-based broker (Kafka)',
        gains: ['Replay, and many independent readers of one stream', 'Very high throughput'],
        costs: [
          'Routing is only by topic and partition - consumers filter what they do not want',
          'No per-message ack, TTL or priority',
        ],
      },
    ],
    mistakes: [
      'Prefetch set to unlimited, so one consumer grabs the whole queue and others idle.',
      'Expecting an error when a publish matches no binding - it is dropped unless the mandatory flag or an alternate exchange catches it.',
      'Binding a direct exchange with order.* - wildcards only mean something on a topic exchange.',
      'A durable queue with non-persistent messages, so a broker restart loses them anyway.',
      'Pointing two different services at one queue, so each message reaches only one of them.',
    ],
    related: ['message-queues', 'pub-sub', 'event-driven-architecture', 'kafka'],
    quiz: [
      {
        id: 'rmq-1',
        prompt:
          'A topic exchange has two bindings: order.* to the orders queue and *.created to the audit queue. A service publishes with routing key order.created. What happens?',
        options: [
          'Only the orders queue gets it, because the first matching binding wins',
          'Both queues get their own copy',
          'The broker picks one of the two queues at random',
          'Only the audit queue gets it, because *.created is more specific',
        ],
        answer: 1,
        explanation:
          'An exchange copies the message into every queue whose binding matches, and order.created matches both patterns. There is no "first match wins" and no specificity ranking - that is how one publish reaches several queues without the producer knowing about any of them.',
      },
      {
        id: 'rmq-2',
        prompt:
          'The same exchange receives a message with routing key user.updated. No binding matches it, and the publisher did not set the mandatory flag. What does the publisher see?',
        options: [
          'An error, so it can retry later',
          'Nothing happens yet - the exchange holds the message until a matching binding appears',
          'Nothing: the publish succeeds and the message is dropped',
          'The message goes to every queue, as a fallback',
        ],
        answer: 2,
        explanation:
          'Exchanges do not store messages. An unroutable message is dropped, or returned to the publisher only if it set the mandatory flag (an alternate exchange can also catch it). The tempting answer - an error - is exactly the assumption that loses messages silently. In the Lab this is the Dropped as unroutable counter.',
      },
      {
        id: 'rmq-3',
        prompt:
          'In the Lab you switch the exchange from Topic to Direct. Inventory, bound with order.*, stops receiving anything. Why?',
        options: [
          'A direct exchange compares the binding key and the routing key as exact strings, so order.* is just text that matches no key',
          'A direct exchange delivers each message to only one queue',
          'Switching the exchange type deletes the existing bindings',
          'Direct exchanges only accept routing keys without dots',
        ],
        answer: 0,
        explanation:
          'Direct routing is string equality: the binding order.* matches only a message whose key is literally order.*. Wildcards are a topic exchange feature. A direct exchange still copies to every queue bound with the same key, so "only one queue" is wrong.',
      },
      {
        id: 'rmq-4',
        prompt:
          'A new fraud service must see every order.placed. The payments service already consumes a queue bound with order.placed. What is the change with the least coupling?',
        options: [
          'Make the order service publish each event twice, once for fraud',
          'Have the fraud service consume from the payments queue too',
          'Have the payments service forward each message to the fraud service',
          'Declare a fraud queue and bind it to the exchange with order.placed - the producer does not change',
        ],
        answer: 3,
        explanation:
          'A new queue with its own binding gives fraud its own copy, and the producer and the payments service stay untouched. Consuming from the payments queue is the tempting shortcut, but consumers on one queue compete, so each order would reach only one of the two services.',
      },
      {
        id: 'rmq-5',
        prompt:
          'Two instances of the payments service consume from the same payments queue. An order.placed message arrives. What happens?',
        options: [
          'Both instances process it, which is why payments must be idempotent',
          'The broker holds it until both instances acknowledge',
          'One of the two instances gets it - they share the work',
          'It is rejected because the queue has two consumers',
        ],
        answer: 2,
        explanation:
          'Consumers on one queue are competing consumers: each message is delivered to one of them, which is how you scale one service. That is right here, because both instances do the same job. Broadcasting to different services needs one queue per service, as the Lab shows with One shared queue turned on.',
      },
      {
        id: 'rmq-6',
        prompt:
          'Three consumers share a queue of slow jobs, with no prefetch set. One consumer holds 1,000 unacknowledged messages while the other two sit idle. What fixes it?',
        options: [
          'Add more consumers',
          'Set a small prefetch, such as 10, so each consumer only holds a few unacknowledged messages',
          'Switch the exchange to fanout',
          'Turn on auto-ack so messages leave the queue faster',
        ],
        answer: 1,
        explanation:
          'A prefetch of 0 means unlimited, so the first consumer takes everything it can. A small prefetch spreads the work and bounds what is redelivered if that consumer dies. More consumers would idle just the same, and auto-ack makes the loss problem worse.',
      },
      {
        id: 'rmq-7',
        prompt:
          'A consumer uses automatic acknowledgement. It crashes halfway through sending an invoice, and that invoice is never sent. What would have prevented the loss?',
        options: [
          'Acknowledging manually, after the work is done',
          'A larger prefetch',
          'A fanout exchange',
          'A shorter message TTL',
        ],
        answer: 0,
        explanation:
          'With auto-ack the broker forgets the message as soon as it is delivered, so a crash loses it. A manual ack after the work means an unacked message is redelivered when the channel closes - at the price of possible duplicates, so the consumer must be idempotent.',
      },
      {
        id: 'rmq-8',
        prompt:
          'The broker restarts. The orders queue was declared durable and is still there, but it is empty - 400 messages are gone. What was missing?',
        options: [
          'Publisher confirms',
          'A dead letter exchange',
          'A topic exchange instead of a direct one',
          'The messages were not published as persistent',
        ],
        answer: 3,
        explanation:
          'A durable queue survives the restart, but only persistent messages are written to disk and survive with it. You need both, plus manual ack on the consumer side. Publisher confirms tell the producer the broker stored a message; they do not make a transient message survive.',
      },
      {
        id: 'rmq-9',
        prompt:
          'In the Lab, Analytics is bound with # and handles 4 events/s. You raise the publish rate to 6 events/s. What do you see?',
        options: [
          'Every queue grows, because the exchange slows down',
          'The publisher starts failing',
          'Only the Analytics queue grows - the other subscribers keep up',
          'Analytics starts receiving only every second event',
        ],
        answer: 2,
        explanation:
          'Each subscriber has its own queue, so a slow one falls behind on its own and the others are unaffected. The exchange keeps routing and the publisher sees no error - which is why lag must be watched per queue, not just the publish rate.',
      },
      {
        id: 'rmq-10',
        prompt:
          'One malformed message makes the consumer throw every time. It is requeued and retried in a tight loop, and the queue barely moves. What should you do?',
        options: [
          'Raise the prefetch so other messages get through',
          'Reject it without requeue and route it through a dead letter exchange to a dead letter queue you monitor',
          'Delete the queue and recreate it',
          'Switch to auto-ack so it is dropped',
        ],
        answer: 1,
        explanation:
          'A dead letter exchange moves poison messages out of the main queue, and keeps them for inspection. Auto-ack would also drop the message, but it would silently drop every other message a crash interrupts as well.',
      },
      {
        id: 'rmq-11',
        prompt:
          'In the Lab you turn Queues outlive subscribers off, take Email down for 30 seconds, then bring it back. Which user.signed_up events from those 30 seconds does it get?',
        options: [
          'None - its exclusive queue was deleted when it disconnected, so those events were never kept for it',
          'All of them, from its queue',
          'Only the last one',
          'All of them, because the exchange kept them',
        ],
        answer: 0,
        explanation:
          'An exclusive (or auto-delete) queue goes away with its subscriber, so while Email is away there is no queue bound for it and its copies are never kept - Missed copies climbs. A named queue that outlives the subscriber keeps collecting. Exchanges never store messages.',
      },
      {
        id: 'rmq-12',
        prompt:
          'A payment consumer should retry a failed message after 60 seconds, without writing a scheduler. Which RabbitMQ building blocks do that?',
        options: [
          'A higher prefetch and a sleep in the consumer',
          'A fanout exchange that copies the message to a retry service',
          'Publishing with a delay header on a direct exchange',
          'A retry queue with a 60-second message TTL whose dead letter exchange routes back to the main exchange',
        ],
        answer: 3,
        explanation:
          'The message sits in the retry queue until its TTL expires, and is then dead-lettered back to the main exchange - a delayed retry built from routing primitives, as the Lesson walks through. A sleep in the consumer blocks it and holds the message unacked the whole time.',
      },
    ],
  },
  {
    slug: 'event-driven-architecture',
    title: 'Event-Driven Architecture',
    tagline: 'Services announce facts; other services decide what to do about them.',
    category: 'async',
    difficulty: 'Advanced',
    lab: 'broker-routing',
    labFocus: 'event-driven-architecture',
    keywords: ['events', 'choreography', 'orchestration', 'workflow', 'decoupling', 'coupling', 'eventual consistency'],
    what: 'In an event-driven system, components publish events describing something that happened, and interested components react - without the publisher knowing who they are. For a multi-step business process it is also a choice about where the workflow is written down: spread across reacting services (choreography), or held by one coordinator (orchestration).',
    why: 'It decouples teams: adding a new reaction to "order placed" does not require changing the order service. It also absorbs load, because reactions happen asynchronously. Choreography and orchestration both use events; they differ in who knows the workflow - and so in how hard it is to change, debug and recover.',
    how: [
      'Publish events as facts in the past tense: OrderPlaced, PaymentCaptured.',
      'Consumers subscribe and update their own state; they must be idempotent.',
      'Use the outbox pattern so the event and the database write commit together.',
      'Version event schemas - consumers outlive producers.',
      'Choose per process: choreograph independent reactions, orchestrate ordered steps that need compensation (sagas).',
    ],
    when: ['Many consumers of the same business fact.', 'Workflows spanning several services.', 'Audit and analytics pipelines.'],
    diagram: `Order Service --OrderPlaced--> [ event bus ]
                                  |-- Payment Service
                                  |-- Inventory Service
                                  |-- Notification Service
                                  |-- Analytics

No service knows the others exist.`,
    advantages: [
      'A new reaction is a new subscriber - the publisher does not change.',
      'A consumer that is down does not fail the publisher; its events wait in its queue.',
      'Bursts are absorbed by the broker instead of by a chain of synchronous calls.',
    ],
    tradeoffs: [
      {
        approach: 'Event-driven (choreography)',
        gains: ['Loose coupling', 'Easy to add consumers', 'Natural load smoothing'],
        costs: [
          'No single place shows the whole workflow, so failure is hard to reason about',
          'Debugging requires distributed tracing',
          'Eventual consistency becomes a product decision',
          'Schema evolution is a permanent obligation',
        ],
      },
      {
        approach: 'Orchestration (a coordinator service)',
        gains: ['The workflow is explicit, testable and observable', 'Clear error handling and compensation'],
        costs: ['Coordinator becomes a coupling point and must be highly available', 'More synchronous dependencies'],
      },
      {
        approach: 'Direct synchronous calls',
        gains: ['Easy to follow: one call chain, one stack trace', 'The caller gets the result immediately'],
        costs: [
          'The caller must know and call every service that cares',
          'Any callee that is down or slow fails or slows the caller',
          'Adding a reaction means changing and redeploying the caller',
        ],
      },
    ],
    mistakes: [
      'Publishing commands disguised as events ("SendEmail" is not something that happened).',
      'Ordering assumptions across topics that the broker never promised.',
      'Choreographing an ordered workflow that needs compensation, so nobody can say where a stuck order is.',
      'Writing to the database and then publishing, so a crash in between loses the event - use an outbox.',
      'Consumers that are not idempotent, so a redelivered OrderPlaced charges the card twice.',
    ],
    related: ['pub-sub', 'kafka', 'saga-pattern', 'outbox-pattern', 'eventual-consistency', 'microservices'],
    quiz: [
      {
        id: 'eda-1',
        prompt:
          'In the Lab you switch to Direct calls and take Payments down: Failed publishes climbs. You switch back to Through the broker, with Payments still down. What changes?',
        options: [
          'Publishes still fail, because Payments is still down',
          'Publishes succeed; the Payments queue collects its events and the other services carry on',
          'The broker retries the call to Payments until it answers',
          'The other services stop receiving events until Payments is back',
        ],
        answer: 1,
        explanation:
          'Through the broker, the publisher only needs the broker to accept the event. The Payments queue holds its copies until it returns, and the other subscribers are unaffected. With direct calls the publisher waits on every callee, so one sick service fails the whole publish.',
      },
      {
        id: 'eda-2',
        prompt:
          'The order service publishes OrderPlaced. Marketing wants a congratulation email on the first purchase of each customer. In an event-driven design, what changes?',
        options: [
          'The order service adds a call to the email service',
          'The order service publishes a new FirstPurchase event',
          'Nothing in the order service: a new consumer subscribes to OrderPlaced and decides whether it is a first purchase',
          'The event bus gets a rule that calls the email service',
        ],
        answer: 2,
        explanation:
          'Adding a reaction is deploying a subscriber - the Lab shows it when you subscribe CRM sync and the publisher does not change. Having the order service decide what counts as a first purchase for marketing would put marketing logic into the most critical service.',
      },
      {
        id: 'eda-3',
        prompt: 'A signup service publishes an event called SendWelcomeEmail. What is wrong with it?',
        options: [
          'It is a command wearing an event costume: the publisher decides what a subscriber must do, so the coupling is still there',
          'Event names must be in capital letters',
          'Emails should never be sent from events',
          'Nothing, as long as only the email service subscribes',
        ],
        answer: 0,
        explanation:
          'Events are past-tense facts, such as UserSignedUp. Each subscriber then decides its own reaction - welcome email, CRM sync, analytics - without the publisher knowing. SendWelcomeEmail names one recipient and one action, which is a command.',
      },
      {
        id: 'eda-4',
        prompt:
          'The order service saves the order to its database, then publishes OrderPlaced. It crashes between the two steps. What happens, and what is the standard fix?',
        options: [
          'The broker notices and publishes the event on its behalf',
          'The event is published twice; add a unique id',
          'The database write is rolled back automatically',
          'The order exists but the event is never published; write the event to an outbox table in the same transaction and relay it',
        ],
        answer: 3,
        explanation:
          'Two systems cannot commit atomically without a distributed transaction, so a dual write can lose the event. The outbox pattern commits the order and the event together, and a relay publishes it at least once - which is why consumers must also be idempotent.',
      },
      {
        id: 'eda-5',
        prompt:
          'After a consumer restart, the payment service receives the same OrderPlaced twice and charges the customer twice. What was missing?',
        options: [
          'A faster broker',
          'Idempotent handling: record the order id and skip an event already processed',
          'Exactly-once delivery from the broker',
          'A second payment service',
        ],
        answer: 1,
        explanation:
          'Brokers deliver at least once, so duplicates are normal after a crash or a lost ack. The handler must be idempotent, for example with the order id as a deduplication key. Waiting for exactly-once delivery from the broker is the tempting wrong answer - end to end, the consumer still has to handle duplicates.',
      },
      {
        id: 'eda-6',
        prompt:
          'Checkout is choreographed across 7 services. An order is stuck for 3 days: payment succeeded, inventory never reacted, and nobody can say which step it is on. What is the structural fix?',
        options: [
          'Add more consumers to every service',
          'Replace the events with synchronous calls everywhere',
          'Orchestrate the ordered steps with explicit compensation, and keep the independent reactions choreographed',
          'Increase the event retention',
        ],
        answer: 2,
        explanation:
          'A process with ordered steps and compensation needs an owner that records where each order is. Independent reactions such as notifications and analytics can stay choreographed. Switching everything to synchronous calls brings back the coupling and the cascading failures.',
      },
      {
        id: 'eda-7',
        prompt:
          'After OrderPlaced, payment captured 89 EUR but inventory has no stock. There is no transaction across the two services. How is the order undone?',
        options: [
          'By compensation: a refund step that reverses the payment, as in a saga',
          'The broker rolls back the payment event',
          'By deleting the OrderPlaced event',
          'It cannot be undone, so the order ships late',
        ],
        answer: 0,
        explanation:
          'Once an event is published and acted on, there is no rollback - only compensating actions that undo the business effect. That is what the saga pattern formalises. Deleting the event changes nothing, because payment already acted on it.',
      },
      {
        id: 'eda-8',
        prompt:
          'A customer places an order and is taken straight to Order history, which is built by a service that consumes OrderPlaced. The new order is missing for a second. What is going on, and what do you do?',
        options: [
          'The event was lost; publish it again',
          'Eventual consistency: the consumer has not caught up. Show the order as pending, or read it from the order service right after placing it',
          'The broker is too slow and must be replaced',
          'The order service must call Order history synchronously before it answers',
        ],
        answer: 1,
        explanation:
          'Reactions happen after the publish, so read models lag a little - that is inherent, and becomes a product decision. Calling the history service synchronously would bring back the coupling that events removed.',
      },
      {
        id: 'eda-9',
        prompt:
          'A consumer assumes OrderPlaced always arrives before OrderCancelled. The two events go to different topics, and sometimes the cancel arrives first. Why?',
        options: [
          'The broker is misconfigured',
          'The publisher sent them in the wrong order',
          'Cancellations have a higher priority',
          'Ordering is only kept within one partition or queue, not across topics - put both on the same key or handle out-of-order events',
        ],
        answer: 3,
        explanation:
          'Brokers order messages within a partition or a queue. Across topics nothing is promised, so the consumer must either receive both on the same ordered channel (keyed by order id) or tolerate reordering, for example with a version number.',
      },
      {
        id: 'eda-10',
        prompt:
          'The order service renames the field total to amount in OrderPlaced. Three consumers it has never heard of break. What rule would have prevented this?',
        options: [
          'Change event schemas additively only: add amount, keep total, and check changes against a schema registry',
          'Tell every consumer before each release',
          'Never change an event',
          'Use a fanout exchange',
        ],
        answer: 0,
        explanation:
          'With events you do not know every consumer, so removing or renaming a field is a breaking change for someone. Additive changes and a registry check keep evolution safe. Telling every consumer is exactly the coordination event-driven design tries to avoid - and you cannot tell the ones you do not know.',
      },
      {
        id: 'eda-11',
        prompt:
          'A customer says they got no confirmation email. The order went through 5 event-driven services. What makes this quick to investigate?',
        options: [
          'Reading the order service code',
          'Restarting the email service',
          'A correlation id carried on every event, with distributed tracing and per-consumer lag',
          'Publishing the event again',
        ],
        answer: 2,
        explanation:
          'There is no single stack trace in an event-driven flow. A correlation id propagated by every consumer lets one query show every step of that order, and consumer lag shows whether the email service was simply behind. The order service code shows nothing about who consumed the event.',
      },
      {
        id: 'eda-12',
        prompt:
          'At checkout the user must see "payment declined" on the same page, within the request. Should the checkout get that answer from an event?',
        options: [
          'Yes - publish PaymentRequested and wait on the page for PaymentDeclined',
          'Yes - events are always the better choice between services',
          'No - use a fanout exchange instead',
          'No - the user needs the result now, so a synchronous call to payments fits; events suit reactions that need not answer',
        ],
        answer: 3,
        explanation:
          'An event does not return a result to its publisher. When the caller needs the answer to continue, request-response is the right shape. Events fit reactions the publisher does not wait for. Choosing per interaction is the trade-off, not "events everywhere".',
      },
    ],
  },
  {
    slug: 'pub-sub',
    title: 'Pub/Sub',
    tagline: 'One publisher, many subscribers, no direct knowledge of each other.',
    category: 'async',
    difficulty: 'Beginner',
    lab: 'broker-routing',
    labFocus: 'pub-sub',
    keywords: ['topic', 'fan-out', 'subscriber', 'broadcast', 'decoupling', 'at-least-once', 'consumer lag'],
    what: 'Publish/subscribe delivers each published message to every interested subscriber, rather than to exactly one consumer as a work queue does. Publishers do not know who is listening.',
    why: 'It is the messaging shape for broadcasting facts: one event, many independent reactions, each scaling on its own. New behaviour is added by subscribing, without touching the code that produces the event - the structural core of event-driven systems.',
    how: [
      'Publishers send to a topic; subscribers register interest independently.',
      'Each subscriber (or subscriber group) receives its own copy and tracks its own position.',
      'Slow subscribers must not block others - each needs its own buffer.',
      'Delivery is typically at-least-once, so handlers must be idempotent.',
    ],
    when: [
      'One fact, several independent reactions: a signup that triggers an email, a CRM sync and analytics.',
      'Cache invalidation or live updates across many instances (ephemeral is fine here).',
    ],
    diagram: `Publisher -> topic "user.signed_up"
                 |-> welcome-email service
                 |-> crm-sync service
                 |-> analytics pipeline
each gets its own copy and its own backlog`,
    advantages: [
      'A new subscriber costs the publisher nothing - no code change, no redeploy.',
      'Each subscriber scales, fails and falls behind on its own.',
      'The publisher does not wait for any subscriber.',
    ],
    tradeoffs: [
      {
        approach: 'Pub/Sub',
        gains: ['Add consumers without touching producers', 'Independent scaling and failure'],
        costs: [
          'No delivery confirmation - hard to know if anyone actually handled the message',
          'Duplicate delivery must be tolerated',
          'Ordering is limited to a partition or key',
          'Debugging spans many services',
        ],
      },
      {
        approach: 'Work queue (point to point)',
        gains: ['Each message is handled once, by one of several workers', 'Adding workers spreads the load'],
        costs: [
          'One message reaches one consumer - a second kind of consumer needs its own queue',
          'Not a way to tell several services the same news',
        ],
      },
    ],
    mistakes: [
      'Using ephemeral pub/sub (Redis) for business events that must not be lost.',
      'Watching only the health of the topic, so one subscriber falls hours behind unnoticed.',
      'Pointing two different services at one queue, so each event reaches only one of them.',
      'Handlers that are not idempotent, so a redelivery sends a second receipt.',
    ],
    related: ['message-queues', 'event-driven-architecture', 'fan-out', 'kafka', 'rabbitmq-concepts', 'websockets'],
    quiz: [
      {
        id: 'ps-1',
        prompt:
          'In the Lab, a fanout exchange has three subscribers: Email, CRM sync and Analytics. You press Publish one. How many copies of user.signed_up are delivered?',
        options: [
          'One, to whichever subscriber is free first',
          'One, to Email, because it is listed first',
          'Three - each subscriber queue gets its own copy',
          'Three, but only after all subscribers confirm',
        ],
        answer: 2,
        explanation:
          'Fanout copies every message into every bound queue, so one publish becomes three independent copies. "Whichever is free first" describes a work queue, where consumers compete for one message. Nobody waits for confirmations: each subscriber handles its copy on its own.',
      },
      {
        id: 'ps-2',
        prompt:
          'In the Lab you take CRM sync down, with queues that outlive subscribers. What happens to Email and Analytics, and to the events meant for CRM sync?',
        options: [
          'Email and Analytics carry on; the CRM sync queue collects its events and drains when it is back',
          'All three stop until CRM sync is back',
          'The publisher gets an error for each event',
          'CRM sync events go to Email instead',
        ],
        answer: 0,
        explanation:
          'Each subscriber has its own queue, so a failure in one is isolated from the others and from the publisher. The queue is the buffer that lets CRM sync catch up later - which is also why its lag must be monitored.',
      },
      {
        id: 'ps-3',
        prompt:
          'A team uses Redis pub/sub for OrderPlaced. The fulfilment subscriber restarts for 20 seconds during a deploy. What happens to the orders published in that window?',
        options: [
          'Redis keeps them until the subscriber reconnects',
          'Redis retries them for 60 seconds',
          'The publisher gets an error and republishes',
          'They are lost for that subscriber - Redis pub/sub only delivers to whoever is connected at that moment',
        ],
        answer: 3,
        explanation:
          'Redis pub/sub is ephemeral: at most once, with nothing stored. For business events that must not be missed, use durable pub/sub (Kafka, SNS with SQS, Google Pub/Sub, NATS JetStream), where each subscriber catches up from its own position.',
      },
      {
        id: 'ps-4',
        prompt:
          'Twenty app instances cache pricing rules with a 60-second TTL. An admin change should reach all of them fast. Is Redis pub/sub a reasonable way to send "invalidate pricing"?',
        options: [
          'No - any lost message means wrong prices forever',
          'Yes - a missed message is caught by the 60-second TTL anyway, so ephemeral delivery is acceptable',
          'No - pub/sub cannot reach twenty subscribers',
          'Yes - Redis pub/sub never loses messages',
        ],
        answer: 1,
        explanation:
          'Match the delivery guarantee to the cost of a lost message. Here the TTL is the safety net: an instance that misses the message refreshes within 60 seconds. Redis pub/sub does lose messages - that is exactly why the TTL has to stay.',
      },
      {
        id: 'ps-5',
        prompt:
          'In the Lab you turn on One shared queue. Email, CRM sync and Analytics all consume from it. What happens to each user.signed_up?',
        options: [
          'Each service still gets its own copy',
          'The broker holds it until all three have read it',
          'It goes to exactly one of the three, in turn - the other two never see it',
          'It is dropped, because a queue cannot have three consumers',
        ],
        answer: 2,
        explanation:
          'Consumers on one queue compete: each message goes to one of them. That is right for instances of the same service, and wrong for different services - Missed copies climbs in the Lab. Pub/sub needs one queue or subscription per subscriber.',
      },
      {
        id: 'ps-6',
        prompt:
          'The analytics subscriber has been 6 hours behind for 2 days. The topic dashboard showed healthy publish rates the whole time. What was missing?',
        options: [
          'An alert on lag per subscriber',
          'More partitions',
          'A faster publisher',
          'A second topic for analytics',
        ],
        answer: 0,
        explanation:
          'Each subscriber tracks its own position, so a healthy topic says nothing about healthy consumption. Alert on lag per subscriber group, with a limit that fits each one - analytics may lag 30 minutes, accounting not more than a minute.',
      },
      {
        id: 'ps-7',
        prompt:
          'A consumer rebalance redelivers 1,200 PaymentCaptured messages, and the email subscriber sends 1,200 duplicate receipts. What is the fix?',
        options: [
          'Ask the broker for exactly-once delivery',
          'Make the email handler idempotent, for example by payment id and template',
          'Turn off redelivery',
          'Publish each payment only once',
        ],
        answer: 1,
        explanation:
          'Durable pub/sub delivers at least once, so duplicates happen after rebalances, crashes and lost acks. A deduplication key makes a redelivery harmless. Turning off redelivery would trade duplicates for lost messages.',
      },
      {
        id: 'ps-8',
        prompt:
          'The signup API must tell the user whether the welcome email was sent before it responds. Is publishing UserSignedUp to a topic the right shape for that?',
        options: [
          'Yes, pub/sub returns the result of every subscriber',
          'Yes, if the email service subscribes first',
          'Yes, with a fanout exchange',
          'No - the publisher gets no feedback from subscribers; use request-response, or react later to an EmailSent event',
        ],
        answer: 3,
        explanation:
          'The publisher does not know who is listening and does not wait, so it cannot learn whether anyone succeeded. If you need the result now, call the service. If you only need to know later, subscribe to a resulting event.',
      },
      {
        id: 'ps-9',
        prompt:
          'The order service publishes a thin event, "order 42 changed". Five subscribers each call GET /orders/42 to find out what changed, and the order service is overloaded at peak. What helps?',
        options: [
          'Carry the state the subscribers need in the event, with versioned fields',
          'Add a sixth subscriber that caches orders',
          'Publish the event five times',
          'Make the subscribers poll less often',
        ],
        answer: 0,
        explanation:
          'A thin event forces every subscriber to call back, which recreates the coupling pub/sub removed and multiplies load on the publisher. A fat event lets subscribers act on their own, at the cost of a larger payload and schema discipline.',
      },
      {
        id: 'ps-10',
        prompt:
          'In Kafka, the email service and the analytics service both need every PaymentCaptured. How should they consume?',
        options: [
          'As two consumers in the same consumer group',
          'Analytics reads from the email service',
          'In two separate consumer groups, so each group gets every record at its own offset',
          'Through one consumer that forwards to both',
        ],
        answer: 2,
        explanation:
          'Different groups each get the full stream - that is pub/sub. Consumers within one group share the partitions, which is a work queue: each record would reach only one of the two services.',
      },
      {
        id: 'ps-11',
        prompt:
          'A year after launch, a fraud team wants every PaymentCaptured. What changes in the payment service?',
        options: [
          'It adds a call to the fraud service',
          'Nothing - the fraud service subscribes and deploys on its own',
          'It publishes to a second topic for fraud',
          'It waits for the fraud check before capturing',
        ],
        answer: 1,
        explanation:
          'Adding a subscriber is the promise of pub/sub: the publisher knows nobody, so it does not change. In the Lab, subscribing another service changes nothing on the publisher. Adding a call would turn the payment service into the coupling point again.',
      },
      {
        id: 'ps-12',
        prompt:
          'A subscriber sometimes receives PaymentRefunded before PaymentCaptured for the same payment. The topic has 12 partitions and messages are published without a key. What fixes the ordering for each payment?',
        options: [
          'One partition for the whole topic',
          'A second subscriber',
          'A larger retention',
          'Publish with the payment id as the key, so all events of one payment go to the same partition',
        ],
        answer: 3,
        explanation:
          'Order is kept within a partition, and the key picks the partition. Keying by payment id orders the events of each payment while keeping 12 partitions of parallelism. A single partition also orders them, but gives up all the parallelism to fix a per-payment problem.',
      },
    ],
  },
  {
    slug: 'background-workers',
    title: 'Background Workers',
    tagline: 'Processes that do the slow work after the response is sent.',
    category: 'async',
    difficulty: 'Beginner',
    lab: 'queue',
    keywords: ['jobs', 'workers', 'concurrency', 'retry', 'scaling'],
    what: 'Background workers are processes that consume jobs from a queue and execute them outside the request/response cycle.',
    why: 'Users should not wait for a PDF to render or an email provider to respond. Moving that work out keeps p95 latency about your code rather than about your slowest dependency.',
    how: [
      'Enqueue a job with everything the worker needs (or an id it can load).',
      'Size the pool from throughput: required rate divided by per-worker rate.',
      'Make jobs idempotent and retry with backoff; cap attempts and dead-letter the rest.',
      'Separate queues per priority so a bulk backfill cannot starve password-reset emails.',
    ],
    diagram: `POST /export  -> enqueue job -> 202 Accepted (job_id)
                                    |
                       worker pool processes it
client polls /exports/{job_id} or receives a webhook`,
    tradeoffs: [
      {
        approach: 'Background workers',
        gains: ['Fast responses', 'Independent scaling', 'Retry and isolation'],
        costs: ['Job status must be exposed to the user', 'Two code paths to operate', 'Ordering is not guaranteed by default'],
      },
    ],
    mistakes: ['One shared queue for everything, so a million-row import delays every transactional email.'],
    related: ['message-queues', 'task-queues', 'backpressure', 'idempotency'],
  },
  {
    slug: 'task-queues',
    title: 'Task Queues',
    tagline: 'Scheduling, priorities, retries and the operational side of jobs.',
    category: 'async',
    difficulty: 'Intermediate',
    keywords: ['celery', 'sidekiq', 'scheduling', 'priority', 'visibility timeout'],
    what: 'A task queue is the layer above a raw message queue: named jobs, arguments, scheduling, priorities, retry policies and visibility timeouts.',
    why: 'Most applications need "run this later", "run this every hour" and "retry three times with backoff". Rebuilding that on a raw broker is where the bugs live.',
    how: [
      'Visibility timeout must exceed worst-case processing time, or the job runs twice concurrently.',
      'Delayed and scheduled jobs cover reminders and retries.',
      'Priority queues or separate queues per class of work prevent starvation.',
      'Keep payloads small - pass ids, not blobs.',
    ],
    diagram: `enqueue("send_invoice", {id: 42}, run_at=+10m, retries=3, backoff=exp)

visibility timeout 30s, job takes 45s
 -> message reappears, a second worker starts the same job`,
    tradeoffs: [
      {
        approach: 'Framework task queue',
        gains: ['Scheduling, retries, priorities out of the box', 'Good operational tooling'],
        costs: ['Framework-specific semantics to learn', 'Hidden defaults (timeouts, prefetch) cause surprises'],
      },
    ],
    mistakes: ['Visibility timeout shorter than job duration - the classic cause of duplicate processing.'],
    related: ['background-workers', 'message-queues', 'retry', 'idempotency'],
  },
];
