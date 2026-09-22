# 08 - Sweep the caching and database labs

Findings for ticket 08 - Sweep the caching and database labs. Format and severities: see `README.md`.

Verified in headless Chromium (Playwright, 1440x1000, light and dark, reduced motion) against the dev
server. Every lab loads from `/labs/<id>` and from the Interactive Demo tab of its concept page
(`caching`, `cache-strategies`, `database-indexing`, `replication`, `read-replicas`, `sharding`). No
console errors or page errors. Every slider was pushed to both ends and every toggle, select option,
preset and button was clicked; the metric text was scanned for `NaN`, `Infinity`, `undefined` and
negative values. The only bad value found was the stale-read share over 100% (F08-012).

Checks the ticket asked for:
- Caching hit rate adds up. Hit rate + miss rate = 100% at all times, and DB queries/sec follows
  miss rate x traffic (81% miss at 1,000 req/sec gave 805 q/s).
- Replication shows lag, not instant consistency. Async replicas are `Behind` by lag x write rate,
  and sync mode drops the stale share to 0.0%.
- Sharding shows a hot partition when the key is skewed. Country gives 2.19x skew with Shard A at
  1,257 req/s, labelled `HOT`. created_at gives 2.47x with Shard D, and user_id stays at 1.02x.
- Asymmetric wiring. In the `sharding` visual spec every shard is still wired, so it needs no reason.
  The two specs where a single partition holds the key (`partitioning`, `nosql-databases`) both
  carry an `asymmetric` reason. The sharding spec does contradict the lab, though. See F08-019.

### F08-001 - Shrinking the cache size never evicts anything

- **Area:** Caching Lab (`/labs/caching`), Cache size slider
- **Clicked:** Cache size 1000 for 4 s, then Cache size 10
- **Expected:** the cache drops to 10 keys and the hit rate falls sharply
- **Happened:** `Keys` stayed at 483 with a 10-item cache. The Fill meter was clamped to 100% and the
  hit rate stayed at 99%. Each miss evicted one entry and then inserted one, so an over-full cache
  never got back under its limit. The same leak came back after a TTL change (379 keys in a
  100-item cache). After the fix: 10 keys, 18% hit rate, 821 DB q/s.
- **Severity:** bug
- **Status:** fixed in `src/features/caching/CachingLab.tsx` (trims to the LRU limit every tick)

### F08-002 - Request inspector shows a Redis miss and store when the cache is off

- **Area:** Caching Lab, Request Inspector
- **Clicked:** Cache enabled off, then clicked a particle
- **Expected:** the route is `Client -> API -> PostgreSQL`
- **Happened:** the route was `Client, API, Redis (MISS), PostgreSQL, Redis (store)`, but the note
  underneath said "Cache disabled - straight to database". The simulated latency also still added
  the 4 ms cache lookup that no longer happens.
- **Severity:** bug
- **Status:** fixed in `src/features/caching/CachingLab.tsx`

### F08-003 - Caching Lab animates read-through while it is labelled cache-aside

- **Area:** Caching Lab diagram
- **Clicked:** watched miss particles with the default settings
- **Expected:** the API node is labelled `cache-aside`. In the Cache Strategies lab, cache-aside means
  the application queries the database itself after a miss.
- **Happened:** miss particles went `users -> api -> cache -> db` along a `cache -> db` edge labelled
  "miss -> load". In the Cache Strategies lab, that is read-through, where the cache loads from the
  database itself. The two labs taught opposite things for the same word.
- **Severity:** misleading
- **Status:** fixed in `src/features/caching/CachingLab.tsx`. Misses now go
  `users -> api -> cache -> api -> db`. The `cache -> db` edge is gone and the `api -> db` edge is
  labelled "on miss". The inspector route now shows API between the hops.

### F08-004 - Modelled latencies are shown with no hint that they are simulated

- **Area:** Caching (Avg/P95 latency), Indexing (Write latency, Write overhead), Replication (Write
  latency), Sharding (Worst latency)
- **Clicked:** hovered the metric hints
- **Expected:** CLAUDE.md says a simplified model must be flagged in the UI wherever a number could
  be taken for a measurement
- **Happened:** these numbers come from `computeLoad` or from fixed formulas, and nothing said so. Only
  Indexing's Query time said "Estimated". Sharding showed `4.00 s`, which is the model's ceiling, as
  if it had been measured.
- **Severity:** misleading
- **Status:** fixed. Added a "Simulated by a simplified model, not measured" hint in
  `CachingLab.tsx`, `IndexingLab.tsx`, `ReplicationLab.tsx` and `ShardingLab.tsx`.

### F08-005 - Step 1 of cache-aside and write-around is not highlighted

- **Area:** Cache Strategies Lab (`/labs/cache-strategies`)
- **Clicked:** Cache aside, then Read, then stepped to step 1 (`GET key`). Did the same for Write
  around, then Read.
- **Expected:** the `app -> cache` edge is highlighted and labelled `GET key`
- **Happened:** the edge was muted, with no label and no marching ants. Step 5 (`SET key`) uses the
  same edge, and the edge map kept only the last step for each edge, so the active step was
  overwritten. Every other step rendered correctly.
- **Severity:** bug
- **Status:** fixed in `src/features/caching/CacheStrategiesLab.tsx` (the active step wins the
  shared edge)

### F08-006 - Cache Strategies Lab has no particle legend

- **Area:** Cache Strategies Lab
- **Clicked:** looked at the circle, diamond and triangle particles
- **Expected:** every other lab has a ParticleLegend, and CLAUDE.md says status is never shown by
  colour alone
- **Happened:** the shapes had no key, so a learner could not tell that the triangle means a miss
  or warning
- **Severity:** misleading
- **Status:** fixed in `src/features/caching/CacheStrategiesLab.tsx`

### F08-007 - Changing the table size silently searches for a row that no longer exists

- **Area:** Database Indexing Lab (`/labs/indexing`)
- **Clicked:** Search for "the last row (worst case)" at 8,000 rows, then Table size 1,000, then Run
  without index
- **Expected:** the query and the Select agree
- **Happened:** the Select showed `ada.turing781 (row 781)`, but the SQL and the scan still used
  `linus.dijkstra8000@example.com`, which does not exist in a table of 1,000 rows. The scan read all
  1,000 rows and found nothing, and the UI did not say so.
- **Severity:** bug
- **Status:** fixed in `src/features/databases/IndexingLab.tsx` (resizing resets the search target)

### F08-008 - Write overhead +35% contradicts the write-path meter

- **Area:** Database Indexing Lab, Write overhead metric vs Write path cost meter
- **Clicked:** Create index on email
- **Expected:** one cost for maintaining the index
- **Happened:** the metric was a fixed `+35%`, while the meter underneath (which drives Write
  latency) showed `200 writes/sec -> 400 structures updated/sec`, which is +100%
- **Severity:** misleading
- **Status:** fixed in `src/features/databases/IndexingLab.tsx`. The overhead is now derived from the
  same structures-per-write model and shows `+100%`.

### F08-009 - "Rows Removed by Filter" is off by one when the row does not exist

- **Area:** Database Indexing Lab, sequential scan plan
- **Clicked:** Search for "a row that does not exist", then Run without index
- **Expected:** all 8,000 rows removed
- **Happened:** it showed 7,999. The code always subtracted the one matching row, even when nothing
  matched.
- **Severity:** bug
- **Status:** fixed in `src/features/databases/IndexingLab.tsx`

### F08-010 - Should the B-tree depth be log2(n)?

- **Area:** Database Indexing Lab, B-tree depth and rows inspected with an index
- **Clicked:** Create index at 8,000 and at 50,000 rows
- **Expected:** a junior should come away with an accurate picture of a B-tree
- **Happened:** depth is `log2(rows)` (13 at 8k, 16 at 50k), and the drawing is a binary tree. Real
  B-trees have a fan-out in the hundreds, so 50,000 rows need about 3 levels. The O(log n) lesson
  holds, but "B-tree = binary tree" is the wrong picture.
- **Severity:** judgment-call
- **Status:** decided in #16 (pick A) - fixed in `src/features/databases/IndexingLab.tsx`

### F08-011 - Should the lab keep both query results side by side?

- **Area:** Database Indexing Lab, the two QueryPanels
- **Clicked:** Run without index, then Run with index
- **Expected:** the insight says "Run the query both ways", so the two results would stay next to
  each other
- **Happened:** only the last run is kept. Running with the index blanks the scan panel back to `-`,
  so the learner has to remember 262 ms to compare it with 5.0 ms.
- **Severity:** judgment-call
- **Status:** decided in #16 (pick A) - fixed in `src/features/databases/IndexingLab.tsx`

### F08-012 - Stale reads go above 100%

- **Area:** Database Replication Lab (`/labs/replication`), Stale reads metric
- **Clicked:** Replication lag 3000 ms, or Write rate 200
- **Expected:** a share between 0% and 100%
- **Happened:** `104.3%`, `105.9%`. The two RateCounters were first read at two different
  `performance.now()` calls, which starts each ring. That put their buckets out of step, so stale
  reads expired later than reads.
- **Severity:** bug
- **Status:** fixed in `src/features/databases/ReplicationLab.tsx` (one timestamp for both counters,
  clamped to 1). It now peaks at 100.0%.

### F08-013 - Async failover never loses a write at normal lag

- **Area:** Database Replication Lab, Kill primary
- **Clicked:** defaults (async, 400 ms lag, 20 writes/sec), then Kill Primary and waited for the
  failover
- **Expected:** the insight promises that "any write not yet shipped is lost on promotion". A few
  writes should be lost.
- **Happened:** "No writes lost - the promoted replica was fully caught up", every time. Writes still
  in flight went on landing during the 3 s failover delay after the primary was dead. Writes were
  only ever lost when lag was above about 2.3 s.
- **Severity:** misleading
- **Status:** fixed in `src/features/databases/ReplicationLab.tsx` (writes not yet shipped are dropped
  when the primary dies). The same click now logs "6 acknowledged write(s) lost". Sync mode still
  loses 0.

### F08-014 - After a failover the dead primary stays in the diagram and the new one disappears

- **Area:** Database Replication Lab, diagram after failover
- **Clicked:** Kill Primary, then waited 3 s
- **Expected:** the promoted replica is drawn as primary, and the old primary is shown as down
- **Happened:** the old primary kept `role: 'primary'`, so the diagram still drew "Primary - Down" in
  the primary slot. It kept showing the live version number and sending replication edges. The
  promoted replica was drawn nowhere, and its write particles were filtered out. The toolbar showed
  "Rebuild cluster" instead of "Kill primary". Screenshot: scratchpad `t08/repl-failover.png`.
- **Severity:** bug
- **Status:** fixed in `src/features/databases/ReplicationLab.tsx`. On promotion the old primary is
  demoted and shown as a down replica.

### F08-015 - Recovering the primary before failover leaves the cluster with no primary

- **Area:** Database Replication Lab, Recover Primary
- **Clicked:** Kill Primary, then Recover Primary within 3 s
- **Expected:** the primary is back and no failover happens
- **Happened:** `reviveNode` checked for a healthy primary after marking this node healthy. It matched
  itself, so it demoted itself to replica. Writes stopped until the scheduled failover promoted it
  again as "Primary (promoted)". The log meanwhile said it had "caught up as a replica".
- **Severity:** bug
- **Status:** fixed in `src/features/databases/ReplicationLab.tsx`. It stays primary and the pending
  failover is cancelled.

### F08-016 - Should almost every replica read be stale at the defaults?

- **Area:** Database Replication Lab, Stale reads
- **Clicked:** load the lab with the defaults
- **Expected:** a junior reads "stale" as "I read a value someone just changed"
- **Happened:** 98-99% stale at 20 writes/sec and 400 ms lag. The model treats the whole database as
  one key, so any replica behind by any write counts as stale.
- **Severity:** judgment-call
- **Status:** decided in #16 (pick B) - fixed in `src/features/databases/ReplicationLab.tsx`

### F08-017 - Sync write latency depends on a slider that is disabled

- **Area:** Database Replication Lab, Synchronous mode
- **Clicked:** Synchronous
- **Expected:** a control that changes a metric can be moved
- **Happened:** write latency = 8 + lag x 0.25 (108 ms at 400 ms), but the Replication lag slider is
  disabled in sync mode. The cost of sync depends on a value the learner can only set in async mode.
- **Severity:** judgment-call
- **Status:** decided in #16 (pick A) - fixed in `src/features/databases/ReplicationLab.tsx`

### F08-018 - The diagram is cut off on a 1440px screen, including the hot shard

- **Area:** Cache Strategies, Replication and Sharding labs (`DiagramCanvas`, shared)
- **Clicked:** opened the labs at 1440x1000
- **Expected:** the whole diagram is visible on a normal laptop screen
- **Happened:** the lab stage is about 750px wide there, and DiagramCanvas has a fixed 960px width
  that scrolls sideways. The scrollbar is an overlay on macOS, so nothing hints that there is more.
  What gets cut off: the Caller node (where the write-behind "200 OK (fast)" lands), Replica 3, and
  Shard D. Shard D is the hot shard for created_at, the one the lab is about. Screenshot: scratchpad
  `t08/shard-created.png`.
- **Severity:** judgment-call
- **Status:** decided in #16 (pick A) - split out as #19 (`DiagramCanvas` scales to fit); shared component and a CLAUDE.md rule change

### F08-019 - The sharding concept diagram shows hash(user_id) as the hot-shard key

- **Area:** `sharding` visual spec in `src/data/visuals/data-performance.ts` (concept page diagram)
- **Clicked:** opened `/concepts/sharding`
- **Expected:** the concept diagram agrees with the lab
- **Happened:** the router subtitle is `hash(user_id)`, the shards are ranges (`users 1-3M`), and the
  steps say "Bad key: hot shard" with Shard A at 90%. The lab teaches that a hash of user_id is the
  balanced default (1.02x skew). The diagram says the opposite.
- **Severity:** misleading
- **Status:** fixed in `src/data/visuals/data-performance.ts` by the orchestrator - the router
  subtitle is now `range(user_id)`, which matches the range shards and the hot-shard steps.
