# 05 - Sweep scenarios and evolution

Findings for ticket 05 - Sweep scenarios and evolution. Format and severities: see `README.md`.

<!-- Add findings below as ### F<nn>-<nnn> blocks. -->

Swept in headless Chromium (dark and light theme, 375 / 1024 / 1280 / 1400 / 1920 px wide). Scripts
and screenshots: `scratchpad/t05/`.

Acceptance summary:
- Scenarios index lists 8 cards; all 8 open, all 6 tabs of each render text, no empty element, no
  `undefined`/`NaN`, every concept chip resolves (5-6 per scenario), `/scenarios/nope` shows
  "Scenario not found". No console errors.
- Evolution walks 1 -> 8 with Next, 8 -> 1 with Previous (both disabled at the ends), the stage rail
  jumps directly. No console errors.
- Every stage: no node overlap, no node outside the 960x540 canvas, no truncated title or subtitle
  (measured `scrollWidth` vs `clientWidth` of each `.truncate` element) after F05-001/F05-002.
- Asymmetric wiring: no stage declares `asymmetric`, and none needs to. `check:visuals` finds no
  replica group with differing wiring (API 1/2/3 in stages 3-4, Replica 1/2 in stage 5 are
  identical). Load Balancer vs Standby LB (stage 3) and the stage 8 services are roles, not
  replicas - see F05-012 for the standby.

### F05-001 - Stage 7 "Message Queue" badge title is truncated

- **Area:** /evolution, stage 7
- **Clicked:** Next stage x6; measured the title span of every node carrying the `new` badge
- **Expected:** "Message Queue" shown in full (issue acceptance box, CLAUDE.md badge rule)
- **Happened:** title `scrollWidth` 94 > `clientWidth` 89 - rendered as "Message Qu..." while
  `npm run check:visuals` passed
- **Severity:** bug
- **Status:** fixed in `src/features/evolution/stages.ts` (box 195 -> 210 wide, x 680 -> 675); now 94/94

### F05-002 - Stage 8 "Payments DB" badge title is truncated

- **Area:** /evolution, stage 8
- **Clicked:** jumped to stage 8, same measurement as F05-001
- **Expected:** "Payments DB" in full
- **Happened:** `scrollWidth` 78 > `clientWidth` 69 - rendered as "Payments..."
- **Severity:** bug
- **Status:** fixed in `src/features/evolution/stages.ts` (box 175 -> 195 wide); now 78/78

### F05-003 - check:visuals under-estimates title width, so it missed F05-001 and F05-002

- **Area:** `scripts/check-visuals.mjs` (`minWidth`, 6.4 px per title character)
- **Clicked:** `npm run check:visuals` before the fixes above
- **Expected:** the check fails on a badge title that truncates (CLAUDE.md: "trust it over eyeballing")
- **Happened:** it passed. Measured title widths in the browser: "Message Queue" 94 px for 13
  characters (7.2 px/char), "Payments DB" 78 px for 11 (7.1 px/char), "Load Balancer" 84 px
  (6.5 px/char). Titles with many capitals exceed the 6.4 px estimate, so the check is not a
  reliable guarantee for badge nodes
- **Severity:** bug
- **Status:** decided in #16 (pick A) - fixed in `scripts/check-visuals.mjs` (per-letter title width table measured in headless Chromium), `src/data/visuals/data-performance.ts` (partitioning `query` 205 -> 210 px)

### F05-004 - Evolution diagram is cut off at every desktop width; stage 7 hides its new components

- **Area:** /evolution, diagram card
- **Clicked:** opened /evolution at 1280, 1400 and 1920 px wide; went to stage 7
- **Expected:** the whole architecture, including the component the stage introduces, is visible
- **Happened:** the diagram column is 560-776 px wide next to the 360 px right column (and
  `max-w-6xl` caps it even at 1920), but the canvas is a fixed 960 px. At 1400 px "Message Queue",
  "Workers x4", "API 3" and "Standby LB" sat off to the right behind a macOS overlay scrollbar
  that never shows - the stage about queues showed no queue. Separately, below `xl` the grid had
  no explicit column, so its track grew to the 960 px min-content width and the card clipped
  instead of scrolling on a phone
- **Severity:** bug
- **Status:** fixed in `src/features/evolution/EvolutionPage.tsx` - the stage now fits its column
  like `FlowVisual` does (scale clamped 0.6x-1x, never enlarged), and `grid-cols-1` lets the
  wrapper scroll sideways below 0.6x (375 px phone). Verified: no node outside the visible area
  at 1024/1280/1400/1920; at 375 the diagram scrolls, page does not. See F05-011 for the text size

### F05-005 - Queue and event traffic is drawn as "Warning / retry"

- **Area:** /evolution, stages 7 and 8, particle layer and legend
- **Clicked:** stage 7, watched the API -> Message Queue -> Workers edges, read the legend
- **Expected:** async jobs shown as normal work - the stage is teaching that the queue is the
  healthy path
- **Happened:** every edge with `tone: 'warn'` spawned yellow triangles, which the legend names
  "Warning / retry". A junior reads "every job put on the queue is a warning or a retry"
- **Severity:** misleading
- **Status:** fixed in `src/features/evolution/EvolutionPage.tsx` - only edges into a cache node
  draw cache-hit diamonds, everything else is a request; the legend drops "Warning / retry"

### F05-006 - The standby load balancer is shown carrying live traffic

- **Area:** /evolution, stage 3
- **Clicked:** stage 3, watched the dashed "on failover" edge Clients -> Standby LB
- **Expected:** a hot standby carries nothing until the active balancer fails (its own subtitle:
  "takes over on failure")
- **Happened:** request particles flowed down the failover edge continuously, about 1 in 8 of all
  particles, as if the two balancers shared load
- **Severity:** misleading
- **Status:** fixed in `src/features/evolution/stages.ts` (new `standby` flag on the node) and
  `src/features/evolution/EvolutionPage.tsx` (no particles on edges into a standby node)

### F05-007 - Stage 1 says "Nothing is wrong yet" under red 98% CPU and 8% errors

- **Area:** /evolution, stage 1, "The problem" card vs the metric chips
- **Clicked:** opened /evolution
- **Expected:** the problem card and the metrics describe the same moment
- **Happened:** the card said "Nothing is wrong yet", while the chips beside it showed CPU 98%,
  p95 820 ms and Errors 8%, all red - the chips show the post-growth state the question describes
- **Severity:** misleading
- **Status:** fixed in `src/features/evolution/stages.ts` - problem text now says the single
  server was fine until traffic grew and it hit 98% CPU

### F05-008 - YouTube bandwidth treats views per second as concurrent viewers

- **Area:** /scenarios/youtube, tab "2. Capacity", Bandwidth row
- **Clicked:** opened the scenario, Capacity tab
- **Expected:** concurrent streams = starts per second x average watch time (the Netflix scenario
  in the same app uses 10M concurrent x 4 Mbps = 40 Tbps)
- **Happened:** "58,000 concurrent x 3 Mbps = ~174 Gbps" - 58,000 is views per second, not
  concurrent viewers. The answer is ~300x too small and teaches a junior that arrival rate equals
  concurrency; it also claimed YouTube needs 230x less bandwidth than Netflix
- **Severity:** misleading
- **Status:** fixed in `src/data/scenarios/core.ts` - "58,000 starts/sec x ~300 s watched x 3 Mbps
  = ~17M concurrent, ~50 Tbps (CDN, not origin)"

### F05-009 - URL shortener cache working set formula does not produce its result

- **Area:** /scenarios/url-shortener, tab "2. Capacity", Cache working set row
- **Clicked:** Capacity tab, did the arithmetic
- **Expected:** the result is what the formula gives
- **Happened:** "20% of daily reads x 500 B = Comfortably a few GB". 4,000 reads/sec x 86,400 =
  345M reads/day; x 20% x 500 B = ~35 GB, an order of magnitude more than "a few GB"
- **Severity:** misleading
- **Status:** fixed in `src/data/scenarios/core.ts` - "345M reads/day x 20% x 500 B = ~35 GB - fits
  in one Redis node". All other capacity rows in the 8 scenarios were recomputed and are right

### F05-010 - Evolution animation ignores reduced motion and never pauses

- **Area:** /evolution, `useTicker(true, ...)` in `EvolutionPage.tsx`
- **Clicked:** opened /evolution in a context with `reducedMotion: 'reduce'`; scrolled the diagram
  off screen
- **Expected:** unclear. CLAUDE.md requires `FlowVisual` and `SequenceFlow` to start paused under
  `prefers-reduced-motion`, show Pause/Play and stop off screen, but does not mention this page
- **Happened:** particles run permanently: under reduced motion, off screen, with no pause control
- **Severity:** judgment-call
- **Status:** decided in #16 (pick A) - fixed in `src/features/evolution/EvolutionPage.tsx` and
  `src/components/architecture/FlowVisual.tsx` (shared: `useAutoplay` and `PlayPauseButton` now exported)

### F05-011 - At 1280-1400 px the fitted evolution diagram has small text

- **Area:** /evolution after F05-004
- **Clicked:** opened /evolution at 1280 and 1400 px wide
- **Expected:** readable node titles and the full diagram
- **Happened:** the full diagram is now visible, but at 0.6x (1280) and 0.7x (1400) the 12 px
  titles render at about 7-8 px
- **Severity:** judgment-call
- **Status:** decided in #16 (pick B) - fixed in `src/features/evolution/EvolutionPage.tsx`

### F05-012 - Standby LB has no wiring to the API servers

- **Area:** /evolution, stage 3
- **Clicked:** stage 3, compared the Load Balancer and Standby LB edges
- **Expected:** a junior can see how the standby would serve traffic after it takes over
- **Happened:** Load Balancer -> API 1/2/3 are drawn; Standby LB has only the dashed "on failover"
  edge from Clients and no edges onward, so the diagram does not show what the standby reaches.
  The check does not flag it (different titles, not replicas by its rule)
- **Severity:** judgment-call
- **Status:** decided in #16 (pick A) - fixed in `src/features/evolution/stages.ts` and
  `src/features/evolution/EvolutionPage.tsx` (no particles on any edge touching a standby node)
