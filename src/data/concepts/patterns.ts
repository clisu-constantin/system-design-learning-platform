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
    lab: 'replication',
    labFocus: 'leader-follower',
    keywords: ['primary', 'replica', 'leader', 'follower', 'ordering', 'failover', 'single leader'],
    what: 'A structural pattern where one node accepts all writes and orders them, and follower nodes replicate that ordered stream.',
    why: 'Ordering writes in one place removes write conflicts entirely, which is why it underpins most databases, brokers and coordination services.',
    how: [
      'Writes go to the leader, which assigns an order and streams it to followers.',
      'Followers replay the stream in that same order, so they all reach the same state.',
      'Followers serve reads (possibly stale) and stand ready for promotion.',
      'Leader failure triggers election; a quorum prevents two leaders.',
    ],
    when: [
      'Almost any replicated database, queue partition or coordination service - it is the default.',
      'Read-heavy workloads, where followers carry the reads.',
      'When write throughput fits one machine, or one machine per shard.',
    ],
    advantages: [
      'No write conflicts: one node decides the order.',
      'Followers add read capacity and are ready failover targets.',
      'Simple to reason about - every copy replays the same log.',
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
      {
        approach: 'Leaderless (quorum reads and writes)',
        gains: ['Any replica accepts writes, so no failover step', 'Tunable consistency per request'],
        costs: ['Concurrent writes still need a merge rule', 'Every read and write contacts several replicas'],
      },
    ],
    mistakes: [
      'Reading from a follower right after a write and showing the user stale data.',
      'Adding followers to fix a write bottleneck - every write still goes through the one leader.',
      'Electing a new leader without fencing the old one, so both accept writes (split brain).',
      'Treating writes that fail during the failover gap as fatal instead of retryable.',
    ],
    related: ['replication', 'read-replicas', 'leader-election', 'consensus', 'failover', 'sharding'],
    quiz: [
      {
        id: 'lf-1',
        prompt:
          'Two users update the same row at the same moment: one sets price = 10, the other price = 12. With a single leader, what do the followers end up with?',
        options: [
          'Some followers 10, some 12, forever',
          'A conflict that an operator must resolve',
          'The same value on every follower - the leader put the two writes in one order, and every follower replays that order',
          'Both values, as a list',
        ],
        answer: 2,
        explanation:
          'The leader decides which write comes second, and that one is the final value everywhere. Followers never have to agree among themselves - they copy. That is the whole appeal of the pattern: no write conflicts to resolve.',
      },
      {
        id: 'lf-2',
        prompt:
          'A single-leader database is saturated at 40,000 writes per second. It already has three followers serving reads. What raises write capacity?',
        options: [
          'Add three more followers',
          'Route writes to the followers',
          'Promote a follower to a second leader',
          'Cut unnecessary writes and batch the rest, then shard - one leader per shard',
        ],
        answer: 3,
        explanation:
          'Followers replay every write, so they add read capacity, not write capacity. Two leaders on the same data bring back write conflicts. Removing and batching writes buys time; sharding gives each leader only its slice, so write capacity grows with the shard count.',
      },
      {
        id: 'lf-3',
        prompt:
          'In the Lab you kill the primary (the leader). For about 3 seconds, "Writes refused" climbs, then a replica is promoted. What should the application do with writes that fail in that window?',
        options: [
          'Retry them with backoff, because the failover gap is expected and short',
          'Show a fatal error and discard the input',
          'Send them to a follower',
          'Keep them in memory forever',
        ],
        answer: 0,
        explanation:
          'Detecting the failure, electing a new leader and repointing clients always takes some seconds. Treating those errors as retryable (with backoff, and an idempotency key so a retry cannot apply twice) turns the gap into a short delay. Followers are read-only until one is promoted.',
      },
      {
        id: 'lf-4',
        prompt:
          'Followers have applied up to versions 990, 1000 and 998 when the leader dies. Which follower should be promoted, and why?',
        options: [
          'Any of them - they are identical',
          'The one at 1000, because it is missing the fewest writes',
          'The one at 990, because it is the most stable',
          'The one with the lowest load',
        ],
        answer: 1,
        explanation:
          'Followers are at different points in the log. Promoting the one at 1000 loses only writes after 1000; promoting the one at 990 would also throw away 991 to 1000. The Lab does the same: the log names the promoted replica and counts the acknowledged writes it never received.',
      },
      {
        id: 'lf-5',
        prompt:
          'The leader pauses for 20 seconds (a long garbage collection). The followers elect a new leader. Then the old leader wakes up and keeps accepting writes. What prevents this from corrupting data?',
        options: [
          'Synchronous replication',
          'A bigger heap',
          'Fencing: the new leader has a higher term or token, and storage and followers reject writes carrying the old one',
          'Reading from the leader only',
        ],
        answer: 2,
        explanation:
          'A leader that was slow, not dead, does not know it was replaced. A quorum election picks one new leader, and fencing makes the old one harmless: its writes carry a stale term and are refused. Without fencing both accept writes and the histories diverge (split brain).',
      },
      {
        id: 'lf-6',
        prompt:
          'A three-node cluster splits into one node and two nodes. The leader was the single node. What happens next?',
        options: [
          'The single node stays leader, and the two nodes elect a second leader too',
          'The two-node side can elect a new leader because it has a majority; the old leader cannot reach a majority, so it must stop accepting writes',
          'Nobody can be leader until the network heals',
          'The single node wins because it was leader first',
        ],
        answer: 1,
        explanation:
          'A majority of 3 is 2. Only one side can ever have a majority, so only one side can elect a leader or commit writes. The isolated old leader cannot get its writes acknowledged by a majority, which is how quorum-based election prevents two leaders.',
      },
      {
        id: 'lf-7',
        prompt:
          'The Lab opens with writes on the leader and reads spread over the followers. You drag Read rate from 120 to 500 reads per second. Where does the extra load land?',
        options: [
          'On the leader',
          'Nowhere - reads are free',
          'It is refused',
          'On the three followers, while the leader keeps serving only writes',
        ],
        answer: 3,
        explanation:
          'Followers are there to carry reads, so the Reads count grows on the follower nodes and the leader only takes writes. Switch Route reads to Primary and the same load lands on the leader instead - one machine doing everything.',
      },
      {
        id: 'lf-8',
        prompt:
          'Your users are in Europe and the US, and the single leader is in the US. European writes take 150 ms. Someone proposes a leader in each region. What do you take on?',
        options: [
          'Write conflicts: the same row can be changed in both regions at once, and you now need a rule to merge or pick',
          'Nothing - multi-leader is strictly faster',
          'Slower reads in both regions',
          'Loss of all followers',
        ],
        answer: 0,
        explanation:
          'Local writes in each region are the gain. The cost is exactly what single-leader avoided: two leaders can accept conflicting writes, so you need conflict resolution. It is worth it only when local write latency or writing through a partition is a real requirement.',
      },
      {
        id: 'lf-9',
        prompt:
          'A leaderless store has N = 3 replicas. Writes wait for W = 1 replica and reads ask R = 1 replica. A user writes and immediately reads. What can happen, and what setting fixes it?',
        options: [
          'Nothing can go wrong - every replica gets the write',
          'The read is always refused',
          'The read may hit a replica that has not got the write yet; choose W + R > N (for example W = 2, R = 2) so every read set overlaps every write set',
          'The write is lost; choose W = 0',
        ],
        answer: 2,
        explanation:
          'With W = 1 and R = 1 the replica read may not be the one written. When W + R is greater than N, at least one replica in any read has the latest write. Leaderless systems trade the single writer for this quorum arithmetic.',
      },
      {
        id: 'lf-10',
        prompt:
          'In the Lab with reads on the followers, "Own save not seen" is high. Users save, reload, and see their old data. What is the standard fix?',
        options: [
          'Make every follower a leader',
          'Route that user to the leader for a short window after their write (read-your-writes)',
          'Remove the followers',
          'Restart the followers',
        ],
        answer: 1,
        explanation:
          'Followers are behind the leader by the replication lag, and the reload lands inside it. Sending just the recent writer to the leader fixes it and keeps every other read on the followers. Turn on read-your-writes routing in the Lab and the crosses disappear.',
      },
    ],
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
