# 04 - Sweep the playground

Findings for ticket 04 - Sweep the playground. Format and severities: see `README.md`.

<!-- Add findings below as ### F<nn>-<nnn> blocks. -->

Verified with headless Playwright (real mouse events for palette drag-and-drop, node drag, handle-to-handle
edge drawing, edge and node deletion with Backspace). Scripts and screenshots: session scratchpad `t04/`
(`verify.cjs`, `cycle.cjs`, `reset.cjs`). No console errors or page errors on any path.

Acceptance status after the fixes below: all 15 palette kinds place by drag-and-drop and by click; nodes drag,
select (inspector opens) and delete (inspector button and Backspace, connected edges go too); edges draw from
the bottom handle to the top handle and delete with Backspace; all four presets load fully in view; adding and
wiring a cache to Client - Server - Database removes "No cache", clears the database bottleneck (800 -> 160 req/s)
and raises Performance 25 -> 65, deleting it reverts; empty canvas and a single orphan node give a message and
zero scores.

### F04-001 - First load shows one preset while the selector names another

- **Area:** Playground toolbar preset selector
- **Clicked:** opened `/playground`; then picked "Load balanced web tier" in the selector; then clicked Reset
- **Expected:** the canvas shows the preset the selector names, and Reset restores what was on screen
- **Happened:** the selector said "Load balanced web tier" but the canvas held the 3-node Client - Server - Database
  preset (`PRESETS[1]` vs `useState('scaled')`). Picking the named preset did nothing (same value, no change
  event), and Reset swapped in a different diagram
- **Severity:** bug
- **Status:** fixed in `src/features/playground/PlaygroundPage.tsx` (one `DEFAULT_PRESET` feeds the canvas, the selector and Reset)

### F04-002 - Loading a preset keeps the old zoom, so most of the new diagram is off screen

- **Area:** Playground canvas viewport
- **Clicked:** opened `/playground`, picked "Cached, queued and replicated" (also "Load balanced web tier" and "Blank canvas")
- **Expected:** the new diagram is framed on screen
- **Happened:** the viewport kept the first `fitView` of a 3-node preset (about 1.8x zoom). Only CDN, Load Balancer,
  API 1-2 and half of Primary DB were visible; Client, API 3, queue, worker and monitoring were off screen. On
  "Blank canvas" every new component was a giant card. Calling `fitView()` right after `setNodes` did nothing because
  the new nodes are not measured yet
- **Severity:** bug
- **Status:** fixed in `src/features/playground/PlaygroundPage.tsx` (re-arms React Flow's fit-on-init via `useStoreApi`
  so it fits once the new nodes are measured, resets to 1:1 for the blank canvas, `maxZoom: 1`). Verified: every
  preset renders fully inside the canvas, including after Reset

### F04-003 - Unconnected components score as a perfect architecture

- **Area:** Playground analysis (`analysis.ts`)
- **Clicked:** Blank canvas, then added one of each of the 15 palette components without drawing any edge
- **Expected:** loose, unwired boxes do not make a system scalable or available
- **Happened:** Scalability 100 / 100, Availability 100 / 100, Performance 95 / 100 and "No structural risks detected
  for this traffic level" - for a canvas where no request reaches anything. Redundancy was counted by kind, not by
  whether the component was wired
- **Severity:** misleading
- **Status:** fixed in `src/features/playground/analysis.ts`: only components with at least one edge count
  (Monitoring excepted, it is drawn without request edges), a medium risk names every unconnected component and
  tells the learner how to connect them, and scores are 0 while nothing is wired

### F04-004 - Empty canvas scores 30 / 25 / 40 and recommends an API gateway

- **Area:** Playground analysis, Blank canvas preset
- **Clicked:** picked "Blank canvas"
- **Expected:** a sensible empty state
- **Happened:** Scalability 30, Availability 25, Performance 40, plus "No gateway or load balancer..." and "No
  monitoring component..." risks for a canvas with no components
- **Severity:** misleading
- **Status:** fixed in `src/features/playground/analysis.ts` (early return: all scores 0 and one "The canvas is empty"
  item that says to add a Client and a Server or load a preset)

### F04-005 - The most complete preset reads as production-ready

- **Area:** Playground analysis, "Cached, queued and replicated" preset
- **Clicked:** loaded the preset
- **Expected:** no claim that the system is production-ready; the single load balancer in front of everything is a
  single point of failure (CLAUDE.md: "Anything that fronts the whole system is redundant in reality")
- **Happened:** Scalability 100, Availability 100, Performance 90, and a green "No structural risks detected for this
  traffic level." The analysis never checked for a lone load balancer or gateway
- **Severity:** misleading
- **Status:** fixed in `src/features/playground/analysis.ts` (new medium risk for exactly one load balancer or API
  gateway, each costs 10 Availability) and `PlaygroundPage.tsx` (the empty-risk text is now neutral and says the
  heuristic is not a production-readiness review). The preset now shows Availability 90 and the load balancer risk

### F04-006 - Full preset wires its API replicas differently

- **Area:** `presets.ts`, "Cached, queued and replicated"
- **Clicked:** loaded the preset and followed the edges
- **Expected:** API 1, API 2 and API 3 are replicas, so they have identical connections (CLAUDE.md "Diagrams must be true")
- **Happened:** API 1 and API 2 talked to the cache, only API 2 talked to Primary DB, and API 3 only talked to the
  queue - teaching that instances behind a load balancer are not interchangeable. The cache also had its own edge to
  Primary DB on top of the API -> DB edge, so cache misses were counted twice
- **Severity:** misleading
- **Status:** fixed in `src/features/playground/presets.ts` (each API -> cache, -> Primary DB, -> queue; dropped the
  double-counting cache -> Primary DB edge). Code review of #21 then found a bug in the numbers this fix quoted: the
  cache miss share (0.2) was applied to every sibling target of the cache, so the queue got it too. With Client ->
  Server -> SQL + Queue at 800 req/s the queue carried 800 req/s, and adding a Redis cache next to them dropped it to
  160 - as if a cache could answer "enqueue this job". Fixed in `src/features/playground/analysis.ts`: a cache only
  reduces traffic to data stores beside it (SQL, NoSQL, object storage, search), and a CDN only to origins (load
  balancer, gateway, server, service, object storage); a queue, another service or anything else keeps full traffic.
  That sent the full queue share to the preset's single Worker (720 req/s against 300), so the preset's worker tier is
  now "Workers x3" (one collapsed node, capacity 900). At 800 req/s the preset reads: CDN 800, load balancer 720,
  each API 240, cache 720, Primary DB 144, Read Replica 144, queue 720 (was 144), Workers x3 720 of 900 (was 144 on
  one worker); scores unchanged (Scalability 100, Availability 90, Performance 90). Client -> Server -> SQL + Queue:
  queue 800 without a cache and still 800 with one (was 160); SQL drops from 800 to 160 as intended

### F04-007 - Score bars are red when the score is good and green when it is bad

- **Area:** Playground "Architecture health" panel
- **Clicked:** loaded "Cached, queued and replicated" (100 / 100), then "Client - Server - Database" (Availability 0)
- **Expected:** a high score reads as good
- **Happened:** `ScoreRow` used `Meter`'s automatic utilization colours (>= 90% is danger), so 100 / 100 was a red bar
  and 0 / 100 was green
- **Severity:** misleading
- **Status:** fixed in `src/features/playground/PlaygroundPage.tsx` (explicit tone: >= 70 ok, >= 40 warn, else danger)

### F04-008 - A cycle or a self-connection multiplies the load

- **Area:** Playground analysis traffic propagation; edge drawing
- **Clicked:** "Client - Server - Database", Start simulation, drew SQL Database -> Server; then drew Server -> Server
- **Expected:** a loop does not create new requests; a component cannot be wired to itself
- **Happened:** the Server went from 800 to 4,800 req/s after the cycle (the depth cap of 12 let traffic loop six
  times), and the self-connection was accepted and pushed the Server to 300,800 req/s
- **Severity:** bug
- **Status:** fixed in `src/features/playground/analysis.ts` (traffic never re-enters a component already on its path;
  a total work budget guards densely wired canvases) and `PlaygroundPage.tsx` (`isValidConnection` rejects
  source === target). Verified: 800 req/s before and after the cycle, the self-connection is not created

### F04-009 - The client edge animates the fewest requests although it carries all of them

- **Area:** Playground edge particles while running
- **Clicked:** "Load balanced web tier", Start simulation
- **Expected:** the edge leaving the client, which carries 100% of traffic, is at least as busy as the ones after it
- **Happened:** clients have no load of their own (`load[client] = 0`), so their edges got intensity 0 and one particle
  while the load balancer edges showed three
- **Severity:** misleading
- **Status:** fixed in `src/features/playground/PlaygroundPage.tsx` (a client edge uses the client's share of the traffic)

### F04-010 - Stopped simulation: node cards say 0 req/s, the inspector says 800 / 1,000

- **Area:** Playground inspector vs node cards
- **Clicked:** "Client - Server - Database", simulation stopped, clicked Server
- **Expected:** one consistent number
- **Happened:** the card shows `0 req/s 0%` (loads are zeroed while stopped) while the Selected meter shows
  `800 / 1,000 req/s` and the risk list already reports "1 component(s) receiving more traffic than they can serve"
- **Severity:** judgment-call
- **Status:** decided in #16 (pick A) - fixed in `src/features/playground/PlaygroundPage.tsx`

### F04-011 - A CDN absorbs 85% of all requests, API calls included

- **Area:** `analysis.ts` `PASS_THROUGH.cdn = 0.15`
- **Clicked:** "Cached, queued and replicated" at 800 req/s
- **Expected:** a CDN offloads static assets; dynamic API calls still reach the load balancer
- **Happened:** the load balancer receives 120 req/s and each API 40 req/s, so the CDN looks like it cuts API load by 85%
- **Severity:** judgment-call
- **Status:** decided in #16 (pick B) - fixed in `src/features/playground/analysis.ts`

### F04-012 - Heuristic scores can reach 100 / 100

- **Area:** Playground "Architecture health"
- **Clicked:** loaded "Cached, queued and replicated"
- **Expected:** a heuristic that checks a handful of things does not award a perfect score
- **Happened:** Scalability 100 / 100 (Availability is now 90 because of F04-005)
- **Severity:** judgment-call
- **Status:** decided in #16 (pick A) - no change

### F04-013 - Cache misses counted twice when a cache is also wired to the store

- **Area:** `analysis.ts` cache-aside rule
- **Clicked:** "Client - Server - Database", added a Redis Cache, drew Server -> Cache and Cache -> SQL Database
  (keeping Server -> SQL Database)
- **Expected:** one of the two paths carries the misses
- **Happened:** the misses arrive on both the Server -> DB edge and the Cache -> DB edge, so the database sees 2x the
  miss rate. The model treats a component wired to a cache as cache-aside and a cache wired to a store as read-through,
  and applies both when a learner draws both
- **Severity:** judgment-call
- **Status:** decided in #16 (pick A) - fixed in `src/features/playground/analysis.ts`. After review: a Cache -> store edge is ignored only when the caller also has a direct edge to that store; with App -> Cache -> store alone, that edge carries the misses. Checked with the analysis function: all three wirings give the database 160 of 800 req/s, a canvas with no cache gives 800
