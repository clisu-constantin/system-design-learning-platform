# Behavior sweep - consolidated report

Ticket 11 (#16). Merges the nine findings files `02-*.md` to `10-*.md`. Each id below links back to
its full entry in those files.

## Verdict

**Yes, the app runs as intended.** The sweep clicked every page, all 22 labs and the playground in
a real browser. It logged 126 findings. 92 were fixed during the sweep, and 1 more (F09-016) was found and fixed
while doing #16. The other 33 were open
questions that `CLAUDE.md` did not settle. The repo owner accepted the recommended pick on every one
of them: 29 are now done on `fix/behavior-sweep` (fixed, no change needed, or a `CLAUDE.md`
rewording), and 4 were too large for this branch and are split out as #17, #18, #19 and #20. No
finding is left open. `npm run build` and `npm run lint` pass.

| Area | Findings | Fixed in sweep | Decided in #16 |
| --- | --- | --- | --- |
| 02 Browse surface | 7 | 4 | 3 |
| 03 Concept and category pages | 5 | 2 | 3 |
| 04 Playground | 13 | 9 | 4 |
| 05 Scenarios and evolution | 12 | 8 | 4 |
| 06 Fundamentals and scaling labs | 20 | 17 | 3 |
| 07 Networking and load balancing labs | 15 | 11 | 4 |
| 08 Caching and database labs | 19 | 14 | 5 |
| 09 Queue, rate limiting and reliability labs | 16 | 12 | 3 (+1) |
| 10 Distributed, architecture and observability labs | 19 | 15 | 4 |
| **Total** | **126** | **92** | **33 (+1)** |

(+1) is F09-016: the circuit breaker title was cut next to its HALF-OPEN badge. It was found and
fixed while implementing F09-011.

Duplicates merged: "diagram wider than the lab stage" came up in 05 (fixed for evolution, F05-004),
07 (noted, not logged) and 08 (F08-018). It is listed once, as F08-018.

The 92 findings fixed during the sweep are not repeated here: each one is in its area file with
its steps, severity and the file that fixed it. The sections below cover the 33 items that needed a
decision, sorted by severity, each with its question, the pick and the outcome.

## Bugs (1)

### F05-003 - `check:visuals` under-estimates title width

Context: a flat 6.4 px per character passes titles like "Message Queue" (measured 94 px) that
truncate on badge nodes. A capitals-aware estimate (7.6 / 6.2 px) still under-shoots, because width
depends on the letter. The two cases it missed are fixed by hand (F05-001, F05-002).

- **Question:** how should the check measure a title?
- **A:** a per-letter width table for the title font in `scripts/check-visuals.mjs` (accurate, about
  40 lines, may flag diagrams that pass today).
- **B:** keep 6.4 px and add a fixed safety margin (about 12 px) to badge nodes only.
- **Pick: A.** `CLAUDE.md` says "trust it over eyeballing the box"; that promise needs a check that is right.
- **Outcome:** Fixed: per-letter width table measured in Chromium; one spec widened; CLAUDE.md rule updated.

## Misleading (4)

### F03-004 - Load Balancing step-by-step shows Server 2 "Down" from step 1

- **Question:** how does the story stay in order?
- **A:** add an optional per-step node status to `SequenceFlow` (small feature in a shared component).
- **B:** change the step 3 caption to "Server 2 already failed checks", so the static diagram is true.
- **Pick: B** now (one string), A as a new issue if more specs need it.
- **Outcome:** Fixed: step 3 caption is now "Server 2 already failed checks".

### F07-006 - Load balancer latency lags up to 10 s and stays filled when nothing is served

- **Question:** fix the shared metric window?
- **A:** make `MetricWindow` in `src/simulations/engine/metrics.ts` time-based (drop samples older
  than about 2 s). Affects every lab that uses it.
- **B:** keep the engine and clear the window in this lab when the pool is empty.
- **Pick: A**, as a new issue - every lab benefits, and it needs its own sweep of the labs.
- **Outcome:** Split out as #18.

### F07-011 - CDN edges read "Down" when the CDN is only switched off

- **Question:** add a status label prop to `ArchNode`?
- **A:** add an optional `statusLabel` prop to `ArchNode` and pass "Off" here.
- **B:** leave it.
- **Pick: A.** `HealthIndicator` already takes a label; it is a small prop.
- **Outcome:** Fixed: `ArchNode` has a `statusLabel` prop; the CDN lab passes "Off".

### F09-012 - Retry lab: jitter raises the peak it claims to lower

- **Question:** fix the model or the claim?
- **A:** model a correlated failure and count in 100-250 ms buckets, so jitter visibly flattens the
  retry spikes.
- **B:** keep the model and say jitter spreads the same volume instead of lowering the peak.
- **Pick: A**, as a new issue - it is a model redesign, and it is the lesson the concept page teaches.
- **Outcome:** Split out as #17, fixed there (jitter off 8,000 req/s, jitter on 2,504 req/s at the defaults).

## Judgment calls (28)

Each one is a question with two options, the pick from the sweep agent and the outcome. Full context
in the area file.

### Browse surface

- **F02-005 - Should Compare let the learner pick any two concepts, not just fixed pairs?** A: keep
  curated pairs and count the acceptance box as met. B: let the learner pick any two. **Pick: A.** **Outcome:** No change. The acceptance box counts as met.
- **F02-006 - Should Compare keep its second pair selector, whose labels are cut?** A: remove it. B:
  keep it with full titles. **Pick: A.** **Outcome:** Fixed: bottom selector removed.
- **F02-007 - Should the first visit follow the OS theme, when CLAUDE.md says dark?** A: follow the OS
  and reword CLAUDE.md. B: always start dark. **Pick: A.** **Outcome:** CLAUDE.md reworded.

### Concept pages

- **F03-003 - What about the 70 concepts with no quiz and the 12 with no trade-offs?** A: a content
  ticket for the missing trade-offs (CLAUDE.md requires them), quizzes optional. B: accept the gaps. **Pick: A** (new issue). **Outcome:** Split out as #20 (missing trade-offs).
- **F03-005 - The tab says "Interactive lab" and the docs say "Interactive Demo" - which one changes?**
  A: rename the tab. B: change CLAUDE.md to "Interactive lab". **Pick: B.** **Outcome:** CLAUDE.md reworded.

### Playground

- **F04-010 - When stopped, cards say 0 req/s and the inspector says 800 - which is right?** A: always
  show the computed load. B: hide loads until Start. **Pick: A.** **Outcome:** Fixed.
- **F04-011 - Should a CDN absorb 85% of all traffic, API calls included?** A: keep 0.15
  pass-through. B: treat the traffic as mostly dynamic (pass-through near 1). **Pick: B.** **Outcome:** Fixed (CDN pass-through 0.9).
- **F04-012 - Should the heuristic scores be able to reach 100/100?** A: keep 0-100 with the
  disclaimer. B: cap at 90. **Pick: A.** **Outcome:** No change.
- **F04-013 - With Cache -> DB also wired, which path carries the cache misses?** A: model cache-aside
  only. B: read-through when the cache has a store. **Pick: A.** **Outcome:** Fixed.

### Scenarios and evolution

- **F05-010 - Should the evolution animation honour reduced motion and get a pause?** A: reuse
  `useAutoplay` and add Pause/Play. B: leave it. **Pick: A.** **Outcome:** Fixed.
- **F05-011 - How should the fitted evolution diagram avoid small text at 1280-1400 px?** A: keep side
  by side, smaller text (shipped). B: stack the right column below about 1700 px. **Pick: B.** **Outcome:** Fixed.
- **F05-012 - Should the standby LB be wired to the API servers?** A: add three dashed edges. B:
  leave it. **Pick: A.** **Outcome:** Fixed.

### Fundamentals and scaling labs

- **F06-018 - Should horizontal scaling traffic go past what 8 servers can take?** A: cap the slider
  at 3,200. B: keep 5,000 to show a ceiling. **Pick: A.** **Outcome:** Fixed.
- **F06-019 - What should the Requirements complexity score show with nothing selected?** A: show 0.
  B: keep 100. **Pick: A.** **Outcome:** Fixed, but with a dash in a neutral tone instead of 0: a dash
  is the app-wide "no value" mark, and a 0 would read as a real score for a scope with nothing in it.
- **F06-020 - Should healthy Redis links be drawn in the danger colour?** A: neutral colour while up.
  B: keep red. **Pick: A.** **Outcome:** Fixed (the `ok` tone while Redis is up).

### Networking and load balancing labs

- **F07-005 - How can Round Robin, Least Connections and Random be told apart?** A: a "Server 1 is
  slow" toggle. B: make Server 1 bigger under every algorithm. **Pick: A.** **Outcome:** Fixed: "Server 1 is slow" toggle. At the defaults (500 req/s) Round Robin runs the slow server at about 83% with roughly 5x the latency of the others - slow, not overloaded (it only rejects requests above 600 req/s); Least Connections sends it less work.
- **F07-014 - Should URL journey "CDN in front" ever be a hit?** A: add a CDN-hit state. B: keep it
  always a miss and relabel the toggle. **Pick: B.** **Outcome:** Fixed: toggle reads "CDN in front (always a miss)".

### Caching and database labs

- **F08-010 - Is a B-tree depth of log2(n) acceptable?** A: keep it and label it simplified. B: model
  fan-out 100. **Pick: A.** **Outcome:** Fixed.
- **F08-011 - Should the lab keep more than the last query result?** A: keep one result per mode. B:
  as now. **Pick: A.** **Outcome:** Fixed.
- **F08-016 - About 99% of replica reads are stale at the defaults - change the model or the metric?**
  A: model many keys. B: rename the metric "Reads behind the primary". **Pick: B.** **Outcome:** Fixed (metric is "Reads behind").
- **F08-017 - Should sync write latency depend on a disabled slider?** A: keep the slider enabled and
  relabel it. B: fixed sync round trip. **Pick: A.** **Outcome:** Fixed.
- **F08-018 - How should lab diagrams fit at 1440 px (also seen in 07)?** A: let `DiagramCanvas`
  scale to fit (0.5x-1x), like `FlowVisual`. B: compact each lab to about 740 px. **Pick: A** (new
  issue - it changes a CLAUDE.md rule and every lab). **Outcome:** Split out as #19.

### Queue, rate limiting and reliability labs

- **F09-003 - What happens to the excess when max depth shrinks below the queue length?** A: keep the
  excess and log it. B: drop the oldest excess. **Pick: A.** **Outcome:** Fixed (one log line).
- **F09-011 - How can HALF-OPEN stay on screen longer than 100-300 ms?** A: decide the trial call when
  its particle arrives. B: hold HALF-OPEN for 1.5 s. **Pick: A.** **Outcome:** Fixed: each trial call is decided when its particle reaches the dependency, so HALF-OPEN stays on screen for the trip (about 2 s).

### Distributed, architecture and observability labs

- **F10-006 - With two nodes neither side is a real majority - add a node or reword?** A: add a third
  node. B: change the subtitle to "majority side (2 of 3 replicas)". **Pick: B.** **Outcome:** Fixed.
- **F10-012 - Only Orders scales, so microservices fail at high traffic - scale all or cap traffic?**
  A: scale every service in proportion. B: keep Orders-only, cap traffic, count Orders -> Payments
  load. **Pick: B.** **Outcome:** Fixed (traffic capped at 2,000 req/s).
- **F10-013 - How should "Network hops" be counted, the same way in every mode?** A: count every hop
  after the entry. B: internal hops only. **Pick: A.** **Outcome:** Fixed.
- **F10-018 - What should "Async notification" off mean?** A: off = a slow synchronous notification
  span. B: rename the toggle. **Pick: A.** **Outcome:** Fixed.

## Split out as new issues

- #17 - Retry lab: model a correlated failure so jitter visibly lowers the peak (F09-012)
- #18 - Make `MetricWindow` time-based so lab latency does not lag or go stale (F07-006)
- #19 - Let `DiagramCanvas` scale to fit its container (F08-018)
- #20 - Write the missing trade-offs for 12 concepts (F03-003)

## Out of scope, by prior decision

Content rewrites, refactors and dead-code removal, visual polish, and labs for the concepts that
have none stay parked. F03-003 (missing trade-offs) is content work and goes to its own issue.
