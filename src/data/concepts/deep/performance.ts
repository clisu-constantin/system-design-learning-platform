import type { DepthMap } from './types';

export const performanceDepth: DepthMap = {
  caching: {
    analogy: {
      title: 'The notes you keep on your desk',
      body:
        'The company archive holds every document, but the five you use daily sit on your desk. Fetching one takes a second instead of a walk to the basement. Two risks come with the desk: it is small, so you must decide what to throw away, and a document may have been revised downstairs while your copy still says the old thing.',
    },
    deepDive: [
      {
        heading: 'A cache is a bet on repetition',
        paragraphs: [
          'Caching only pays when the same data is requested many times, and when producing it is expensive relative to storing it. The two numbers that decide everything are the hit rate and the cost difference: a 95 percent hit rate that turns a 50 ms query into a 1 ms lookup removes about 47 ms from the average request. A 20 percent hit rate on a 2 ms query is pure complexity for nothing.',
          'So before adding a cache, ask what fraction of requests ask for something already seen. Real access patterns are usually heavily skewed - a small share of items receives most of the traffic - which is exactly what makes caching so effective in practice.',
          'The corollary is that caching is a performance optimisation, never a correctness mechanism. If your system only works when the cache is warm, then a cache restart is an outage. Always measure what happens at a zero percent hit rate, because that is the state after every deploy of the cache tier.',
        ],
        code: {
          caption: 'Average latency is decided by the hit rate',
          body: `hit 1 ms, miss 50 ms

hit rate   average latency   load reaching the database
50%          25.5 ms          50%
80%          10.8 ms          20%
95%           3.5 ms           5%
99%           1.5 ms           1%

Going 95 -> 99 barely changes latency, but cuts DB load 5x.
That second column is usually the real reason to cache.`,
        },
      },
      {
        heading: 'Where caches live, from closest to furthest',
        paragraphs: [
          'The browser cache is free and nearest, controlled entirely by response headers. A CDN edge cache is next, serving many users from one copy near them. Then an application-level cache inside your process (fast, but each instance has its own copy), then a shared cache such as Redis (one copy for all instances, one network hop away), and finally the caches inside the database itself.',
          'Each layer answers earlier than the one below, so the highest-leverage caching is always the outermost layer that can correctly hold the data. Caching a public image at the CDN removes the request from your infrastructure entirely; caching it in Redis still costs you a round trip and an app server.',
          'In-process caches are tempting because they are the fastest of all, but with N instances you get N copies with independent expiry, so users see different values depending on where they land. Use them for data that is small, read constantly and tolerant of a few seconds of inconsistency: feature flags, configuration, reference tables.',
        ],
        bullets: [
          'Browser - free, controlled by Cache-Control; the cheapest hit possible.',
          'CDN - shared across users, removes traffic from your origin entirely.',
          'In-process - nanoseconds, but one copy per instance and no shared invalidation.',
          'Redis / Memcached - one shared copy, about 1 ms, survives app restarts.',
          'Database buffer cache - automatic, and the reason a warm database is fast.',
        ],
      },
      {
        heading: 'Eviction, TTL and the three classic disasters',
        paragraphs: [
          'A cache is finite, so something must be evicted. LRU (least recently used) is the sensible default and matches most access patterns. LFU favours items that are popular over a long period and resists a burst of one-off requests flushing everything useful out. TTL is the other half: even a cache with free space should expire entries, because a TTL is your guarantee that stale data eventually corrects itself.',
          'The first disaster is the thundering herd, also called a cache stampede: a popular key expires, a thousand concurrent requests all miss, and all thousand hit the database at once. The fix is either a lock so only one request recomputes while the others wait, or serving the stale value while one background refresh runs.',
          'The second is cache penetration - requests for keys that do not exist, which never populate the cache and always reach the database. Caching the negative result briefly, or keeping a bloom filter of known keys, closes it. The third is correlated expiry: everything loaded at the same time expires at the same time, producing a periodic load spike. Add random jitter to every TTL and it disappears.',
        ],
      },
    ],
    examples: [
      {
        title: 'Adding a cache and measuring what it actually bought',
        setup:
          'A product page issues a 45 ms query. Traffic is 2,000 requests per second across 40,000 products, and the top 2,000 products account for 80 percent of views.',
        walkthrough: [
          'Without a cache: 2,000 queries per second at 45 ms. The database is near saturation and p95 is 180 ms.',
          'Cache the top items in Redis with a 60-second TTL. The skew means a small cache covers most traffic: about 85 percent of requests hit.',
          'Average latency becomes 0.85 x 1 ms + 0.15 x 46 ms, roughly 7.8 ms. Database load drops from 2,000 to 300 queries per second.',
          'First incident: a popular product expires and 400 concurrent requests all recompute it. Fix with a per-key lock so one request refreshes and the rest wait 45 ms once.',
          'Second incident: a deploy flushes Redis, the hit rate goes to zero, and the database receives 2,000 queries per second - more than it can serve. Fix by warming the top 2,000 keys on startup and by never flushing the whole cache at once.',
          'Third detail: all keys were written in the same minute of a cold start, so they expire together. Add jitter of plus or minus 20 percent to each TTL.',
        ],
        result:
          'Latency fell by a factor of six and database load by a factor of seven - and the three follow-up problems are the normal cost of a cache. Plan for the stampede, the cold start and the synchronised expiry before they find you.',
      },
    ],
    jargon: [
      { term: 'Hit rate', plain: 'The share of requests answered from the cache. The number that decides whether caching helped.' },
      { term: 'TTL', plain: 'Time to live: how long an entry may be served before it must be refreshed.' },
      { term: 'Eviction policy', plain: 'Which entry is discarded when the cache is full. LRU is the usual default.' },
      { term: 'Thundering herd', plain: 'Many requests missing the same key at once and all recomputing it.' },
      { term: 'Cold cache', plain: 'The empty state after a restart, when every request is a miss. Size your database for it.' },
      { term: 'Jitter', plain: 'Randomising TTLs so entries do not all expire in the same second.' },
    ],
    remember: [
      'Caching is a bet on repetition - check the hit rate before and after.',
      'The outermost layer that can hold the data correctly gives the biggest win.',
      'Your database must survive a zero percent hit rate, because cold caches happen.',
      'Stampede, penetration and synchronised expiry are the three failures to design against.',
      'A cache is a performance tool, never a correctness mechanism.',
    ],
  },

  'cache-strategies': {
    analogy: {
      title: 'Who fetches the file, and who files it back',
      body:
        'When you need a document, either you walk to the archive yourself and keep a copy (cache-aside), or you ask an assistant who always does that for you (read-through). When you change it, you can update the archive and your copy together (write-through), hand it to the assistant to file later (write-behind), or just throw your copy away and let the next reader fetch it fresh (write-invalidate). Each choice moves work and risk somewhere different.',
    },
    deepDive: [
      {
        heading: 'The read patterns: cache-aside versus read-through',
        paragraphs: [
          'Cache-aside (also called lazy loading) puts the application in charge: look in the cache, and on a miss read the database and store the result. It is the most common pattern because it is explicit, works with any cache and any store, and only ever caches data somebody actually asked for. Its weaknesses are the boilerplate repeated at every call site and the stampede on a popular miss.',
          'Read-through hides that logic behind the cache client: the application just asks the cache, which fetches from the database on a miss. Call sites become one line, and the loader can deduplicate concurrent misses centrally, which kills the stampede problem in one place. The price is a library or service that must know how to load every kind of entity.',
          'Either way the failure behaviour matters more than the pattern. If the cache is unreachable, cache-aside naturally falls through to the database; a read-through implementation must be written to do the same rather than propagating the error, or a cache outage becomes a total outage.',
        ],
        code: {
          caption: 'Cache-aside, the version worth copying',
          body: `value = cache.get(key)
if value is None:
    with single_flight(key):          # only one loader per key
        value = cache.get(key)        # re-check: someone may have filled it
        if value is None:
            value = db.query(key)
            cache.set(key, value, ttl=60 + random(-12, 12))
return value

On cache errors: log and fall through to db. Never fail the request
because the cache is down.`,
        },
      },
      {
        heading: 'The write patterns, and what each one risks',
        paragraphs: [
          'Write-through updates the cache and the database together on every write. Reads after a write are always correct, and the cache is always warm for recently written data. It makes writes a little slower and fills the cache with entries nobody may ever read.',
          'Write-behind (write-back) writes to the cache and acknowledges immediately, flushing to the database asynchronously. It gives dramatic write throughput and absorbs bursts - and it is the only pattern that can lose acknowledged data, because a cache node crash takes the not-yet-flushed writes with it. Use it for metrics, counters and view tallies; never for money.',
          'Write-invalidate (write-around) is the quiet favourite: write to the database and simply delete the cache key. The next read repopulates it. It avoids caching write-heavy data that is rarely read, and it sidesteps the hardest bug in the write-through family - two concurrent writers filling the cache in the wrong order.',
        ],
        bullets: [
          'Write-through - correct reads, slower writes, cache full of unread entries.',
          'Write-behind - fastest writes, can lose data on crash, good for counters.',
          'Write-invalidate - simplest and safest default; the next read pays one miss.',
          'Whatever you choose, deleting a key is safer than updating it, because delete is idempotent and order-independent.',
        ],
      },
      {
        heading: 'Invalidation is the hard part, so reduce how much of it you do',
        paragraphs: [
          'Updating a cached value in place is racy: two writers can compute values in one order and write them in the other, leaving the cache permanently disagreeing with the database. Deleting the key instead means the next read reconstructs from the source of truth, and repeated deletes are harmless.',
          'Even so, the hardest cases are derived and aggregated entries. If a user changes their display name, which cached items contain it? A cached feed page, a cached comment thread, a rendered HTML fragment. Tracking those dependencies by hand is where caching bugs come from, which is why many teams prefer short TTLs and accept a few seconds of staleness over an exhaustive invalidation graph.',
          'Two techniques scale better than dependency tracking. Key versioning: include a version in the key (user:42:v7), bump the version on change, and old entries age out on their own. Or cache small, canonical objects rather than assembled pages, so invalidating one object is precise and assembly stays cheap.',
        ],
      },
    ],
    examples: [
      {
        title: 'Choosing a strategy per data type in one product',
        setup:
          'One e-commerce application, four kinds of data, four different correct answers.',
        walkthrough: [
          'Product details - read constantly, changed rarely. Cache-aside with a 10-minute TTL, plus explicit invalidation on the admin save. Staleness is visible but harmless for minutes.',
          'Stock level - read constantly, changed constantly, and being wrong sells something you do not have. Either do not cache, or cache for 5 seconds and always re-check atomically at checkout.',
          'Product page view count - written far more often than read and tolerant of loss. Write-behind in Redis, flushed to the database every 30 seconds. Losing 30 seconds of counts on a crash is acceptable.',
          'User session - read on every request, written on login. Redis as the primary store with persistence, not a cache at all - there is no database behind it to fall back on.',
          'Note the pattern: the question is always how bad stale is, and how bad lost is. Those two answers pick the strategy.',
        ],
        result:
          'Four data types in one application needed four different policies. "What is our caching strategy" is the wrong question; the right one is asked per piece of data.',
      },
    ],
    jargon: [
      { term: 'Cache-aside', plain: 'The application checks the cache, loads from the database on a miss, and stores the result.' },
      { term: 'Read-through', plain: 'The cache itself loads from the database on a miss; the application only talks to the cache.' },
      { term: 'Write-through', plain: 'Every write updates the cache and the database together.' },
      { term: 'Write-behind', plain: 'Write to the cache, flush to the database later. Fast, and can lose data.' },
      { term: 'Single flight', plain: 'Letting only one concurrent request recompute a missing key while the rest wait.' },
      { term: 'Key versioning', plain: 'Putting a version number in the key so a bump invalidates everything derived from it.' },
    ],
    remember: [
      'Cache-aside is the default; read-through centralises the loader and kills stampedes.',
      'Delete keys rather than updating them - delete is idempotent and order-independent.',
      'Write-behind is the only pattern that can lose acknowledged writes.',
      'Choose per data type by asking how bad stale is and how bad lost is.',
      'A cache outage must degrade to slow, never to broken.',
    ],
  },

  redis: {
    analogy: {
      title: 'A whiteboard next to the filing cabinet',
      body:
        'The cabinet is the permanent record; the whiteboard holds what the team needs right now, written where everyone can see it and erased freely. Writing and reading are instant because it is in the room, not in the basement. But it is a whiteboard: if the building loses power, whatever was only on the board may be gone.',
    },
    deepDive: [
      {
        heading: 'Single-threaded, in-memory, and why that is fast rather than slow',
        paragraphs: [
          'Redis keeps everything in RAM and executes commands on a single thread. That sounds like a bottleneck and is the opposite: there are no locks, no context switches and no coordination overhead, so each command takes microseconds and a single instance handles 100,000 or more operations per second on ordinary hardware.',
          'The single thread also gives you a free correctness property: every command is atomic with respect to the others. INCR cannot race, and a Lua script runs to completion without interleaving. That makes Redis an excellent coordination primitive - counters, locks, rate limiters - not just a cache.',
          'The consequence to respect is that one slow command blocks everything. KEYS * on a million-key database, a large SORT, or a 500 ms Lua script stalls every other client for that entire time. Use SCAN instead of KEYS, keep scripts short, and treat any command whose cost grows with collection size as dangerous in production.',
        ],
        code: {
          caption: 'Not a key-value store - a data structure server',
          body: `STRING   SET page:42 "<html>"        counters with INCR
HASH     HSET user:42 name "Ana"       partial updates, no re-serialise
LIST     LPUSH queue job1              simple queue, BRPOP blocks
SET      SADD online 42                membership, unions, intersections
ZSET     ZADD board 1500 "ana"         leaderboards, time-ordered ranges
STREAM   XADD events * k v             append log with consumer groups
BITMAP   SETBIT active:2026-09-18 42 1 daily actives in a few KB
HLL      PFADD uniques "ana"           count distinct in 12 KB, ~0.8% error`,
        },
      },
      {
        heading: 'Persistence: what survives a restart',
        paragraphs: [
          'RDB takes point-in-time snapshots. It is compact and fast to load, and you lose everything written since the last snapshot - typically minutes. AOF appends every write command to a log, replayed on startup; with fsync every second you lose at most a second, at some cost in throughput and a larger file. Many deployments run both.',
          'Even with AOF, Redis is not a database in the durability sense most applications need. Replication is asynchronous, so a failover can lose recent writes, and the whole dataset must fit in memory. Treating it as the source of truth for money or orders is a mistake that only shows up during an incident.',
          'The right framing: use Redis as a cache (losing it costs latency), as a coordination layer (locks, rate limits, where a reset is acceptable), or as the primary store for genuinely ephemeral data such as sessions - having decided explicitly what losing it would mean.',
        ],
        bullets: [
          'Cache - loss is fine, only latency suffers.',
          'Sessions - loss logs people out; usually acceptable with AOF and a replica.',
          'Rate limits and locks - loss resets a window or releases a lock; design for that.',
          'Orders, payments, anything auditable - no. Use a durable database.',
        ],
      },
      {
        heading: 'Memory management is the operational story',
        paragraphs: [
          'Redis is bounded by RAM, so maxmemory and an eviction policy are mandatory settings, not tuning. With allkeys-lru it evicts the least recently used key when full and behaves like a proper cache. With noeviction (the default) it starts rejecting writes when full, which for a cache is an outage and for a session store may be exactly what you want.',
          'Big keys are the other recurring problem. A single list with ten million elements makes every operation on it slow and blocks the one thread, and deleting it can stall the server for seconds - use UNLINK for asynchronous deletion. Keep collections bounded deliberately, by trimming or by splitting keys.',
          'For scale beyond one machine there are two paths. Replication plus Sentinel gives failover with read replicas but one writable node. Cluster mode shards keys across nodes by hash slot, which multiplies capacity but restricts multi-key operations to keys in the same slot - so you plan key naming with hash tags from the start.',
        ],
      },
    ],
    examples: [
      {
        title: 'Three features, three data structures',
        setup:
          'A product needs a live leaderboard, a per-user rate limit and a "who is online" indicator. All three land on Redis, each with a different structure.',
        walkthrough: [
          'Leaderboard: ZADD scores:weekly 1500 user:42 keeps a sorted set. Reading the top 10 is ZREVRANGE scores:weekly 0 9 in microseconds, and the rank of one user is ZREVRANK - a query that would be an expensive scan in SQL.',
          'Rate limit: INCR rate:42:1695031260 followed by EXPIRE 60 on first use. One counter per user per minute, atomic by construction, and the keys clean themselves up.',
          'Better rate limit: a small Lua script doing the check and increment in one atomic step, so the check-then-act race disappears even across many application instances.',
          'Online users: SADD online:2026-09-18 42 with SCARD for the count and SISMEMBER for a single check. For millions of users, a bitmap with SETBIT plus BITCOUNT uses a fraction of the memory.',
          'All three share one property: they would each be a heavy query and a race condition in the main database, and are one atomic command here.',
        ],
        result:
          'Redis earned its place not by being a faster cache but by offering data structures with atomic operations. Choosing the right structure is most of using it well.',
      },
    ],
    jargon: [
      { term: 'ZSET', plain: 'Sorted set: members with scores, kept in order. Leaderboards and time ranges.' },
      { term: 'TTL / EXPIRE', plain: 'A per-key lifetime after which Redis removes it automatically.' },
      { term: 'RDB / AOF', plain: 'Snapshot persistence and append-only command log. Different loss windows.' },
      { term: 'maxmemory policy', plain: 'What happens when memory is full: evict (cache) or reject writes (store).' },
      { term: 'Pipeline', plain: 'Sending many commands without waiting for each reply. Removes round trips.' },
      { term: 'Cluster / hash slot', plain: 'Sharding keys across nodes. Multi-key commands need keys in the same slot.' },
    ],
    remember: [
      'Single-threaded means atomic commands - and one slow command blocks everyone.',
      'It is a data structure server; picking the right structure is the skill.',
      'Persistence exists but is weaker than a database - decide what losing it costs.',
      'Set maxmemory and an eviction policy explicitly; the default rejects writes.',
      'Use SCAN not KEYS, and keep collections bounded.',
    ],
  },

  'cdn-caching': {
    analogy: {
      title: 'Vending machines versus the central kitchen',
      body:
        'The kitchen can cook anything, but it is far away. Vending machines on every corner hold the popular items and serve them instantly. Restocking rules decide how fresh the machines are, and the label on each item decides which machine slot it goes in. Get the labels wrong and every customer gets their own private slot, which defeats the entire point.',
    },
    deepDive: [
      {
        heading: 'The headers that actually control an edge cache',
        paragraphs: [
          'Cache-Control is the instruction the origin gives to every cache on the path. max-age is how long any cache may reuse it; s-maxage overrides that for shared caches like a CDN only, which is how you tell browsers to revalidate often while the edge holds a copy for an hour. public and private decide whether a shared cache may store it at all - private means browser only.',
          'no-cache does not mean do not cache; it means store it but revalidate before each use, which is usually what you want for HTML. no-store is the real prohibition, for anything genuinely secret. immutable tells the browser not even to revalidate, which is correct for hashed asset filenames.',
          'ETag and Last-Modified enable revalidation: the client sends the fingerprint back and the server can answer 304 Not Modified with no body. A 304 still costs a round trip, so it is much better than a full transfer and much worse than a cache hit - which is why long max-age on immutable assets beats frequent revalidation.',
        ],
        code: {
          caption: 'A policy per content type',
          body: `/static/app.4f2a1c.js
  Cache-Control: public, max-age=31536000, immutable

/index.html
  Cache-Control: public, no-cache          (revalidate, cheap 304)

/api/products (public list)
  Cache-Control: public, s-maxage=60, stale-while-revalidate=300

/api/me (per user)
  Cache-Control: private, no-store

Images that may change
  hash the URL, or use s-maxage plus an explicit purge on update`,
        },
      },
      {
        heading: 'The cache key decides your hit rate',
        paragraphs: [
          'An edge stores one object per cache key. By default the key is the URL, and everything you add to it multiplies the number of stored copies. Add the Cookie header and every visitor gets a private copy, so the hit rate collapses to near zero - the single most common CDN misconfiguration.',
          'Vary is the polite way to say "this response differs by that header". Vary: Accept-Encoding is fine and necessary (a handful of copies: brotli, gzip and uncompressed). Vary: User-Agent is close to catastrophic, because there are millions of distinct user agent strings and therefore millions of copies of the same page.',
          'Query strings deserve the same scrutiny. Marketing parameters like utm_source make every shared link a unique cache key even though the response is identical, so configure the CDN to ignore them. Conversely, a parameter that genuinely changes the response - ?page=2 - must be in the key or you will serve page 1 to everyone.',
        ],
        bullets: [
          'Strip cookies from the cache key for static paths, and do not set cookies on static responses.',
          'Ignore tracking query parameters; keep the ones that change the content.',
          'Vary only on Accept-Encoding, and on Accept-Language if you truly serve different languages.',
          'Serve assets from a cookie-free hostname so the mistake cannot happen.',
          'Measure hit rate per path - the average hides the one path ruining it.',
        ],
      },
      {
        heading: 'Invalidation, staleness and dynamic content',
        paragraphs: [
          'A purge is a message to hundreds of locations. The large vendors now complete one in seconds, but the locations never drop their copies at the same instant, and browsers keep the copies they already hold. Designs that require instant global invalidation are fragile; designs built on immutable URLs never need it. Where you must purge, prefer tag-based or surrogate-key purging so one product update clears exactly the objects containing it.',
          'stale-while-revalidate is the most underused directive on the list. It lets the edge serve a slightly stale copy immediately while refreshing in the background, so users never wait for a revalidation and the origin sees one request instead of a burst. stale-if-error does the same for outages: when the origin returns 5xx, the edge keeps serving the old copy and your incident becomes invisible to most users.',
          'Even genuinely dynamic responses benefit from short edge TTLs. A public product list cached for 10 seconds at the edge, under 5,000 requests per second, means each edge location asks the origin once every 10 seconds instead of passing on 50,000 requests - and users see data that is at most 10 seconds old, which almost always matches the product requirement.',
        ],
      },
    ],
    examples: [
      {
        title: 'Taking an origin from 5,000 to 5 requests per second',
        setup:
          'A news homepage receives 5,000 requests per second during a breaking story. The origin serves every one of them because the page is "dynamic".',
        walkthrough: [
          'The page is identical for all logged-out users and changes at most every few minutes. The only dynamic part is a small logged-in header.',
          'Step 1: split the response. The page becomes cacheable HTML; the user-specific header is fetched by a separate small API call marked private, no-store.',
          'Step 2: set Cache-Control: public, s-maxage=30, stale-while-revalidate=120 on the page.',
          'The edge now serves the same copy to everyone for 30 seconds. Origin traffic falls from 5,000 requests per second to roughly 1 per 30 seconds per edge location - with about 150 locations serving readers, about 5 requests per second in total.',
          'During revalidation, stale-while-revalidate means readers keep getting instant responses; only one background request per edge goes to the origin.',
          'When the story is updated, an explicit purge by surrogate key clears just that page, and the next request repopulates it within a second.',
        ],
        result:
          'Origin load dropped by roughly three orders of magnitude and page latency became edge-local, while content was never more than 30 seconds old. Splitting the personalised fragment out of the page is what made a "dynamic" page cacheable.',
      },
    ],
    jargon: [
      { term: 's-maxage', plain: 'max-age just for shared caches like a CDN. Lets you cache long at the edge, short in browsers.' },
      { term: 'no-cache vs no-store', plain: 'Revalidate before use, versus never store it at all.' },
      { term: 'Vary', plain: 'Declares which request headers change the response. Each one multiplies stored copies.' },
      { term: 'Surrogate key / cache tag', plain: 'A label on cached objects so you can purge a whole group precisely.' },
      { term: 'stale-while-revalidate', plain: 'Serve the old copy instantly and refresh in the background.' },
      { term: 'Origin shield', plain: 'A middle cache layer that absorbs misses from many edges so the origin sees one request.' },
    ],
    remember: [
      'The cache key is the whole game - cookies and tracking parameters destroy hit rates.',
      's-maxage lets the edge cache long while browsers revalidate often.',
      'Immutable hashed filenames make invalidation unnecessary instead of fast.',
      'stale-while-revalidate and stale-if-error turn refreshes and outages into non-events.',
      'Even a 10-second edge TTL on dynamic content can remove 99.9 percent of origin load.',
    ],
  },

  'database-caching': {
    analogy: {
      title: 'The pages of the ledger left open on the table',
      body:
        'A clerk who works with the same few pages keeps them open on the desk instead of fetching the volume from the shelf each time. The database does this for you automatically - it keeps recently used pages in memory. Most "slow database" problems are really "the pages needed are not on the table, so every question means a trip to the shelf".',
    },
    deepDive: [
      {
        heading: 'The cache you already have: the buffer pool',
        paragraphs: [
          'Every relational database keeps recently used data and index pages in a memory area - the buffer pool in MySQL, shared_buffers plus the OS page cache in Postgres. A read served from there is a memory access; a read that misses goes to disk and is one to two orders of magnitude slower. The buffer cache hit ratio is therefore one of the most informative metrics on a database.',
          'This is why a database that was fast yesterday is slow today after the dataset grew past memory: nothing in your code changed, but the working set no longer fits. It is also why the first queries after a restart are slow and the next thousand are fast: the buffer pool starts empty and has to be read back in from disk. Databases work hard to keep one big scan from pushing the hot pages out - PostgreSQL reads a large table through a small ring of buffers, and InnoDB puts newly read pages in the middle of its LRU list instead of the front.',
          'The practical lever is to keep the working set small enough to fit: narrower rows, partial and covering indexes, archiving old data, or partitioning so that the hot partition indexes stay resident. Adding RAM works too, and is often the cheapest fix available. How much to give the database is engine-specific: PostgreSQL also relies on the OS page cache, so its docs start shared_buffers at 25 percent of RAM and rarely go above 40 percent, while InnoDB servers often give up to 80 percent of RAM to the buffer pool.',
        ],
        code: {
          caption: 'Metrics that tell you where you stand',
          body: `buffer cache hit ratio   > 99% healthy, < 95% investigate
rows read / rows returned  1000:1 means a missing index, not a cache problem
temp files written        sorts spilling to disk - work_mem too small
query plan: Seq Scan on a big table under load   fix the index first

Order of attack:
  1 fix the query and its index      (100x)
  2 make the working set fit RAM     (10x)
  3 add an application cache         (10x, adds staleness)`,
        },
      },
      {
        heading: 'Query result caching, and why databases stopped doing it',
        paragraphs: [
          'MySQL once had a query cache that stored full result sets keyed by the SQL text. It was removed in 8.0 because invalidation was coarse - any write to a table invalidated every cached query touching it - and the internal lock around it made it a bottleneck on multi-core machines. The lesson generalises: result caching close to the data is hard to invalidate correctly.',
          'So result caching moved into the application layer, usually Redis, where you control the key, the TTL and the invalidation, and can cache the assembled object rather than a raw row set. Materialized views are the database-side survivor: an explicitly stored query result, which is honest about being stale rather than pretending to be live. In PostgreSQL you refresh one with REFRESH MATERIALIZED VIEW, on a schedule or on demand; it recomputes every row, and without CONCURRENTLY (which needs a unique index on the view) it blocks readers while it runs. Some databases can maintain a view incrementally on every write - Oracle fast refresh, SQL Server indexed views - which trades freshness for slower writes.',
          'Prepared statements are a different and quieter win. They let the database reuse a query plan instead of parsing and planning every time, which matters for short queries executed thousands of times per second - the planning can otherwise cost more than the execution.',
        ],
        bullets: [
          'Buffer pool - automatic, biggest effect, tune by making the working set fit.',
          'Materialized view - stored result of an expensive aggregate, refreshed deliberately.',
          'Prepared statement - reuses the plan; saves parsing on hot short queries.',
          'Application cache - full control over key and TTL, at the cost of owning invalidation.',
        ],
      },
      {
        heading: 'Fix the query before you cache it',
        paragraphs: [
          'Caching a bad query hides it. The cold path still exists, so the first request after an expiry pays the full cost, and every cache miss during a stampede hits the database with the same terrible plan. A 2-second query cached at 95 percent still means 5 percent of users wait 2 seconds, and a cache flush means everybody does.',
          'The order that works: read the plan, add or fix the index, reduce the rows touched, and only then decide whether a cache is still worth adding. Very often the indexed query is 1 ms and no cache is needed at all - which removes a whole class of staleness bugs you would otherwise have introduced.',
          'When you do cache, prefer caching assembled objects (the product page payload) over raw rows. The expensive part is usually not one query but the several queries plus serialisation, and a single cached object collapses all of it into one lookup.',
        ],
      },
    ],
    examples: [
      {
        title: 'The dashboard that got 200x faster twice',
        setup:
          'An admin dashboard runs an aggregate over 40 million rows on every load and takes 6 seconds. The team proposes caching it in Redis for 5 minutes.',
        walkthrough: [
          'Before caching, read the plan: a sequential scan over the whole table, filtering by tenant and date in memory.',
          'Add an index on (tenant_id, created_at). Runtime drops from 6 s to 300 ms - the query was never expensive, it was unindexed.',
          'Still 300 ms because it aggregates a million rows for a large tenant. This part is genuinely expensive and legitimately worth precomputing.',
          'Create a materialized view of daily totals per tenant, refreshed every 10 minutes. The dashboard query reads 90 rows instead of a million: about 4 ms.',
          'No Redis needed. The data is at most 10 minutes old, which the product owner confirms is fine for a dashboard, and there is one source of truth with a documented refresh.',
          'If the requirement had been real-time, the answer would have been an incrementally maintained counter table updated on write - not a cache.',
        ],
        result:
          'Two structural fixes beat the proposed cache and introduced no staleness bugs. Reach for the index and the precomputed aggregate before the cache; the cache is what you add when the query is already as cheap as it can be.',
      },
    ],
    jargon: [
      { term: 'Buffer pool / shared_buffers', plain: 'The database memory area holding recently used pages. Your biggest cache by far.' },
      { term: 'Working set', plain: 'The data actually being touched. If it fits in RAM, everything feels fast.' },
      { term: 'Cache hit ratio', plain: 'Share of page reads served from memory rather than disk. Under 95 percent deserves attention.' },
      { term: 'Materialized view', plain: 'A stored, refreshable result of an expensive query. It lives on disk like a table and is stale between refreshes.' },
      { term: 'Prepared statement', plain: 'A parsed and planned query reused with different parameters.' },
      { term: 'Plan cache', plain: 'Query plans kept for reuse. SQL Server and Oracle share one cache across sessions; PostgreSQL keeps plans only for prepared statements, per connection.' },
    ],
    remember: [
      'Your biggest database cache is the buffer pool, and it is already running.',
      'Slowness that appears with no code change usually means the working set outgrew RAM.',
      'Fix the query and the index before adding any cache - a cached bad query is still a bad query.',
      'Materialized views are honest, refreshable denormalisation with one source of truth.',
      'Cache assembled objects rather than raw rows; the serialisation is often the cost.',
    ],
  },

  'application-caching': {
    analogy: {
      title: 'The notes in your own head versus the shared noticeboard',
      body:
        'Remembering something yourself is instantaneous, but nobody else knows it and you forget it when you go home. Writing it on the shared noticeboard costs a walk down the corridor, and everyone sees the same thing. In-process memory is your head; Redis is the noticeboard. Which one is right depends entirely on whether everyone must agree.',
    },
    deepDive: [
      {
        heading: 'In-process caches are the fastest and the trickiest',
        paragraphs: [
          'A value in a local dictionary or an LRU map costs nanoseconds - no serialisation, no network, no other process involved. For data read thousands of times per second, that is unbeatable, and it removes load from the shared cache as well.',
          'The catch is that with N instances you have N independent caches. They fill at different times, expire at different times, and can hold different values simultaneously. A user refreshing a page can see a flag on, then off, then on again, depending on which instance answered. That is acceptable for some data and unacceptable for others, and the distinction has to be made deliberately. A write does not fix it either: the instance that handled the write can drop its own copy, but the other instances are not told and keep theirs until it expires.',
          'Memory is the second catch. An unbounded in-process cache is a slow memory leak that ends in an out-of-memory kill, usually at peak traffic. Always bound the size, always set a TTL, and remember that the cache competes with your application for the same heap.',
        ],
        bullets: [
          'Good in-process: feature flags, configuration, currency tables, compiled templates, small reference data.',
          'Bad in-process: anything users must see consistently across instances, anything large, anything invalidated precisely.',
          'Always bounded (max entries or bytes) and always with a TTL.',
          'Expect N copies to disagree for up to one TTL - decide if that is fine before using it.',
        ],
      },
      {
        heading: 'Two levels are usually the right answer',
        paragraphs: [
          'The common production shape is L1 in-process plus L2 shared. A read checks local memory, then Redis, then the database, populating on the way back. Very hot keys are served in nanoseconds, moderately hot keys cost one millisecond, and only genuine misses reach the database.',
          'Keep the local TTL short - seconds, not minutes - so the window of disagreement between instances is bounded and small. The shared TTL can be much longer, because there is only one copy and it can be invalidated precisely.',
          'For the cases where a few seconds of divergence is not acceptable, a pub/sub invalidation channel closes the gap: when a value changes, publish the key and every instance drops its local entry. It is not instant and it is not guaranteed - Redis Pub/Sub delivers each message at most once, so an instance that is reconnecting simply misses it - so treat it as an optimisation on top of the TTL, never as a replacement for it. Redis 6 and later can send these invalidations itself (client-side caching with tracking), and its docs still advise a maximum TTL on every local key.',
        ],
        code: {
          caption: 'Two-level read, with the numbers that justify it',
          body: `value = local.get(key)          # ~100 ns, may be 3 s stale
if miss:
    value = redis.get(key)      # ~1 ms, shared, precise
    if miss:
        value = db.query(key)   # ~20 ms
        redis.set(key, value, ttl=300)
    local.set(key, value, ttl=3)
return value

Invalidation: write -> redis.delete(key) -> publish("invalidate", key)
              each instance drops its local copy on receipt`,
        },
      },
      {
        heading: 'Memoisation, request-scoped caches and other cheap wins',
        paragraphs: [
          'The smallest and safest cache lives for the duration of a single request. If three layers of code each ask for the current user or the tenant settings, a request-scoped map turns three queries into one, with zero staleness risk because it is discarded when the request ends. This is often the highest value-to-risk caching available and it is routinely overlooked.',
          'Memoising pure computations is similarly safe: a parsed regular expression, a compiled template, a formatted price table. There is no invalidation problem because the input fully determines the output.',
          'The dangerous pattern is caching anything user-specific in a process-wide structure. Getting the key wrong by a single field means one user sees the data of another, which is a security incident rather than a bug. If an entry is per-user, the user id must be in the key, and it is worth writing a test that asserts exactly that.',
        ],
      },
    ],
    examples: [
      {
        title: 'Feature flags: from 40,000 Redis calls per second to 4',
        setup:
          'Feature flags are checked about 20 times per request. At 2,000 requests per second across 20 instances, that is 40,000 Redis GETs per second just for flags.',
        walkthrough: [
          'Flags change a few times per day and the whole set is about 8 KB - tiny, read constantly, tolerant of seconds of staleness. Ideal in-process data.',
          'Each instance loads the full flag set into memory and refreshes it every 5 seconds in the background. Redis traffic becomes 20 instances / 5 seconds, about 4 requests per second.',
          'A flag check is now a dictionary lookup, roughly 100 ns instead of a 1 ms network call, removing about 20 ms of latency per request.',
          'Divergence window: for up to 5 seconds, some instances have the old flags. For a gradual rollout that is fine; the team documents it explicitly.',
          'For emergency kill switches, 5 seconds is still fine but a pub/sub message triggers an immediate refresh, so a disable typically propagates in under 100 ms.',
          'Safety: the background refresh keeps the last known good values if Redis is unreachable, so a cache outage cannot turn every flag off at once.',
        ],
        result:
          'Latency and Redis load both improved by orders of magnitude, and the only cost is a documented five-second consistency window. The decision hinged on one question: can two users briefly see different flags? For this data, yes.',
      },
    ],
    jargon: [
      { term: 'In-process cache', plain: 'A cache inside the application memory. Fastest possible, one copy per instance.' },
      { term: 'L1 / L2 cache', plain: 'Local memory first, shared cache second. The common two-level layout.' },
      { term: 'Memoisation', plain: 'Remembering the result of a pure function for the same inputs.' },
      { term: 'Request-scoped cache', plain: 'A map that lives for one request. Zero staleness risk.' },
      { term: 'Cache coherence', plain: 'Whether independent copies agree. With in-process caches, they do not, for up to one TTL.' },
      { term: 'Pub/sub invalidation', plain: 'Broadcasting a key change so every instance drops its local copy.' },
    ],
    remember: [
      'In-process caching is nanoseconds - and gives every instance its own version of the truth.',
      'Bound the size and set a TTL, or it becomes a memory leak.',
      'L1 local plus L2 shared, with a short local TTL, covers most needs.',
      'Request-scoped caching is the safest win available; use it before anything global.',
      'Any per-user entry must have the user id in the key - test that explicitly.',
    ],
  },
};
