# 06 - Sweep the fundamentals and scaling labs

Findings for ticket 06 - Sweep the fundamentals and scaling labs. Format and severities: see `README.md`.

<!-- Add findings below as ### F<nn>-<nnn> blocks. -->

Checked in headless Chromium (Playwright) at 1400x1000, light and dark, with and without
`prefers-reduced-motion`. Every lab loads from `/labs/<id>` and from the "Interactive lab" tab of
each concept that hosts it (`functional-requirements`, `non-functional-requirements`,
`capacity-estimation`, `vertical-scaling`, `horizontal-scaling`, `auto-scaling`,
`stateless-applications`, `stateful-applications`, `jwt`). Every slider was pushed to min and max,
every button and toggle clicked, and the page text scanned for NaN / Infinity / negative values:
none found, no console errors. Node geometry (inside the canvas, no overlap, no `truncate`
clipping) was measured from the DOM, not eyeballed.

Machine tiers (`src/simulations/models/machine.ts`): cost per req/sec rises at every step
(0.080, 0.120, 0.160, 0.217, 0.325 $/req/s), so cost grows faster than capacity as required. The
ladder caption ("16x capacity, 65x cost") matches the data. No change needed.

### F06-001 - Requirements lab keeps the relaxed baseline next to the strict target

- **Area:** Requirements lab, "Architecture consequences" card
- **Clicked:** pushed every non-functional slider to its maximum
- **Expected:** the list names what 99.999% / 20 ms / 100M DAU / strong / critical force
- **Happened:** the list also kept every level-0 line, so it said "Single instance is acceptable" next to "Multi-region active-active", "Manual recovery is fine" next to "No manual step in any recovery path", "One server and one database" next to "Sharded data", "In-memory storage acceptable" next to "Cross-region backups". The union loop started at index 0 for every level. 42 "forced decisions", 7 of them contradictions.
- **Severity:** misleading
- **Status:** fixed in `src/features/fundamentals/RequirementsLab.tsx` - level 0 is the relaxed baseline and only shows while the slider is at 0; levels 1+ still accumulate. Max now shows 35 lines, none contradictory.

### F06-002 - Capacity lab "5-year storage" card ignores the Retention slider

- **Area:** Capacity Estimation Playground, summary cards
- **Clicked:** set Retention to 1 year
- **Expected:** the card reports the retention the learner chose
- **Happened:** the card still said "5-YEAR STORAGE" while showing the 1-year number (6.80 TB at 1 year x 5 copies). The label was hard-coded.
- **Severity:** bug
- **Status:** fixed in `src/features/fundamentals/CapacityLab.tsx` - label is now `{retentionYears}-year storage`.

### F06-003 - Capacity lab calls copies "replicas"

- **Area:** Capacity Estimation Playground, storage card and Replication factor slider
- **Clicked:** Replication factor 1, then 5
- **Expected:** replication factor N means N copies of the data
- **Happened:** the card said "including 5 replicas" (a junior reads that as primary + 5) and the slider said "1 copies".
- **Severity:** misleading
- **Status:** fixed in `src/features/fundamentals/CapacityLab.tsx` - "including replication (5 copies)", "1 copy".

### F06-004 - Capacity lab warns about write partitioning on total traffic, not writes

- **Area:** Capacity Estimation Playground, insight
- **Clicked:** 10M DAU, 20 req/user, 1% writes, 5x peak (11,574 peak req/s, 116 peak writes/s)
- **Expected:** "a single database primary will not absorb the writes" only when the writes are high
- **Happened:** the warning fired on `peakQps > 10000` - so 116 writes/sec was told to partition early, while the lab itself says reads scale with replicas. At minimum settings the other branch said "fits comfortably on a small fleet" even at 46M req/s.
- **Severity:** misleading
- **Status:** fixed in `src/features/fundamentals/CapacityLab.tsx` - the condition uses peak writes/sec (same 10,000 threshold) and both branches now quote the peak write rate.

### F06-005 - Capacity lab rounds small rates to 0

- **Area:** Capacity Estimation Playground, steps and metrics
- **Clicked:** every slider to its minimum (1k DAU, 1 req/user)
- **Expected:** a small but non-zero rate
- **Happened:** "0 req/sec", "At 0 peak requests/sec you need 1 server", and step 9 read "0 req/sec x 0.1 KB = 1.19 B/sec" - arithmetic that contradicts itself.
- **Severity:** misleading
- **Status:** fixed in `src/features/fundamentals/CapacityLab.tsx` - rates under 10/sec show two decimals ("0.01 req/sec").

### F06-006 - Vertical scaling tier ladder skips the event log and the downtime warning

- **Area:** Vertical Scaling lab, "Tier ladder" card
- **Clicked:** at 3,000 req/s on Small, clicked the XLarge card
- **Expected:** logged like the Upgrade button: "Upgraded to XLarge" + "Restart required - this is downtime"
- **Happened:** nothing logged for the resize; the log went straight from "Downgraded to Small" to "Back under capacity", which contradicts the metrics.
- **Severity:** bug
- **Status:** fixed in `src/features/scaling/VerticalScalingLab.tsx` - ladder clicks go through `selectTier`, which logs upgrade (with restart warning) or downgrade.

### F06-007 - Vertical scaling says "there is headroom" past the knee

- **Area:** Vertical Scaling lab, insight
- **Clicked:** XLarge at 3,000 req/s (78% CPU, latency 99 ms, 3x base)
- **Expected:** the text agrees with the latency the node shows
- **Happened:** "At 78% CPU there is headroom ... latency barely moves until utilization passes about 70%" - the lab uses `kneeAt: 0.6` and the same paragraph says planning targets 60-70%.
- **Severity:** misleading
- **Status:** fixed in `src/features/scaling/VerticalScalingLab.tsx` - above 60% it says the machine is past the knee and requests are queueing; knee text says 60%.

### F06-008 - Model latency and capacity metrics carry the wrong hover hint

- **Area:** Vertical, Horizontal and Auto Scaling labs, Live metrics
- **Clicked:** hovered Latency and Capacity / Pool capacity
- **Expected:** CLAUDE.md: a `computeLoad` number must say it is a simplification
- **Happened:** Latency fell back to the shared hint "measured over the recent window" (it is computed, not measured). Capacity used the `utilization` key and so showed "Incoming load divided by capacity. Above 100%..." on a req/s number.
- **Severity:** misleading
- **Status:** fixed in `src/features/scaling/VerticalScalingLab.tsx`, `HorizontalScalingLab.tsx`, `AutoScalingLab.tsx` - explicit hints ("Computed by a simplified queueing model, not measured."; capacity = servers x per-server req/s). Same fix for StatelessLab "Extra latency" ("An illustrative figure, not measured.").

### F06-009 - Horizontal scaling writes every add/remove to the event log twice

- **Area:** Horizontal Scaling lab, Add server / Remove
- **Clicked:** Add server x7, Remove x7
- **Expected:** one log line per click
- **Happened:** every line appeared twice ("Removed Server 8 ..." x2). `log()` was called inside the `setServers` updater, which StrictMode runs twice.
- **Severity:** bug
- **Status:** fixed in `src/features/scaling/HorizontalScalingLab.tsx` - log outside the updater.

### F06-010 - Horizontal scaling server cards overflow the canvas and clip their titles

- **Area:** Horizontal Scaling lab, diagram
- **Clicked:** any server count; then 8 servers
- **Expected:** boxes inside the canvas, "Server 8" readable
- **Happened:** the card grows to 151px against a 120px box, so every server's bottom edge was at y=481 on a 475px canvas (status line clipped). At 8 servers (107px wide) every title was truncated ("Server 1" scrollWidth > clientWidth).
- **Severity:** bug
- **Status:** fixed in `src/features/scaling/HorizontalScalingLab.tsx` - box h 152 at y 320, canvas 490; server cards go `compact` below 130px width. Measured: no overflow, no truncation, 1-8 servers, both traffic extremes. Auto Scaling measured clean up to 8 instances, no change.

### F06-011 - Horizontal scaling insight at one server: "losing one of 1 servers costs 100%"

- **Area:** Horizontal Scaling lab, insight
- **Clicked:** 1 server, traffic 100
- **Expected:** a sentence that makes sense for one server
- **Happened:** "losing one of 1 servers now costs 100% of capacity instead of the whole service" - 100% is the whole service.
- **Severity:** misleading
- **Status:** fixed in `src/features/scaling/HorizontalScalingLab.tsx` - one server gets its own sentence (single point of failure).

### F06-012 - Single load balancer box fronts the whole system

- **Area:** Horizontal Scaling, Auto Scaling and Stateless labs, Load Balancer node
- **Clicked:** looked at the diagram
- **Expected:** CLAUDE.md: anything that fronts the whole system is redundant in reality; label it (`2 nodes`) rather than leave a single box
- **Happened:** a lone "Load Balancer" box, in labs whose lesson is removing single points of failure.
- **Severity:** misleading
- **Status:** fixed in `HorizontalScalingLab.tsx` ("round robin, 2 nodes"), `AutoScalingLab.tsx` ("auto scaling group, 2 nodes"), `StatelessLab.tsx` ("round robin, 2 nodes" / "sticky by user, 2 nodes"). Measured: no subtitle truncation.

### F06-013 - Auto scaling ignores a lowered "Max instances"

- **Area:** Auto Scaling lab, Max instances slider
- **Clicked:** let the fleet reach 8, set Max instances to 2
- **Expected:** the fleet drops to 2, like an auto scaling group's max size
- **Happened:** stayed at "Instances 8/8" with max 2 until CPU happened to fall below the scale-in threshold.
- **Severity:** bug
- **Status:** fixed in `src/features/scaling/AutoScalingLab.tsx` - the ticker terminates instances above the max and logs "Fleet above max of 2 - terminating api-8". Verified: 8/8 -> 2/2.

### F06-014 - Stateless lab: local sessions converge to 100% success

- **Area:** Stateless lab, "Local sessions" mode
- **Clicked:** Local sessions, 30 req/s, wait a few seconds; kill Server 1
- **Expected:** round robin keeps missing the session (about 1 in 3 requests finds it with 3 servers) - the lesson of the mode note
- **Happened:** every miss added the user to that server without removing the old session, so after a few seconds every server knew every user and Local showed 100% success, as good as JWT.
- **Severity:** misleading
- **Status:** fixed in `src/features/scaling/StatelessLab.tsx` - a re-login replaces the session cookie, so the user's session on other servers is dropped. Verified: ~27-33% success with 3 servers, ~41-50% with 2.

### F06-015 - Stateless lab: sticky sessions never lose a session when a server dies

- **Area:** Stateless lab, "Sticky sessions" mode
- **Clicked:** Sticky, Log all users in, Kill Server 1
- **Expected:** the users pinned to Server 1 lose their session (the mode note says so); everyone else is unaffected
- **Happened:** 100% success after the kill - a missing session was silently re-created and counted as success. Also pinning was `hash % healthy.length`, so a kill reshuffled users on the surviving servers too.
- **Severity:** misleading
- **Status:** fixed in `src/features/scaling/StatelessLab.tsx` - the balancer keeps a user on the server holding their session and only re-pins users whose server is gone; that request counts as lost ("SESSION NOT FOUND - re-pinned here, user logs in again"). Verified: exactly Server 1's users lost (97.9% after the kill).

### F06-016 - Stateless lab: all servers down still reads as success

- **Area:** Stateless lab, Failure injection
- **Clicked:** Kill Server 1, 2 and 3
- **Expected:** every request fails
- **Happened:** arrivals were skipped, so nothing was counted - "Successful 33.3%" (from earlier traffic) frozen while 0/3 servers were up.
- **Severity:** bug
- **Status:** fixed in `src/features/scaling/StatelessLab.tsx` - requests with no healthy server count as failed ("NO HEALTHY SERVER - request failed", failure particle to the LB); the metric is renamed "Lost / failed" with a matching hint. Verified: 0.0% success.

### F06-017 - Stateless lab: Redis box pokes out of the canvas

- **Area:** Stateless lab, "Shared store" diagram
- **Clicked:** Shared store
- **Expected:** Redis card inside the canvas
- **Happened:** card renders 91px tall in a 76px box; bottom at 511 on a 510px canvas.
- **Severity:** bug
- **Status:** fixed in `src/features/scaling/StatelessLab.tsx` - box y 410, h 92.

### F06-018 - Horizontal scaling traffic can exceed the largest pool

- **Area:** Horizontal Scaling lab, Traffic slider vs Add server cap
- **Clicked:** traffic 5,000, add servers up to 8
- **Expected:** unclear - the insight says "adding a server divides the load"
- **Happened:** 8 x 400 = 3,200 req/s, so above 3,200 there is no way to stop errors (36% at 5,000 with 8 servers).
- **Severity:** judgment-call
- **Status:** decided in #16 (pick A) - fixed in `src/features/scaling/HorizontalScalingLab.tsx`

### F06-019 - Requirements lab complexity is 100 with nothing selected

- **Area:** Requirements lab, Complexity score
- **Clicked:** all sliders to max, unchecked every requirement
- **Expected:** unclear
- **Happened:** "Requirements 0 ... Complexity score 100" while the scope summary says "Nothing selected - there is nothing to design". The score is mostly driven by the non-functional sliders.
- **Severity:** judgment-call
- **Status:** decided in #16 (pick A) - fixed in `src/features/fundamentals/RequirementsLab.tsx`

### F06-020 - Stateless lab draws healthy Redis links in the danger colour

- **Area:** Stateless lab, "Shared store" diagram
- **Clicked:** Shared store
- **Expected:** healthy wiring in a neutral or ok tone; red is the failure colour in the particle legend
- **Happened:** server -> Redis edges use `tone: 'danger'` while Redis is up (muted and dashed when it is down). The shape and text labels still carry status, so this is not colour-only status.
- **Severity:** judgment-call
- **Status:** decided in #16 (pick A) - fixed in `src/features/scaling/StatelessLab.tsx`
