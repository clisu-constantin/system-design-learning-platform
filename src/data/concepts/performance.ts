import type { Concept } from '@/types';

export const performanceConcepts: Concept[] = [
  {
    slug: 'caching',
    title: 'Caching',
    tagline: 'Keep the answer near the question - and decide what happens when it goes stale.',
    category: 'performance',
    difficulty: 'Beginner',
    lab: 'caching',
    labFocus: 'caching',
    keywords: ['hit rate', 'ttl', 'eviction', 'redis', 'stale'],
    what: 'A cache stores the result of an expensive operation in a fast store so that repeated requests can be served without redoing the work.',
    why: 'A cache hit from memory costs about a millisecond; the database query behind it might cost fifty. At high read volumes, caching is usually the single largest latency and cost improvement available - and it takes read load off the database.',
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
      'Skewed access, where a small hot set of keys gets most of the traffic and fits in memory.',
    ],
    diagram: `User -> API -> Cache
                 |
                 +-- HIT  ----------> response      ~1 ms
                 |
                 +-- MISS
                       |
                       v
                    Database  --> store in cache --> response   ~50 ms`,
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
        approach: 'A bigger cache (more memory)',
        gains: ['Holds more of the hot set, so the hit rate rises', 'Fewer evictions of keys that are still wanted'],
        costs: ['RAM costs money', 'Diminishing returns once the hot set fits - the long tail of rare keys barely hits'],
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
        prompt: 'Your cache has a 90% hit rate. Hits take 5 ms and misses take 100 ms. A teammate says the average request takes about 5 ms now. What is the average really?',
        options: [
          '5 ms',
          '14.5 ms',
          '52.5 ms',
          '100 ms',
        ],
        answer: 1,
        explanation:
          '0.9 x 5 + 0.1 x 100 = 14.5 ms. The 10% of misses add 10 ms and dominate the average, which is why the last few points of hit rate matter so much. 5 ms is the tempting answer, but it is the hit latency, not the average.',
      },
      {
        id: 'cache-2',
        prompt: 'A popular key expires and 5,000 concurrent requests miss at once. All 5,000 run the same query and the database falls over. What is this, and what fixes it?',
        options: [
          'Replication lag - add read replicas so the 5,000 queries are spread across more copies',
          'Cache penetration - cache a negative result so missing keys stop reaching the database',
          'A cache stampede - let one request reload the key while the others wait',
          'Too small a cache - the key was pushed out early, so double the memory limit',
        ],
        answer: 2,
        explanation:
          'This is the thundering herd, also called a cache stampede: one hot key expiring turns into thousands of identical queries. Only one request should recompute the value (a per-key lock or request coalescing), or the old value is served while one refresh runs. More memory does not help: the key was not evicted, it expired. Penetration is about keys that do not exist at all.',
      },
      {
        id: 'cache-3',
        prompt: 'In the Caching Lab, traffic is 1,000 req/sec, the hit rate is about 60% and the database runs about 400 queries/sec against a capacity of 900. You switch "Cache enabled" off. What do you see?',
        options: [
          'Database queries jump to about 1,000/sec, past its capacity, and latency climbs steeply',
          'Nothing much: 1,000 is only about 10% above the 900 capacity, so the database absorbs it',
          'Latency falls, because every request skips the 1 ms cache lookup and goes straight to the database',
          'Only the hit rate changes; database load is set by the Traffic slider alone',
        ],
        answer: 0,
        explanation:
          'Every request becomes a query, so the database goes from about 400 to 1,000 queries/sec - above its 900 capacity. Past the knee of the queueing curve latency does not grow gently, it climbs steeply. Skipping the 1 ms cache lookup is real but tiny next to that.',
      },
      {
        id: 'cache-4',
        prompt: 'Hits take 1 ms and misses 50 ms. Your hit rate goes from 95% to 99%. What changes the most?',
        options: [
          'Average latency drops by about 40 ms, because four in every hundred requests stop paying the 50 ms miss',
          'Nothing measurable - at 95% the hits already dominate, so four more points is noise',
          'The cache needs five times more memory to hold enough keys for the extra hits',
          'Database load falls five times, from 5% to 1% of requests; average latency drops only about 2 ms',
        ],
        answer: 3,
        explanation:
          'Average latency goes from about 3.5 ms to 1.5 ms - a small change. But the misses are what reach the database, and they fall from 5 in 100 requests to 1 in 100: a fivefold cut in database load. That second number is often the real reason to chase the last few points of hit rate.',
      },
      {
        id: 'cache-5',
        prompt: 'In the Caching Lab the memory limit is 100 keys and Distinct keys is 500. You drag Distinct keys to 5,000 and leave everything else alone. What happens to the hit rate, and why?',
        options: [
          'It rises, because more distinct keys means more data worth caching and more chances to hit',
          'It falls: the same 100 slots now cover a much smaller share of the keys asked for',
          'It stays the same, because the TTL has not changed and the TTL decides how long keys stay',
          'It drops to 0%, because the cache cannot hold 5,000 keys and evicts each one before reuse',
        ],
        answer: 1,
        explanation:
          'A cache only helps when the hot subset fits. With 5,000 distinct keys the 100 hottest cover much less of the traffic, so more requests miss and LRU keeps evicting keys that will be needed again. It does not fall to zero: the very hottest keys still stay cached because skewed traffic keeps touching them.',
      },
      {
        id: 'cache-6',
        prompt: 'An API serves 10,000 different report IDs, and each ID is requested about equally often. The team adds a cache with room for 1,000 entries and a 60 s TTL. What hit rate should they expect?',
        options: [
          'Around 90%, the typical hit rate for a cache on a busy read path',
          'Close to 100% once it warms up, since the 60 s TTL keeps entries around',
          'At most about 10%, because only a tenth of equally popular keys fit',
          'It depends only on the TTL: a longer TTL keeps more of the 10,000 IDs',
        ],
        answer: 2,
        explanation:
          'With uniform access the hit rate can be no better than the share of keys that fit: 1,000 of 10,000, about 10%. Caches work so well in practice because real traffic is skewed - drag Access skew to uniform in the Lab and watch the hit rate fall. 90% is a typical number for skewed hot paths, not a law.',
      },
      {
        id: 'cache-7',
        prompt: 'A deploy restarts the cache tier and empties it. Normally 85% of 2,000 req/sec hit, so the database sees 300 queries/sec. What happens in the first minute after the restart, and what should the team have planned?',
        options: [
          'Nothing: the first few requests refill the cache almost instantly',
          'The database briefly sees all 2,000 queries/sec; warm the hot keys first',
          'Requests fail with errors until the cache is full again, since every lookup misses',
          'The database still sees 300 queries/sec, because the 85% hit rate is a property of the traffic',
        ],
        answer: 1,
        explanation:
          'An empty cache is a 0% hit rate, so every request goes to the database until the hot keys are loaded again - press Flush cache in the Lab to watch it. Requests do not fail with cache-aside, they just get slow, and the database may tip over. Warming the top keys, or restarting cache nodes one at a time, avoids the cold start.',
      },
      {
        id: 'cache-8',
        prompt: 'An admin changes a price in the database. Product pages are cached with a 10-minute TTL, and customers keep seeing the old price for several minutes. What is the cleanest fix?',
        options: [
          'Delete the cached key when the price is written',
          'Flush the whole cache on every write',
          'Turn off the cache for product pages',
          'Raise the TTL on product pages',
        ],
        answer: 0,
        explanation:
          'The TTL only bounds staleness to 10 minutes; it does not remove it. Deleting the key on write means the very next read misses and loads the fresh row. Flushing everything makes every write a cold start for the whole site, and turning the cache off gives up the benefit to fix one key. A longer TTL makes the problem worse.',
      },
      {
        id: 'cache-9',
        prompt: 'After every cold start the database gets a sharp load spike exactly every 60 seconds, then it goes quiet. Every key uses a 60 s TTL. What is going on?',
        options: [
          'The database runs a scheduled job every minute that competes with the cache refills',
          'The cache is too small, so it evicts nearly everything once a minute and refills',
          'The keys were loaded together, so they expire together; add TTL jitter',
          'The hit rate is 100%, so the database should see no load at all',
        ],
        answer: 2,
        explanation:
          'Keys written at the same moment with the same TTL expire at the same moment, so the misses arrive in waves. Adding jitter (for example 60 s plus or minus 20%) spreads the expiries out and the spikes disappear. An undersized cache would give constant misses, not a sharp periodic spike.',
      },
      {
        id: 'cache-10',
        prompt: 'The Redis cluster in front of the database goes down, and every API request starts returning HTTP 500. The database itself is healthy. What was designed wrong?',
        options: [
          'Nothing - an API built on cache-aside cannot answer without its cache',
          'The cache was a hard dependency; a cache error should fall through to the database',
          'The database should have failed first, so the API could keep serving from the cache',
          'Redis needed a longer TTL, so keys would outlive a short cluster outage',
        ],
        answer: 1,
        explanation:
          'A cache is a performance tool, never a correctness mechanism. With cache-aside, a cache error can be treated as a miss and the request answered from the database - slower, but working. The database must then be able to survive that load, which is the same question as surviving a cold cache.',
      },
      {
        id: 'cache-11',
        prompt: 'Bots request product IDs that do not exist. Each request misses the cache, queries the database, finds nothing, and caches nothing - so the next identical request does the same. How do you stop these reaching the database?',
        options: [
          'Raise the TTL on real products so more of the catalog stays cached',
          'Add more memory to the cache so the bot keys fit alongside real products',
          'Use LFU instead of LRU, so the rare bot keys are evicted before hot ones',
          'Cache the "not found" result briefly, or check a Bloom filter first',
        ],
        answer: 3,
        explanation:
          'This is cache penetration: keys that never exist never populate the cache, so every request goes to the database. Caching the negative result briefly, or rejecting unknown IDs with a Bloom filter, closes the gap. The other options only help keys that exist.',
      },
      {
        id: 'cache-12',
        prompt: 'A public product image is served by your API from Redis on every page view. Where does caching it give the biggest win?',
        options: [
          'In Redis, with a longer TTL so the image is never reloaded from storage',
          'At the CDN edge and in the browser, via Cache-Control headers',
          'In the database buffer pool, so the image bytes are always read from RAM',
          'In an in-process cache on each API instance, to skip the Redis network hop',
        ],
        answer: 1,
        explanation:
          'The outermost layer that can hold the data correctly gives the biggest win. A public image can live at the CDN and in the browser, so the request never reaches your infrastructure at all. Redis still costs a network hop, an API server and your bandwidth on every view.',
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
      'Write-around: writes go straight to the database (deleting any cached copy) and the cache is only populated on read.',
    ],
    when: [
      'Always - every cache needs an explicit answer to who fills it and what happens on a write.',
      'Per data type: ask how bad a stale read is and how bad a lost write is, and let those two answers pick the strategy.',
      'Write-behind only for data you can afford to lose, such as view counters and metrics.',
    ],
    advantages: [
      'Makes the freshness guarantee of each piece of data explicit instead of accidental.',
      'Lets you trade write latency against durability deliberately.',
      'Deleting keys on write keeps the invalidation logic idempotent and order-independent.',
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
        approach: 'Read-through',
        gains: ['One code path for hits and misses', 'The loader can let only one request reload a key, which stops stampedes in one place'],
        costs: ['The cache layer must know how to load every kind of entity', 'If the cache is down, reads fail unless the client falls back to the database'],
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
        costs: ['First read after a write is always a miss', 'An update must still delete the old cached copy, or it stays stale until the TTL'],
      },
    ],
    mistakes: [
      'Mixing strategies per code path without documenting it, so nobody knows the freshness guarantee.',
      'Using write-behind for data you cannot afford to lose.',
      'Updating the cached value in place on a write instead of deleting it - two concurrent writers can leave the older value cached.',
      'Writing to the database and forgetting to delete the cached key, then debugging stale reads.',
      'Letting a cache error fail the request instead of falling back to the database.',
    ],
    related: ['caching', 'redis', 'denormalization'],
    quiz: [
      {
        id: 'cs-1',
        prompt: 'Writes are acknowledged as soon as they reach the cache and are flushed to the database every 30 seconds. The cache node crashes. What happens to the writes of the last 20 seconds?',
        options: [
          'They are safe, because an acknowledged write has already reached the database',
          'They are replayed from the cache on restart, since the cache kept the pending queue',
          'They are lost - they were acknowledged but never reached the database',
          'They are retried automatically by the database once the cache node comes back',
        ],
        answer: 2,
        explanation:
          'This is write-behind: the acknowledgement comes before the database has the data, so anything not yet flushed dies with the cache node. It is the only strategy that can lose acknowledged writes. With write-through the database would have every write, because the caller waits for it.',
      },
      {
        id: 'cs-2',
        prompt: 'A video site counts views: 50,000 increments per second, read a few times a minute, and losing a few seconds of counts in a crash is acceptable. Which write strategy fits?',
        options: [
          'Write-behind: count in the cache and flush totals to the database in batches',
          'Write-through: every increment to the cache and the database, so counts are never lost',
          'Write-around: every increment straight to the database, and cache only the totals read',
          'No cache: the database must see each increment to keep the count correct',
        ],
        answer: 0,
        explanation:
          'Write-behind turns 50,000 small database writes per second into one batched update every few seconds, and its one risk - losing unflushed writes - is acceptable here. Write-through and write-around would both send all 50,000 writes per second to the database.',
      },
      {
        id: 'cs-3',
        prompt: 'In the Cache Strategies Lab you watch the cache-aside write: UPDATE to the database, then DEL key, then 200 OK. A developer removes the DEL step to save a round trip. What do readers see?',
        options: [
          'Nothing changes - the database has the new value, and reads trust the database',
          'The old value, served from the cache until its TTL runs out',
          'An error on the next read, because cache and database now disagree',
          'The new value, because the cache watches the database for changes',
        ],
        answer: 1,
        explanation:
          'In cache-aside nothing links the cache to the database except the application. Without the DEL, the cached copy stays and every read hits it - stale - until the TTL expires. The cache does not watch the database; that is exactly the job the DEL step does.',
      },
      {
        id: 'cs-4',
        prompt: 'Two requests update the same product at almost the same time. Each writes the database, then SETs its own new value into the cache. Sometimes the cache ends up with the older value for good. What is the safer write path?',
        options: [
          'Add a longer TTL so the cache changes less often and the race window shrinks',
          'Write the cache first, then the database, so both writers follow the same order',
          'Use write-behind so the cache is the only writer and the database follows it',
          'Delete the cached key after the database write instead of setting it',
        ],
        answer: 3,
        explanation:
          'The two SETs can land in the opposite order from the database writes, leaving the older value cached. A DEL is idempotent and order-independent: whichever request deletes last, the next read reloads from the source of truth. Swapping the order or lengthening the TTL keeps the race and only changes how long it lasts.',
      },
      {
        id: 'cs-5',
        prompt: 'A nightly job imports 10 million order rows that nobody will read for weeks. The service uses write-through for all writes. What goes wrong, and what should the import use instead?',
        options: [
          'Nothing - write-through keeps everything fresh, so the import is harmless',
          'It evicts the hot keys with rows nobody reads; write around the cache',
          'The import is lost if the cache crashes mid-run; write to the database first',
          'The database rejects the import, because write-through allows one write at a time',
        ],
        answer: 1,
        explanation:
          'Write-through caches everything that is written, including write-once data, so the import pushes the hot set out and the hit rate collapses the next morning. Write-around sends those writes straight to the database; the cache fills only with what is read. Data loss is the risk of write-behind, not write-through.',
      },
      {
        id: 'cs-6',
        prompt: 'Your service uses a read-through cache library. The cache cluster goes down, and every read now returns an error, although the database is healthy. What is missing?',
        options: [
          'A fallback that reads the database directly on a cache error',
          'A longer TTL',
          'Write-behind for the reads',
          'A bigger cache cluster',
        ],
        answer: 0,
        explanation:
          'With read-through the application only talks to the cache, so a cache outage becomes a read outage unless the client falls back to the database. Cache-aside falls through naturally; read-through has to be written to do it. A bigger or longer-lived cache does nothing while it is down.',
      },
      {
        id: 'cs-7',
        prompt: 'Stock levels change every few seconds, and selling an item you do not have is expensive. Product pages show stock from a cache. What must the checkout do?',
        options: [
          'Trust the cached stock level, because it is at most a few seconds old',
          'Use write-behind so stock updates reach the cache before buyers do',
          'Re-check and reserve the stock atomically in the database at checkout',
          'Raise the TTL so the cache is hit more often during the checkout rush',
        ],
        answer: 2,
        explanation:
          'A cache is fine for showing roughly how many are left, but the decision that sells the item must use the source of truth, atomically. "At most a few seconds old" is exactly the window in which two buyers take the last item. The strategy is chosen by how bad stale is - and here stale is very bad.',
      },
      {
        id: 'cs-8',
        prompt: 'In the Cache Strategies Lab you pick Write around, then Read, right after a write of a new row. What does the read do first, and why?',
        options: [
          'Hits the cache, because the write stored the row there on the way in',
          'Misses, then loads the row from the database and caches it',
          'Reads from the cache, which fetches the row from the database by itself',
          'Fails, because the row is only in the database and not yet cached',
        ],
        answer: 1,
        explanation:
          'Write-around writes only to the database, so the first read after a write is always a miss: the application loads the row and fills the cache on the way back. That miss is the price of keeping write-once data out of the cache. Fetching by itself would be read-through, a different pattern.',
      },
      {
        id: 'cs-9',
        prompt: 'Thirty call sites repeat the same cache-aside code, and a hot key missing sends hundreds of identical queries to the database. What change fixes both problems in one place?',
        options: [
          'Switch every write to write-through, so hot keys are always in the cache',
          'Shorten the TTL so each miss reloads a smaller, fresher batch',
          'Remove the cache from the hot key and let the database serve it',
          'Read-through with one loader that lets a single request reload a key',
        ],
        answer: 3,
        explanation:
          'Read-through puts the loading logic in one place, so call sites become one line, and that one loader can make sure only one request reloads a key (single flight). Write-through keeps written keys warm but does not stop a stampede on a key that expired, and a shorter TTL makes misses more frequent.',
      },
      {
        id: 'cs-10',
        prompt: 'A user changes their display name. It appears inside cached feed pages, comment threads and profile cards, each under its own key. Keeping track of every key to delete keeps missing some. What scales better?',
        options: [
          'Flush the whole cache whenever any user changes their display name',
          'Cache the user once and build pages from it, or version the key',
          'Use write-behind for names, so the rename reaches every cached page later',
          'Never cache anything that contains a name, so no page can show an old one',
        ],
        answer: 1,
        explanation:
          'Deleting every derived key by hand is where caching bugs come from. Caching the user once and assembling pages makes one delete precise; a versioned key (user:42:v7) makes old entries unreachable at once and they age out on their own. Flushing everything turns each rename into a cold start.',
      },
    ],
  },
  {
    slug: 'redis',
    title: 'Redis',
    tagline: 'An in-memory data structure server used as cache, session store and more.',
    category: 'performance',
    difficulty: 'Beginner',
    lab: 'caching',
    labFocus: 'redis',
    keywords: ['in-memory', 'ttl', 'lru', 'maxmemory', 'eviction', 'pubsub', 'sorted set', 'lock'],
    what: 'Redis is an in-memory store that runs commands one at a time on a single thread, with data structures (strings, hashes, lists, sets, sorted sets, streams), per-key TTLs, a memory limit with an eviction policy, optional persistence and replication.',
    why: 'Sub-millisecond operations plus useful data structures make it the default choice for caching, session storage, rate limiting, leaderboards, and simple queues.',
    how: [
      'Data lives in RAM; persistence (RDB snapshots, AOF log) is for recovery, not for capacity.',
      'Commands are executed one at a time, which makes single-key operations naturally atomic.',
      'A TTL (SET key value EX 60) makes a key disappear after that many seconds; Redis removes expired keys when they are touched and in a background sweep.',
      'maxmemory plus an eviction policy bounds memory: allkeys-lru evicts the least recently used key, and noeviction - the default policy - refuses new writes when full.',
      'Replication is asynchronous; Sentinel adds failover and Cluster shards keys across nodes.',
    ],
    when: [
      'Caching database results and rendered fragments.',
      'Shared sessions across a stateless app tier.',
      'Counters, rate limiters, leaderboards, ephemeral locks.',
    ],
    diagram: `SET  session:abc  {json}  EX 1800     -> expires in 30 min
INCR rate:user:42                     -> atomic counter
ZADD leaderboard 4820 "ada"           -> sorted set
GET  product:42                       -> sub-millisecond read
CONFIG SET maxmemory-policy allkeys-lru -> evict when full`,
    advantages: [
      'Sub-millisecond operations, because everything is in RAM.',
      'Every single command is atomic, so counters, rate limits and locks need no extra coordination.',
      'Rich data structures: sorted sets, hashes, streams and more, not just strings.',
      'Per-key TTLs and a memory limit make it a self-cleaning cache.',
    ],
    tradeoffs: [
      {
        approach: 'Redis as a cache (maxmemory + allkeys-lru)',
        gains: ['Memory stays bounded', 'Cold keys are evicted automatically', 'Writes never fail for lack of room'],
        costs: ['Any key can vanish, so only store what you can reload', 'LRU is approximated by sampling a few keys'],
      },
      {
        approach: 'Redis as a store (noeviction)',
        gains: ['Never silently drops a key', 'A full memory shows up as errors you can alert on'],
        costs: ['Writes fail with an OOM error when memory is full', 'Memory must be sized and watched'],
      },
      {
        approach: 'RDB snapshots',
        gains: ['Compact file', 'Fast restart'],
        costs: ['Loses every write since the last snapshot, often minutes'],
      },
      {
        approach: 'AOF log (fsync every second)',
        gains: ['Loses at most about one second of writes'],
        costs: ['Larger file and slower restart', 'Some write throughput spent on the log'],
      },
    ],
    mistakes: [
      'Using Redis as the system of record for data you cannot lose.',
      'Storing huge values or running O(n) commands (KEYS) on a single-threaded server.',
      'Relying on a naive SETNX lock for correctness-critical mutual exclusion.',
      'Leaving maxmemory unset on a cache: on 64-bit systems the default is no limit, so Redis grows until the machine runs out of RAM.',
      'Overwriting a key with a plain SET and losing its TTL - SET clears the expiry unless you pass EX again.',
    ],
    related: ['caching', 'cache-strategies', 'distributed-locks', 'rate-limiting'],
    quiz: [
      {
        id: 'redis-1',
        prompt: 'In the Caching Lab on the Redis focus, Redis holds 150 keys - its memory limit - with allkeys-lru, and a request misses on a key that is not cached. What happens when the API stores it?',
        options: [
          'The SET fails with an OOM error, because memory is at its limit',
          'Redis evicts the least recently used key and stores the new one',
          'Redis grows past its limit and evicts in a later background sweep',
          'Redis evicts the key with the shortest TTL left to make room',
        ],
        answer: 1,
        explanation:
          'With allkeys-lru, a write that needs room makes Redis evict the key used longest ago, so memory stays at the limit and the new key gets in. Refusing the write is what noeviction does. Evicting by shortest remaining TTL is a different policy, volatile-ttl.',
      },
      {
        id: 'redis-2',
        prompt: 'Same Lab, memory full. You switch the eviction policy to noeviction. What do you see?',
        options: [
          'Nothing changes: noeviction only matters for keys without a TTL',
          'Redis crashes with an out-of-memory error on the next write',
          'Reads start failing, because Redis rejects every command when full',
          'SET refused climbs, but reads are still answered',
        ],
        answer: 3,
        explanation:
          'Under noeviction Redis answers commands that add data with an OOM error but keeps serving reads. Cache-aside treats the failed SET as harmless and answers from the database, so the only effect is that the cache stops learning new keys until TTLs free some room. That is why noeviction, the Redis default, is the wrong policy for a cache.',
      },
      {
        id: 'redis-3',
        prompt: 'A team installs Redis with the default config on a 64-bit server and uses it as a cache, with no TTLs. A few weeks later the server starts swapping and Redis is killed. Why?',
        options: [
          'maxmemory defaults to 0 (no limit) on 64-bit, so Redis never evicted',
          'The default policy allkeys-lru evicted too slowly to keep up with new keys',
          'Redis leaks memory after a few weeks and needs a scheduled restart',
          'AOF persistence filled the RAM with its growing log of every write',
        ],
        answer: 0,
        explanation:
          'Without maxmemory there is nothing to evict against, so a cache with no TTLs only grows. Set maxmemory below the RAM of the machine and pick allkeys-lru. allkeys-lru is not the default - noeviction is - and it only acts once a limit is set.',
      },
      {
        id: 'redis-4',
        prompt: 'Login sessions are stored only in Redis, with a 30-minute TTL. Memory fills up during a traffic peak. Which policy fits, and why?',
        options: [
          'allkeys-lru, so Redis logs out the users who were idle longest first',
          'allkeys-random, to spread the forced logouts fairly across all users',
          'noeviction with a memory alert, so a full Redis fails visibly',
          'No maxmemory, so sessions are never evicted and nobody is logged out',
        ],
        answer: 2,
        explanation:
          'For a cache, eviction is harmless because the data can be reloaded. Sessions have no database behind them, so an eviction is a surprise logout. noeviction turns a full memory into errors you can alert on and size for. No limit at all just moves the failure to the operating system killing Redis.',
      },
      {
        id: 'redis-5',
        prompt: 'An engineer runs KEYS user:* on a production Redis holding 20 million keys, to find a few test users. What happens to the other clients?',
        options: [
          'Nothing - KEYS runs in a background thread while other commands continue',
          'They all wait until KEYS has scanned all 20 million keys',
          'Only clients reading user:* keys are slowed, because KEYS locks that prefix',
          'Redis splits the scan across its CPU cores, so the pause is short',
        ],
        answer: 1,
        explanation:
          'The single thread that makes every command atomic also means one slow command blocks everyone. KEYS is O(n) over the whole keyspace, so with 20 million keys every other client stalls for the whole scan. SCAN returns a few keys per call and lets other commands run in between.',
      },
      {
        id: 'redis-6',
        prompt: 'A rate limiter runs on four app instances. Each does GET count, adds 1 in code, then SET count. Under load, users get more requests through than the limit allows. What is the fix?',
        options: [
          'Use INCR, which reads and increments in one atomic command',
          'Add more app instances so each one handles fewer requests',
          'Give the counter a longer TTL so the window does not reset early',
          'Use a bigger Redis machine so GET and SET finish faster',
        ],
        answer: 0,
        explanation:
          'GET then SET is a read-modify-write race: two instances read 9, both write 10, and one request is never counted. INCR does the whole thing inside Redis in one command, and commands never interleave. A bigger machine or more instances only make the race more frequent.',
      },
      {
        id: 'redis-7',
        prompt: 'Redis runs with AOF and appendfsync everysec. The machine loses power. How much of the acknowledged data can be gone?',
        options: [
          'Nothing - AOF makes Redis as durable as a database',
          'Everything since the last RDB snapshot, often minutes',
          'About the last second of writes',
          'All of it - Redis is in memory only',
        ],
        answer: 2,
        explanation:
          'With fsync every second the log reaches disk once a second, so up to about one second of writes can be lost. Minutes of loss is the RDB-only case. appendfsync always would lose less, at a large cost in throughput.',
      },
      {
        id: 'redis-8',
        prompt: 'The Redis primary dies and Sentinel promotes a replica. A few writes that clients saw acknowledged just before the crash are missing. How?',
        options: [
          'Sentinel deleted them during the failover',
          'The TTL on those keys ran out',
          'The replica was evicting keys',
          'Replication is asynchronous, so the replica never got them',
        ],
        answer: 3,
        explanation:
          'Redis replication is asynchronous, so the primary answers the client first and ships the write to replicas afterwards. Writes in that gap die with the primary. This is one reason Redis should not be the only copy of money or orders.',
      },
      {
        id: 'redis-9',
        prompt: 'Sessions are written with SET session:abc {json} EX 1800. Later, a bug fix updates the session with a plain SET session:abc {json}. Weeks later memory is full of old sessions. Why?',
        options: [
          'The plain SET cleared the TTL, so those sessions never expire',
          'EX 1800 means 1800 days, so the sessions expire only in about five years',
          'Redis ignores TTLs until memory is full, then expires the oldest keys first',
          'Expired keys are only removed on restart',
        ],
        answer: 0,
        explanation:
          'SET overwrites the whole key, including its expiry: the key becomes persistent unless you pass EX (or KEEPTTL) again. Redis does remove expired keys on its own, both when they are touched and in a background sweep, so the TTL is not the problem - its absence is.',
      },
      {
        id: 'redis-10',
        prompt: 'A weekly leaderboard must show the top 10 of 2 million players and the rank of any one player, updated on every game. Which Redis structure fits?',
        options: [
          'One string per player, ranked with a KEYS scan',
          'A sorted set: ZADD per game, ZREVRANGE and ZREVRANK to read',
          'A list of scores, sorted in the application after an LRANGE of all players',
          'A hash of player to score, read with HGETALL and sorted in the application',
        ],
        answer: 1,
        explanation:
          'A sorted set keeps members ordered by score, so updating a score, reading the top 10 and finding one rank are all about O(log n). The other options pull 2 million entries into the application to sort them on every read.',
      },
      {
        id: 'redis-11',
        prompt: 'After moving to Redis Cluster, MGET user:1:name user:2:name fails with a CROSSSLOT error. What is going on?',
        options: [
          'Cluster mode does not support MGET at all; fetch each key separately',
          'One of the keys has expired, and MGET fails when any key is missing',
          'The keys hash to different slots, and multi-key commands need one slot',
          'The cluster needs more replicas so each node can answer for every slot',
        ],
        answer: 2,
        explanation:
          'Cluster shards keys by hash slot, and a multi-key command can only touch keys in the same slot. Hash tags put related keys in one slot on purpose - for example {user:1}:name and {user:1}:email. MGET itself works, as long as the keys share a slot.',
      },
    ],
  },
  {
    slug: 'cdn-caching',
    title: 'CDN Caching',
    tagline: 'Cache keys, TTLs and invalidation at the edge.',
    category: 'performance',
    difficulty: 'Intermediate',
    lab: 'cdn',
    labFocus: 'cdn-caching',
    keywords: ['edge', 'cache key', 'vary', 'purge', 'immutable', 's-maxage'],
    what: 'The caching layer of a CDN: what the edge stores, how it builds a cache key, how long it keeps the object, and how you invalidate it.',
    why: 'A CDN only helps to the extent that it hits. Hit rate is decided by your cache keys and headers, not by the CDN vendor.',
    how: [
      'The cache key is typically host + path + selected query parameters + Vary headers.',
      'Cache-Control from the origin says whether a shared cache may keep a copy (public, private, no-store) and for how long (max-age, or s-maxage for shared caches only).',
      'Content-hashed assets get Cache-Control: public, max-age=31536000, immutable - a deploy changes the URL.',
      'Use stale-while-revalidate to serve the old copy while refreshing in the background.',
      'Invalidate by purge, or better, by changing the URL (cache busting).',
    ],
    when: [
      'Every static asset: hash the file name and cache it for a year.',
      'Public, shared responses such as product lists or article pages: a short s-maxage, even a few seconds.',
      'HTML that must reflect deploys at once: no-cache with an ETag, so each use is a cheap revalidation.',
      'Never for per-user responses: mark them private or no-store.',
    ],
    diagram: `Cache key:  GET /static/app.a91f.js
Cache-Control: public, max-age=31536000, immutable
-> never revalidated; new deploy produces app.b72c.js`,
    advantages: [
      'A hashed URL with a one-year max-age is fetched from the origin once per edge, then never again.',
      'Even a 10 second TTL on a busy public response removes almost all of its origin load.',
      'stale-if-error keeps serving the last good copy while the origin is down.',
    ],
    tradeoffs: [
      {
        approach: 'Version-in-URL (immutable)',
        gains: ['Near-100% hit rate', 'No purges needed', 'Nothing stale after a deploy'],
        costs: ['Build step must hash assets', 'HTML itself must stay short-lived'],
      },
      {
        approach: 'Short TTL + purge',
        gains: ['Works for content that cannot change URL'],
        costs: ['Lower hit rate', 'Stale copies until each one expires or the purge arrives, which is not at the same moment everywhere'],
      },
      {
        approach: 'no-cache (revalidate every use)',
        gains: ['Never serves an old version', 'Most answers are a small 304 Not Modified'],
        costs: ['Every request still makes a trip to the origin', 'Origin sees 100% of requests'],
      },
    ],
    mistakes: [
      'Including a tracking query parameter in the cache key, fragmenting the cache into a copy per campaign.',
      'Including the Cookie header in the key of static files, so every visitor gets a private copy.',
      'Caching authenticated responses at a shared edge.',
      'Vary: User-Agent, which stores one copy per browser version.',
      'Expecting a purge to clear browser caches - it only clears the CDN.',
    ],
    related: ['cdn', 'caching', 'http-https'],
    quiz: [
      {
        id: 'cdn-caching-1',
        prompt:
          'In the CDN Lab the policy is public, s-maxage=30 on URLs that stay the same between deploys. You press Deploy new version. Triangles appear and "Old version served" jumps near 100%, then falls to 0 over about 30 seconds. Why?',
        options: [
          'The deploy failed on some servers and they are still running the old code',
          'Each edge copy stays fresh for its 30 s TTL and is replaced only on expiry',
          'The purge is still on its way to the edges, one location at a time',
          'Browsers are sending their cached old version back up to the edge',
        ],
        answer: 1,
        explanation:
          'The origin has v2, but the URL did not change, so every edge keeps answering from its v1 copy until its 30 seconds run out - popular files first, rare files last. Nothing was purged, so the purge is the tempting wrong answer. A purge would shorten the window; hashed URLs would remove it.',
      },
      {
        id: 'cdn-caching-2',
        prompt:
          'The index.html of a single-page app must show a new deploy within seconds, but you still want to avoid sending the full file when nothing changed. Which header fits?',
        options: [
          'Cache-Control: no-store',
          'Cache-Control: public, max-age=31536000, immutable',
          'Cache-Control: private, max-age=3600',
          'Cache-Control: no-cache, with an ETag',
        ],
        answer: 3,
        explanation:
          'no-cache means store it but check with the origin before every use. When the ETag still matches, the answer is a 304 Not Modified with no body, and a deploy is visible on the very next request. no-store is the tempting wrong one: it also shows deploys at once, but forces a full download every time.',
      },
      {
        id: 'cdn-caching-3',
        prompt:
          'In the CDN Lab you set Cache-Control to no-cache for the hashed static files. The hit rate drops to 0% and origin traffic equals total traffic, though most answers are small 304s. Why is this the wrong policy for these files?',
        options: [
          'Each use still waits on the origin, though a hashed file never changes',
          'no-cache forbids the edge from storing the file at all, so every request is a miss',
          '304 responses are larger than full responses once headers are counted',
          'no-cache makes the edge serve old versions after each deploy',
        ],
        answer: 0,
        explanation:
          'Revalidation is cheap in bytes but not in time: each use waits for the origin to say "not modified". A file whose name changes whenever its content does never needs that question. The tempting wrong answer is that no-cache forbids storing - that is no-store; no-cache stores and revalidates.',
      },
      {
        id: 'cdn-caching-4',
        prompt:
          'You want edges to keep the public product list for 60 seconds, while browsers check again on every page view. Which Cache-Control header does that?',
        options: [
          'public, max-age=60',
          'private, max-age=0, s-maxage=60',
          'public, max-age=0, s-maxage=60',
          'no-store, max-age=0, s-maxage=60',
        ],
        answer: 2,
        explanation:
          's-maxage applies only to shared caches such as a CDN and overrides max-age there, so the edge keeps 60 seconds while browsers get 0. public, max-age=60 is the tempting answer, but it would let every browser keep its own copy for a minute too. private forbids the edge from storing it at all.',
      },
      {
        id: 'cdn-caching-5',
        prompt:
          'In the CDN Lab you set the cache key to Host + path + Cookie header. The hit rate falls to almost 0% and the edges fill with thousands of objects. What should the key be for these static files?',
        options: [
          'Host + path + Cookie, with a longer TTL so each copy earns more hits',
          'Host + path only, since the files are the same for every visitor',
          'Host + path + User-Agent, so each browser gets a copy it can render',
          'No key - static files should skip the CDN and come from the origin',
        ],
        answer: 1,
        explanation:
          'Every visitor has a different cookie, so every request looks like a new object and no copy is ever used twice. A longer TTL is the tempting answer, but a copy that nobody else can match is useless however long it lives. A cookie-free hostname for assets makes the mistake impossible to repeat.',
      },
      {
        id: 'cdn-caching-6',
        prompt:
          'Marketing links add ?utm_source=... to every URL, and the product list uses ?page=2, ?page=3. To fix a poor hit rate, someone configures the edge to ignore the whole query string. What breaks?',
        options: [
          'Nothing - query strings never change a response',
          'The utm links stop working',
          'The edge starts refusing requests with a query string',
          'Page 2 and page 3 now get the cached copy of page 1',
        ],
        answer: 3,
        explanation:
          'Ignoring the query string removes the utm fragmentation, but ?page does change the response, and with it out of the key every page looks the same. The fix is to ignore the parameters that do not change the bytes (utm_*) and keep the ones that do. "Query strings never change a response" is the tempting belief that caused it.',
      },
      {
        id: 'cdn-caching-7',
        prompt:
          'To serve a mobile layout, the origin adds Vary: User-Agent to its HTML. The edge hit rate falls from 95% to 20%. Why, and what fixes it?',
        options: [
          'Each of thousands of User-Agent strings gets its own copy; vary on device class',
          'Vary headers are not supported by CDNs, so the edge stops caching the HTML',
          'The mobile layout is larger, so the edges run out of space and evict pages; add storage',
          'Vary forces every request to revalidate with the origin; send an ETag too',
        ],
        answer: 0,
        explanation:
          'Vary adds the named request header to the cache key, so every distinct value becomes its own copy, and each copy needs its own miss. Two or three device classes keep that to two or three copies. Running out of space is the tempting answer, but the problem is the number of keys, not the size of any one.',
      },
      {
        id: 'cdn-caching-8',
        prompt:
          'In the CDN Lab (public, s-maxage) at 200 requests per second, you drag the Edge TTL from 30 s to 1 s. The hit rate drops much more than it did at 20,000 requests per second. Why?',
        options: [
          'The edges are too far from the users at low traffic, so requests expire before they arrive',
          'Low traffic makes the origin slower, so edge copies are refreshed late',
          'A copy earns hits only while fresh, and at low traffic few requests arrive in 1 s',
          'A 1 s TTL turns off the cache entirely, whatever the traffic level',
        ],
        answer: 2,
        explanation:
          'A copy only earns hits from the requests that arrive while it is fresh. At high traffic even a rare file is asked for many times per second, so a 1 s TTL still catches most of them; at low traffic the next request usually comes after it expired. Turning the cache off is the tempting answer, but hits of popular files still happen at 1 s.',
      },
      {
        id: 'cdn-caching-9',
        prompt:
          'In the CDN Lab you press Purge all edges. Europe drops its copies first; Asia Pacific keeps serving the old version for another second or so. In production, what should the design assume about a purge?',
        options: [
          'It reaches locations one by one, and never touches browser caches',
          'It is atomic - every location drops its copies at the same moment',
          'It only works for hashed URLs, since only they have a unique cache key',
          'It permanently disables caching for the purged URL until the next deploy',
        ],
        answer: 0,
        explanation:
          'A purge is a message to hundreds of locations; the big vendors now finish in well under a minute, but never all at the same instant, and the browsers holding a copy never hear about it. Treating it as atomic is the tempting assumption behind "purge after every deploy" designs. Hashed URLs need no purge at all.',
      },
      {
        id: 'cdn-caching-10',
        prompt:
          'A public product list gets 5,000 requests per second, spread across 100 edge locations, and each edge keeps it with s-maxage=10. About how many requests per second reach the origin for it?',
        options: [
          'About 5,000, since each request still asks the origin',
          'About 500 - a cache removes about 90% of the load',
          'At most about 10',
          'Zero, since every edge already holds a copy',
        ],
        answer: 2,
        explanation:
          'Each of the 100 edges fetches it at most once every 10 seconds: 100 / 10 = 10 requests per second, against 5,000 without the cache, and no user sees data older than 10 seconds. 500 is the tempting answer - it treats the cache as dropping only 90% of the load. Zero would need a TTL that never ends.',
      },
      {
        id: 'cdn-caching-11',
        prompt:
          'The same product list has s-maxage=10. Every 10 seconds, the first user at each edge waits 300 ms while the edge fetches a fresh copy. Which directive removes that wait without lowering freshness much?',
        options: [
          'no-cache, with an ETag for cheap checks',
          'stale-while-revalidate=60',
          'Vary: Accept-Encoding',
          'private, max-age=10',
        ],
        answer: 1,
        explanation:
          'stale-while-revalidate (RFC 5861) lets the edge answer at once with the copy that just expired while it fetches the new one in the background, so no user waits for the origin. no-cache is the tempting wrong answer: it makes every request wait for the origin, not only one every 10 seconds.',
      },
    ],
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
          'Put Redis in front of the API so most reads never reach the database',
          'Make the working set fit in RAM again, for example with more memory',
          'Add two more app instances so the requests are spread across more CPUs',
          'Rewrite the service against a NoSQL database built for large tables',
        ],
        answer: 1,
        explanation:
          'The hit ratio says it: the pages the queries need no longer fit in memory, so one read in eight goes to disk. Fixing that speeds up every query and adds no staleness. Redis is the tempting answer, but it only hides the problem for cached keys - every miss and every expiry still pays the disk reads - and it brings invalidation with it.',
      },
      {
        id: 'db-cache-2',
        prompt:
          'In the Cache Layers Lab, with the materialized view off, the buffer pool holds 4,000 pages, the orders table is 20,000 pages, and the buffer pool hit ratio sits near 50%. You drag the buffer pool to 24,000 pages. What do you see?',
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
          'Turn on the MySQL query cache for that statement so repeat loads skip the sum',
          'Give shared_buffers all of the RAM so the 40 million rows stay in memory',
          'Add a read replica and send the dashboard there to take load off the primary',
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
          'The buffer pool started empty, so pages came from disk for a while',
          'The query planner forgot the indexes and rebuilt them in the background',
          'Replication lag built up on the replicas while the primary was down',
          'The materialized views were dropped and recreated from scratch',
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
          'Refresh every minute instead, so each refresh has fewer new rows to process',
          'Raise shared_buffers so the refresh reads from RAM and finishes faster',
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
          'Refresh the view every second so it is never more than a moment old',
          'Read the live total, or a counter updated in the order transaction',
          'Double the buffer pool so the view is always read from memory',
          'Turn on the in-process cache with a 1 s TTL for the checkout path',
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
          'Stay on 5.7 until the setting comes back in a later 8.x release',
          'Give the buffer pool 100% of RAM to make up for the lost cache',
          'Put a materialized view behind every query the cache used to serve, refreshed each minute',
          'Fix the query and index first, then cache in the application if needed',
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
          'Add Redis with a 5 minute TTL so the query runs once per key',
          'Double the buffer pool so more of the 50,000 rows come from RAM',
          'Create a materialized view of the whole table so the query reads a precomputed copy',
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
          'A materialized view of the lookup, refreshed every few seconds',
          'An in-process cache of the results with a 10 s TTL',
          'Prepared statements, so the plan is made once and reused',
          'A bigger buffer pool, so the lookup never touches disk',
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
          'None - a bigger buffer pool always means fewer disk reads and faster queries',
          'PostgreSQL also needs the OS page cache and memory for sorts and connections',
          'It turns off the OS page cache, so PostgreSQL reads straight from disk',
          'It makes materialized views refresh more slowly, since they need spare RAM',
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
          'The view is kept only in RAM, never on disk, so its reads never count as misses',
          'The view makes the database skip the disk for any table it covers',
          'The query engine now caches whole results instead of pages',
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
          'A bigger Redis cluster, so 40,000 reads per second stop being a strain',
          'Each instance keeps all flags in memory and refreshes every few seconds',
          'Read the flags from the database on every check, so they are never stale',
          'A request-scoped cache, so each request reads the flags from Redis only once',
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
          'The database rolled back a transaction, so the total briefly went down',
          'The buffer pool evicted the page with the total and reloaded an old one',
          'Each refresh lands on another instance with a copy of a different age',
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
          'Staleness drops, the hit rate drops, and database queries rise',
          'Stale reads drop and nothing else changes, since the TTL only bounds age',
          'The hit rate goes up, because fresher entries are served more often',
          'Nothing, because the TTL only affects how much memory the cache uses',
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
          'Only a small performance loss, from more misses than necessary',
          'Entries expire too early, because each user overwrites the tenant key',
          'The cache fills up faster, since it holds one entry per user',
          'Every user of a tenant gets the settings of whoever loaded them first',
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
          'Bound the cache with a maximum size and LRU eviction, plus a TTL',
          'Give the process more memory so 40 million entries fit at peak',
          'Restart the service every night to clear the map before peak',
          'Move the map to a file on disk, where it has room to grow',
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
          'Pub/sub makes every read slower, since instances check for messages first',
          'A missed message leaves a stale copy forever, since pub/sub is at most once',
          'The instances will drop their copies too often and hammer the database',
          'There is no risk; broadcast invalidation is exact and reaches every instance',
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
          'A process-wide cache with a 60 s TTL shared by all requests',
          'Redis with a 5 minute TTL, so every instance sees the same copy',
          'A request-scoped cache that lives for one request',
          'A materialized view of the settings, read in one query',
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
          'The deploy rebuilt the database indexes, which takes a few minutes',
          'The load balancer sends all traffic to one instance during a deploy',
          'The database restarts during every deploy and warms its buffer pool',
          'New instances start with empty local caches, so reads miss',
        ],
        answer: 3,
        explanation:
          'An in-process cache dies with its process. Every new instance starts cold and sends its misses to the database until its hot keys are loaded again - press Deploy the app in the Lab to see the local hit rate fall and the queries rise. A shared L2 cache in between, or a gradual rollout, softens the spike.',
      },
      {
        id: 'app-cache-9',
        prompt:
          'Reads go local cache (TTL 5 s), then Redis (TTL 5 minutes), then the database. A price changes; the code updates the database and deletes the Redis key. How long can users still see the old price?',
        options: [
          'Not at all, since the Redis key was deleted at once',
          'Up to 5 seconds',
          'Up to 5 minutes, the TTL of the Redis entry',
          'Until the next deploy clears the local caches',
        ],
        answer: 1,
        explanation:
          'Deleting the Redis key fixes the shared copy at once, but each instance may still hold the old price in memory for up to its local TTL. That is why the local TTL is kept short. 5 minutes is the tempting answer, but the Redis entry was deleted, so its TTL no longer matters.',
      },
      {
        id: 'app-cache-10',
        prompt:
          'The units-sold counter of a product changes several times a second and is read 1,000 times a second. In the Lab most in-process hits on the hot products show up as stale reads. What does that tell you?',
        options: [
          'The TTL should be raised so the hit rate goes up and hides the stale reads',
          'The local cache is broken, since a working cache never serves stale data',
          'The value changes too often to cache locally, unless approximate is fine',
          'The buffer pool is too small to keep the counter row in memory',
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
          'Keep the filters in a shared store or on the client',
          'Turn on sticky sessions so each user always reaches the same instance',
          'Raise the local TTL to one hour so the filters stay in memory longer',
          'Run a single instance so every request finds the same memory',
        ],
        answer: 0,
        explanation:
          'Per-user state held in one instance is only visible to requests that land there. A shared store or the client makes every instance see the same state, so any instance can serve any request. Sticky sessions are tempting, but they lose the state whenever that instance restarts or is scaled away.',
      },
    ],
  },
];
