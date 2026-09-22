# 03 - Sweep the concept and category pages

Findings for ticket 03 - Sweep the concept and category pages. Format and severities: see `README.md`.

<!-- Add findings below as ### F<nn>-<nnn> blocks. -->

### F03-001 - Sidebar "What it costs" / "What you gain" show one option's trade-offs as the concept's

- **Area:** Concept page, right column cards (`ConceptBody` in `ConceptPage.tsx`)
- **Clicked:** opened `/concepts/stateless-applications`, `/concepts/load-balancing`, `/concepts/rate-limiting` and read the right column
- **Expected:** the cards describe the concept, or say which option they describe (CLAUDE.md: trade-off first, gains and costs of X)
- **Happened:** the cards read `concept.tradeoffs[0]` without naming it. On Stateless Applications that is "Sticky sessions", so the page says the costs of going stateless are "Losing a server logs out its users" and the gains are "Keeps local in-memory caches warm" - the opposite of the lesson. Load Balancing listed Round robin's costs as the costs of load balancing; 42 of 106 concepts have more than one approach and were affected.
- **Severity:** misleading
- **Status:** fixed in `src/features/concept/ConceptPage.tsx` - when a concept has several approaches, the cards are labelled with the approach they come from ("Sticky sessions: what it costs"); concept-level `advantages` keep the plain "What you gain" label. Verified in the browser on the four concepts above.

### F03-002 - "In one line" card ends in four dots when the sentence is truncated

- **Area:** Concept page, "In one line" card
- **Clicked:** opened `/concepts/vertical-scaling`
- **Expected:** a truncated sentence ends in "..."
- **Happened:** "...while keeping exactly one machi...." - `short()` adds "..." and the JSX then appended a period
- **Severity:** bug
- **Status:** fixed in `src/features/concept/ConceptPage.tsx` (period only added when the text was not truncated). Verified in the browser.

### F03-003 - 70 of 106 concepts have no quiz and 12 have no trade-offs

- **Area:** Concept data (`src/data/concepts/*.ts`), seen as missing Quiz / Trade-offs tabs
- **Clicked:** opened every concept page; checked `ALL_CONCEPTS` for `quiz` and `tradeoffs`
- **Expected:** CLAUDE.md says every concept must answer its trade-offs, and quizzes are scenario-based
- **Happened:** no crash - the tabs are simply absent - but e.g. `http-https`, `single-point-of-failure`, `sla`, `circuit-breaker-pattern` have no Trade-offs tab, and most concepts have no Quiz, so they can only be completed with "Mark as complete"
- **Severity:** judgment-call
- **Status:** fixed in #20 - decided in #16 (pick A); the 11 concepts without trade-offs now have 2-3 each (the finding said 12, a recount found 11), and `npm run check:content` fails the build on a concept with no trade-offs or a trade-off with empty gains/costs; quizzes stay optional

### F03-004 - Load Balancing step-by-step shows Server 2 "Down" from step 1

- **Area:** Concept page, Step by step tab on `/concepts/load-balancing` (visual spec in `src/data/visuals`)
- **Clicked:** opened the Step by step tab, looked at step 1 "One address for clients"
- **Expected:** Server 2 turns Down at step 3 "Server 2 fails checks"
- **Happened:** Server 2 is drawn Down (0% CPU) in every step, so the story is told out of order. The spec sets a static `status` on the node; `SequenceFlow` has no per-step status.
- **Severity:** misleading
- **Status:** decided in #16 (pick B) - fixed in `src/data/visuals/scaling.ts` (step 3 caption is now "Server 2 already failed checks", so the static Down status is true from step 1)

### F03-005 - Lab tab is called "Interactive lab", docs and ticket call it "Interactive Demo"

- **Area:** Concept page tab bar
- **Clicked:** opened any concept with a lab
- **Expected:** CLAUDE.md ("A new interactive lab") says the lab appears on the concept page's "Interactive Demo" tab
- **Happened:** the tab reads "Interactive lab", matching the header badge, sidebar card and the Labs page
- **Severity:** judgment-call
- **Status:** decided in #16 (pick B) - no code change; `CLAUDE.md` now says "Interactive lab"

## Verified with no finding (headless Chromium, `scratchpad/t03/*.cjs`)

- All 106 concept pages load with no console errors; every page has Diagram and Full explanation tabs, Step by step exactly when the spec has steps, and the lab tab exactly on the 38 concepts that declare `lab`. Every one of those 38 lab tabs loads the registered lab.
- Diagram: particles move, Pause freezes them, Play resumes. Under `reducedMotion: 'reduce'` the diagram starts paused (button reads Play) and step-by-step holds step 1 with the request parked mid-edge.
- Step by step: auto-advances 1/4 -> 2/4 with the caption banner; clicking a step jumps to it and pauses.
- Full explanation: the per-category `deep/<category>.ts` chunk is only requested when the tab is opened; analogy, deep dive, worked example, jargon and remember cards render for one concept in each of the 13 categories; the collapsed Expandables open.
- Quiz: 1/2 with one wrong answer shows "Not quite" and does not complete the concept; 0/1 then Try again then 1/1 completes it; best score survives reload.
- Trade-offs tab shows Gain and Cost chips for every approach.
- Related links all resolve (no dangling slug in the data); `resolveRelated({related:['nope','caching']})` returns only `caching`; `/concepts/does-not-exist` shows "Concept not found".
- Visiting writes `visited`, Mark as complete and a passing quiz write `completed` in `sdi:progress:v1`, and all survive reload.
- All 13 category pages render with the right title and one link per concept, every link resolves, the difficulty filter and empty state work, `/categories/nope` shows "Section not found", and no horizontal scroll at 375px.
