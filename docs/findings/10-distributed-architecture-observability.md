# 10 - Sweep the distributed, architecture and observability labs

Findings for ticket 10 - Sweep the distributed, architecture and observability labs. Format and severities: see `README.md`.

<!-- Add findings below as ### F<nn>-<nnn> blocks. -->

Verified with headless Playwright scripts (kept in the session scratchpad under `t10/`: `cap.cjs`, `mono.cjs`,
`trace.cjs`, `dark.cjs`, `tog.cjs`). All three labs load from `/labs/<id>` and from the Interactive Demo tab of
`/concepts/cap-theorem`, `/concepts/microservices` and `/concepts/distributed-tracing`. They were checked in dark and
light themes, at 1400px and 375px, and with reduced motion. After the fixes: no console errors, no page errors, and
no NaN, Infinity or negative times at either end of any control.

## CAP Theorem Lab (`cap-theorem`)

### F10-001 - Rejected writes share a React key

- **Area:** CAP Theorem Lab, "Write attempts" list
- **Clicked:** Create partition (CP), then Write on node B twice
- **Expected:** two separate rejected rows, no console warnings
- **Happened:** each rejected write was keyed `${next}-b-${note}`. A rejected write never takes a version, so both got
  the same key and React logged "Encountered two children with the same key" (11 warnings in one run). The row also
  showed a version (`write v3`) that was never created. The next accepted write then took the same number.
- **Severity:** bug
- **Status:** fixed in `src/features/distributed/CapTheoremLab.tsx`. Rows are now keyed by a unique attempt number,
  and a rejected write shows no version.

### F10-002 - "Writes attempted" stops counting at 8

- **Area:** CAP Theorem Lab, metrics
- **Clicked:** clicked Write on node A 16 times
- **Expected:** Writes attempted = 16
- **Happened:** it showed 8. The metric was `writes.length`, and that list is cut to the last 8 rows for display.
- **Severity:** bug
- **Status:** fixed in `src/features/distributed/CapTheoremLab.tsx`. There is now a separate attempt counter.

### F10-003 - CP mode reports "Consistent: No" and says nothing diverges

- **Area:** CAP Theorem Lab, metrics and Node B card during a CP partition
- **Clicked:** Create partition with CP selected, then Write on node A
- **Expected:** CP keeps one truth. The insight says "nothing diverges", and the minority side refuses every
  request, so no client can read the old value.
- **Happened:** Consistent showed **No** in red. Node B's value turned red and its card raised an alert. The lab
  therefore said CP had given up both C and A, which is the opposite of the lesson.
- **Severity:** misleading
- **Status:** fixed in `src/features/distributed/CapTheoremLab.tsx`. "Consistent" now measures whether a client could
  read two different values. A stale copy counts only while it is still served. In CP mode Node B shows `v1` with a
  "not served" unit in the warn colour, and both tooltips explain why.

### F10-004 - Healing after a one-sided write reports a false conflict

- **Area:** CAP Theorem Lab, Heal partition in AP mode
- **Clicked:** AP, Create partition, Write on node A (only), Heal partition
- **Expected:** Node B is only behind, so it catches up. Nothing is lost.
- **Happened:** the log said "Conflict resolved by last-write-wins: v3 kept, v2 silently discarded". v2 was the old
  value, not a competing update. This teaches that any AP partition loses data.
- **Severity:** misleading
- **Status:** fixed in `src/features/distributed/CapTheoremLab.tsx`. The lab now counts the writes each side accepts
  during the partition. Last-write-wins is reported only when both sides wrote. Otherwise the log reads "Node B
  catches up to vN - only one side took writes, so nothing conflicts".

### F10-005 - Switching to CP before healing silently drops a conflicting write

- **Area:** CAP Theorem Lab, Heal partition
- **Clicked:** AP, Create partition, write on A and on B, switch to CP, Heal partition
- **Expected:** a conflict, because both sides accepted a write
- **Happened:** "Both nodes converge - no conflicts to resolve". One of the two accepted writes was thrown away with
  no message. The code chose the heal branch from the current CP/AP setting, not from what had happened.
- **Severity:** bug
- **Status:** fixed in `src/features/distributed/CapTheoremLab.tsx`. The heal message now depends on the writes each
  side accepted (see F10-004). It now logs "last-write-wins: v17 kept, v16 silently discarded".

### F10-006 - With two nodes, neither side is a real majority

- **Area:** CAP Theorem Lab, diagram labels "majority side" / "minority side"
- **Clicked:** read the diagram, then Create partition in CP
- **Expected:** a junior should learn that a quorum needs more than half of the nodes
- **Happened:** a 2-node cluster split 1/1 has no majority, so a real CP system would refuse writes on both sides.
  The lab labels node A "majority" without saying which other nodes are with it.
- **Severity:** judgment-call
- **Status:** decided in #16 (pick B) - fixed in `src/features/distributed/CapTheoremLab.tsx`

## Monolith vs Microservices Lab (`monolith-microservices`)

### F10-007 - Breaking Payments does not affect Orders, despite the synchronous call

- **Area:** Monolith vs Microservices Lab, microservices mode, Break Payments
- **Clicked:** Microservices, ~1400 req/s, Break Payments
- **Expected:** the insight says "Orders is only as available as Payments", so orders that call Payments fail too.
  This is the main cost of microservices that the ticket asks the lab to show.
- **Happened:** Orders requests that called Payments still succeeded. Particles went through the down Payments
  service to its database. The error rate was 33.9%, about the same as losing any other 20% service. Blast radius
  said "Payments only" and the log said "other services unaffected".
- **Severity:** misleading
- **Status:** fixed in `src/features/architecture/MonolithMicroservicesLab.tsx`. The Orders -> Payments call now
  fails when Payments is down or erroring, and its particle stops at the Payments service. The extra hop costs
  Payments' own latency instead of a flat 25 ms. The error rate is now ~52%. Blast radius reads
  "Payments + some Orders", and the log and insight name the dependency. The dependency edge turns red when Payments
  is down.

### F10-008 - Average latency shows 0.0 ms when every request fails

- **Area:** Monolith vs Microservices Lab, metrics and insight
- **Clicked:** Monolith, break any capability
- **Expected:** no latency number, because nothing succeeds
- **Happened:** Avg latency showed **0.0 ms** next to a 100% error rate. The insight said "Average latency is
  0.0 ms", which reads as "very fast".
- **Severity:** misleading
- **Status:** fixed in `src/features/architecture/MonolithMicroservicesLab.tsx`, and only fully fixed by #18. The sweep
  fix showed `n/a` when the latency window held no successful request, but the window then kept the last N samples:
  break a capability after the lab had been running and the old successes stayed in it, so the stale pre-break
  average kept showing. Since #18 `MetricWindow` keeps only the last 2 s of samples and its snapshot is `null` when
  that horizon is empty, so about 2 s after every request starts failing the metric and the insight text show a dash
  (`formatLatency(null)`), the app-wide "no value" mark. The metric hint now says so too
  ("Shows a dash when no request succeeded in the last few seconds").

### F10-009 - Utilization panel contradicts the node card for a broken capability

- **Area:** Monolith vs Microservices Lab, Utilization panel
- **Clicked:** Monolith, Break Users (also Microservices, Break Payments)
- **Expected:** the Utilization meter and the node's CPU meter agree
- **Happened:** the node card showed CPU 0% (process down). The Utilization panel still showed the pre-crash load
  (100% for the monolith, 66% for Payments).
- **Severity:** bug
- **Status:** fixed in `src/features/architecture/MonolithMicroservicesLab.tsx`. The Utilization meters now read 0
  for the broken application or service.

### F10-010 - "sync call" edge label is hidden behind the service cards

- **Area:** Monolith vs Microservices Lab, microservices diagram
- **Clicked:** Microservices mode, looked at the Orders -> Payments edge
- **Expected:** the synchronous dependency is labelled and readable
- **Happened:** the Orders and Payments cards are 30px apart. The label landed behind the cards, and only "nc ca"
  showed. CLAUDE.md names this case: the wiring layer is painted under the node cards.
- **Severity:** bug
- **Status:** fixed in `src/features/architecture/MonolithMicroservicesLab.tsx`. The edge label is dropped, and the
  Orders card subtitle now reads "x2, calls Payments".

### F10-011 - Latency and error numbers not labelled as simplified

- **Area:** Monolith vs Microservices Lab
- **Clicked:** read the metrics
- **Expected:** per CLAUDE.md, a number that could be mistaken for a measurement is labelled as a model
- **Happened:** latencies such as "43 ms" and "3.37 s" come from `computeLoad`, with no note saying so
- **Severity:** misleading
- **Status:** fixed in `src/features/architecture/MonolithMicroservicesLab.tsx`. The footer now reads "Simplified
  load model - latency and errors are illustrative, not measured."

### F10-012 - Only Orders can scale, so microservices look unscalable at high traffic

- **Area:** Monolith vs Microservices Lab, Instances slider in microservices mode
- **Clicked:** Microservices, Traffic 5000, Instances 8
- **Expected:** "Scale only the hot service" (from the comparison table) should let a junior bring errors down
- **Happened:** Users, Payments and Notifications stay at a fixed 400 req/s each. At 5000 req/s Users and Payments get
  1000 req/s and stay at 100% CPU, whatever the setting. The error rate floor is ~27-41%. The monolith at 8
  instances shows 0% errors. The Payments CPU also leaves out the calls Orders makes to it: the particles hit
  Payments, but its meter does not count them. Counting them would saturate Payments at the default 900 req/s, so
  it was left out rather than retuning capacities.
- **Severity:** judgment-call
- **Status:** decided in #16 (pick B) - fixed in `src/features/architecture/MonolithMicroservicesLab.tsx`

### F10-013 - "Network hops per request" counts the two architectures differently

- **Area:** Monolith vs Microservices Lab, footer
- **Clicked:** switched modes and read "Network hops per request"
- **Expected:** both architectures counted the same way
- **Happened:** Monolith shows 1 (app -> db; the load balancer -> app hop is not counted). Microservices shows 2-3
  (gateway -> service is counted). Counted the same way, it is 2 against 2-3.
- **Severity:** judgment-call
- **Status:** decided in #16 (pick A) - fixed in `src/features/architecture/MonolithMicroservicesLab.tsx`

## Distributed Tracing Lab (`tracing`)

### F10-014 - The waterfall does not nest: the root span shows 18 ms and parents do not contain children

- **Area:** Distributed Tracing Lab, waterfall
- **Clicked:** opened the lab with default sliders
- **Expected:** as in any tracing UI, the root span covers the whole request (205 ms). A parent bar spans its
  children, and the numbers add up to the total shown.
- **Happened:** the root row read **18 ms** (the gateway's own work) with a bar 8.8% wide, under a "205 ms total"
  header. order-service read 35 ms, and its children (cache, payment, db) were drawn after its bar ended.
  payment-service (120 ms) ended before its own INSERT. The last span ended at 91% of the axis, and the gateway's
  18 ms had no position on the timeline.
- **Severity:** misleading
- **Status:** fixed in `src/features/observability/TracingLab.tsx`. Spans now carry a `parent`, and each span runs
  its own work, then its children in order. Rows show the duration including children: root 205 ms, order 187 ms,
  payment 145 ms. The span detail shows both duration and self time. A new line under the waterfall shows the sum:
  "Self times add up to the total: 18 + 35 + 3 + 120 + 25 + 4 = 205 ms". A note says the calls run one after
  another only as a simplification. Checked at all four sliders min and max, with cache hit/miss and async on/off.
  In every case the self times add up to the header total, and every child bar sits inside its parent.
  "Slowest span" is now "Slowest span (self)". The smallest-bar clamp shifts a span at the end left instead of
  letting it go past the edge (kafka was 0.13% wide).

### F10-015 - "Services" counts span kinds, not services

- **Area:** Distributed Tracing Lab, metrics
- **Clicked:** read Services with the default settings, then turned the cache off
- **Expected:** the number of distinct components in the request
- **Happened:** it counted distinct `kind` values. order-service and payment-service share the kind "service" and
  count once. Default showed 5 for 6 components. Turning Async notification off dropped it to 4, while the Postgres
  row appeared and disappeared without changing it.
- **Severity:** misleading
- **Status:** fixed in `src/features/observability/TracingLab.tsx`. Each span now has a `component`, and the metric
  is renamed "Components": 6 by default, 5 without Kafka.

### F10-016 - The cache span is drawn in the danger colour

- **Area:** Distributed Tracing Lab, waterfall colours
- **Clicked:** looked at the redis GET row
- **Expected:** a cache hit reads as healthy. Red is the app's error colour.
- **Happened:** the redis span used `bg-danger`, so the one healthy, fast span looked like a failure
- **Severity:** misleading
- **Status:** fixed in `src/features/observability/TracingLab.tsx`. Cache spans now use `bg-violet`.

### F10-017 - The waterfall collapses to 0px bars at phone width

- **Area:** Distributed Tracing Lab, 375px viewport
- **Clicked:** opened `/labs/tracing` at 375x812
- **Expected:** a readable waterfall
- **Happened:** the fixed 224px name column filled the row. Every bar was 0px wide and the durations were clipped
  ("205 m").
- **Severity:** bug
- **Status:** fixed in `src/features/observability/TracingLab.tsx`. Below `sm` the span name takes its own line
  above the bar. The full name is also in a `title`.

### F10-018 - "Async notification" off removes the notification instead of making it synchronous

- **Area:** Distributed Tracing Lab, Async notification toggle
- **Clicked:** turned Async notification off
- **Expected:** a junior reads "async off" as "the notification is sent synchronously", which should make the
  request slower
- **Happened:** the kafka span just disappears and the total drops by 4 ms. Turning async off makes the request
  faster, and nothing is notified.
- **Severity:** judgment-call
- **Status:** decided in #16 (pick A) - fixed in `src/features/observability/TracingLab.tsx`

## Shared components

### F10-019 - Toggle knob sits outside the track when switched on

- **Area:** `Toggle` (seen in the Distributed Tracing Lab; used by many labs)
- **Clicked:** looked at the Cache hit / Async notification switches, which are on by default
- **Expected:** the knob sits inside the right end of the 44px track
- **Happened:** the knob was absolutely positioned with no `left`, so it started at its static position and was then
  translated 22px. It measured at x 1451-1469 for a track at 1407-1451, fully outside the track on the right.
- **Severity:** bug
- **Status:** fixed in `src/components/ui/Toggle.tsx` (shared file, one-class change: `left-0`). Knob now at
  1430-1448 on and 1410-1428 off.
