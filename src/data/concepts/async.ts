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
    keywords: ['events', 'choreography', 'decoupling', 'eventual consistency'],
    what: 'In an event-driven system, components publish events describing something that happened, and interested components react - without the publisher knowing who they are.',
    why: 'It decouples teams: adding a new reaction to "order placed" does not require changing the order service. It also absorbs load, because reactions happen asynchronously.',
    how: [
      'Publish events as facts in the past tense: OrderPlaced, PaymentCaptured.',
      'Consumers subscribe and update their own state; they must be idempotent.',
      'Use the outbox pattern so the event and the database write commit together.',
      'Version event schemas - consumers outlive producers.',
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
          'No single place shows the whole workflow',
          'Debugging requires distributed tracing',
          'Eventual consistency becomes a product decision',
          'Schema evolution is a permanent obligation',
        ],
      },
      {
        approach: 'Orchestration (a coordinator service)',
        gains: ['The workflow is explicit and testable', 'Easier error handling and compensation'],
        costs: ['Coordinator becomes a coupling point', 'More synchronous dependencies'],
      },
    ],
    mistakes: [
      'Publishing commands disguised as events ("SendEmail" is not something that happened).',
      'Ordering assumptions across topics that the broker never promised.',
    ],
    related: ['pub-sub', 'kafka', 'saga-pattern', 'outbox-pattern', 'eventual-consistency'],
  },
  {
    slug: 'pub-sub',
    title: 'Pub/Sub',
    tagline: 'One publisher, many subscribers, no direct knowledge of each other.',
    category: 'async',
    difficulty: 'Beginner',
    keywords: ['topic', 'fan-out', 'subscriber', 'broadcast'],
    what: 'Publish/subscribe delivers each published message to every interested subscriber, rather than to exactly one consumer as a work queue does.',
    why: 'It is the messaging shape for broadcasting facts: one event, many independent reactions, each scaling on its own.',
    how: [
      'Publishers send to a topic; subscribers register interest.',
      'Each subscriber (or subscriber group) receives its own copy.',
      'Slow subscribers must not block others - each needs its own buffer.',
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
        costs: ['Harder to know if anyone actually handled the message', 'Duplicate delivery must be tolerated', 'Debugging spans many services'],
      },
    ],
    related: ['message-queues', 'event-driven-architecture', 'fan-out', 'websockets'],
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
