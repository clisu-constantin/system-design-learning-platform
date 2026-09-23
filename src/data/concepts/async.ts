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
    lab: 'event-log',
    labFocus: 'kafka',
    keywords: ['log', 'partition', 'offset', 'consumer group', 'retention', 'ordering'],
    what: 'Kafka stores records in an append-only log split into partitions. Consumers track their own offset, so data is replayable and multiple independent consumer groups can read the same stream.',
    why: 'When several systems need the same events, and you want to reprocess history after a bug or a new feature, a retained log beats a queue that deletes on acknowledgement.',
    how: [
      'Producers write to a topic; the partition is chosen by key (same key = same partition = ordered).',
      'Each partition is replicated; a leader handles writes and in-sync replicas follow.',
      'Consumer groups divide partitions among members - each partition goes to exactly one member, so parallelism is capped by partition count.',
      'Each group commits its own offset per partition, so reading deletes nothing and a group can rewind to replay.',
      'Retention is time- or size-based (7 days by default), independent of whether anyone consumed the data.',
    ],
    when: ['Event streaming between many teams.', 'High-throughput ingestion.', 'Event sourcing and stream processing.'],
    diagram: `topic: orders   (6 partitions)
 P0 [0][1][2][3]...     <- consumer group A member 1
 P1 [0][1][2]...        <- consumer group A member 2
 ...
 group B reads the same partitions independently at its own offsets

Ordering is guaranteed within a partition, not across the topic.`,
    advantages: [
      'Many consumer groups read the same events without the producer knowing about them.',
      'Replay is routine: rewind a group offset to reprocess after a bug, or start a new service from the oldest record kept.',
      'Very high throughput from sequential appends, batching and one offset per partition instead of per-message state.',
      'Ordering per key, because one key always lands on one partition.',
    ],
    tradeoffs: [
      {
        approach: 'Kafka log',
        gains: ['Replay and multiple consumer groups', 'Very high throughput', 'Ordering per key'],
        costs: [
          'Operationally heavy compared to a managed queue',
          'A classic consumer group tracks one offset per partition: no per-message acknowledgement, retry or delay (share groups, production-ready in Kafka 4.2, add per-record acknowledgement)',
          'Parallelism capped by partition count; partitions can be added but never removed, and adding them moves keys to new partitions',
          'A consumer slower than retention loses the records deleted before it read them',
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
      'Running more consumers in a group than there are partitions - the extra ones sit idle.',
      'A key that concentrates traffic, such as country, so one partition and one consumer take most of the load.',
      'Treating a topic as a database because retention is long.',
      'Assuming global ordering across partitions.',
    ],
    related: ['message-queues', 'event-driven-architecture', 'pub-sub', 'event-sourcing'],
    quiz: [
      {
        id: 'kafka-1',
        prompt:
          'A topic has 6 partitions. To go faster, the team runs 8 consumers in the same consumer group. What happens?',
        options: [
          'All 8 share the load evenly, so throughput rises by a third',
          'Kafka splits each partition so every consumer gets a share',
          'Only 6 consumers get a partition; the other 2 sit idle until a member leaves',
          'The group is rejected because it has more members than partitions',
        ],
        answer: 2,
        explanation:
          'Inside one group each partition goes to exactly one member, so 6 partitions means at most 6 busy consumers. The tempting answer - even sharing - would need more partitions, not more members. In the Lab, 4 billing members over 3 partitions leaves Billing 4 idle.',
      },
      {
        id: 'kafka-2',
        prompt:
          'OrderCreated, OrderPaid and OrderShipped for the same order must be processed in that order, but you also need many consumers in parallel. How do you produce the events?',
        options: [
          'Use the order id as the key, so every event of one order lands on the same partition',
          'Use a single partition for the whole topic',
          'Use a random key so the load spreads evenly',
          'Rely on Kafka ordering the whole topic by timestamp',
        ],
        answer: 0,
        explanation:
          'Kafka orders records within a partition only, and the same key always maps to the same partition. Keying by order id orders each order while different orders run in parallel. One partition would also be ordered, but caps the group at one busy consumer; a random key breaks the per-order order; there is no topic-wide ordering.',
      },
      {
        id: 'kafka-3',
        prompt:
          'Billing and analytics are two consumer groups on the same topic. Analytics is down for two hours; retention is 7 days. What happens to billing, and to analytics when it returns?',
        options: [
          'Billing stalls, because records cannot be removed until every group has read them',
          'Billing is unaffected, and analytics resumes from its own committed offset and catches up',
          'Billing is unaffected, but analytics lost the two hours because billing already consumed them',
          'Both groups restart from the newest record',
        ],
        answer: 1,
        explanation:
          'Each group keeps its own offset per partition, and reading deletes nothing - records leave only by retention. So billing carries on, and analytics picks up where it stopped. The tempting third option is how a queue that deletes on acknowledgement behaves, not a log. In the Lab, the projector keeps going while billing lags, and the other way round.',
      },
      {
        id: 'kafka-4',
        prompt:
          'For three days the search consumer indexed the wrong price field. Retention is 7 days. What is the cleanest fix?',
        options: [
          'Ask every producer to send the last three days of events again',
          'Write a migration script that patches the search index row by row',
          'Delete the topic and recreate it, so every consumer starts clean',
          'Deploy the fixed consumer and reset only the search group offsets to three days ago, so it reprocesses that range',
        ],
        answer: 3,
        explanation:
          'The records are still in the log, so replay is a normal operation: move one group back and let it read again. Producers and the other groups are untouched. Resending from producers or patching by hand is the work a retained log saves you, and recreating the topic throws away the history you need.',
      },
      {
        id: 'kafka-5',
        prompt:
          'A slow consumer group falls further and further behind. The topic uses size-based retention. What eventually happens to that group?',
        options: [
          'Records older than retention are deleted before it reads them, so it skips them and they are lost to it',
          'Kafka pauses the producers until the slow group catches up',
          'Kafka keeps the unread records past retention until the group reads them',
          'The group is moved to a faster broker automatically',
        ],
        answer: 0,
        explanation:
          'Retention does not look at consumers. Once the group offset points at a deleted record it can only continue from the oldest record still kept (or the newest, depending on auto.offset.reset). Kafka does not apply backpressure to producers for a slow group. In the Lab, turn on Size retention and slow billing down: the log says it fell behind retention.',
      },
      {
        id: 'kafka-6',
        prompt:
          'Events are keyed by country, and 70% of users are in one country. One consumer is at 100% while the others idle, and adding consumers does not help. What do you change?',
        options: [
          'Add more partitions - the hot country will spread across them',
          'Add more consumers until the hot one gets help',
          'Pick a key with many more distinct values, such as user id, that still keeps together what must stay ordered',
          'Turn on log compaction',
        ],
        answer: 2,
        explanation:
          'One key always maps to one partition, and one partition goes to one consumer, so a key that concentrates traffic creates a hot partition no matter how many partitions or consumers you add. A higher-cardinality key spreads the load; choose it so the events that need ordering still share a key.',
      },
      {
        id: 'kafka-7',
        prompt: 'A topic was created with 48 partitions but 12 would do. The team wants to reduce it in place. What do you tell them?',
        options: [
          'Run the partition reassignment tool with the new count',
          'Kafka cannot remove partitions: create a new topic with 12 and move producers and consumers to it',
          'Delete 36 partitions; their records move to the remaining ones',
          'Set the partition count to 12; keys keep their old partitions',
        ],
        answer: 1,
        explanation:
          'Kafka can add partitions but not remove them, and even adding them changes which partition a key maps to. So the partition count is chosen with headroom up front, and shrinking means a new topic and a migration.',
      },
      {
        id: 'kafka-8',
        prompt:
          'A billing consumer charges a card, then crashes before it commits its offset. It restarts. What happens, and what must the consumer do about it?',
        options: [
          'Nothing is read twice - Kafka tracks every processed record',
          'The record is lost, because it was already delivered once',
          'Kafka skips the record because it was delivered to a member that crashed',
          'It reads the record again from the last committed offset, so charging must be idempotent',
        ],
        answer: 3,
        explanation:
          'Progress is the committed offset, not the work done. Everything after the last commit is read again - at-least-once delivery - so the side effect needs an idempotency key. In the Lab, Rewind billing does the same on purpose and counts every re-read.',
      },
      {
        id: 'kafka-9',
        prompt:
          'In the Lab, Billing 1 owns P0 and P2 and its lag keeps growing. The projector reads the same partitions and has no lag. Why is the projector not slowed down?',
        options: [
          'It is its own consumer group with its own offsets, so a slow member of another group does not hold it back',
          'The projector reads a copy of the partitions made for it',
          'The projector has priority on the broker',
          'Billing and the projector take turns reading each record',
        ],
        answer: 0,
        explanation:
          'Consumer groups are independent readers of the same log: no data is copied and no group waits for another. A lagging group only hurts itself - until retention deletes records it has not read yet.',
      },
      {
        id: 'kafka-10',
        prompt:
          'A small team needs thumbnail jobs: one kind of consumer, per-job retry with a delay, no replay, and nobody to run a cluster. What fits best?',
        options: [
          'A self-run Kafka cluster with one partition',
          'A Kafka topic with a compacted log',
          'A managed traditional queue such as SQS, with per-message acknowledgement and retry built in',
          'Writing jobs to a database table and never deleting them',
        ],
        answer: 2,
        explanation:
          'Nothing here needs what a log adds - replay or many independent groups - while the team does need per-message retry and little operations. That is the job a managed queue is built for. Kafka could be made to do it, at the cost of running a distributed system for a feature they do not use.',
      },
      {
        id: 'kafka-11',
        prompt:
          'A new fraud service is deployed a month after the order topic started. Retention is 7 days. What can it read on its first day?',
        options: [
          'Only events written after it subscribed',
          'The last 7 days, by starting a new group at the oldest record kept, with no change to any producer',
          'The whole month, because Kafka keeps every record a group has not read',
          'Nothing until an existing group shares its offsets',
        ],
        answer: 1,
        explanation:
          'A new group can start at the earliest offset still in the log and build its state from history. Retention decides what is still there - 7 days here - not whether anyone read it. Starting only from new events is a choice (auto.offset.reset=latest), not a limit.',
      },
    ],
  },
  {
    slug: 'rabbitmq-concepts',
    title: 'RabbitMQ Concepts',
    tagline: 'Exchanges, bindings and queues - routing decided by the broker.',
    category: 'async',
    difficulty: 'Intermediate',
    keywords: ['exchange', 'binding', 'routing key', 'ack', 'prefetch', 'dlq'],
    what: 'RabbitMQ is a broker where producers publish to an exchange, bindings route messages into queues by routing key or pattern, and consumers acknowledge each message.',
    why: 'Its routing model expresses complex delivery rules (fan-out, topic matching, per-tenant queues) declaratively, without the producer knowing who consumes.',
    how: [
      'Exchange types: direct (exact routing key), topic (pattern), fanout (all bound queues), headers.',
      'Consumers acknowledge messages; unacked messages are redelivered after a channel closes.',
      'Prefetch limits how many unacked messages a consumer holds - the main throughput/fairness dial.',
      'Dead-letter exchanges capture rejected or expired messages.',
    ],
    diagram: `publish(routing_key="order.created")
        |
   [ topic exchange ]
     |            |
 order.*      *.created
     v            v
 [orders q]   [audit q]`,
    tradeoffs: [
      {
        approach: 'Broker-side routing',
        gains: ['Flexible topologies without producer changes', 'Per-message ack and retry'],
        costs: ['Broker state to manage', 'No replay after ack', 'Queue depth in memory can hurt the broker'],
      },
    ],
    mistakes: ['Prefetch set to unlimited, so one consumer grabs the whole queue and others idle.'],
    related: ['message-queues', 'pub-sub', 'kafka'],
  },
  {
    slug: 'event-driven-architecture',
    title: 'Event-Driven Architecture',
    tagline: 'Services announce facts; other services decide what to do about them.',
    category: 'async',
    difficulty: 'Advanced',
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
    ],
    mistakes: [
      'Publishing commands disguised as events ("SendEmail" is not something that happened).',
      'Ordering assumptions across topics that the broker never promised.',
      'Choreographing an ordered workflow that needs compensation, so nobody can say where a stuck order is.',
    ],
    related: ['pub-sub', 'kafka', 'saga-pattern', 'outbox-pattern', 'eventual-consistency', 'microservices'],
  },
  {
    slug: 'pub-sub',
    title: 'Pub/Sub',
    tagline: 'One publisher, many subscribers, no direct knowledge of each other.',
    category: 'async',
    difficulty: 'Beginner',
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
    ],
    mistakes: [
      'Using ephemeral pub/sub (Redis) for business events that must not be lost.',
      'Watching only the health of the topic, so one subscriber falls hours behind unnoticed.',
    ],
    related: ['message-queues', 'event-driven-architecture', 'fan-out', 'kafka', 'websockets'],
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
