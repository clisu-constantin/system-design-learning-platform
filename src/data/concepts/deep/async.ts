import type { DepthMap } from './types';

export const asyncDepth: DepthMap = {
  'message-queues': {
    analogy: {
      title: 'The kitchen order rail',
      body:
        'Waiters do not wait at the pass for each dish; they clip the order to a rail and go back to the floor. Chefs take orders off the rail at whatever pace they can cook. During a rush, the rail gets longer - which is visible, manageable, and much better than waiters standing idle or orders being dropped on the floor.',
    },
    deepDive: [
      {
        heading: 'A queue converts coupling in time into a buffer',
        paragraphs: [
          'Without a queue, a producer can only work as fast as its consumer, and it fails when the consumer is down. With a queue, the producer writes a message and returns immediately; the consumer processes when it can. The two systems no longer have to be available at the same moment, which is called temporal decoupling and is the main reason queues exist.',
          'The second effect is load smoothing. Traffic spikes hit the queue instead of the database: a burst of 10,000 orders in ten seconds becomes a queue that drains over two minutes at a steady rate the downstream can actually sustain. Nothing is dropped and nothing is overloaded - the latency of individual items rises instead, which is usually the far cheaper failure.',
          'The third is failure isolation. If the email service is down, order placement still works; messages accumulate and are delivered when it recovers. Without a queue, the email failure becomes an order failure, which is how one unimportant dependency takes down an important flow.',
        ],
        code: {
          caption: 'The same request, with and without a queue',
          body: `SYNCHRONOUS
  POST /orders -> save order (30 ms)
               -> charge card (800 ms)
               -> send email (400 ms)
               -> update analytics (200 ms)
  user waits 1,430 ms; any failure fails the order

QUEUED
  POST /orders -> save order (30 ms)
               -> enqueue 3 messages (5 ms)
  user waits 35 ms; the rest happens in workers,
  retried independently, and an email outage is invisible`,
        },
      },
      {
        heading: 'Delivery guarantees, and the one you will actually use',
        paragraphs: [
          'At-most-once acknowledges the message before processing: if the worker crashes mid-work, the message is gone. Fast, lossy, acceptable only for disposable data such as sampled metrics. At-least-once acknowledges after processing: a crash means the message is redelivered, so work may happen twice. This is the default in virtually every broker.',
          'Exactly-once is what everyone wants, and no broker can promise it for side effects outside the broker - an email sent, a card charged - because the acknowledgement itself can be lost after the work is done. What you can build is an exactly-once effect: at-least-once delivery plus idempotent consumers. Deduplicate by message id, or use natural unique keys so a repeat write is a no-op.',
          'The practical implication is simple and non-negotiable: every consumer must be safe to run twice on the same message. Design that in from the first consumer you write, because it is far harder to retrofit once messages are flowing.',
        ],
        bullets: [
          'Acknowledge after the work is durably done, never before.',
          'Make every handler idempotent - dedupe key or natural unique constraint.',
          'Set a visibility timeout longer than the slowest normal processing time.',
          'Cap redelivery attempts and route failures to a dead letter queue.',
        ],
      },
      {
        heading: 'The operational realities: ordering, backlog and poison messages',
        paragraphs: [
          'Global ordering and parallel consumers are mutually exclusive. If five workers pull from one queue, messages complete in unpredictable order. Where order matters, you need per-key ordering: partition by entity id so all messages for one order go to one partition or one FIFO group, and only that stream is serialised.',
          'Backlog is the metric that matters most. Queue depth alone is ambiguous - 10,000 messages is fine at 5,000 per second and an incident at 10 per second. Track age of the oldest message and the ratio of arrival rate to processing rate; those two tell you whether you are falling behind and by how long.',
          'A poison message - one that always fails - will otherwise be retried forever, blocking or burning capacity. Limit attempts, move it to a dead letter queue, and alert on that queue being non-empty. A DLQ nobody looks at is just a slower way of losing data.',
        ],
      },
    ],
    examples: [
      {
        title: 'Absorbing a flash sale without dropping orders',
        setup:
          'Normal load is 200 orders per minute. A sale drives 12,000 orders in the first minute - 200 per second. The payment processor accepts at most 100 calls per second.',
        walkthrough: [
          'Synchronous design: 200 orders per second arrive against a processor limited to 100 per second, so half of the requests wait behind the other half until they time out. Customers retry, and the retries make it worse.',
          'Queued design: the API validates and saves the order (about 30 ms), enqueues a payment message, and returns "order received" immediately. Users get a response in well under a second throughout.',
          'The queue grows by 200 - 100 = 100 messages per second for 60 seconds, to about 6,000 payment messages. Workers keep draining at 100 per second, so after the rush the backlog clears in roughly another minute.',
          'Customers see "payment processing" rather than an error - a product decision that had to be made deliberately, and which turns a hard failure into a visible delay.',
          'Guardrails: a dead letter queue for cards that fail permanently, alerting on oldest-message age above 5 minutes, and idempotency keys so a redelivered payment message cannot charge twice - every order is charged once even though delivery is at-least-once.',
          'Scaling: workers auto-scale on backlog per worker, so the drain rate rises to the processor limit and no further - the queue is also acting as a rate limiter.',
        ],
        result:
          'The same traffic that broke the synchronous design produced a backlog of about 6,000 messages that was gone two minutes after the sale started. The queue converted an availability problem into a latency problem, which is almost always the trade you want.',
      },
    ],
    jargon: [
      { term: 'Producer / consumer', plain: 'The side that writes messages, and the side that processes them.' },
      { term: 'Acknowledgement (ack)', plain: 'Telling the broker a message is done so it stops redelivering.' },
      { term: 'Visibility timeout', plain: 'How long a message is hidden after delivery before being redelivered.' },
      { term: 'Dead letter queue', plain: 'Where messages go after too many failed attempts, so they can be inspected.' },
      { term: 'Backlog / lag', plain: 'How much work is waiting. Measure by oldest-message age, not just count.' },
      { term: 'At-least-once', plain: 'The normal guarantee: no loss, possible duplicates. Hence idempotency.' },
    ],
    remember: [
      'A queue decouples in time: producer and consumer no longer need to be up together.',
      'It converts overload into latency instead of errors.',
      'At-least-once is what you get, so every consumer must be idempotent.',
      'Ordering and parallelism conflict - partition by key when order matters.',
      'Alert on oldest-message age and on a non-empty dead letter queue.',
    ],
  },

  kafka: {
    analogy: {
      title: 'A newspaper archive, not a postbox',
      body:
        'A postbox empties when the letter is collected. An archive keeps every issue in order, and any number of readers can work through it at their own pace, each keeping a bookmark. A new reader can start from the very first issue printed. That difference - a retained, replayable log rather than a queue that drains - is what Kafka actually is.',
    },
    deepDive: [
      {
        heading: 'A partitioned, append-only log',
        paragraphs: [
          'A topic is split into partitions, and each partition is an ordered, append-only sequence of records on disk. Producers append; consumers read forward, tracking an offset. Nothing is removed when it is read - records are deleted by retention policy (seven days, thirty days, or never), which is why replay is a normal operation rather than a recovery procedure.',
          'Partitions are the unit of parallelism and of ordering. Order is guaranteed within a partition and nowhere else, so the partition key is the crucial design decision: keying by order_id means every event for one order is strictly ordered, while different orders process in parallel.',
          'Consumer groups divide the partitions among their members. With 12 partitions you can run up to 12 consumers in a group, each owning some partitions exclusively. Add a thirteenth and it sits idle - partition count is the ceiling on consumer parallelism. It can be increased but never decreased, and increasing it moves keys to different partitions, so pick it with headroom.',
        ],
        code: {
          caption: 'Topic, partitions, offsets, groups',
          body: `topic: orders  (key = order_id)

p0  [ o5 o8 o5 o12 ]  <- consumer A (group "billing")   offset 3
p1  [ o3 o7 o3      ]  <- consumer B (group "billing")   offset 2
p2  [ o9 o9 o11     ]  <- consumer C (group "billing")   offset 1

group "analytics" reads the SAME partitions with its own offsets.
Independent groups, independent progress, no copying of data.`,
        },
      },
      {
        heading: 'Why teams choose it: throughput and replay',
        paragraphs: [
          'Kafka achieves very high throughput by doing simple things: sequential disk writes (which are surprisingly fast), batching, zero-copy transfer to the network, and no per-message state to track beyond an offset. Hundreds of thousands of messages per second per broker is ordinary rather than exceptional.',
          'Replay is the feature that changes architectures. Because the log is retained, a new service can be deployed and read the whole retained history (7 days by default) to build its own state, a bug in a consumer can be fixed and the affected range reprocessed, and a rebuilt search index can be repopulated without touching the source database.',
          'This is what makes Kafka the backbone of event-driven systems rather than merely a fast queue. Several consumer groups read the same events for different purposes - billing, analytics, search indexing, notifications - and adding a new consumer requires no change to the producer at all.',
        ],
        bullets: [
          'Retention is time or size based, not consumption based - reading does not delete.',
          'Multiple consumer groups read the same data independently.',
          'Replay from an offset is routine: fix a bug, reprocess the range.',
          'Compacted topics keep only the latest value per key - a durable snapshot of current state.',
          'A group slower than retention loses the records deleted before it read them.',
          'An offset older than retention cannot be replayed: the group lands where auto.offset.reset says - the oldest kept record (earliest) or the log end (latest).',
        ],
      },
      {
        heading: 'The costs and the common mistakes',
        paragraphs: [
          'Operationally Kafka is a real distributed system: brokers, replication factors, in-sync replica settings, partition rebalancing, and ZooKeeper until Kafka 4.0 replaced it with the built-in KRaft mode. Running it yourself is a genuine commitment, which is why most teams use a managed offering - and why a smaller broker is often the right answer when you need a queue rather than a log.',
          'The most common design mistake is too few or too many partitions. Too few caps your consumer parallelism and creates hot partitions; too many adds per-partition overhead, slower rebalances and more open files. Start from your target throughput divided by what one consumer can handle, and add headroom.',
          'The second is a key that concentrates traffic - keying by country when 70 percent of users are in one country, or by a constant. And the third is treating Kafka as a database: it is an ordered log, not a query engine, so "get the current state of order 42" means either consuming into a store or using a compacted topic deliberately.',
        ],
      },
    ],
    examples: [
      {
        title: 'One event stream, four consumers, and a replay',
        setup:
          'An order-events topic with 12 partitions keyed by order_id and 7-day retention. Four independent consumer groups read it.',
        walkthrough: [
          'billing consumes each event to charge the customer. Keyed partitions guarantee that created, updated and cancelled for one order arrive in order.',
          'search indexes orders into Elasticsearch. It lags by a second and nobody minds.',
          'analytics batches events into the warehouse every five minutes, committing offsets after each successful batch.',
          'notifications sends emails, and is idempotent by (order_id, event_type) so a redelivery cannot send twice.',
          'A bug is found: for three days, search indexed the wrong currency field. Fix the consumer, reset that group offsets to three days ago, and let it reprocess. No other consumer is affected and the producer is untouched.',
          'Later, a new fraud service is added. It starts from the beginning of retention and builds its model from seven days of history before going live - again with no change to any producer.',
        ],
        result:
          'One write path, four independent readers, and a bug fixed by reprocessing rather than by a migration script. Retention plus per-group offsets is what makes those two things routine.',
      },
    ],
    jargon: [
      { term: 'Topic / partition', plain: 'A named stream, split into ordered logs that provide parallelism.' },
      { term: 'Offset', plain: 'A consumer position in a partition. Committing it is how progress is recorded.' },
      { term: 'Consumer group', plain: 'A set of consumers sharing partitions, with their own independent offsets.' },
      { term: 'Retention', plain: 'How long records are kept regardless of whether they were read.' },
      { term: 'Log compaction', plain: 'Keeping only the newest record per key, so the topic becomes a current-state snapshot.' },
      { term: 'Rebalance', plain: 'Reassigning partitions when group membership changes. Briefly pauses consumption.' },
    ],
    remember: [
      'Kafka is a retained, ordered log - reading does not consume.',
      'Ordering exists only within a partition, so the key choice decides your guarantees.',
      'Partition count caps consumer parallelism; pick it with headroom.',
      'Independent consumer groups read the same events for different purposes.',
      'Replay is a normal operation, and it changes how you fix bugs.',
    ],
  },

  'rabbitmq-concepts': {
    analogy: {
      title: 'A sorting office with rules on the wall',
      body:
        'Letters arrive at one counter (the exchange). The rules on the wall decide which pigeonholes each letter is copied into: some by exact address, some by pattern, some to every hole in the room. Senders never need to know which pigeonholes exist - they just post, and the rules do the routing.',
    },
    deepDive: [
      {
        heading: 'Exchanges, bindings, queues: the routing you get for free',
        paragraphs: [
          'Producers never publish to a queue in RabbitMQ; they publish to an exchange with a routing key. Bindings connect exchanges to queues with rules, and the exchange type decides how the rules are evaluated. That indirection is the core feature: routing lives in the broker configuration rather than in producer code.',
          'A direct exchange matches the routing key exactly - useful for simple task routing. A topic exchange matches patterns with wildcards, so order.created.eu and order.*.eu do what you would hope. A fanout exchange ignores the key and copies to every bound queue. A headers exchange matches on message attributes instead of a key.',
          'The practical consequence is that adding a new consumer means declaring a queue and a binding, with no change to the producer and no redeploy. For systems where routing rules evolve and differ per environment, this is genuinely valuable and is what distinguishes RabbitMQ from a plain queue.',
        ],
        code: {
          caption: 'Topic routing, which covers most real cases',
          body: `publish -> exchange "events" (topic), routing key "order.created.eu"

bindings
  "order.#"          -> queue audit          (every order event)
  "order.created.*"  -> queue welcome_email
  "*.*.eu"           -> queue eu_compliance
  "order.cancelled.#"-> queue refunds

one publish, three queues receive a copy, producer knows none of them
# matches zero or more words, * matches exactly one`,
        },
      },
      {
        heading: 'Reliability: acknowledgements, durability and prefetch',
        paragraphs: [
          'Three settings decide whether a message can be lost. The queue must be durable so it survives a broker restart, the message must be persistent so it is written to disk, and the consumer must acknowledge manually after the work is done rather than on delivery. Miss any one and a crash loses messages - and the defaults are not all on the safe side. Durable is about broker restarts; whether a queue outlives its consumer is a separate choice. An exclusive or auto-delete queue disappears when its consumer goes, and nothing routed while it is gone is kept for it.',
          'Publisher confirms close the last gap on the producer side: without them, a publish that the broker never persisted still looks successful to the application. With them, the broker confirms asynchronously and the producer can retry what was not confirmed.',
          'Prefetch (QoS) is the setting people most often get wrong. The default sends as many messages as a consumer will take, so one consumer can grab a thousand messages and leave the others idle - and if it dies, all thousand are redelivered. Set prefetch to a small number, often 1 to 10 for slow tasks, so work is spread and redelivery is bounded.',
        ],
        bullets: [
          'durable queue + persistent message + manual ack - all three, or messages are lost.',
          'Publisher confirms, or you do not know the broker actually stored it.',
          'Prefetch small for slow tasks; large only for fast, uniform ones.',
          'Dead letter exchange with a retry count, so poison messages leave the main queue.',
        ],
      },
      {
        heading: 'Where RabbitMQ fits next to Kafka',
        paragraphs: [
          'RabbitMQ is a broker in the traditional sense: messages are removed when acknowledged, and it excels at per-message routing, priorities, delayed delivery and complex topologies. Kafka is a retained log: nothing is removed on read, and it excels at throughput and replay.',
          'So the question is what your workload looks like. Task distribution with sophisticated routing, per-message TTLs, priorities and RPC-style replies is RabbitMQ territory. Event streaming with multiple independent readers, replay and very high volume is Kafka territory.',
          'Throughput differs by roughly an order of magnitude - tens of thousands per second for RabbitMQ versus hundreds of thousands for Kafka - but most applications live comfortably below both numbers, so routing flexibility and operational simplicity matter more than the headline figure. And many organisations run both, for different jobs.',
        ],
      },
    ],
    examples: [
      {
        title: 'Retry with backoff, built from exchanges',
        setup:
          'A payment consumer fails on transient provider errors. The team wants three retries at 1, 5 and 25 minutes, then a dead letter - without writing a scheduler.',
        walkthrough: [
          'On a failure, the consumer republishes the message to retry-exchange with a retry count header of 1, then acks the original - the message is moved, not lost.',
          'Three retry queues (retry.1m, retry.5m, retry.25m) each have a message TTL, plus a dead letter exchange and dead letter routing key that point back at the main payments queue.',
          'A failed message lands in retry.1m and simply sits there. After 60 seconds the TTL expires, and RabbitMQ dead-letters it back onto the main queue - which is a delayed retry with no scheduler anywhere.',
          'The retry count picks the routing key - retry.1m for 1, retry.5m for 2, retry.25m for 3 - so attempts escalate 1 -> 5 -> 25 minutes.',
          'After the third failure the message is routed to a genuine dead letter queue, which is monitored and alerted on.',
          'Consumers remain idempotent regardless, because a message can be redelivered even when processing actually succeeded and the ack was lost.',
        ],
        result:
          'Exponential backoff implemented entirely with TTLs and dead letter exchanges - no timers, no database of pending retries. This composition of routing primitives is exactly what RabbitMQ is good at.',
      },
    ],
    jargon: [
      { term: 'Exchange', plain: 'Where producers publish. It decides which queues receive a copy.' },
      { term: 'Binding', plain: 'A rule connecting an exchange to a queue, usually with a pattern.' },
      { term: 'Routing key', plain: 'The label on a message that bindings match against.' },
      { term: 'Prefetch / QoS', plain: 'How many unacknowledged messages one consumer may hold.' },
      { term: 'Dead letter exchange', plain: 'Where rejected or expired messages are routed instead of being dropped.' },
      { term: 'Publisher confirm', plain: 'The broker acknowledging that it durably stored a published message.' },
    ],
    remember: [
      'Producers publish to exchanges, never to queues - routing lives in the broker.',
      'Topic exchanges with wildcard bindings cover most real routing needs.',
      'Durable queue, persistent message and manual ack are all required to avoid loss.',
      'Set prefetch low for slow tasks, or one consumer hoards the work.',
      'TTL plus dead letter exchange gives you delayed retries with no scheduler.',
    ],
  },

  'event-driven-architecture': {
    analogy: {
      title: 'Announcing on the intercom instead of phoning each department',
      body:
        'You can phone accounting, then shipping, then support - and you must know each number, and wait for each to answer. Or you announce "order 42 has been placed" and every department that cares acts on it. Adding a new department means they start listening; the announcer never learns of their existence. The catch: if the order then gets stuck, nobody holds the plan - unless you also hire a coordinator who does.',
    },
    deepDive: [
      {
        heading: 'Events are facts, commands are instructions',
        paragraphs: [
          'The distinction shapes everything. A command says do this (ChargeCard), is addressed to one recipient, and can be rejected. An event says this happened (OrderPlaced), is past tense, is addressed to nobody in particular, and cannot be rejected because it is a statement of fact.',
          'Naming events in the past tense is not a style rule - it enforces the ownership model. The publisher is describing something that occurred in its own domain and is not asking for anything. If your event is called SendWelcomeEmail, it is a command wearing an event costume, and the coupling you were trying to remove is still there.',
          'The payoff is that adding consumers becomes free. A new fraud service, a new analytics pipeline, a new notification type - all subscribe to OrderPlaced without a single change to the order service. That is the inversion of dependency that makes event-driven systems attractive for organisations with many teams.',
        ],
        code: {
          caption: 'The coupling, before and after',
          body: `DIRECT CALLS (order service knows everyone)
  order -> POST /payments
        -> POST /inventory
        -> POST /emails
        -> POST /analytics
  add a consumer = change and redeploy the order service
  any callee down = order flow degraded

EVENT-DRIVEN (order service knows nobody)
  order -> publish OrderPlaced {id, customer, total, items}
  payments, inventory, emails, analytics each subscribe
  add a consumer = deploy the consumer. Nothing else changes.`,
        },
      },
      {
        heading: 'What you give up, and where the workflow lives',
        paragraphs: [
          'In a synchronous call chain you can read the code and see what happens. In an event-driven system, publishing an event tells you nothing about what follows - the consumers are elsewhere, possibly owned by another team, and the full behaviour exists only at runtime. A failure is not a stack trace; it is a message that did not arrive, or arrived twice, or arrived before another message it depended on. Correlation ids, distributed tracing and an event catalogue stop being nice-to-haves.',
          'That matters most for a multi-step business process, because the workflow has to live somewhere. In choreography it is implicit: each service reacts to events and emits its own, and the process exists only as the sum of those reactions. Adding a participant is free, but to answer "what happens when an order is placed" you read six services and hope you found them all. In orchestration it is explicit: a coordinator holds the sequence, issues commands, and records progress, so the process can be read, tested and resumed - at the price of a component that knows every participant and must stay up.',
          'And there are no transactions across consumers. Once OrderPlaced is published, payment may succeed while inventory fails. There is no rollback - only compensation, which is what the saga pattern formalises. Most real systems use both shapes and choose per process: choreography for independent reactions, orchestration for ordered steps that need compensation or that somebody will ask about. Keep the coordinator thin - it sequences steps and compensates, it does not decide prices.',
        ],
        bullets: [
          'Fan-out with independent reactions -> choreography.',
          'Ordered steps with compensation, or "where is order 4711 right now?" -> orchestration.',
          'More than about four chained reactions -> orchestrate before it becomes unfollowable.',
          'Correlation id on every event, propagated by every consumer.',
          'Version events additively; expect out-of-order and duplicate delivery.',
        ],
      },
      {
        heading: 'The transactional outbox, because dual writes do not work',
        paragraphs: [
          'The subtle and universal problem: your service must save the order to its database and publish the event. If it writes the database and then crashes, the event is never published and the rest of the system never learns. If it publishes first and the database write fails, consumers act on an order that does not exist.',
          'There is no way to make two systems commit atomically without a distributed transaction, which brokers generally do not support. The standard solution is the outbox pattern: in one local transaction, write the order and an outbox row containing the event. A separate relay reads the outbox and publishes, marking rows as sent.',
          'Since the relay can crash after publishing and before marking, publication is at-least-once and consumers must be idempotent - which they had to be anyway. Change data capture tools like Debezium implement the relay by reading the database log directly, which removes the polling and is the common production shape.',
        ],
      },
    ],
    examples: [
      {
        title: 'Adding a feature without touching the producer',
        setup:
          'An order service publishes OrderPlaced. Marketing asks for a "first purchase" congratulation email, and later legal asks for an audit trail.',
        walkthrough: [
          'Today four consumers subscribe: payments, inventory, notifications, analytics. The order service knows about none of them.',
          'Marketing feature: a new consumer subscribes to OrderPlaced, checks whether this is the first order for the customer, and sends the email. Deployed independently in an afternoon.',
          'Legal feature: another consumer writes every event to an append-only audit store. Again, zero changes to the order service.',
          'Contrast with the direct-call version: both features would require modifying, testing and redeploying the order service - the most critical service in the system - for functionality that has nothing to do with orders.',
          'The cost appears during an incident: a customer complains they got no email. The investigation spans the broker, the consumer group lag, and the consumer logs, rather than one stack trace. A correlation id per order makes that tractable.',
          'The other cost: when the order service adds a field to the event, all six consumers must tolerate it. Additive-only changes and a schema registry keep that from becoming a coordination meeting.',
        ],
        result:
          'Two features shipped without touching the critical service, at the price of needing tracing, a schema discipline and idempotent consumers. That is the event-driven bargain, stated honestly.',
      },
      {
        title: 'Rewriting an unfollowable checkout flow',
        setup:
          'Checkout is choreographed across 7 services. A customer reports an order stuck for 3 days, and nobody can say which step it is on.',
        walkthrough: [
          'Investigation requires reading logs in 7 services with no shared identifier. It takes 2 engineers most of a day to find that payment succeeded and inventory never received the event.',
          'Worse, there is no compensation: the card was charged 89 EUR, 0 items were reserved, and nothing in the system knows the order is inconsistent.',
          'Fix 1 (immediate): a correlation id on every message and distributed tracing, so 1 query shows every step of an order.',
          'Fix 2 (structural): replace the choreographed core with an orchestrated workflow of 3 steps - reserve stock, charge card, schedule shipment - each with an explicit compensation.',
          'The workflow state is persisted, so the current step of any order is a single query, and a stuck workflow is visible on a dashboard rather than discovered by a customer 3 days later.',
          'What stays choreographed: the 3 reactions to OrderConfirmed - notifications, analytics and recommendation updates. They are independent, need no ordering and need no compensation.',
        ],
        result:
          'The failure was not events - it was that a process with compensation requirements had no owner. Orchestrate the process that has a lifecycle; choreograph the reactions that do not.',
      },
    ],
    jargon: [
      { term: 'Event vs command', plain: 'A fact that happened versus an instruction to do something.' },
      { term: 'Choreography / orchestration', plain: 'Services react on their own and the workflow is implicit, versus a coordinator drives the steps and the workflow is explicit.' },
      { term: 'Compensation', plain: 'An action that undoes the business effect of a completed step, since there is no rollback.' },
      { term: 'Outbox pattern', plain: 'Writing the event to your own database in the same transaction, then relaying it.' },
      { term: 'Correlation id', plain: 'An identifier carried through every event so one flow can be traced.' },
      { term: 'Eventual consistency', plain: 'The state of the system converges after consumers catch up - inherent here.' },
    ],
    remember: [
      'Events are past-tense facts; if it reads like an instruction, it is a command.',
      'Adding consumers costs nothing - that is the entire point.',
      'Choreograph independent reactions; orchestrate ordered steps that need compensation.',
      'You lose the readable call chain, so correlation ids and tracing become mandatory.',
      'Dual writes are broken; use the outbox pattern.',
    ],
  },

  'pub-sub': {
    analogy: {
      title: 'A magazine subscription',
      body:
        'The publisher prints one issue and has no idea who receives it. Subscribers sign up and copies arrive; cancel and they stop. Nobody on either side knows the other, which is exactly why a new subscriber costs the publisher nothing at all - and also why the publisher never learns whether anyone read it.',
    },
    deepDive: [
      {
        heading: 'One message, many independent copies',
        paragraphs: [
          'The defining property is fan-out: a single published message is delivered to every subscriber, each with its own copy and its own progress. Contrast with a work queue, where a message is delivered to exactly one consumer because the point is to divide work rather than to broadcast news. In RabbitMQ the pub/sub shape is a fanout (or topic) exchange with one queue per subscriber - two different services reading one queue would split the messages between them instead.',
          'The publisher is decoupled in three ways at once: it does not know the identity of subscribers, does not know how many there are, and does not wait for them. That inverts the dependency direction. In request-response the caller must know every callee, so adding a fourth one changes the caller. In pub/sub the subscriber knows the event and the publisher knows nobody, so a new subscriber is a deployment, not a change request against another team service.',
          'That is also the limitation to be honest about. The publisher gets no feedback, so it cannot know whether anything was processed successfully. If you need a result, pub/sub is the wrong shape - use request-response, or publish an event and subscribe to a resulting event.',
        ],
        code: {
          caption: 'Fan-out versus work distribution',
          body: `PUB/SUB (topic)                 WORK QUEUE
  publish M                       enqueue M
    -> subscriber A gets M          -> exactly ONE worker gets M
    -> subscriber B gets M
    -> subscriber C gets M        purpose: divide the work
  purpose: tell everyone

In Kafka both exist: different consumer GROUPS get their own copy
(pub/sub), consumers WITHIN a group share partitions (work queue).`,
        },
      },
      {
        heading: 'Delivery guarantees - decide before you build on them',
        paragraphs: [
          'Redis pub/sub is ephemeral: messages are delivered to whoever is connected right now and are gone forever. A subscriber that was restarting misses everything sent in that window. It is excellent for cache invalidation and live notifications, and completely unsuitable for anything that must not be missed. Durable pub/sub - Kafka, Google Pub/Sub, SNS with SQS subscriptions, NATS JetStream - persists messages and tracks per-subscriber progress, so a subscriber that was down catches up when it returns.',
          'Durable delivery is normally at-least-once, so a subscriber will occasionally receive the same message twice - a redelivery after a crash, a lost acknowledgement, a rebalance. Every handler must be idempotent, and the cheapest way is a deduplication key or a unique constraint on whatever it writes. Ordering is limited too: within a partition or key most brokers preserve it, across a topic they do not, so design handlers to tolerate reordering.',
          'Independent progress is the other half. Each subscriber tracks its own position, so a slow or failing subscriber falls behind without affecting the others. That isolation is valuable, and it means you must monitor lag per subscriber - a healthy topic says nothing about healthy consumption.',
        ],
        bullets: [
          'Ephemeral (Redis pub/sub) - cache invalidation, presence, live UI hints.',
          'Durable (Kafka, Pub/Sub, SNS+SQS) - business events, integration, anything replayable.',
          'At-least-once delivery: every handler idempotent, no exceptions.',
          'Order only within a partition or key - design for reordering across them.',
          'Monitor lag per subscriber, and check that a slow one cannot block publishing.',
        ],
      },
      {
        heading: 'Designing topics and events that age well',
        paragraphs: [
          'Topic granularity is a real design decision. One topic per event type gives subscribers exactly what they want and produces many topics to manage. One topic per domain keeps ordering across related events and forces subscribers to filter. A common compromise is one topic per aggregate with the event type as an attribute, so filtering is cheap and ordering is preserved per entity.',
          'Message content matters too. A thin event ("order 42 changed") forces every subscriber to call back for details, which recreates the coupling you were removing and multiplies load on the publisher. A fat event carrying the relevant state lets subscribers act independently, at the cost of a larger payload and versioning discipline. Name events as past-tense facts - PaymentCaptured - never as commands such as SendWelcomeEmail, which would mean the publisher decides what the subscriber does.',
          'Version additively and never remove a field that somebody might read, because with pub/sub you genuinely do not know who is listening; a schema registry turns that rule into a check at publish time. And since no single place describes what happens after an event, carry a correlation id on every message and keep an event catalogue generated from code, so one query can still show the whole flow.',
        ],
      },
    ],
    examples: [
      {
        title: 'Cache invalidation across twenty instances',
        setup:
          'Twenty application instances each hold an in-process cache of feature flags and pricing rules. When an admin changes a rule, all twenty must drop their copy quickly.',
        walkthrough: [
          'Without pub/sub: each instance relies on a 60-second TTL, so a pricing change takes up to a minute to take effect everywhere and different users see different prices in between.',
          'With Redis pub/sub: the admin write publishes invalidate:pricing:eu. All twenty instances are subscribed and drop the key within milliseconds.',
          'Ephemeral delivery is acceptable here precisely because the TTL is the safety net: an instance that was restarting misses the message and refreshes within 60 seconds anyway.',
          'Note what would be wrong: using the same mechanism to publish "order placed". A missed message there means an order nobody processes, and Redis pub/sub offers no way to notice.',
          'Refinement: publish the new value rather than just the key, so instances update instead of dropping - which avoids twenty simultaneous cache misses hitting the database.',
        ],
        result:
          'Propagation went from up to 60 seconds to a few milliseconds, using an ephemeral channel backed by a durable TTL. Matching the durability guarantee to the consequence of a lost message is the whole decision.',
      },
      {
        title: 'One event, four subscribers, and one that fell behind',
        setup:
          'PaymentCaptured is published by the payment service on a durable topic. Four teams subscribe: accounting, email, analytics and fraud.',
        walkthrough: [
          'Adding the fraud subscriber a year after launch required 0 changes to the payment service - it subscribed and deployed.',
          'The analytics subscriber falls 6 hours behind during a traffic peak because its warehouse writes are slow. The other 3 are unaffected, because each tracks its own position.',
          'Nobody notices for 2 days, because there was no per-subscriber lag alert - only a topic dashboard showing healthy publish rates.',
          'Fix 1: alert on lag per subscriber group - analytics may lag 30 minutes, accounting not more than 1 minute.',
          'A separate incident: a rebalance redelivers 1,200 messages and the email subscriber sends 1,200 duplicate receipts.',
          'Fix 2: idempotency by (payment_id, template), so a redelivery is recognised and skipped.',
        ],
        result:
          'Extensibility worked exactly as promised, and the two problems were the two the pattern always brings: per-subscriber lag and duplicate delivery. Both have standard solutions that belong in place from the start.',
      },
    ],
    jargon: [
      { term: 'Topic', plain: 'The named channel publishers write to and subscribers listen on.' },
      { term: 'Fan-out', plain: 'One message delivered to many subscribers, each with its own copy.' },
      { term: 'Subscriber group', plain: 'A set of consumers sharing one position in the stream - one copy per group.' },
      { term: 'Consumer lag', plain: 'How far behind a subscriber is. Monitor it per subscriber.' },
      { term: 'Ephemeral vs durable', plain: 'Messages vanish if nobody is listening, versus stored until consumed.' },
      { term: 'Idempotent handler', plain: 'One that produces the same result when the message arrives twice.' },
    ],
    remember: [
      'Pub/sub broadcasts; a work queue divides. Know which one you need.',
      'New behaviour is added by subscribing - and the publisher learns nothing, not even whether anyone succeeded.',
      'Check whether your pub/sub is ephemeral or durable before trusting it with business events.',
      'At-least-once delivery means idempotent handlers; monitor lag per subscriber.',
      'Past-tense facts and additive versioning only - you do not know who is listening.',
    ],
  },

  'background-workers': {
    analogy: {
      title: 'The back office',
      body:
        'The person at the counter takes your request, gives you a reference number and serves the next customer. The processing happens in the back office, where it can take ten minutes without a queue forming at the door. The counter stays fast because it never does the slow work itself.',
    },
    deepDive: [
      {
        heading: 'Move anything the user does not need to wait for',
        paragraphs: [
          'A request handler should do the minimum required to answer: validate, persist, and return. Everything else - sending emails, generating PDFs, resizing images, calling third parties, updating analytics, rebuilding indexes - is work that a user gains nothing from waiting on.',
          'The benefit is not only latency. A worker can be retried without the user noticing, scaled independently of the web tier, and rate limited against a fragile third party. A failure in a background job becomes a retry rather than a failed request, which is a large availability improvement on its own.',
          'The test for what belongs in the background: if this step failed, would we want to fail the users request? For a payment, yes. For a welcome email, obviously not - and yet synchronous welcome emails have caused real signup outages.',
        ],
        bullets: [
          'Emails, notifications, webhooks - never in the request path.',
          'Image and video processing, PDF generation, exports.',
          'Third-party API calls that are not required for the response.',
          'Analytics, search indexing, cache warming, denormalised counter updates.',
          'Anything that takes longer than a few hundred milliseconds and is not the answer.',
        ],
      },
      {
        heading: 'Workers need their own everything',
        paragraphs: [
          'A common mistake is running workers as an afterthought of the web application. They need their own deployment, their own scaling policy, their own dashboards and their own alerts, because their failure mode is different: a web outage is loud, a worker outage is silent until somebody notices that emails stopped three hours ago.',
          'They also need separate resource limits. Workers doing image processing want lots of memory and few concurrent tasks; workers doing HTTP calls want high concurrency and little memory. Running both in one pool means tuning for neither, which is why separate queues and separate worker pools per workload type is the usual shape.',
          'Database connections deserve special attention. Fifty workers each holding a pool of ten connections is 500 connections, competing with the web tier for the same server limit. Workers should have their own, smaller pool, and long jobs must not hold a connection while doing external IO.',
        ],
        code: {
          caption: 'A worker fleet that does not interfere with itself',
          body: `queue: critical   (payments)        4 workers, concurrency 10, own DB pool
queue: default    (emails, webhooks) 8 workers, concurrency 25
queue: heavy      (video, exports)   2 workers, concurrency 1, 8 GB RAM
queue: low        (analytics)        2 workers, may lag freely

Separate queues = a video job can never delay a payment.
Alert on oldest-message age PER QUEUE, with different thresholds.`,
        },
      },
      {
        heading: 'Making jobs safe to retry, resume and cancel',
        paragraphs: [
          'Every job will run twice eventually: a redelivery, a deploy mid-job, a timeout that fired after the work completed. So jobs must be idempotent - keyed by something stable so a second run is a no-op, or written so that repeating the effect is harmless.',
          'Long jobs should be resumable rather than long. A job that processes 100,000 records should record progress and be able to continue from where it stopped, or better, split into batches that each fit comfortably inside a visibility timeout. A four-hour job that restarts from zero on every deploy never finishes on a busy team.',
          'Graceful shutdown ties it together: on SIGTERM, stop accepting new jobs, finish or safely abandon the current one, and return unfinished work to the queue. Without it, every deploy produces a small number of half-done jobs, which is the source of most mysterious data inconsistencies in job-heavy systems.',
        ],
      },
    ],
    examples: [
      {
        title: 'Signup, before and after',
        setup:
          'POST /signup currently takes 2.4 seconds and fails whenever the email provider is slow. It creates the user, sends a welcome email, provisions a demo workspace, and notifies the CRM.',
        walkthrough: [
          'Measure: user creation 40 ms, email 900 ms, workspace provisioning 1,100 ms, CRM call 350 ms.',
          'Only user creation must happen before responding. The response becomes 40 ms plus three enqueues, about 50 ms total.',
          'The email job retries with backoff; a provider outage now delays the email instead of failing the signup.',
          'Workspace provisioning is the interesting one - the user expects it. The UI shows "setting up your workspace" with a progress state, and the API exposes the status. The perceived experience improves because the page loads instantly.',
          'CRM notification goes to the low-priority queue; if the CRM is down for two hours, nobody notices and nothing is lost.',
          'Idempotency: each job is keyed by user id and job type, so a redelivery cannot send two welcome emails or provision two workspaces.',
          'Alerting: oldest-message age per queue, plus an alert if the welcome-email queue is empty for an unusual length of time - a silent worker is the failure nobody sees.',
        ],
        result:
          'Signup went from 2.4 s to 50 ms and stopped depending on three external systems. The main design work was not moving the code - it was deciding what the user sees while background work is still running.',
      },
    ],
    jargon: [
      { term: 'Worker', plain: 'A process that pulls jobs from a queue and executes them outside the request path.' },
      { term: 'Job / task', plain: 'One unit of background work, usually a message describing what to do.' },
      { term: 'Concurrency', plain: 'How many jobs one worker process handles at once.' },
      { term: 'Graceful shutdown', plain: 'Finishing or returning the current job on SIGTERM instead of dropping it.' },
      { term: 'Visibility timeout', plain: 'How long a job is hidden before the broker assumes the worker died.' },
      { term: 'Priority queue', plain: 'A separate queue so urgent work is not stuck behind bulk work.' },
    ],
    remember: [
      'If the user does not need the result, it does not belong in the request.',
      'Workers need their own deployment, scaling, dashboards and alerts.',
      'Separate queues per workload, or slow bulk jobs will delay urgent ones.',
      'Every job runs twice eventually - make it idempotent and resumable.',
      'Handle SIGTERM properly, or every deploy leaves half-finished work behind.',
    ],
  },

  'task-queues': {
    analogy: {
      title: 'A ticketed work rota',
      body:
        'Jobs are written on tickets and hung on a board. Workers take the top ticket, do it, and mark it done. Some tickets are urgent and go on a separate board; a ticket nobody can complete after three tries goes into the problem tray, where somebody actually looks at it.',
    },
    deepDive: [
      {
        heading: 'A task queue is a queue plus a job lifecycle',
        paragraphs: [
          'A raw message queue moves bytes. A task queue - Celery, Sidekiq, BullMQ, RQ and friends - adds the things you would otherwise write yourself: serialising a function call and its arguments, retry policies with backoff, scheduled and delayed execution, result storage, progress reporting, and a dashboard showing what is running and what failed.',
          'That is why teams reach for one rather than using the broker directly. The queue is the easy part; the lifecycle around each job is where the work actually is, and getting retries, timeouts and failure visibility right is worth a library.',
          'The trade-off is a layer of magic. Arguments are serialised, so passing a whole object is a trap - it is stale by the time the job runs, and it bloats the message. Pass identifiers and let the job load current state.',
        ],
        code: {
          caption: 'Job definition choices that cause or prevent incidents',
          body: `BAD
  send_invoice.delay(order_object, pdf_bytes)
    - huge message, stale data, breaks when the model changes

GOOD
  send_invoice.delay(order_id=42, idempotency_key="inv-42-2026-09")
    - small, always loads current state, safe to run twice

retry policy
  max_retries=5, backoff=exponential, jitter=on
  retry ONLY on transient errors; a validation error should
  go straight to the dead letter, not be retried five times`,
        },
      },
      {
        heading: 'Retries: the setting that helps and the setting that hurts',
        paragraphs: [
          'Retry with exponential backoff and jitter is the default that should be on everywhere. Without jitter, a downstream outage produces synchronised retry waves that keep the recovering service down - a retry storm you caused yourself.',
          'But retry only transient failures. A job that fails because the input is invalid will fail identically five more times, wasting capacity and delaying real work. Classify errors: network timeouts and 5xx are retryable, validation errors and 4xx are not, and anything unclassified should default to a small number of attempts.',
          'Cap total attempts and send exhausted jobs to a dead letter queue with the error attached. Then alert on that queue. The failure mode to avoid is a job retrying forever in the background while everyone believes the system is healthy - which is exactly what happens with unlimited retries and no dashboard.',
        ],
        bullets: [
          'Exponential backoff with jitter, always.',
          'Retry transient errors only; fail fast on permanent ones.',
          'Cap attempts, then dead letter with the error and the arguments.',
          'Alert on dead letter depth and on oldest-job age per queue.',
          'Set a per-job timeout, or one stuck job occupies a worker forever.',
        ],
      },
      {
        heading: 'Scheduling, priorities and long-running work',
        paragraphs: [
          'Most task queues can schedule a job for later, which is how reminders, retries and delayed cleanup are implemented without a cron. Beware scheduling far in the future: a job scheduled for six months out is a message nobody can see, whose code may no longer exist. For anything beyond a few days, store a row and have a periodic job pick it up.',
          'Priorities are usually better implemented as separate queues than as a priority field. Separate queues give separate worker pools, separate scaling and separate alerting, and they make starvation visible instead of subtle. A single priority queue tends to starve low-priority work invisibly.',
          'For genuinely long or multi-step work - a job with five external calls and human approval in the middle - a plain task queue starts to strain. That is the point where durable execution engines like Temporal earn their place: they persist the state of the workflow itself, so a process crash resumes at the last completed step instead of restarting.',
        ],
      },
    ],
    examples: [
      {
        title: 'A retry policy that turned a small outage into a large one',
        setup:
          'An image-processing job calls a third-party API. The API has a 4-minute outage. The queue holds about 30,000 jobs per hour, retry policy is 10 attempts with a fixed 5-second delay.',
        walkthrough: [
          'During the outage, roughly 2,000 jobs fail. Each retries every 5 seconds, so the queue generates 400 extra calls per second at the recovering API.',
          'The API comes back, is immediately hit by the retry flood plus normal traffic, and falls over again. The outage extends from 4 minutes to 40.',
          'All retries happen at the same offsets because the delay is fixed, so the load arrives in sharp waves rather than spread out.',
          'Fix 1: exponential backoff - 5 s, 10 s, 20 s, 40 s - so retry pressure falls off instead of staying constant.',
          'Fix 2: jitter of plus or minus 30 percent, so the waves flatten into a spread.',
          'Fix 3: a circuit breaker around the API. After 20 consecutive failures, jobs fail fast and are rescheduled a minute later instead of hammering a service that is known to be down.',
          'Fix 4: a concurrency limit on that queue, capping calls at the rate the provider documents.',
        ],
        result:
          'The same outage now produces a backlog that drains in two minutes, instead of a self-inflicted extension. A fixed-delay retry policy at scale is not a safety feature, it is a load generator.',
      },
    ],
    jargon: [
      { term: 'Task queue', plain: 'A queue plus job lifecycle: retries, scheduling, results and a dashboard.' },
      { term: 'Backoff', plain: 'Waiting longer between each retry attempt.' },
      { term: 'Jitter', plain: 'Randomising the wait so retries do not synchronise.' },
      { term: 'Dead letter queue', plain: 'Where exhausted jobs go, with their error, so a human can look.' },
      { term: 'Scheduled / delayed job', plain: 'A job that becomes eligible to run at a future time.' },
      { term: 'Durable execution', plain: 'An engine that persists workflow state so a crash resumes mid-workflow.' },
    ],
    remember: [
      'Pass ids, not objects - arguments are serialised and go stale.',
      'Exponential backoff with jitter, or your retries become the outage.',
      'Retry transient failures only; permanent ones should dead letter immediately.',
      'Separate queues beat priority fields: separate scaling, separate alerts.',
      'Alert on dead letter depth - a silent queue of failures is the worst failure mode.',
    ],
  },
};
