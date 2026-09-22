# 07 - Sweep the networking and load balancing labs

Findings for ticket 07 - Sweep the networking and load balancing labs. Format and severities: see `README.md`.

<!-- Add findings below as ### F<nn>-<nnn> blocks. -->

All four labs load from `/labs/<id>` and from the Interactive Demo tab of every concept that hosts
them (`what-happens-when-you-type-a-url`, `dns`, `tls-https`, `cdn`, `cdn-caching`, `api-gateway`,
`load-balancing`, `health-checks`) with no console errors. Every control was pushed to both extremes
in headless Chromium (scripts in the session scratchpad, `t07/`); no NaN, Infinity or negative time
appeared in any lab, before or after the fixes. Dark theme and reduced motion render without errors.

### F07-001 - Load balancer: added servers get no layout, killed server keeps a live edge

- **Area:** Load Balancer Lab (`/labs/load-balancer`), diagram
- **Clicked:** Servers stepper 3 -> 8 (or 3 -> 1 -> 8); separately, clicked Kill on Server 2
- **Expected:** new servers appear in the row under the load balancer; a killed server's edge turns dashed/muted, because health checks ejected it from the pool
- **Happened:** Servers 4-8 rendered unpositioned, as full-width boxes stacked over the canvas (screenshot `t07/lb-EndEndEnd8.png`), and had no edges. After Kill the LB -> Server 2 edge stayed a solid green "ok" line. Cause: `layout` and `edges` were `useMemo`'d on `servers`, an array mutated in place, so the memo never recomputed.
- **Severity:** bug
- **Status:** fixed in `src/features/load-balancing/LoadBalancerLab.tsx` (memo keyed on a `poolKey` of id:status). Verified: 1 dashed edge after Kill, 0 after Restart; 8 servers laid out in one row.

### F07-002 - Load balancer: "Server 8" title truncated to "Serve..." at 8 servers

- **Area:** Load Balancer Lab, server node cards
- **Clicked:** Servers stepper to 7 and 8
- **Expected:** every server title readable (CLAUDE.md: no label silently truncated)
- **Happened:** at 8 servers the boxes are ~107px wide and the regular node padding truncated every title to "Serve..." (screenshot `t07/lb3-8b.png`)
- **Severity:** bug
- **Status:** fixed in `src/features/load-balancing/LoadBalancerLab.tsx` (node cards go `compact` above 6 servers). Verified: no `.truncate` element overflows at 4-8 servers, including Weighted with its subtitle.

### F07-003 - Load balancer: Weighted gives Server 1 3x the traffic but only 1.6x the capacity

- **Area:** Load Balancer Lab, Weighted Round Robin
- **Clicked:** Algorithm -> Weighted Round Robin at 500 req/sec, 3 servers
- **Expected:** the note says "Bigger servers receive proportionally more requests", so a weight-3 server should be exactly as busy as a weight-1 server
- **Happened:** Server 1 (weight 3) ran at 42% CPU while Servers 2-3 ran at 23% - weighted routing looked like it overloads the big server. Its capacity was modelled as `capacity * 1.6`, not `* weight`. The pool-capacity meter and the overload insight also ignored the bigger machine (said 1,200 req/sec when the real pool was 1,440).
- **Severity:** misleading
- **Status:** fixed in `src/features/load-balancing/LoadBalancerLab.tsx` (one `capacityOf(server)` used by the tick, the meter and the insight; weight N = N x capacity under Weighted; note says "a machine three times the size"). Verified: all three servers at 23-24% CPU; insight reports 2,000 req/sec pool capacity.

### F07-004 - Load balancer: "Active conns" counts requests the server already rejected

- **Area:** Load Balancer Lab, Active conns metric and per-server Conns
- **Clicked:** Traffic 5,000, Servers 1, Capacity 100, Duration 400 ms
- **Expected:** in-flight connections = accepted throughput x latency (Little's law), i.e. at most a few hundred for a 100 req/sec server
- **Happened:** Active conns 19,234 for one server serving 100 req/sec - Little's law was applied to the full arrival rate, including the 98% that fail fast. This also skews Least Connections under overload.
- **Severity:** misleading
- **Status:** fixed in `src/features/load-balancing/LoadBalancerLab.tsx` (`active = incoming x (1 - errorRate) x latency`).

### F07-005 - Load balancer: Round Robin, Least Connections and Random look identical

- **Area:** Load Balancer Lab, Algorithm select
- **Clicked:** each algorithm for 4 s at 500 req/sec, 3 servers; also at 50 req/sec
- **Expected:** the ticket asks that each algorithm visibly distribute differently
- **Happened:** Weighted is visibly different. The other three give every server 38-40% CPU and 15-16 conns. That is the true behaviour for identical servers, but the Least Connections note promises "slow servers stop receiving new work" and the lab has no slow server, so a junior cannot see why it exists.
- **Severity:** judgment-call
- **Status:** decided in #16 (pick A) - fixed in `src/features/load-balancing/LoadBalancerLab.tsx`

### F07-006 - Load balancer: latency metrics lag, and stay populated when nothing is served

- **Area:** Load Balancer Lab, Avg/P95/P99 latency
- **Clicked:** overload the pool, then drop Traffic to 50 and raise Capacity to 1,500; separately, Kill all three servers
- **Expected:** latency falls with utilization; with every server down there is no latency to report
- **Happened:** 4 s after recovery Avg latency still read 2.72 s next to 0% utilization, because `MetricWindow(500)` is sized in samples and 50 req/sec takes 10 s to refill it. With all servers down, Avg latency kept showing the last value (101 ms) beside 0 req/sec served.
- **Severity:** misleading
- **Status:** decided in #16 (pick A) - fixed in #18: `src/simulations/engine/metrics.ts` (`MetricWindow` keeps the last 2 s of samples, capped by count, and its snapshot is `null` with nothing in the horizon), `src/utils/format.ts` (`formatLatency(null)` is a dash), and every lab that reads it (Load Balancer, CDN, Caching, Circuit Breaker, Monolith vs Microservices) renders a dash and breaks the chart line instead of a stale value. Script check: 50 req/sec recovering from 2.72 s reads 30 ms 2.1 s later; with nothing served the window is empty 2 s after the last request. Browser check after merge (1440px): Load Balancer shows a dash for avg/p95/p99 about 3 s after every server is killed; CDN, Caching, Circuit Breaker and Monolith vs Microservices show normal latency while running.

### F07-007 - API gateway: pipeline shows the previous request after a control changes

- **Area:** API Gateway Lab (`/labs/api-gateway`), Gateway pipeline, insight and response block
- **Clicked:** Send request on `/api/users/me`, then Endpoint -> `GET /api/unknown` (no send)
- **Expected:** everything on screen describes the same request
- **Happened:** Resolved route said "no match" and the response block said `GET /api/unknown`, while the pipeline still said "/api/users/me matches users-service", the insight said "Request accepted" and the response was "-> 200 OK". Same after Reset quota window: quota 0/10 next to "Quota 10/10 exhausted -> 429". Toggles did not update the pipeline either.
- **Severity:** bug
- **Status:** fixed in `src/features/networking/ApiGatewayLab.tsx` (idle state previews the current controls; the sent pipeline is kept only until a control changes). Verified: `/api/unknown` preview shows 404 at Route matching; quota reset preview shows 200 OK.

### F07-008 - API gateway: a request rejected by JWT validation still spends rate-limit quota

- **Area:** API Gateway Lab, Quota used
- **Clicked:** Token is valid -> off, Send request
- **Expected:** the rate limit check is marked "skipped" (the request was rejected before it), so quota is unchanged
- **Happened:** quota went 0/10 -> 1/10 for a 401. The passing stage also said "Token bucket 0/10 used" while the metric said 1/10.
- **Severity:** bug
- **Status:** fixed in `src/features/networking/ApiGatewayLab.tsx` (quota is spent only when the limit stage passes; its text reads "request N of 10"). Verified: invalid-token send leaves Quota used unchanged.

### F07-009 - API gateway: request dot re-travels for every check and then freezes at the gateway

- **Area:** API Gateway Lab, diagram
- **Clicked:** Send request with everything valid
- **Expected:** one request travels client -> gateway, is checked, then travels gateway -> service
- **Happened:** the dot ran client -> gateway five times (once per pipeline stage), then a second dot appeared at the start of gateway -> service and stayed there forever, because the ticker had already stopped (screenshot `t07/gw-done.png`). A rejected request showed no dot at all.
- **Severity:** bug
- **Status:** fixed in `src/features/networking/ApiGatewayLab.tsx`. The dot now travels once, waits at the gateway through the checks, and the Forward step carries it to the service. A rejected request is drawn as a failure (cross) particle. Verified by screenshots `t07/gw3-*.png`.

### F07-010 - CDN: edge hit rate above 100%

- **Area:** CDN Lab (`/labs/cdn`), per-edge "Hit rate" on the edge nodes
- **Clicked:** CDN enabled, Traffic 20,000, Edge hit ratio 99%
- **Expected:** at most 100%
- **Happened:** Europe Edge and North America Edge showed 103% (screenshot `t07/cdn-max.png`). The hits counter was only read once requests existed, so its rolling window started later than the requests counter and the two windows drifted apart.
- **Severity:** bug
- **Status:** fixed in `src/features/networking/CdnLab.tsx` (both counters read every render, ratio clamped to 1). Verified: max seen over 30 samples is 99%.

### F07-011 - CDN: unused edges are labelled "Down"

- **Area:** CDN Lab, edge nodes with CDN disabled
- **Clicked:** load the lab (CDN starts disabled)
- **Expected:** an edge that is simply not in use reads as "not in use", not as a failure
- **Happened:** the subtitle says "not in use" but the status line says "Down" with a greyed card, the same way a crashed server is shown in the load balancer lab. A junior may read "the CDN is broken".
- **Severity:** misleading
- **Status:** decided in #16 (pick A) - fixed in `src/components/architecture/ArchNode.tsx` (shared: new optional `statusLabel` prop passed to `HealthIndicator`), `src/features/networking/CdnLab.tsx` (edges read "Off" while the CDN is disabled)

### F07-012 - URL journey: a cache miss is free on a warm connection

- **Area:** What Happens When You Type a URL (`/labs/url-journey`)
- **Clicked:** Warm connection on, Cache hit off
- **Expected:** a cache miss reaches the database and pays for the query, whatever the state of the browser connection
- **Happened:** the Database query row said "cached" with 0 ms and Backend time was 24 ms whether Cache hit was on or off, so the Cache hit toggle did nothing on a warm connection. `db.warmMs` was 0.
- **Severity:** bug
- **Status:** fixed in `src/features/networking/UrlJourneyLab.tsx` (`warmMs: 35`). Verified: warm + miss now shows 35 ms and Backend time 59 ms (was 24 ms).

### F07-013 - URL journey: "Twelve stages" but the default shows 11

- **Area:** What Happens When You Type a URL, lab description
- **Clicked:** load the lab
- **Expected:** the description matches the Stages metric
- **Happened:** description said "Twelve stages", Stages metric said 11 (the database stage is hidden on a cache hit, the CDN stage when the CDN is off; the count ranges 10-12)
- **Severity:** misleading
- **Status:** fixed in `src/features/networking/UrlJourneyLab.tsx` ("Up to twelve stages").

### F07-014 - URL journey: "CDN in front" only ever adds latency

- **Area:** What Happens When You Type a URL, CDN in front toggle
- **Clicked:** toggled CDN in front with every other combination
- **Expected:** the toggle description says "Edge cache before your origin", so a junior expects it to make the page faster at least sometimes
- **Happened:** the CDN stage is always modelled as a miss, so turning it on always adds 6-12 ms and removes nothing. The lab never shows the edge answering. The CDN stage detail text describes a hit, but the numbers never produce one.
- **Severity:** judgment-call
- **Status:** decided in #16 (pick B) - fixed in `src/features/networking/UrlJourneyLab.tsx`

### F07-015 - Latency numbers read as measured

- **Area:** Load balancer, CDN and URL journey labs, metrics strip
- **Clicked:** hovered the info icon on Avg latency and P95 latency (load balancer, CDN) and on the three timing cards (URL journey)
- **Expected:** CLAUDE.md: a simplified number that could be mistaken for a measurement says so in the UI, as tickets 06, 08, 09 and 10 now do
- **Happened:** the hints described the metric but never said the value is simulated
- **Severity:** misleading
- **Status:** fixed in `src/features/load-balancing/LoadBalancerLab.tsx`, `src/features/networking/CdnLab.tsx`, `src/features/networking/UrlJourneyLab.tsx` - the hints now end with "not measured"; checked by hovering in headless Chromium

## Checklist notes

- **Ejected node wiring:** lab canvases (`DiagramCanvas`) have no `asymmetric` field, and `check:visuals` covers only `src/data/visuals` and the evolution stages. In the load balancer lab the ejection is shown three ways: a dashed, muted edge (works after F07-001), a "Down" status label on the node, and two event-log lines ("health check failed (3 consecutive)", "Removing Server N from the load balancer pool"). Restart shows "Starting", then logs "health check passed" / "added back to the pool" after 3 s.
- **Status by shape and text:** particle legends use shapes (circle, diamond, triangle, cross). Node statuses always have a text label. Gateway stages have pass/reject/skipped badges.
- **Simplified numbers:** `computeLoad` is documented as a simplification in `load.ts`. Logged as F07-015 after review.
- **Canvas width:** at a 1400px viewport the 960px stage scrolls horizontally, which is intended. In the CDN and API Gateway labs the right column of nodes (Asia Pacific, the three services) starts off screen until you scroll. This is the shared `DiagramCanvas` design, so it is not logged as a finding.
