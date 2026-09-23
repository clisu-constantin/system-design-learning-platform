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
