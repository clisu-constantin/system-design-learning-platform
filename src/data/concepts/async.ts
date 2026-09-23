import type { Concept } from '@/types';

export const asyncConcepts: Concept[] = [
  {
    slug: 'message-queues',
    title: 'Message Queues',
    tagline: 'A buffer that lets producers and consumers run at different speeds.',
    category: 'async',
    difficulty: 'Beginner',
    lab: 'queue',
    labFocus: 'message-queues',
    keywords: ['backpressure', 'workers', 'queue depth', 'dead letter', 'at least once'],
    what: 'A message queue stores work items durably between the service that creates them and the workers that process them.',
    why: 'It decouples a fast, user-facing request from slow work. The API returns as soon as the job is enqueued, and a spike becomes a longer queue rather than a wall of timeouts.',
    how: [
      'The producer enqueues a message and returns immediately.',
      'Workers pull messages, process them and acknowledge; a message not acknowledged within the visibility timeout becomes visible again and is redelivered.',
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
        prompt: 'Producers send 500 msg/s into an unbounded queue. Five workers process 80 msg/s each. What happens?',
        options: [
          'The queue stays empty',
          'Depth grows by 100 msg/s and the wait for every new message keeps growing',
          'Producers are automatically throttled',
          'Messages are dropped',
        ],
        answer: 1,
        explanation:
          'Consumption is 5 x 80 = 400 msg/s against 500 arriving, so 100 msg/s pile up. An unbounded queue neither throttles nor drops - it just grows, and so does the wait. A queue absorbs a burst; it cannot fix a permanent deficit.',
      },
      {
        id: 'mq-2',
        prompt:
          'A worker charges a card, then crashes before it acknowledges the message. The broker delivers at least once. What happens next, and what protects the customer?',
        options: [
          'The message is lost, so the customer is never charged',
          'The broker sees that the charge happened and deletes the message',
          'After the visibility timeout the message is delivered again, and only an idempotent handler - for example an idempotency key on the charge - stops a second charge',
          'Nothing - the broker guarantees exactly-once delivery',
        ],
        answer: 2,
        explanation:
          'With no acknowledgement the broker assumes the work was not done and redelivers it. That is at-least-once delivery: no loss, possible duplicates. The broker cannot see side effects such as a card charge, so exactly-once delivery is not on offer - an idempotent handler gives an exactly-once effect.',
      },
      {
        id: 'mq-3',
        prompt:
          'In the Lab, 100 msg/sec arrive and 3 workers do 20 msg/sec each. You raise Max depth from 500 to 5,000. What changes?',
        options: [
          'Rejections start after about 125 s instead of 12.5 s, and messages wait much longer first - the 40 msg/sec deficit is unchanged',
          'The deficit disappears, because the queue can hold everything',
          'The workers get faster, because they have more to do',
          'Rejections start sooner, because a bigger queue is slower',
        ],
        answer: 0,
        explanation:
          'The queue grows by 100 - 60 = 40 msg/sec either way. At 500 it is full after 500 / 40 = 12.5 s; at 5,000 after 125 s. A bigger bound only delays the rejections and makes the wait longer - watch the Oldest message metric climb. Only more capacity or less work removes the deficit.',
      },
      {
        id: 'mq-4',
        prompt:
          'Order placement calls the email service directly and waits for it. The email provider is down for 20 minutes. What changes if the order service puts a message on a queue instead?',
        options: [
          'Nothing - order placement fails for 20 minutes either way',
          'Orders succeed; the confirmation emails wait in the queue and go out when the provider recovers',
          'Orders succeed, but every email from those 20 minutes is lost',
          'The orders themselves are queued and are placed 20 minutes late',
        ],
        answer: 1,
        explanation:
          'The queue removes the need for both sides to be up at the same moment (temporal decoupling). The order is saved and answered; the email message waits durably until a worker can send it. Nothing is lost as long as messages are kept longer than the outage.',
      },
      {
        id: 'mq-5',
        prompt:
          'Queue A holds 10,000 messages and its oldest message is 2 seconds old. Queue B holds 500 and its oldest message is 12 minutes old. Which needs attention now?',
        options: [
          'A, because its depth is 20 times higher',
          'Neither - both queues are below 50,000',
          'Both equally, because both have a backlog',
          'B - its consumers are 12 minutes behind or stuck, while A drains in seconds',
        ],
        answer: 3,
        explanation:
          'Depth alone is ambiguous: 10,000 messages is nothing for consumers that drain them in 2 seconds. The age of the oldest message is the delay a user actually feels, and 12 minutes means B is stuck or badly behind. Alert on oldest-message age, not only on depth.',
      },
      {
        id: 'mq-6',
        prompt:
          'Five workers pull from one queue. The events for order 42 - created, paid, shipped - must be applied in that order. What do you do?',
        options: [
          'Nothing - a queue is first in, first out, so five workers finish in order too',
          'Add more workers so each event finishes sooner',
          'Route messages by order id to a partition or FIFO group, so one consumer applies order 42 in sequence while other orders run in parallel',
          'Make the producer sleep between the three events',
        ],
        answer: 2,
        explanation:
          'Messages leave a queue in order, but five workers finish them in any order. Per-key ordering - a partition or message group per order id - keeps each order sequential and still spreads different orders across workers. Sleeping only makes the race less likely.',
      },
      {
        id: 'mq-7',
        prompt: 'One message always makes the worker throw an exception, and there is no limit on attempts. What happens, and what is the fix?',
        options: [
          'It is redelivered forever, burning worker time and blocking any ordered group it sits in; cap the attempts and move it to a dead-letter queue with an alert',
          'The broker deletes it after the first failure, so nothing needs doing',
          'Raise the visibility timeout so the worker has more time',
          'Add workers so the failure matters less',
        ],
        answer: 0,
        explanation:
          'A poison message never succeeds, so without a cap it cycles forever. A dead-letter queue takes it out of the flow after N attempts and keeps it for a person to inspect. More time or more workers do not make a message that always fails succeed.',
      },
      {
        id: 'mq-8',
        prompt: 'Jobs usually take 40 seconds. The queue visibility timeout is 30 seconds. What do you see?',
        options: [
          'Nothing unusual - the broker waits for the job',
          'Every job fails with a timeout error',
          'The broker slows down delivery to match the jobs',
          'After 30 s the message becomes visible again and a second worker starts the same job while the first is still running',
        ],
        answer: 3,
        explanation:
          'The visibility timeout is how long a delivered message stays hidden. When it runs out without an acknowledgement, the broker assumes the worker died and delivers the message again - so every 40 s job runs at least twice. Set the timeout above the slowest normal job, or extend it while working.',
      },
      {
        id: 'mq-9',
        prompt:
          'A metrics pipeline acknowledges each message as soon as it is received, before processing it. A worker crashes halfway through a batch. What is the result?',
        options: [
          'The batch is redelivered to another worker',
          'Those messages are lost - acknowledging before processing is at-most-once, acceptable for sampled metrics and not for orders',
          'Every message in the batch is processed twice',
          'The broker rolls the batch back automatically',
        ],
        answer: 1,
        explanation:
          'Once acknowledged, the broker forgets the message, so work that crashed is gone. That is at-most-once: fast, and lossy. At-least-once acknowledges after the work instead and pays with possible duplicates.',
      },
      {
        id: 'mq-10',
        prompt:
          'In the Lab, 100 msg/sec arrive and 3 workers do 40 msg/sec each, so the queue is nearly empty. You press Send a burst (400 extra messages over 2 s). What does the queue do?',
        options: [
          'Rejects the whole burst, because it is above capacity',
          'Grows to about 360 messages during the burst, then drains at the 20 msg/sec of spare capacity in about 18 s',
          'Nothing - the burst goes straight to the workers',
          'Grows forever, because the burst never ends',
        ],
        answer: 1,
        explanation:
          'During the burst 300 msg/sec arrive against 120 consumed, so the queue gains 180 per second for 2 s - about 360, below the 500 bound. Afterwards only 120 - 100 = 20 msg/sec of headroom drains it: about 18 s. The burst became a delay, not an error.',
      },
      {
        id: 'mq-11',
        prompt:
          'Workers auto-scale on CPU. The backlog grows for an hour while worker CPU stays at 25%, because each job waits on a slow external API. Which signal should drive scaling?',
        options: [
          'Memory use on the workers',
          'The number of producers',
          'Backlog per worker, or the age of the oldest message',
          'Network bytes in and out',
        ],
        answer: 2,
        explanation:
          'Workers that wait on IO fall behind without using CPU, so a CPU rule never fires. Backlog per worker (or oldest-message age) measures how far behind they are, which is what the user feels. Scaling on it is the standard pattern for queue consumers.',
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
    labFocus: 'background-workers',
    keywords: ['jobs', 'workers', 'concurrency', 'retry', 'scaling', '202 accepted', 'graceful shutdown'],
    what: 'Background workers are processes that consume jobs from a queue and execute them outside the request/response cycle.',
    why: 'Users should not wait for a PDF to render or an email provider to respond. Moving that work out keeps p95 latency about your code rather than about your slowest dependency, and a failing email provider becomes a retry instead of a failed request.',
    how: [
      'The request handler validates, saves, enqueues a job with an id (not a whole object) and answers 202 Accepted with a job id.',
      'Size the pool from throughput: required rate divided by per-worker rate, plus headroom for bursts.',
      'Make jobs idempotent and retry with backoff; cap attempts and dead-letter the rest.',
      'Separate queues per priority so a bulk backfill cannot starve password-reset emails.',
      'Expose job status (a status URL or a notification) and alert on the age of the oldest job per queue.',
    ],
    when: [
      'The user does not need the result to continue: emails, webhooks, notifications, analytics, search indexing.',
      'The work is slow or heavy: PDF and export generation, image and video processing.',
      'The work calls a third party that can be slow, rate limited or down.',
    ],
    advantages: [
      'Responses stay fast no matter how slow the job is.',
      'Workers scale independently of the web tier.',
      'A failed job is retried in the background instead of failing the user request.',
    ],
    diagram: `POST /export  -> enqueue job -> 202 Accepted (job_id)   ~20 ms
                                    |
                       worker pool processes it     ~1 s per job
client polls /exports/{job_id} or receives a webhook`,
    tradeoffs: [
      {
        approach: 'Background workers',
        gains: ['Fast responses', 'Independent scaling', 'Retry and isolation'],
        costs: ['Job status must be exposed to the user', 'Two code paths to operate', 'Ordering is not guaranteed by default'],
      },
      {
        approach: 'Doing the work inside the request',
        gains: ['The response carries the final result', 'One code path, no queue or workers to run'],
        costs: [
          'Response time includes the slowest step',
          'A slow or failing dependency fails the user request',
          'Web servers must be sized for the heavy work',
        ],
      },
    ],
    mistakes: [
      'One shared queue for everything, so a million-row import delays every transactional email.',
      'Jobs that are not idempotent, so a redelivery after a deploy sends two emails or provisions two workspaces.',
      'No graceful shutdown: every deploy kills jobs halfway through.',
      'Monitoring only the web tier - a stopped worker raises no HTTP errors, only a growing backlog.',
      'Moving work the user actually needs (the payment result) to the background and leaving the page with nothing to show.',
    ],
    related: ['message-queues', 'task-queues', 'backpressure', 'idempotency'],
    quiz: [
      {
        id: 'bw-1',
        prompt:
          'POST /signup takes 2.4 s: 40 ms to create the user, 900 ms to send a welcome email, and more for other steps. The email provider starts timing out and signups fail. Which design keeps signups working?',
        options: [
          'Raise the HTTP timeout of the signup endpoint to 30 seconds',
          'Create the user, enqueue a welcome-email job and answer at once; a worker sends the email and retries with backoff',
          'Send the email first, then create the user',
          'Cache the responses of the email provider',
        ],
        answer: 1,
        explanation:
          'The user needs the account, not the email, before the page can continue. With the email in a worker the response takes about 50 ms, and a provider outage delays emails instead of failing signups. A longer timeout keeps the signup tied to the provider and only makes the wait longer.',
      },
      {
        id: 'bw-2',
        prompt:
          'In the Lab, users get an answer in 20 ms while each job takes 1 s in a worker. You turn the Queue off. What do users see?',
        options: [
          'Still 20 ms - removing the queue removes a hop',
          'Faster answers, because nothing waits in a queue any more',
          'Each user now waits at least the 1 s job, plus any wait for a free worker',
          'An immediate error on every request',
        ],
        answer: 2,
        explanation:
          'Without the queue the API calls a worker and holds the request until the job is done, so the job time moves back onto the request path. The Users node shows the wait jump from 20 ms to over a second. The work did not get slower - the user now waits for it.',
      },
      {
        id: 'bw-3',
        prompt: 'Jobs arrive at 30 per second and one worker finishes 4 per second. What is the smallest pool that keeps up?',
        options: ['4 workers', '6 workers', '8 workers', '30 workers'],
        answer: 2,
        explanation:
          '30 / 4 = 7.5, so 8 workers (32 per second) is the minimum - and it leaves only 2 per second to drain a burst, so run more in practice. 6 workers do 24 per second and fall 6 per second behind, forever.',
      },
      {
        id: 'bw-4',
        prompt:
          'A nightly import enqueues 1 million jobs into the same queue as password-reset emails. What happens to a reset requested at 01:00, and what is the fix?',
        options: [
          'It waits behind the import backlog, possibly for hours; give transactional work its own queue and workers',
          'It jumps the line because it is a small job',
          'It is dropped because the queue is busy',
          'The import slows itself down automatically',
        ],
        answer: 0,
        explanation:
          'A queue serves messages in order, so the reset sits behind whatever was enqueued first. Separate queues with their own workers keep urgent work fast no matter how big the bulk backlog grows. Queues do not know which job is small or urgent.',
      },
      {
        id: 'bw-5',
        prompt:
          'A deploy restarts the workers while a provision-workspace job is half done. The job is delivered again. What must be true to avoid two workspaces?',
        options: [
          'The broker must use exactly-once delivery',
          'Deploys must never happen while jobs run',
          'Nothing - redelivery never happens because of a deploy',
          'The job must be idempotent, keyed by user id and job type, so the second run finds the workspace and stops',
        ],
        answer: 3,
        explanation:
          'Every job runs twice eventually: a deploy, a crash or a timeout causes a redelivery. Keying the job so a repeat is a no-op makes that harmless. Brokers cannot give exactly-once effects on outside systems, and banning deploys does not stop crashes.',
      },
      {
        id: 'bw-6',
        prompt: 'Workers exit immediately on SIGTERM. What shows up after every deploy, and what is the fix?',
        options: [
          'Nothing - the broker finishes the jobs',
          'A few half-finished jobs; on SIGTERM stop taking new jobs, finish or return the current one to the queue, then exit',
          'The whole queue is lost',
          'Producers stop sending jobs',
        ],
        answer: 1,
        explanation:
          'Killing a worker mid-job leaves partial side effects, and the job may be redelivered on top of them. Graceful shutdown finishes or hands back the current job, so deploys stop producing inconsistent data. The queue itself survives a worker restart.',
      },
      {
        id: 'bw-7',
        prompt: 'Which checkout step should stay inside the request instead of moving to a worker?',
        options: [
          'Sending the confirmation email',
          'Updating the analytics counters',
          'Charging the card, when the page must say whether the payment succeeded',
          'Notifying the CRM',
        ],
        answer: 2,
        explanation:
          'The test is whether the user needs the result to get their answer. The page must show whether the payment worked, so the charge stays on the request path. The email, analytics and CRM change nothing the user sees right now, so they belong in workers.',
      },
      {
        id: 'bw-8',
        prompt:
          'The workers crashed at 02:00. The website worked all night and nobody was paged. At 09:00 support hears that no emails went out. What monitoring was missing?',
        options: [
          'CPU on the web servers',
          'The HTTP error rate of the API',
          'Database connection count',
          'The age of the oldest job per queue (and worker liveness), with an alert',
        ],
        answer: 3,
        explanation:
          'A worker outage is silent: the API keeps enqueuing and answering 202, so web metrics look perfect. The queue is where the failure shows - the oldest job gets older every minute. That is the alert that would have fired at 02:05.',
      },
      {
        id: 'bw-9',
        prompt: 'An export takes 3 minutes in a worker. The API answers 202 Accepted with a job id. What else does the product need?',
        options: [
          'A way to learn the result - a status URL to poll, or a notification or webhook when the export is ready',
          'Nothing - 202 means the export is done',
          'A longer HTTP timeout on the export endpoint',
          'A bigger queue',
        ],
        answer: 0,
        explanation:
          '202 Accepted says the request was accepted for processing, not that it finished. The client needs a way to find out when and whether it did. A longer timeout would put the 3 minutes back on the request.',
      },
      {
        id: 'bw-10',
        prompt:
          'Each of 50 workers opens a pool of 10 database connections. The database allows 400 connections and the web tier already uses 150. What happens when all workers run?',
        options: [
          'Nothing - the workers share the web tier connections',
          'They ask for 500 more connections against 250 free, so new connections are refused; give workers a small pool of their own and never hold a connection during external calls',
          'The database quietly queues the extra connections',
          'Workers do not use database connections',
        ],
        answer: 1,
        explanation:
          '50 x 10 = 500 on top of 150 is 650 against a limit of 400. A database refuses connections past its limit (PostgreSQL answers "too many clients"), and the web tier suffers too. Workers need their own, smaller budget.',
      },
      {
        id: 'bw-11',
        prompt:
          'In the Lab, 3 jobs/sec arrive and 4 workers finish 1 job/sec each. You raise Producer rate to 6/sec. What happens to the user wait and to the jobs?',
        options: [
          'Users wait longer for their 202',
          'User wait stays 20 ms, but the queue grows by 2 jobs/sec and every new job finishes later than the one before',
          'Both stay the same',
          'Requests are rejected at once',
        ],
        answer: 1,
        explanation:
          'The API only enqueues, so its answer does not depend on the workers. But 6 in and 4 out means the queue gains 2 jobs per second, and Job done after keeps climbing. Background work hides a capacity problem from response times - which is why you watch the queue.',
      },
    ],
  },
  {
    slug: 'task-queues',
    title: 'Task Queues',
    tagline: 'Scheduling, priorities, retries and the operational side of jobs.',
    category: 'async',
    difficulty: 'Intermediate',
    lab: 'queue',
    labFocus: 'task-queues',
    keywords: ['celery', 'sidekiq', 'scheduling', 'priority', 'visibility timeout', 'dead letter', 'backoff'],
    what: 'A task queue is the layer above a raw message queue: named jobs, arguments, scheduling, priorities, retry policies and visibility timeouts.',
    why: 'Most applications need "run this later", "run this every hour" and "retry three times with backoff". Rebuilding that on a raw broker is where the bugs live.',
    how: [
      'Visibility timeout must exceed worst-case processing time, or the job runs twice concurrently.',
      'A failed task is retried after a delay that grows each attempt (exponential backoff, with jitter); after the last attempt it moves to a dead-letter queue.',
      'Retry only transient errors - a validation error fails the same way every time.',
      'Delayed and scheduled jobs cover reminders and retries.',
      'Priority queues or separate queues per class of work prevent starvation.',
      'Keep payloads small - pass ids, not blobs.',
    ],
    when: [
      'Background jobs need retries, delays, schedules or priorities, not just a pipe.',
      'Failed work must be kept and inspected instead of lost.',
      'You want a dashboard of what is running, waiting and failing.',
    ],
    advantages: [
      'Retries with backoff and dead-lettering are configuration, not code.',
      'Delayed and scheduled execution without a separate scheduler.',
      'Tooling to see, retry and discard failed jobs.',
    ],
    diagram: `enqueue("send_invoice", {id: 42}, run_at=+10m, retries=3, backoff=exp)

attempt 1 fails -> delayed 2 s -> attempt 2 fails -> delayed 4 s
-> attempt 3 fails -> dead-letter queue (a person looks)

visibility timeout 30s, job takes 45s
 -> message reappears, a second worker starts the same job`,
    tradeoffs: [
      {
        approach: 'Framework task queue',
        gains: ['Scheduling, retries, priorities out of the box', 'Good operational tooling'],
        costs: ['Framework-specific semantics to learn', 'Hidden defaults (timeouts, prefetch) cause surprises'],
      },
      {
        approach: 'Raw message queue plus your own job code',
        gains: ['Full control of the message format and semantics', 'One less framework to learn'],
        costs: ['Retries, delays and dead-lettering must be built and tested by you', 'No ready-made dashboard for failed jobs'],
      },
    ],
    mistakes: [
      'Visibility timeout shorter than job duration - the classic cause of duplicate processing.',
      'Retrying permanent errors, so a bad input burns five attempts before it fails anyway.',
      'Fixed-delay retries with no jitter, so every failed task hits the recovering service at the same moment.',
      'A dead-letter queue with no alert - failures pile up silently.',
      'Passing whole objects as arguments, so the task runs on stale data.',
    ],
    related: ['background-workers', 'message-queues', 'retry', 'idempotency'],
    quiz: [
      {
        id: 'tq-1',
        prompt:
          'A thumbnail task normally takes 10 s but sometimes 90 s. The visibility timeout is 30 s. Which setting avoids a second worker starting the same task, without delaying the retry of a crashed task for hours?',
        options: [
          'Set the visibility timeout to 12 hours',
          'Keep 30 s - duplicates are harmless',
          'Set it above the slowest normal case, say 2 minutes, and let long tasks extend it while they work',
          'Turn acknowledgements off',
        ],
        answer: 2,
        explanation:
          'Shorter than the job means duplicate concurrent runs; far longer means a crashed task stays hidden for hours before anyone retries it. A timeout just above the normal worst case, extended by a heartbeat for the rare long run, avoids both.',
      },
      {
        id: 'tq-2',
        prompt: 'A task fails with a validation error: the email address in its input is malformed. The policy retries 5 times with backoff. What should happen instead?',
        options: [
          'Retry 10 times, in case the address fixes itself',
          'Fail it straight to the dead-letter queue with the error - it will fail the same way every time',
          'Retry immediately with no delay',
          'Drop the task silently',
        ],
        answer: 1,
        explanation:
          'Retries help with transient errors such as timeouts and 5xx answers. A permanent error returns the same result on every attempt, so retries only waste worker time and delay the report. Dead-lettering keeps the task and its error for a person; dropping it loses both.',
      },
      {
        id: 'tq-3',
        prompt: 'In the Lab, 30% of attempts fail and Max attempts is 3. About what share of tasks ends in the dead-letter queue?',
        options: ['30%', '9%', '2.7%', '0%'],
        answer: 2,
        explanation:
          'A task reaches the dead-letter queue only if all three attempts fail: 0.3 x 0.3 x 0.3 = 0.027, about 2.7%. 30% is the chance of one failed attempt, and 9% the chance that two fail. The Dead-lettered metric in the Lab settles near this share.',
      },
      {
        id: 'tq-4',
        prompt:
          'In the Lab, 40 new tasks/sec arrive, workers can do 60/sec, Max attempts is 3. You raise Failure rate from 30% to 60%. What happens?',
        options: [
          'Only the dead-letter queue grows',
          'Nothing - the workers still have spare capacity',
          'The workers speed up to handle the retries',
          'Retries push the load to about 78 attempts/sec, above the 60 the workers can do, so the queue grows as well',
        ],
        answer: 3,
        explanation:
          'Each task now costs 1 + 0.6 + 0.36 = 1.96 attempts on average, so 40 tasks/sec become about 78 attempts/sec. Retries are real load. With 60/sec of capacity the queue starts growing, not only the dead-letter queue.',
      },
      {
        id: 'tq-5',
        prompt:
          'An API your tasks call is down for 4 minutes. 2,000 tasks have failed and each retries every 5 s with a fixed delay. What reaches the API when it comes back?',
        options: [
          'About 400 extra calls per second, in synchronised waves that can knock it over again; use exponential backoff with jitter',
          'No extra load - retries only happen once the API is healthy',
          'About 5 extra calls per second',
          'The 2,000 calls once, then nothing',
        ],
        answer: 0,
        explanation:
          '2,000 tasks retrying every 5 s is 2,000 / 5 = 400 calls per second, all at the same offsets. Exponential backoff lowers the pressure over time and jitter spreads the waves. A retry policy does not know whether the API is healthy.',
      },
      {
        id: 'tq-6',
        prompt:
          'A task is enqueued with the whole order object. It runs 10 minutes later, after the customer changed the delivery address. What is wrong, and what is the fix?',
        options: [
          'Nothing - the task has all the data it needs',
          'Tasks should always run immediately',
          'Raise the message size limit',
          'The task works on stale data; pass the order id and load the current state when the task runs',
        ],
        answer: 3,
        explanation:
          'Arguments are serialised at enqueue time, so the object is a snapshot that goes stale while the task waits. Passing the id makes the task read the current order, and it keeps messages small. Running immediately cannot be guaranteed when there is a backlog.',
      },
      {
        id: 'tq-7',
        prompt: 'You need to send a reminder six months from now. Where should that reminder live?',
        options: [
          'A delayed task with run_at six months ahead',
          'A row in the database with a due date, picked up by a periodic job',
          'In the memory of a worker',
          'A worker that sleeps for six months',
        ],
        answer: 1,
        explanation:
          'A task hidden for six months is invisible to everyone, and its code may not exist by the time it runs - some brokers cap delays anyway (SQS allows at most 15 minutes). A row with a due date is visible, editable and survives deploys; a periodic job turns it into a task when it is due.',
      },
      {
        id: 'tq-8',
        prompt:
          'Password resets and weekly reports share one task queue with a priority field. Reports have not run for two days and nobody noticed. What does this show?',
        options: [
          'Priority fields are broken in this framework',
          'The reports should be made high priority too',
          'Separate queues with their own workers and alerts make starvation visible; one queue with priorities can starve low-priority work silently',
          'The queue needs a bigger maximum size',
        ],
        answer: 2,
        explanation:
          'With a priority field, a steady flow of high-priority work can keep low-priority work waiting forever, and one queue gives you one set of metrics that hides it. Separate queues get separate worker pools and a per-queue oldest-job alert. Raising every priority just rebuilds the same problem.',
      },
      {
        id: 'tq-9',
        prompt: 'The dead-letter queue has held 3,000 failed invoice tasks for a week and nothing alerts on it. What is the real problem?',
        options: [
          'The dead-letter queue is too small',
          'The retry count is too low',
          'Nothing - the tasks are safe in the dead-letter queue',
          'A dead-letter queue nobody watches is data loss with a delay; alert on its depth, fix the cause, then redrive the tasks',
        ],
        answer: 3,
        explanation:
          'The dead-letter queue exists so a person can look at failures. Without an alert, 3,000 customers have not been invoiced and nobody knows. More retries would not have fixed tasks that failed for a real reason.',
      },
      {
        id: 'tq-10',
        prompt: 'One task hangs forever on a network call with no timeout. Each worker runs one task at a time. What happens over time?',
        options: [
          'Nothing - the broker kills hung tasks',
          'Every hang occupies a worker for good; set a per-task timeout so the task fails and is retried or dead-lettered',
          'The visibility timeout frees the stuck worker',
          'The queue skips the task',
        ],
        answer: 1,
        explanation:
          'A worker blocked on a call with no timeout never returns. The visibility timeout only makes the message visible to another worker - which may hang the same way - and does not free the first. A per-task timeout turns the hang into a failure the retry policy can handle.',
      },
      {
        id: 'tq-11',
        prompt: 'In the Lab, Retry delay is 2 s and doubles per attempt. A task fails its first and its second attempt. When is its third attempt ready to run?',
        options: [
          '2 s after the second failure',
          '4 s after the second failure',
          'Immediately after the second failure',
          '8 s after the second failure',
        ],
        answer: 1,
        explanation:
          'The first failure waits 2 s, the second waits 2 x 2 = 4 s: exponential backoff. You can see the waiting tasks in the Delayed tasks node. Fixed or immediate retries would not give a struggling dependency more room each time.',
      },
    ],
  },
];
