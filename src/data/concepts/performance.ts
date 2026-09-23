import type { Concept } from '@/types';

export const performanceConcepts: Concept[] = [
  {
    slug: 'caching',
    title: 'Caching',
    tagline: 'Keep the answer near the question - and decide what happens when it goes stale.',
    category: 'performance',
    difficulty: 'Beginner',
    lab: 'caching',
    keywords: ['hit rate', 'ttl', 'eviction', 'redis', 'stale'],
    what: 'A cache stores the result of an expensive operation in a fast store so that repeated requests can be served without redoing the work.',
    why: 'A cache hit from memory costs a few milliseconds; the database query behind it might cost a hundred. At high read volumes, caching is usually the single largest latency and cost improvement available.',
    how: [
      'On a read, look in the cache first (a hit returns immediately).',
      'On a miss, query the source, store the result, and return it.',
      'A TTL bounds staleness; eviction (usually LRU) bounds memory.',
      'Hit rate is the metric that matters: at 90% hits, the database sees one tenth of the traffic.',
    ],
    when: [
      'Read-heavy workloads where the same data is requested repeatedly.',
      'Expensive computations: aggregations, rendered pages, external API results.',
      'Data that tolerates being a few seconds or minutes old.',
    ],
    diagram: `User -> API -> Cache
                 |
                 +-- HIT  ----------> response      ~4 ms
                 |
                 +-- MISS
                       |
                       v
                    Database  --> store in cache --> response   ~120 ms`,
    advantages: [
      'Large latency reduction on the hot path.',
      'Protects the database from read spikes.',
      'Cheaper than scaling the datastore for the same read volume.',
    ],
    tradeoffs: [
      {
        approach: 'Caching with a TTL',
        gains: ['Simple', 'Bounded staleness', 'Big hit-rate win for hot keys'],
        costs: ['Users can see stale data for up to the TTL', 'Cache and source can disagree', 'One more system to operate'],
      },
      {
        approach: 'No cache',
        gains: ['Always fresh', 'Fewer moving parts and no invalidation bugs'],
        costs: ['Database carries every read', 'Latency bound by query cost'],
      },
    ],
    mistakes: [
      'Caching without a plan for invalidation, then debugging "impossible" stale data.',
      'Caching everything, including data read once - that is memory spent on evictions.',
      'Ignoring the thundering herd: when a hot key expires, thousands of requests miss at the same time and hit the database together.',
      'Making the cache a hard dependency, so a cache outage becomes a full outage.',
    ],
    realWorld: [
      'Hit rates above 90% are common for hot read paths; below 50% usually means the key design or TTL is wrong.',
      'Stampede protection (locking, request coalescing, jittered TTLs) matters as much as the cache itself.',
    ],
    related: ['cache-strategies', 'redis', 'cdn', 'application-caching'],
    quiz: [
      {
        id: 'cache-1',
        prompt: 'Hit rate is 90%, cache hits take 5 ms and misses 100 ms. What is the approximate average latency?',
        options: ['5 ms', '14.5 ms', '52 ms', '100 ms'],
        answer: 1,
        explanation:
          '0.9 x 5 + 0.1 x 100 = 14.5 ms. The 10% of misses dominate the average, which is why the last few points of hit rate matter so much.',
      },
      {
        id: 'cache-2',
        prompt: 'A popular key expires and 5,000 concurrent requests miss at once, overwhelming the database. What is this called and how is it mitigated?',
        options: [
          'Replication lag - add replicas',
          'Cache stampede - mitigate with locking/coalescing, jittered TTLs or background refresh',
          'Sharding skew - change the shard key',
          'Head-of-line blocking - switch to HTTP/3',
        ],
        answer: 1,
        explanation:
          'Only one request should recompute the value; the rest wait for it or serve a slightly stale copy while it refreshes.',
      },
    ],
  },
  {
    slug: 'cache-strategies',
    title: 'Cache Strategies',
    tagline: 'Who writes to the cache, and when.',
    category: 'performance',
    difficulty: 'Intermediate',
    lab: 'cache-strategies',
    keywords: ['cache aside', 'write through', 'write behind', 'write around', 'read through'],
    what: 'A set of patterns describing how reads and writes flow between the application, the cache and the database: cache-aside, read-through, write-through, write-behind and write-around.',
    why: 'They differ in freshness, write latency and what happens when a component fails. Picking one is a deliberate trade, not a detail.',
    how: [
      'Cache-aside: the application checks the cache, and on a miss loads from the database and stores the result.',
      'Read-through: the cache itself loads from the database on a miss - the application only talks to the cache.',
      'Write-through: writes go to the cache and the database synchronously, keeping them consistent.',
      'Write-behind: writes go to the cache and are flushed to the database asynchronously.',
      'Write-around: writes go straight to the database and the cache is only populated on read.',
    ],
    diagram: `CACHE ASIDE          WRITE THROUGH        WRITE BEHIND        WRITE AROUND
app -> cache (miss)  app -> cache         app -> cache        app -> database
app -> database         -> database          ~async~             (cache filled
app -> store in cache   (both updated)       -> database          on next read)`,
    tradeoffs: [
      {
        approach: 'Cache-aside',
        gains: ['Only requested data is cached', 'Cache outage degrades performance, not correctness'],
        costs: ['Every miss pays cache + database', 'Duplicate logic in every read path', 'Race conditions between load and write'],
      },
      {
        approach: 'Write-through',
        gains: ['Cache is never stale for written keys', 'Simple reasoning about freshness'],
        costs: ['Every write pays cache latency too', 'Caches data that may never be read'],
      },
      {
        approach: 'Write-behind',
        gains: ['Very fast writes', 'Absorbs write bursts and can batch them'],
        costs: ['Data loss if the cache dies before flushing', 'Database temporarily disagrees with the cache'],
      },
      {
        approach: 'Write-around',
        gains: ['Cache is not polluted by write-once data', 'Simple write path'],
        costs: ['First read after a write is always a miss'],
      },
    ],
    mistakes: [
      'Mixing strategies per code path without documenting it, so nobody knows the freshness guarantee.',
      'Using write-behind for data you cannot afford to lose.',
    ],
    related: ['caching', 'redis', 'denormalization'],
    quiz: [
      {
        id: 'cs-1',
        prompt: 'Which strategy risks losing data if the cache node crashes?',
        options: ['Cache-aside', 'Write-through', 'Write-behind', 'Write-around'],
        answer: 2,
        explanation:
          'Write-behind acknowledges the write once it is in the cache and flushes to the database later. Anything not yet flushed is lost.',
      },
    ],
  },
  {
    slug: 'redis',
    title: 'Redis',
    tagline: 'An in-memory data structure server used as cache, session store and more.',
    category: 'performance',
    difficulty: 'Beginner',
    keywords: ['in-memory', 'ttl', 'lru', 'pubsub', 'sorted set', 'lock'],
    what: 'Redis is a single-threaded, in-memory store with data structures (strings, hashes, lists, sets, sorted sets, streams), optional persistence, TTLs and replication.',
    why: 'Sub-millisecond operations plus useful data structures make it the default choice for caching, session storage, rate limiting, leaderboards, and simple queues.',
    how: [
      'Data lives in RAM; persistence (RDB snapshots, AOF log) is for recovery, not for capacity.',
      'Commands are executed one at a time, which makes single-key operations naturally atomic.',
      'maxmemory plus an eviction policy (allkeys-lru is common for caches) bounds memory.',
      'Replication and Sentinel/Cluster provide failover and sharding.',
    ],
    when: [
      'Caching database results and rendered fragments.',
      'Shared sessions across a stateless app tier.',
      'Counters, rate limiters, leaderboards, ephemeral locks.',
    ],
    diagram: `SET  session:abc  {json}  EX 1800     -> expires in 30 min
INCR rate:user:42                     -> atomic counter
ZADD leaderboard 4820 "ada"           -> sorted set
GET  product:42                       -> sub-millisecond read`,
    tradeoffs: [
      {
        approach: 'Redis as a cache',
        gains: ['Enormous latency win', 'Rich structures beyond key/value', 'Simple to operate at small scale'],
        costs: ['RAM is expensive - dataset must fit', 'Another component with its own failure modes', 'Persistence is weaker than a real database'],
      },
    ],
    mistakes: [
      'Using Redis as the system of record for data you cannot lose.',
      'Storing huge values or running O(n) commands (KEYS) on a single-threaded server.',
      'Relying on a naive SETNX lock for correctness-critical mutual exclusion.',
    ],
    related: ['caching', 'cache-strategies', 'distributed-locks', 'rate-limiting'],
  },
  {
    slug: 'cdn-caching',
    title: 'CDN Caching',
    tagline: 'Cache keys, TTLs and invalidation at the edge.',
    category: 'performance',
    difficulty: 'Intermediate',
    lab: 'cdn',
    keywords: ['edge', 'cache key', 'vary', 'purge', 'immutable'],
    what: 'The caching layer of a CDN: what the edge stores, how it builds a cache key, how long it keeps the object, and how you invalidate it.',
    why: 'A CDN only helps to the extent that it hits. Hit rate is decided by your cache keys and headers, not by the CDN vendor.',
    how: [
      'The cache key is typically host + path + selected query parameters + Vary headers.',
      'Cache-Control: public, max-age=31536000, immutable for content-hashed assets.',
      'Use stale-while-revalidate to serve the old copy while refreshing in the background.',
      'Invalidate by purge, or better, by changing the URL (cache busting).',
    ],
    diagram: `Cache key:  GET /static/app.a91f.js
Cache-Control: public, max-age=31536000, immutable
-> never revalidated; new deploy produces app.b72c.js`,
    tradeoffs: [
      {
        approach: 'Version-in-URL (immutable)',
        gains: ['Near-100% hit rate', 'No purges needed', 'Instant deploys'],
        costs: ['Build step must hash assets', 'HTML itself must stay short-lived'],
      },
      {
        approach: 'Short TTL + purge',
        gains: ['Works for content that cannot change URL'],
        costs: ['Lower hit rate', 'Purge propagation is not instant'],
      },
    ],
    mistakes: [
      'Including a tracking query parameter in the cache key, fragmenting the cache per user.',
      'Caching authenticated responses at a shared edge.',
    ],
    related: ['cdn', 'caching', 'http-https'],
  },
  {
    slug: 'database-caching',
    title: 'Database Caching',
    tagline: 'The layers of caching that exist before you add Redis.',
    category: 'performance',
    difficulty: 'Intermediate',
    lab: 'cache-layers',
    labFocus: 'database-caching',
    keywords: ['buffer pool', 'shared_buffers', 'materialized view', 'working set', 'hit ratio', 'prepared statement'],
    what: 'The caches a database runs itself: the buffer pool keeps hot pages in RAM, prepared statements let it reuse a query plan, and a materialized view stores a precomputed query result that you refresh.',
    why: 'Most "slow database" problems are really "the working set no longer fits in RAM" or "the query is missing an index". Knowing these layers stops you from adding an external cache, with all its staleness, to fix a problem the database can fix itself.',
    how: [
      'The buffer pool (InnoDB) or shared_buffers plus the OS page cache (PostgreSQL) keeps recently used pages in RAM. A page found there is a memory read; a miss is a disk read, one to two orders of magnitude slower.',
      'The buffer cache hit ratio is the share of page reads served from RAM. Above 99% is healthy for a transactional database; under 95% is worth a look.',
      'Prepared statements are parsed and planned once and then reused, which matters for short queries run thousands of times per second.',
      'A materialized view stores the result of an expensive query as a table. Reads become cheap and its few pages stay in the buffer pool, but it is stale between refreshes.',
    ],
    when: [
      'Before adding an application cache - check the buffer cache hit ratio, the working set size and the query plan first.',
      'When latency got worse with no code change - the data may have outgrown RAM.',
      'When an expensive aggregate is read far more often than it must change, and minutes-old numbers are acceptable - a materialized view.',
    ],
    diagram: `App -> query engine -> buffer pool (RAM) -> disk
       plan reused     hit: memory read     miss: page read
                       > 99% hit ratio is healthy

Materialized view: read 1 precomputed row
                   instead of summing thousands
                   (stale until the next REFRESH)`,
    advantages: [
      'The buffer pool is automatic, always consistent and needs no code.',
      'Fixing the working set or an index speeds up every query, not only the cached ones.',
      'A materialized view is one source of truth with a documented refresh, not a second copy in another system.',
    ],
    tradeoffs: [
      {
        approach: 'Size RAM to the working set (buffer pool)',
        gains: ['Automatic and never stale', 'Helps every query that touches hot pages', 'No code and no invalidation'],
        costs: ['RAM costs money and stops scaling at the largest machine', 'Cold after every restart', 'Removes disk time only, not the CPU cost of a bad query'],
      },
      {
        approach: 'Materialized view',
        gains: ['An expensive aggregate becomes a one-row read', 'Its small working set stays in RAM'],
        costs: ['Stale between refreshes', 'A PostgreSQL refresh recomputes every row, and without CONCURRENTLY it blocks readers'],
      },
      {
        approach: 'Prepared statements',
        gains: ['Parsing and planning are paid once, not on every call'],
        costs: ['In PostgreSQL they live per connection', 'A reused generic plan can be worse for unusual parameter values'],
      },
      {
        approach: 'External cache in front of the database',
        gains: ['The query is skipped entirely on a hit', 'You choose the key, the TTL and what object is stored'],
        costs: ['You own invalidation and stale reads', 'One more system to run, and cold misses still pay the full query'],
      },
    ],
    mistakes: [
      'Adding Redis in front of a database that is short on RAM or missing an index - the cold path stays just as slow.',
      'Giving the database all the RAM: PostgreSQL also relies on the OS page cache, and its docs start shared_buffers at 25% of memory.',
      'Running REFRESH MATERIALIZED VIEW without CONCURRENTLY on a view users read during the day - in PostgreSQL the refresh blocks them.',
      'Judging performance right after a restart, while the buffer pool is still cold.',
    ],
    realWorld: [
      'PostgreSQL suggests shared_buffers of 25% of RAM on a dedicated server and rarely more than 40%; InnoDB servers often give up to 80% of RAM to the buffer pool.',
      'MySQL removed its query cache in 8.0: any write invalidated every cached result for that table, and its lock did not scale on many cores.',
    ],
    related: ['caching', 'application-caching', 'database-indexing', 'denormalization'],
    quiz: [
      {
        id: 'db-cache-1',
        prompt:
          'A product API got three times slower over six months with no code change. The buffer cache hit ratio fell from 99.5% to 88% while the table grew from 20 GB to 90 GB on a 64 GB server. What is the first thing to do?',
        options: [
          'Put Redis in front of the API so the database sees fewer reads',
          'Make the working set fit in RAM again: more memory, archive old rows, or slimmer indexes',
          'Add two more app instances behind the load balancer',
          'Rewrite the service against a NoSQL database',
        ],
        answer: 1,
        explanation:
          'The hit ratio says it: the pages the queries need no longer fit in memory, so one read in eight goes to disk. Fixing that speeds up every query and adds no staleness. Redis is the tempting answer, but it only hides the problem for cached keys - every miss and every expiry still pays the disk reads - and it brings invalidation with it.',
      },
      {
        id: 'db-cache-2',
        prompt:
          'In the Cache Layers Lab the buffer pool holds 4,000 pages, the orders table is 20,000 pages, and the buffer pool hit ratio sits near 50%. You drag the buffer pool to 24,000 pages. What do you see?',
        options: [
          'Nothing changes: a buffer pool only speeds up writes',
          'The hit ratio jumps to 100% at once, because the whole table is loaded into RAM when the size changes',
          'The hit ratio climbs toward 100% as pages are read in, and average latency and database load fall',
          'Latency gets worse, because a bigger pool takes longer to search',
        ],
        answer: 2,
        explanation:
          'A page enters the buffer pool the first time it is read, so the ratio rises as the hot pages come in, and then stays high because nothing forces them out. Nothing is preloaded: a bigger pool only means pages are not evicted. Finding a page in the pool is a hash lookup, so its size does not slow reads down.',
      },
      {
        id: 'db-cache-3',
        prompt:
          'An admin dashboard sums 40 million order rows per tenant. With the right index it still takes 300 ms, it is loaded 50 times per second, and the product owner confirms that numbers up to 10 minutes old are fine. What fits best?',
        options: [
          'Turn on the MySQL query cache for that statement',
          'Give shared_buffers all of the RAM on the server',
          'Add a read replica and send the dashboard there',
          'A materialized view of daily totals per tenant, refreshed every 10 minutes',
        ],
        answer: 3,
        explanation:
          'The work is genuinely expensive - summing a million rows per load - and the product accepts 10 minutes of staleness, which is exactly what a refreshed materialized view offers: one cheap read of precomputed totals. A read replica is the tempting answer, but it runs the same 300 ms query and only moves the load. The query cache no longer exists in MySQL 8.0.',
      },
      {
        id: 'db-cache-4',
        prompt:
          'The database restarts at 09:00. For the next 20 minutes p95 latency is five times normal, then it recovers without anyone doing anything. What happened?',
        options: [
          'The buffer pool started empty, so pages came from disk until the working set was read back into RAM',
          'The query planner forgot the indexes and rebuilt them',
          'Replication lag built up on the replicas',
          'The materialized views were dropped and recreated',
        ],
        answer: 0,
        explanation:
          'After a restart the buffer pool is cold: every hot page must be read from disk once before it is served from memory again. Press Restart database in the Cache Layers Lab to watch the hit ratio drop and climb back. Indexes live on disk and survive a restart, so nothing has to be rebuilt.',
      },
      {
        id: 'db-cache-5',
        prompt:
          'A PostgreSQL job runs REFRESH MATERIALIZED VIEW sales_view every 5 minutes. During each refresh the dashboard that reads the view hangs for about 8 seconds. What fixes the hanging?',
        options: [
          'Refresh every minute instead, so each refresh has less to do',
          'Raise shared_buffers so the refresh finishes faster',
          'Add a unique index on the view and use REFRESH MATERIALIZED VIEW CONCURRENTLY',
          'Replace the view with the MySQL query cache',
        ],
        answer: 2,
        explanation:
          'A plain refresh locks the view while it rebuilds it, so readers wait. CONCURRENTLY builds the new result on the side and applies the differences, so reads continue; it requires a unique index on the view. Refreshing more often is tempting, but every refresh still recomputes all rows and still blocks, so you would hang more often.',
      },
      {
        id: 'db-cache-6',
        prompt:
          'In the Lab you turn the materialized view on with a 30 s refresh. The product page now reads fast, but the checkout team needs the units-sold number to be exact to the second. What do you do for checkout?',
        options: [
          'Refresh the view every second',
          'Read the live total for checkout - an indexed query, or a counter updated in the same transaction as the order',
          'Double the buffer pool',
          'Turn on the in-process cache with a 1 s TTL',
        ],
        answer: 1,
        explanation:
          'A materialized view is stale by design between refreshes; the Lab shows stale rows piling up until each refresh. When a reader needs the current value, read the source, or keep a counter that changes together with the order. A one-second refresh is tempting, but each refresh recomputes every total and is still up to a second old. An in-process cache adds staleness instead of removing it.',
      },
      {
        id: 'db-cache-7',
        prompt:
          'After upgrading from MySQL 5.7 to 8.0 the server refuses the query_cache_size setting. One hot read path relied on it. What is the sound plan?',
        options: [
          'Stay on 5.7 until the setting comes back',
          'Give the buffer pool 100% of RAM to make up for it',
          'Put a materialized view on every query the cache used to serve',
          'Fix the query and its index first, then cache the assembled result in the application if it is still needed',
        ],
        answer: 3,
        explanation:
          'MySQL removed the query cache in 8.0: any write to a table invalidated every cached result for that table, and its global lock did not scale on multi-core machines. It is not coming back. Make the query cheap first; if a cache is still worth it, the application can cache the whole assembled object with a key and TTL it controls. A view per query is heavy machinery for what is usually a missing index.',
      },
      {
        id: 'db-cache-8',
        prompt:
          'The hottest query reads 50,000 rows for every row it returns. The buffer cache hit ratio is 99.8%. The team wants to add Redis. What is the better first step?',
        options: [
          'Add the missing index so the query reads only the rows it returns',
          'Add Redis with a 5 minute TTL',
          'Double the buffer pool',
          'Create a materialized view of the whole table',
        ],
        answer: 0,
        explanation:
          'A 50,000:1 ratio of rows read to rows returned is a scan, not a cache problem. The pages are already in RAM (99.8%), so a bigger buffer pool buys nothing; the waste is the CPU spent reading rows that are thrown away. An index fixes every call, including cold ones, and adds no staleness. Redis would hide the scan until the next miss.',
      },
      {
        id: 'db-cache-9',
        prompt:
          'A service runs the same short lookup 20,000 times per second. Profiling shows that parsing and planning take longer than executing. Users must always see current data. What helps?',
        options: [
          'A materialized view of the lookup',
          'An in-process cache of the results with a 10 s TTL',
          'Prepared statements, so each connection plans the query once and reuses the plan',
          'A bigger buffer pool',
        ],
        answer: 2,
        explanation:
          'A prepared statement caches the plan, not the data, so results stay current while the planning cost disappears from every call. The result cache is tempting because it removes the query entirely, but it breaks the rule that users see current data. The buffer pool only helps page reads, which are not the cost here.',
      },
      {
        id: 'db-cache-10',
        prompt:
          'A new DBA sets shared_buffers to 60 GB on a dedicated 64 GB PostgreSQL server "so the whole database is cached". What is the problem?',
        options: [
          'None - more buffer pool is always faster',
          'PostgreSQL also relies on the OS page cache and needs memory for sorts and connections; its docs start at 25% of RAM and rarely go above 40%',
          'It turns off the OS page cache',
          'It makes materialized views refresh more slowly',
        ],
        answer: 1,
        explanation:
          'PostgreSQL reads through the OS page cache as well as its own buffers, and every connection needs working memory for sorts and hashes. Starving those makes things worse, which is why the documentation suggests 25% as a start and warns that more than 40% rarely helps. InnoDB, which manages its own I/O, is commonly given up to 80%.',
      },
      {
        id: 'db-cache-11',
        prompt:
          'In the Lab, with the buffer pool left at 4,000 pages, you turn the materialized view on. The buffer pool hit ratio goes to about 100%. Why, when the buffer pool did not grow?',
        options: [
          'The view is kept only in RAM, never on disk',
          'The view turns the disk off',
          'The query engine now caches whole results',
          'The view is 10 pages, so the working set shrank until it fits',
        ],
        answer: 3,
        explanation:
          'Each read now touches one row of a 10-page view instead of 20 pages of the orders table, so everything the reads need fits in the pool. A materialized view is stored on disk like a table - it stays in RAM only because it is small and hot. Shrinking the working set is as good as buying memory.',
      },
    ],
  },
  {
    slug: 'application-caching',
    title: 'Application Caching',
    tagline: 'In-process caches: the fastest and the most dangerous.',
    category: 'performance',
    difficulty: 'Intermediate',
    lab: 'cache-layers',
    labFocus: 'application-caching',
    keywords: ['local cache', 'in-process', 'memoization', 'coherence', 'lru', 'l1 l2'],
    what: 'Caching inside the application process - an in-memory LRU map, memoized function results, warmed configuration, or a map that lives for one request.',
    why: 'There is no network hop, so a hit costs nanoseconds instead of about a millisecond for Redis. The cost is that every instance has its own copy, and those copies drift apart for up to one TTL.',
    how: [
      'Bound the size (an LRU with a maximum number of entries) and set a short TTL - seconds, not minutes.',
      'Use it for data that is small, hot and tolerant of brief inconsistency: feature flags, configuration, reference data.',
      'Combine it with a shared cache: L1 local for nanoseconds, L2 Redis for one shared copy that can be invalidated precisely.',
      'A write changes only the copy of the instance that handled it; the other instances keep their old copy until it expires, unless they are sent an invalidation.',
    ],
    when: [
      'Data read thousands of times per second that changes rarely.',
      'Per-request deduplication: several layers asking for the same thing in one request.',
      'Not for data every user must see the same way on every request, and not for values that change many times per second.',
    ],
    diagram: `Instance A local cache: feature_flags v7
Instance B local cache: feature_flags v6   <- drift for up to one TTL

Two-tier: local (5 s TTL) -> Redis (5 min TTL) -> database`,
    advantages: [
      'The fastest cache there is: no network, no serialisation.',
      'Takes load off the shared cache and the database.',
      'Keeps serving the last known value when the shared cache is down.',
    ],
    tradeoffs: [
      {
        approach: 'Local in-process cache',
        gains: ['No network latency at all', 'Survives cache-server outages'],
        costs: ['Inconsistent between instances for up to one TTL', 'Memory per instance', 'Cold after every deploy'],
      },
      {
        approach: 'Two levels: local plus shared (L1 + L2)',
        gains: ['Hot keys in nanoseconds, the rest in about a millisecond', 'Only true misses reach the database'],
        costs: ['Two TTLs to reason about', 'Staleness is still bounded by the local TTL'],
      },
      {
        approach: 'Shared cache only (Redis)',
        gains: ['One copy that every instance sees', 'Precise invalidation', 'Stays warm across deploys'],
        costs: ['A network round trip on every read', 'One more system that can fail'],
      },
      {
        approach: 'Request-scoped cache',
        gains: ['No staleness between requests', 'No invalidation at all'],
        costs: ['Only removes repeats inside one request'],
      },
    ],
    mistakes: [
      'Caching per-user data locally behind a round-robin load balancer, so each request sees a different version.',
      'Unbounded maps that grow until the process runs out of memory.',
      'A per-user entry keyed without the user id - one user sees the data of another.',
      'Relying on pub/sub invalidation alone with no TTL - a lost message leaves a stale copy forever.',
    ],
    realWorld: [
      'The Redis docs advise a maximum TTL on every locally cached key, even with server-sent invalidation, to protect against lost messages and bugs.',
      'Redis Pub/Sub delivers at most once: a subscriber that is disconnected during a publish never gets that message.',
    ],
    related: ['caching', 'database-caching', 'stateless-applications', 'redis'],
    quiz: [
      {
        id: 'app-cache-1',
        prompt:
          'Feature flags are checked 20 times per request. At 2,000 requests per second across 20 instances that is 40,000 Redis reads per second. The flags change a few times a day and are 8 KB in total. What fits best?',
        options: [
          'A bigger Redis cluster',
          'Each instance keeps the whole flag set in memory and refreshes it every few seconds',
          'Read the flags from the database on every check',
          'A request-scoped cache only',
        ],
        answer: 1,
        explanation:
          'Small, hot, rarely changing and fine to be a few seconds old - the textbook in-process case. Redis traffic drops to a few reads per second and each check becomes a memory lookup. A request-scoped cache is tempting and safe, but it still costs one Redis read per request, 2,000 per second, for data that changes a few times a day.',
      },
      {
        id: 'app-cache-2',
        prompt:
          'In the Cache Layers Lab (TTL 30 s, 5 orders per second) the metric says the instances disagree on 6 of the 10 hot products. A user refreshing a product page sees 1,204 sold, then 1,198, then 1,204. Why?',
        options: [
          'The database rolled back a transaction',
          'The buffer pool evicted the page with the total',
          'The load balancer sends each refresh to another instance, and each holds a copy of a different age',
          'The clocks of the instances are out of sync',
        ],
        answer: 2,
        explanation:
          'Each instance filled its copy at a different moment, and a new order only clears the copy of the instance that took it. Round robin then walks the user across copies of different ages, so the number goes down and back up. The buffer pool cannot cause this: it is inside the database and always returns the current page.',
      },
      {
        id: 'app-cache-3',
        prompt: 'In the Lab you lower the local TTL from 30 s to 2 s. What happens?',
        options: [
          'Stale reads and disagreements drop, the local hit rate drops, and more queries reach the database',
          'Stale reads drop and nothing else changes',
          'The hit rate goes up, because entries are fresher',
          'Nothing, because the TTL only affects memory use',
        ],
        answer: 0,
        explanation:
          'The TTL is the longest a copy can be used, so it bounds both how stale a copy gets and how long the instances can disagree. The price is paid in hits: copies expire sooner, so more reads go to the database. Freshness and hit rate pull in opposite directions; the TTL is where you choose.',
      },
      {
        id: 'app-cache-4',
        prompt:
          'A process-wide LRU caches account settings under the key "settings:" plus the tenant id. The settings are per user. What goes wrong?',
        options: [
          'Only a small performance loss',
          'Entries expire too early',
          'The cache fills up faster',
          'The first user of a tenant to load settings fills the entry, and every other user of that tenant gets those settings - a data leak',
        ],
        answer: 3,
        explanation:
          'A process-wide cache is shared by every request that instance serves. When the key lacks the user id, the first user to load it decides what everybody in the tenant sees. That is a security incident, not a bug: put every field the value depends on into the key, and test it.',
      },
      {
        id: 'app-cache-5',
        prompt:
          'A service is killed for running out of memory at peak every few days. A heap dump shows a HashMap cache of product results with 40 million entries. What is the fix?',
        options: [
          'Bound the cache - a maximum number of entries with LRU eviction - and give entries a TTL',
          'Give the process more memory',
          'Restart the service every night',
          'Move the map to a file on disk',
        ],
        answer: 0,
        explanation:
          'An unbounded cache is a memory leak with a delay: it keeps every key it ever saw. A size limit with LRU eviction keeps the hot entries and drops the rest, and a TTL bounds staleness. More memory or nightly restarts only move the crash further away.',
      },
      {
        id: 'app-cache-6',
        prompt:
          'The team adds Redis pub/sub invalidation - every change publishes the key and each instance drops its local copy - and removes the TTL from local entries because "every change is broadcast". What is the risk?',
        options: [
          'Pub/sub makes every read slower',
          'Redis pub/sub delivers at most once: an instance that is reconnecting during a publish misses it and keeps its stale copy forever',
          'The instances will drop their copies too often',
          'There is no risk; broadcast invalidation is exact',
        ],
        answer: 1,
        explanation:
          'Redis Pub/Sub is fire and forget: a message a subscriber misses is gone. Without a TTL nothing ever corrects that copy. Keep the invalidation - it shortens the usual window - but keep a TTL as the safety net, as the Redis client-side caching docs advise.',
      },
      {
        id: 'app-cache-7',
        prompt:
          'Three layers of code each load the tenant settings, so every request runs the same query three times. The settings must never be stale between two requests. What do you use?',
        options: [
          'A process-wide cache with a 60 s TTL',
          'Redis with a 5 minute TTL',
          'A request-scoped cache: a map that lives for one request and is thrown away',
          'A materialized view of the settings',
        ],
        answer: 2,
        explanation:
          'A request-scoped map turns three queries into one and is discarded at the end of the request, so the next request reads fresh data - no staleness and no invalidation. The process-wide and Redis caches remove more queries, but they serve old settings for up to one TTL, which the requirement forbids.',
      },
      {
        id: 'app-cache-8',
        prompt:
          'After every deploy the database CPU spikes for about two minutes, then settles. The app uses an in-process cache. Why?',
        options: [
          'The deploy rebuilt the database indexes',
          'The load balancer sends all traffic to one instance during a deploy',
          'The database restarts during every deploy',
          'New instances start with empty local caches, so for a while almost every read is a miss that queries the database',
        ],
        answer: 3,
        explanation:
          'An in-process cache dies with its process. Every new instance starts cold and sends its misses to the database until its hot keys are loaded again - press Deploy the app in the Lab to see the local hit rate fall and the queries rise. A shared L2 cache in between, or a gradual rollout, softens the spike.',
      },
      {
        id: 'app-cache-9',
        prompt:
          'Reads go local cache (TTL 5 s), then Redis (TTL 5 minutes), then the database. A price changes; the code updates the database and deletes the Redis key. How long can users still see the old price?',
        options: ['Not at all', 'Up to 5 seconds, until the local copy on each instance expires', 'Up to 5 minutes', 'Until the next deploy'],
        answer: 1,
        explanation:
          'Deleting the Redis key fixes the shared copy at once, but each instance may still hold the old price in memory for up to its local TTL. That is why the local TTL is kept short. 5 minutes is the tempting answer, but the Redis entry was deleted, so its TTL no longer matters.',
      },
      {
        id: 'app-cache-10',
        prompt:
          'The units-sold counter of a product changes several times a second and is read 1,000 times a second. In the Lab most in-process hits on the hot products show up as stale reads. What does that tell you?',
        options: [
          'The TTL should be raised so the hit rate goes up',
          'The local cache is broken',
          'A value that changes many times per second goes stale almost as soon as it is cached, so a local cache fits only if an approximate number is acceptable',
          'The buffer pool is too small',
        ],
        answer: 2,
        explanation:
          'A cache pays off for data read often and changed rarely. A busy counter is changed so often that most copies are already old when they are served; the Redis docs use a constantly incremented counter as the example of what not to cache locally. Raising the TTL raises hits and staleness together.',
      },
      {
        id: 'app-cache-11',
        prompt:
          'A dashboard keeps the saved filters of each user in the memory of the instance that served them. Behind a round-robin load balancer, filters seem to reset at random. Which fix still works after deploys and autoscaling?',
        options: [
          'Store the filters in a shared store (Redis or the database) or on the client, not in one instance',
          'Turn on sticky sessions',
          'Raise the local TTL to one hour',
          'Run a single instance',
        ],
        answer: 0,
        explanation:
          'Per-user state held in one instance is only visible to requests that land there. A shared store or the client makes every instance see the same state, so any instance can serve any request. Sticky sessions are tempting, but they lose the state whenever that instance restarts or is scaled away.',
      },
    ],
  },
];
