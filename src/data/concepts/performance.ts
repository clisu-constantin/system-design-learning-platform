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
    keywords: ['buffer pool', 'query cache', 'materialized view', 'working set'],
    what: 'Databases cache aggressively themselves: the buffer pool keeps hot pages in memory, plans are reused, and materialised views store precomputed results.',
    why: 'Understanding these layers prevents you from adding an external cache to solve a problem that is really "the working set no longer fits in RAM".',
    how: [
      'Buffer pool / shared_buffers keeps recently used pages in memory - a well-sized instance serves most reads without touching disk.',
      'Prepared statements avoid re-planning identical queries.',
      'Materialised views precompute expensive aggregates and are refreshed on a schedule.',
    ],
    when: ['Before adding an application cache - check cache hit ratio and working set size first.'],
    diagram: `Query -> plan cache -> buffer pool (RAM) -> disk
                        ~99% hit ratio is healthy
                        low ratio = undersized memory or bad indexes`,
    tradeoffs: [
      {
        approach: 'Materialised views',
        gains: ['Expensive aggregates become instant reads'],
        costs: ['Stale between refreshes', 'Refresh cost and locking must be scheduled'],
      },
    ],
    mistakes: ['Adding Redis in front of a database that is simply short on RAM or missing an index.'],
    related: ['caching', 'database-indexing', 'denormalization'],
  },
  {
    slug: 'application-caching',
    title: 'Application Caching',
    tagline: 'In-process caches: the fastest and the most dangerous.',
    category: 'performance',
    difficulty: 'Intermediate',
    keywords: ['local cache', 'memoization', 'coherence', 'lru'],
    what: 'Caching inside the application process - memoised function results, in-memory LRU maps, warmed configuration.',
    why: 'There is no network hop, so it is the fastest cache available. The cost is that every instance has its own copy, and those copies drift.',
    how: [
      'Bound the size with an LRU and set a short TTL.',
      'Use it for data that is small, hot and tolerant of brief inconsistency (feature flags, configuration, reference data).',
      'Combine with a shared cache: local for microseconds, Redis for coherence.',
    ],
    diagram: `Instance A local cache: feature_flags v7
Instance B local cache: feature_flags v6   <- drift for up to one TTL

Two-tier: local (10s TTL) -> Redis (5 min TTL) -> database`,
    tradeoffs: [
      {
        approach: 'Local in-process cache',
        gains: ['No network latency at all', 'Survives cache-server outages'],
        costs: ['Inconsistent between instances', 'Memory per instance', 'Cold after every deploy'],
      },
    ],
    mistakes: [
      'Caching per-user data locally behind a round-robin load balancer, producing inconsistent behaviour per request.',
      'Unbounded maps that grow until the process runs out of memory.',
    ],
    related: ['caching', 'stateless-applications', 'redis'],
  },
];
