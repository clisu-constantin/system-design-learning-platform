import type { Concept } from '@/types';

export const patternConcepts: Concept[] = [
  {
    slug: 'fan-out',
    title: 'Fan-out',
    tagline: 'Write once to many places, or read from many places once.',
    category: 'patterns',
    difficulty: 'Intermediate',
    lab: 'fan-out',
    keywords: ['feed', 'push', 'pull', 'celebrity problem', 'timeline', 'hybrid fan-out', 'write amplification', 'scatter-gather'],
    what: 'Fan-out is the pattern of distributing one event to many destinations - most visibly in social feeds, where a post must reach every follower.',
    why: 'It is the canonical read-vs-write trade. Fan-out on write precomputes every timeline (fast reads, expensive writes); fan-out on read assembles at query time (cheap writes, expensive reads).',
    how: [
      'Fan-out on write: when a user posts, store the post once and insert a reference into every follower timeline.',
      'Fan-out on read: when a user opens the app, query the posts of everyone they follow and merge them by time.',
      'Hybrid: push for ordinary accounts, and pull the posts of accounts with very many followers at read time.',
      'Cap each precomputed timeline to its newest entries and fall back to a query for older pages.',
    ],
    when: [
      'One event must reach many readers: a feed, an inbox, a notification list.',
      'Reads far outnumber writes and feed latency matters: fan-out on write.',
      'Writes dominate, or a few accounts have huge audiences: fan-out on read, or a hybrid.',
    ],
    advantages: [
      'Lets you choose which side pays - the writer once, or every reader every time.',
      'Fan-out on write turns a feed read into a single lookup of a list that is already built.',
      'Fan-out on read keeps each post in one place, so edits and deletes take effect at once.',
    ],
    diagram: `FAN-OUT ON WRITE             FAN-OUT ON READ
post -> 5,000 timelines      post -> 1 row
read = 1 lookup              read = merge 200 sources
celebrity, 50M followers     celebrity costs nothing extra
  = 50M writes per post        but every read is expensive

HYBRID: push under 10,000 followers, pull the rest`,
    tradeoffs: [
      {
        approach: 'Fan-out on write',
        gains: ['Very fast reads: one lookup per feed', 'Predictable read cost'],
        costs: [
          'Write amplification: one write per follower',
          'The celebrity problem: one post can queue millions of writes',
          'Feed delay grows with followers and with the queue ahead',
          'Storage duplication',
          'Deletes, edits and new follows must fan out too',
        ],
      },
      {
        approach: 'Fan-out on read',
        gains: ['Cheap writes: one row per post', 'No duplication', 'No celebrity problem', 'A new post is visible on the next read'],
        costs: ['Expensive reads: one query per followed account', 'Read cost varies by user, so p99 is hard to keep low'],
      },
      {
        approach: 'Hybrid (push under a follower threshold, pull above it)',
        gains: ['Most feed reads stay one lookup', 'No write storm from very large accounts', 'Write cost per post is bounded by the threshold'],
        costs: [
          'Two code paths to build, test and keep consistent',
          'Read cost grows with the number of large accounts a user follows',
          'A threshold to choose, and accounts that cross it',
        ],
      },
    ],
    mistakes: [
      'Choosing one strategy globally instead of hybridising by follower count.',
      'Pushing a celebrity post into millions of timelines through the same queue, so every ordinary post waits behind it.',
      'Forgetting that deletes, edits and new follows become fan-out operations under fan-out on write.',
      'Keeping every post in every timeline forever instead of capping timelines and querying older pages.',
      'In request fan-out, making every branch mandatory instead of giving each a timeout and returning partial results.',
    ],
    related: ['pub-sub', 'denormalization', 'caching', 'backpressure'],
    quiz: [
      {
        id: 'fo-1',
        prompt:
          'You are designing the home feed for a social app. The median account has 150 followers, nobody has more than 5,000, and feeds are opened about 100 times for every post written. Feed load time is the metric the product team watches. Which fan-out do you start with?',
        options: [
          'Fan-out on read, because it avoids storing duplicate references',
          'Fan-out on write: each post costs up to a few thousand timeline writes, and every one of the 100 reads becomes a single lookup',
          'A hybrid with a 10,000 follower threshold, because every feed system needs one',
          'No fan-out: keep one global list of posts and filter it per user',
        ],
        answer: 1,
        explanation:
          'Reads dominate 100 to 1 and no account is large, so paying once at write time (at most 5,000 writes) to make every read one lookup is the cheap side. Fan-out on read would merge about 150 sources on each of those 100 reads. A hybrid only earns its extra code path when very large accounts exist - here every account is under the threshold, so it would behave exactly like fan-out on write anyway.',
      },
      {
        id: 'fo-2',
        prompt:
          'In the Lab, on write, you drag the author to 50M followers. The author posts every 2 minutes, the workers finish 300,000 timeline writes a second, and the feed delay keeps growing. What is going on?',
        options: [
          'The timeline cache is full and is evicting entries',
          'Feed reads are competing with the workers for the same database',
          'Each post needs 50M writes, about 167 seconds of work, but a new post arrives every 120 seconds - the queue can never drain',
          'The follow graph is too slow to list 50M followers',
        ],
        answer: 2,
        explanation:
          'Work arrives faster than it can be done: 167 seconds of writes every 120 seconds, so the backlog grows by about 47 seconds per post, forever. That is the celebrity problem in its plainest form. The cache and the follow graph are not the bottleneck in this model - the fan-out-on-write cost is proportional to followers, and this account simply has too many.',
      },
      {
        id: 'fo-3',
        prompt:
          'Same celebrity, 50M followers. You switch the Lab to Hybrid with a 10,000 follower threshold. What happens to the cost of one post and of one feed read?',
        options: [
          'The post costs 0 timeline writes; a feed read becomes the prebuilt timeline plus one pull of this account, 2 queries',
          'The post still costs 50M writes, but they are spread over a longer time',
          'The post costs 10,000 writes, one per follower up to the threshold',
          'Nothing changes for this account, because hybrid only applies to new followers',
        ],
        answer: 0,
        explanation:
          'Above the threshold the post is stored once and not pushed at all; followers merge it in at read time. Each read pays one timeline lookup plus one query for the celebrity - 2 queries instead of 201 under pure fan-out on read with 200 accounts followed. Pushing to only the first 10,000 followers would leave the rest without the post, so no real hybrid does that.',
      },
      {
        id: 'fo-4',
        prompt:
          'Your feed uses fan-out on read. Most users have fast feeds, but a few power users who follow 2,000 accounts see feeds that take seconds and time out at p99. What is the cost driver?',
        options: [
          'The number of followers those power users have',
          'The number of accounts they follow: every feed read queries and merges all 2,000',
          'The size of the posts table as a whole',
          'The rate at which the power users post',
        ],
        answer: 1,
        explanation:
          'Under fan-out on read the read cost is proportional to how many accounts the reader follows, not how many follow them - try the "Accounts each reader follows" slider in the Lab with On read. Their own follower count only matters under fan-out on write. This per-user variance is exactly why fan-out on read struggles to keep p99 low.',
      },
      {
        id: 'fo-5',
        prompt:
          'Under fan-out on write, an account with 1 million followers deletes a post that went out an hour ago. A user reports still seeing it in their feed. What was missed?',
        options: [
          'The CDN cache of the post image was not purged',
          'The post row was soft-deleted instead of hard-deleted',
          'The delete must fan out too: the reference was written into 1 million timelines and each one has to be removed, reliably',
          'The client cached the old feed and needs a refresh',
        ],
        answer: 2,
        explanation:
          'Fan-out on write copies a reference into every follower timeline, so deleting the post means removing it from all 1 million of them - the same expensive fan-out again, and it must not silently skip any. A client refresh would just read the stale timeline again. Under fan-out on read there is only one copy, so a delete is immediate.',
      },
      {
        id: 'fo-6',
        prompt:
          'Your feed uses fan-out on write. A user follows a new account and opens their feed: none of the posts of that account appear, only posts written after the follow. Why, and what is the usual fix?',
        options: [
          'The follow graph is eventually consistent; wait a few seconds',
          'Timelines are only written at post time, so older posts were never pushed to this user; backfill the recent posts of the followed account into the timeline',
          'The timeline cap of 800 entries dropped them; raise the cap',
          'Fan-out on write cannot support new follows; switch to fan-out on read',
        ],
        answer: 1,
        explanation:
          'Pushing happens when a post is written, so a follow made later has nothing in the timeline for that account. A backfill job copies its recent posts in (or the read path merges them for recently followed accounts). The cap only drops the oldest entries of a full timeline, and waiting does nothing because no write is pending.',
      },
      {
        id: 'fo-7',
        prompt:
          'A product page fans out to 4 services in parallel: profile, orders, recommendations and notifications. Each is 99.9 percent available and the page waits for all 4. Recommendations sometimes take 900 ms while the others return in 40 ms. What do you change?',
        options: [
          'Call the 4 services one after another so they do not overload each other',
          'Add retries on every branch until all 4 succeed',
          'Give each branch its own timeout and render the page without recommendations when that branch is late or fails',
          'Nothing: 99.9 percent per service means the page is 99.9 percent available',
        ],
        answer: 2,
        explanation:
          'In request fan-out, page latency is the slowest branch (900 ms here) and, if every branch is mandatory, availability is the product: 0.999 to the power 4 is about 99.6 percent. Per-branch timeouts and partial results let the optional part fail without taking the page down. Sequential calls add latencies together, and unbounded retries make the slow branch slower.',
      },
      {
        id: 'fo-8',
        prompt:
          'On a hybrid feed with a 10,000 follower threshold, one reader follows 30 accounts that are each above the threshold. Their feed is noticeably slower than average. What explains it, and what keeps it cheap?',
        options: [
          'Each read is 1 timeline lookup plus 30 pulls; the pulled posts are the same for millions of readers, so caching them keeps each pull cheap',
          'The 30 accounts were pushed into the timeline 30 times, so the timeline is too long',
          'The hybrid falls back to pure fan-out on read for this user; lower the threshold to 1,000',
          'The follow graph cannot store more than 20 celebrity follows per user',
        ],
        answer: 0,
        explanation:
          'In a hybrid the read cost grows with the number of large accounts a reader follows - here 1 + 30 queries. Posts of large accounts are read by very many people, which makes them ideal to cache in memory. Lowering the threshold would push more accounts and move cost back onto writes; the reader is not switched to a different strategy.',
      },
      {
        id: 'fo-9',
        prompt:
          'Fan-out on write, 20 million users, and every post ever written is kept in every follower timeline in an in-memory cache. The cache cluster keeps running out of memory. What is the usual design?',
        options: [
          'Switch every user to fan-out on read',
          'Compress the post text inside each timeline entry',
          'Store the timelines on disk instead of in memory',
          'Keep only the newest entries per timeline (Twitter kept 800) and serve older pages with a query',
        ],
        answer: 3,
        explanation:
          'Almost all feed reads look at the newest posts, so a timeline only needs its newest few hundred entries in memory; older pages fall back to a query against the posts store. Timelines should hold references, not post text, so compressing text misses the point. Switching everyone to fan-out on read gives up the fast reads that justified the design.',
      },
      {
        id: 'fo-10',
        prompt:
          'A fleet of 50,000 sensors each writes a reading every second. Each reading has about 10 subscribed dashboards, and a dashboard is opened a few times a day. Which fan-out fits?',
        options: [
          'Fan-out on write: push every reading into all 10 dashboards so they load instantly',
          'Fan-out on read: store each reading once and assemble a dashboard when it is opened',
          'A hybrid with a 10,000 follower threshold',
          'Fan-out on write, with the dashboards cached at a CDN',
        ],
        answer: 1,
        explanation:
          'Writes dominate by far: 50,000 a second against a few dashboard loads a day. Fan-out on write would turn that into 500,000 writes a second to prepare views almost nobody reads. Fan-out on read pays only when a dashboard is actually opened. A hybrid threshold is about uneven audiences, and every sensor here has the same small one.',
      },
      {
        id: 'fo-11',
        prompt:
          'Your fan-out-on-write system has one shared queue for all posts. Right after a celebrity with 30 million followers posts, ordinary users complain their friends posts arrive minutes late. Why?',
        options: [
          'The ordinary posts are waiting in the same queue behind 30 million celebrity timeline writes',
          'The celebrity post uses more network bandwidth than the others',
          'The feed service is overloaded by celebrity followers opening the app',
          'Timelines are locked while the celebrity post is being written',
        ],
        answer: 0,
        explanation:
          'Fan-out workers drain the queue in order, so a 30 million write job delays every post queued behind it - at 300,000 writes a second that is 100 seconds of work before the next post starts. The celebrity makes everybody late, not only its own followers. Not pushing large accounts (a hybrid), or giving them their own queue, removes the head-of-line blocking.',
      },
      {
        id: 'fo-12',
        prompt:
          'A team measures that 99 percent of posts reach every follower within 5 seconds under fan-out on write, but they want new posts to be visible immediately. What does switching to fan-out on read buy and cost?',
        options: [
          'It buys nothing: fan-out on read also has to copy the post to followers first',
          'It buys immediate visibility on the next read, and costs a merge of every followed account on every read',
          'It buys faster reads and costs slower writes',
          'It removes the need for a follow graph',
        ],
        answer: 1,
        explanation:
          'With fan-out on read nothing is copied, so the next read after the post is stored already includes it - the Lab shows the feed delay as none. The price is that every read merges all followed accounts, which is the expensive, variable side. Faster reads and slower writes is the description of fan-out on write, the opposite direction; and fan-out on read still needs the follow graph to know which accounts to merge.',
      },
    ],
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
