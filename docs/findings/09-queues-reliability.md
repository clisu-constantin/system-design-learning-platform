# 09 - Sweep the queue, rate limiting and reliability labs

Findings for ticket 09 - Sweep the queue, rate limiting and reliability labs. Format and severities: see `README.md`.

<!-- Add findings below as ### F<nn>-<nnn> blocks. -->

Verified with headless Chromium (Playwright) against the dev server. Scripts and screenshots:
`scratchpad/t09/` (`load.cjs`, `queue.cjs`, `qw.cjs`, `rl.cjs`, `cb.cjs`, `rb.cjs`, `rb2.cjs`).
All four labs load from `/labs/<id>` and from the "Interactive lab" tab of every hosting concept
(`message-queues`, `background-workers`, `backpressure`, `producer-consumer`, `rate-limiting`,
`circuit-breaker`, `circuit-breaker-pattern`, `retry`, `exponential-backoff`) with no console errors.
Every slider was pushed to min and max; no metric showed NaN, Infinity or a negative time.

Ticket extras, checked:
- Circuit breaker reaches CLOSED -> OPEN -> HALF-OPEN -> OPEN/CLOSED from the controls ("Break the
  dependency", "Recover it", cooldown 1 s): all three states appear in the badge, the state machine
  card and the event log. See F09-011 for how briefly HALF-OPEN is on screen.
- Backoff delays grow: exponential at base 1000 ms shows waits of 1.00 s, 2.00 s (t+1.12 s, t+3.24 s)
  in the timeline, and 5 s / 10 s / 20 s in the sketch at base 5000 ms.
- Producing faster than workers consume grows the queue (500 msg/s in, 1 msg/s out: depth climbs to
  the 500 bound, then every refused message is counted in Rejected, on the Producer node and in a
  "Queue full ... backpressure (429)" log line; unbounded it grows past 1,900). Nothing is dropped silently.
- The retry visual spec (`src/data/visuals/systems.ts`, `retry`) states its asymmetry:
  "The first two attempts fail and the third succeeds - the sequence is the lesson."

### F09-001 - Queue lab clips worker titles at 8 workers

- **Area:** Queue lab (`/labs/queue`), worker row
- **Clicked:** Workers stepper up to 8
- **Expected:** every box reads "Worker 1" ... "Worker 8"
- **Happened:** the runtime width was 106px; the title span needs 53-54px but got 52px, so Workers 2-8
  rendered as "Worke..." (scrollWidth 54 / clientWidth 52). The CLAUDE.md sizing formula
  (52 + 6.4 per char = 103px) under-estimates this box by a few px. Worker 1 fit only because "1" is narrow.
- **Severity:** bug
- **Status:** fixed in `src/features/queues/QueueLab.tsx` (min width 110px, 8px gap; a row of 8 is
  936px, inside the 960px canvas). Re-measured 3-8 workers: no title truncated.

### F09-002 - Queue lab "Consumed" metric shows capacity, not consumption

- **Area:** Queue lab, metrics strip and "Production vs consumption" chart
- **Clicked:** Producer rate to 0 msg/sec, waited for the queue to drain
- **Expected:** a metric called "Consumed" drops to 0 when nothing arrives
- **Happened:** "Consumed 60 msg/s" stayed on while producing 0 msg/s with an empty queue - the value
  is workers x per-worker rate (the hint already said "Total processing capacity"). A junior reads it
  as throughput.
- **Severity:** misleading
- **Status:** fixed in `src/features/queues/QueueLab.tsx` (label "Capacity", chart title
  "Production vs worker capacity", series "Capacity/sec").

### F09-003 - Lowering Max depth below the current depth leaves the queue over its bound

- **Area:** Queue lab, Bounded queue toggle + Max depth slider
- **Clicked:** Bounded queue off, let depth reach ~2,000, Bounded queue on, Max depth to 50
- **Expected:** unclear - that is the question
- **Happened:** the node says "bounded at 50" while depth reads 2,030; new messages are rejected and
  the backlog drains at the worker rate.
- **Severity:** judgment-call
- **Status:** decided in #16 (pick A) - fixed in `src/features/queues/QueueLab.tsx`

### F09-004 - Rate limiting "Send a burst" is logged but not counted

- **Area:** Rate limiting lab (`/labs/rate-limiting`), "Send a burst of N" button, all four algorithms
- **Clicked:** Fixed Window, limit 10, "Send a burst of 20"
- **Expected:** Allowed / Rejected / Reject rate, the chart and the diagram reflect the 20 requests
- **Happened:** the log said "8 allowed, 12 rejected with 429" but Allowed went 31 -> 32 and Rejected
  14 -> 15 (only the normal traffic of that frame); no particles moved. The burst only changed the
  algorithm internal state (tokens, window count). For Leaky Bucket the log also said "allowed" for
  requests that were only queued.
- **Severity:** bug
- **Status:** fixed in `src/features/security/RateLimitingLab.tsx` (burst adds to the counters and
  rate counters, animates up to 12 particles along the real edges, leaky bucket logs "queued" and
  counts them as allowed when they drain). Re-checked: Fixed Window burst 27 -> 37 allowed,
  13 -> 24 rejected, matching "10 allowed, 10 rejected".

### F09-005 - Leaky bucket rejections travel an edge that does not exist

- **Area:** Rate limiting lab, Leaky Bucket, limit 5, client rate 80 req/sec
- **Clicked:** selected Leaky Bucket, pushed the client rate to max
- **Expected:** rejected requests reach the limiter and leave on its red "429" edge, like the other algorithms
- **Happened:** rejected particles were routed `client -> rejected` directly, a straight line with no
  wire that passes under the Rate Limiter card - the diagram showed crosses emerging from under the
  card, as if the 429 did not come from the limiter (`scratchpad/t09/rl-leaky.png`).
- **Severity:** bug
- **Status:** fixed in `src/features/security/RateLimitingLab.tsx` (route `client -> limiter -> rejected`;
  `scratchpad/t09/rl-leaky2.png`).

### F09-006 - Circuit breaker "Recent calls" strip grows without limit while OPEN

- **Area:** Circuit breaker lab (`/labs/circuit-breaker`), Recent calls card
- **Clicked:** Cooldown 30 s, Request rate 60, "Break the dependency", waited 8 s
- **Expected:** the strip keeps the newest ~40 calls
- **Happened:** 496 markers were rendered and still growing - only the pass-through branch trimmed the
  list, the two short-circuit branches never did. At 60 req/s and a 30 s cooldown that is 1,800 DOM
  nodes re-rendered 30 times a second.
- **Severity:** bug
- **Status:** fixed in `src/features/reliability/CircuitBreakerLab.tsx` (trimmed to 40 in every branch;
  re-checked: 40 markers).

### F09-007 - Disabling the breaker while OPEN keeps a hidden OPEN state

- **Area:** Circuit breaker lab, "Circuit breaker" toggle
- **Clicked:** "Break the dependency" until OPEN (cooldown 30 s), toggle breaker off, failure rate to 0%, toggle on
- **Expected:** a disabled breaker has no state; turning it back on starts CLOSED
- **Happened:** while disabled the metric said CLOSED but the insight said "Cooldown remaining: 19.1s.
  Failing here costs about 2 ms instead of 2.00 s" and the rolling-window card showed a cooldown
  countdown; turning the breaker back on resumed OPEN and short-circuited a healthy dependency.
- **Severity:** bug
- **Status:** fixed in `src/features/reliability/CircuitBreakerLab.tsx` (turning the breaker off resets
  it to CLOSED with an empty window and logs the change). Re-checked: no cooldown text while
  disabled, re-enabled state is CLOSED.

### F09-008 - Recent calls strip carries status by colour alone

- **Area:** Circuit breaker lab, Recent calls strip and its legend
- **Clicked:** watched the strip at a 40% failure rate
- **Expected:** CLAUDE.md: "Status is never communicated by color alone"
- **Happened:** success / failure / short-circuited were same-shaped green / red / amber bars, and the
  legend used same-shaped coloured squares.
- **Severity:** bug
- **Status:** fixed in `src/features/reliability/CircuitBreakerLab.tsx` (circle / cross / triangle glyphs
  matching the particle legend, each with an accessible name; `scratchpad/t09/cb-strip.png`).

### F09-009 - Circuit breaker latency numbers are a model but read as measured

- **Area:** Circuit breaker lab, "Avg latency" metric and API Service node
- **Clicked:** hovered the Avg latency hint
- **Expected:** CLAUDE.md: say in the UI when a number could be mistaken for a measurement
- **Happened:** "Avg latency 259 ms" comes from fixed costs (60 ms success, the timeout for a failure,
  2 ms short-circuit) with nothing saying so.
- **Severity:** misleading
- **Status:** fixed in `src/features/reliability/CircuitBreakerLab.tsx` (hint now starts "Simplified model,
  not a measurement" and lists the three costs).

### F09-010 - HALF-OPEN short-circuits were missing from the latency average

- **Area:** Circuit breaker lab, Avg latency during HALF-OPEN
- **Clicked:** code path found while checking F09-006, then broke and recovered the dependency
- **Expected:** a call answered by the fallback costs 2 ms whether the breaker is OPEN or HALF-OPEN
- **Happened:** OPEN short-circuits pushed 2 ms into the rolling average, HALF-OPEN ones pushed
  nothing, so the average ignored those calls.
- **Severity:** bug
- **Status:** fixed in `src/features/reliability/CircuitBreakerLab.tsx`.

### F09-011 - HALF-OPEN is on screen for only 100-300 ms

- **Area:** Circuit breaker lab, breaker badge and state machine card
- **Clicked:** cooldown 1 s, "Break the dependency", sampled the state every 100 ms for 8 s; then "Recover it"
- **Expected:** a junior can see the breaker sit in HALF-OPEN while it probes
- **Happened:** HALF-OPEN showed in 4-8 of 80 samples; each visit lasted one sample (a failed trial
  reopens on the next arrival) and recovery went HALF-OPEN -> CLOSED in ~300 ms. The trial result is
  decided the moment a call arrives, while its particle takes about 2 s to reach the Payment Service,
  so the state flips back before the trial is visibly sent. The event log does record every transition.
- **Severity:** judgment-call
- **Status:** decided in #16 (pick A) - fixed in `src/features/reliability/CircuitBreakerLab.tsx`

### F09-012 - Retry lab: turning jitter on raises the peak it claims to lower

- **Area:** Retry lab (`/labs/retry-backoff`), Jitter toggle, Peak fleet load, insight text
- **Clicked:** Exponential backoff, failure 95%, 8 attempts, jitter off, then jitter on (same at the defaults)
- **Expected:** the insight says jitter makes "peak load drop"; without jitter "they all ... retry together"
- **Happened:** jitter off: peak 2,000 req/s (1.00x); jitter on: peak 3,139 req/s (1.57x). The load model
  starts the clients spread uniformly over the first second and counts in 1 s buckets, so no-jitter
  retries are already spread, and full jitter pulls retries back into the first seconds on top of the
  initial wave. The numbers teach the opposite of the text. Immediate vs backoff is shown correctly (6.72x vs 1.00x).
- **Severity:** misleading
- **Status:** decided in #16 (pick A) - split out as #17 (correlated-failure load model); a model redesign, too large for the sweep branch

### F09-013 - Retry sketch ignores Max attempts

- **Area:** Retry lab, fixed-width sketch at the top of the stage
- **Clicked:** Max attempts to 1, then 2
- **Expected:** the sketch never shows more attempts than the cap
- **Happened:** it always drew four attempts ending in "200 OK", while the timeline beside it said
  "Gave up after 1 attempts".
- **Severity:** misleading
- **Status:** fixed in `src/features/reliability/RetryBackoffLab.tsx` (sketch built from the cap: it shows
  up to four attempts and ends in "503 (cap reached, give up)" when the cap is lower; immediate retry
  has its own footer line).

### F09-014 - Jitter shortcut stays live when jitter cannot apply

- **Area:** Retry lab, "No jitter / Full jitter" segmented control
- **Clicked:** Immediate retry, then the segmented control
- **Expected:** jitter controls are disabled for immediate retries (the Jitter toggle already is)
- **Happened:** the segmented control stayed clickable and flipped the jitter state with no visible effect.
- **Severity:** bug
- **Status:** fixed in `src/features/reliability/RetryBackoffLab.tsx` (hidden while Immediate retry is selected).

### F09-015 - Retry load chart numbers are a model but read as measured

- **Area:** Retry lab, Peak fleet load, Load amplification, "Load on the failing service" chart
- **Clicked:** read the chart and metrics
- **Expected:** CLAUDE.md: say in the UI when a number could be mistaken for a measurement
- **Happened:** capacity is a fixed 60% of the client count and every attempt fails at the slider
  rate, with nothing on screen saying so.
- **Severity:** misleading
- **Status:** fixed in `src/features/reliability/RetryBackoffLab.tsx` (chart caption adds "Simplified model,
  not a measurement ...").

### F09-016 - Circuit breaker node title cut to "Circuit ..." next to the state badge

- **Area:** Circuit breaker lab, Circuit Breaker node
- **Clicked:** Break the dependency, watched the breaker reach HALF-OPEN (found while implementing F09-011 in #16)
- **Expected:** the full title "Circuit Breaker" next to its state badge
- **Happened:** the 190px box left the title 52px beside the wide HALF-OPEN badge; it needs 88px
- **Severity:** bug
- **Status:** fixed in `src/features/reliability/CircuitBreakerLab.tsx` (box 190 -> 250px, still clear of its neighbours); title measured 88/88px in CLOSED, OPEN and HALF-OPEN in headless Chromium
