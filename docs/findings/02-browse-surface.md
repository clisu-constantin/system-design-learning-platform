# 02 - Sweep the browse surface

Findings for ticket 02 - Sweep the browse surface. Format and severities: see `README.md`.

<!-- Add findings below as ### F<nn>-<nnn> blocks. -->

Swept in headless Chromium at 1400x900 and 375x812, dark and light theme. Scripts and screenshots:
`scratchpad/t02/` (`sweep.cjs`, `verify.cjs`, `light.cjs`). No console errors or page errors on any
page in this area.

Verified working (no finding): hero diagram animates (particle transforms change between frames);
all 24 home links resolve; labs index lists 22 labs, every card opens the lab with the same title,
difficulty filter gives 11/9/2/22; glossary renders 58 terms, all 58 term links open a real concept,
filter and empty state work; progress page "Concepts opened" goes 0 -> 1 after visiting a concept,
"Completed" and the top bar go 0 -> 1 / 1% after marking it complete; compare page switches all 4
pairs with two diagrams, a table and two working "Learn" links; unknown URLs (`/xyz`,
`/labs/nope`, `/concepts/nope`, `/categories/nope`, `/scenarios/nope`) all show a not-found view;
sidebar sections expand (112 links), active link highlights, mobile drawer opens and closes on
navigation; search opens with Ctrl+K, Cmd+K and `/`, `/` typed in an input stays text, Esc and
backdrop close it, Enter opens the highlighted result; theme toggle writes `sdi:theme` and survives
reload; both themes readable on home, labs, glossary, progress, compare, 404 and the search dialog.

### F02-001 - Arrow keys move the search highlight out of sight

- **Area:** CommandSearch (Ctrl+K)
- **Clicked:** Ctrl+K, typed `a`, pressed ArrowDown 20 times
- **Expected:** the list scrolls so the highlighted result stays visible, as in any command palette
- **Happened:** highlight was on result 21 of 24, below the visible part of the list; list
  `scrollTop` stayed 0, so Enter opened a result the learner could not see
- **Severity:** bug
- **Status:** fixed in `src/components/layout/CommandSearch.tsx` (active row is scrolled into view
  with `block: 'nearest'`; after the fix `scrollTop` 734 and the row is visible, ArrowUp back to 0
  also scrolls back)

### F02-002 - After clicking a suggestion chip, the keyboard stops working in search

- **Area:** CommandSearch (Ctrl+K)
- **Clicked:** Ctrl+K, clicked the `caching` suggestion chip, then pressed Esc (and ArrowDown/Enter)
- **Expected:** Esc closes the dialog, arrows and Enter drive the results
- **Happened:** the chip unmounts once results appear, focus fell to `<body>`, and the key handler
  lived only on the input - Esc, arrows and Enter all did nothing; the dialog stayed open
- **Severity:** bug
- **Status:** fixed in `src/components/layout/CommandSearch.tsx` (focus returns to the input after a
  chip click; the key handler moved to the dialog panel so Esc/arrows work wherever focus is inside
  it; Enter only opens a result when pressed in the input, so Enter on a focused chip still picks the
  chip). Also clamped ArrowDown on an empty result list, which used to set the highlight to -1.
  Re-verified: focus lands on the input, ArrowDown + Enter opened `/concepts/cdn-caching`, Esc closes.

### F02-003 - Progress page cannot be reached on a phone

- **Area:** TopBar
- **Clicked:** opened the app at 375px wide, looked for a way to `/progress` (top bar, sidebar drawer)
- **Expected:** the progress dashboard is reachable at every width
- **Happened:** the only shell link to it (the top bar progress pill) was `hidden sm:flex`, and the
  sidebar has no Progress entry, so below 640px the page was unreachable (the home "See details" link
  only appears after something is completed)
- **Severity:** bug
- **Status:** fixed in `src/components/layout/TopBar.tsx` (pill shown at every width; it fits beside
  search and the theme toggle at 375px). Re-verified: pill visible at 375px and opens `/progress`.

### F02-004 - Home hero and compare diagrams clip nodes on narrow screens

- **Area:** HomePage hero, ComparePage diagrams, FlowVisual
- **Clicked:** opened `/` and `/compare` at 375px wide
- **Expected:** the whole diagram is visible or can be scrolled to (CLAUDE.md: the canvas "scrolls
  horizontally on small screens"; FlowVisual auto-fits, "pass `zoom` only to pin a scale")
- **Happened:** both pages pinned the scale (`zoom={0.9}` / `zoom={0.62}`), so on a phone the hero
  showed only half the system (API 3 and half of Users/Load Balancer cut off) and the compare card
  cut off the Database node. Even with auto-fit, FlowVisual clamps at 0.5x (380px) and clipped the
  last ~45px with `overflow: hidden` and no way to scroll
- **Severity:** bug
- **Status:** fixed in `src/features/home/HomePage.tsx`, `src/features/compare/ComparePage.tsx`
  (dropped the pinned zoom, so the diagrams fit their card: 766px / 502px on desktop, no scrollbar)
  and **shared file** `src/components/architecture/FlowVisual.tsx` (the fit wrapper, in `FlowVisual`
  and `SequenceFlow`, is now `overflow-x-auto` and sized to the scaled width, so below the 0.5x floor
  the diagram scrolls sideways inside its card instead of clipping; the page itself still has no
  horizontal scroll at 375px).

### F02-005 - Compare Mode offers fixed pairs, not a free choice of two concepts

- **Area:** ComparePage
- **Clicked:** looked for a way to pick any two concepts to compare
- **Expected:** the ticket says "select two concepts"; the page offers 4 curated pairs
- **Happened:** 4 hand-written comparisons, each with authored rows and verdict; they all work
- **Severity:** judgment-call
- **Status:** open. Question: should Compare Mode (a) stay a set of curated pairs whose rows are
  written trade-offs, or (b) let the learner pick any two concepts and build the table from their
  `tradeOffs` data? I would pick (a): the value is in the authored dimension-by-dimension rows, and an
  auto-built table of two unrelated concepts would teach nothing. Treat the acceptance box as met.

### F02-006 - Compare Mode has a second, duplicate pair selector with truncated labels

- **Area:** ComparePage (bottom of page)
- **Clicked:** scrolled to the bottom of `/compare`
- **Expected:** one way to pick a comparison
- **Happened:** a segmented control repeats the four pair buttons from the top, labelled only with the
  first half of each title: "Vertical", "Monolith", "Strong", "Synchronous". Works, but "Strong" alone
  does not say strong what
- **Severity:** judgment-call
- **Status:** open. Question: (a) remove the bottom selector, or (b) keep it as a "next comparison"
  shortcut with full titles? I would pick (a) - the top buttons are always one scroll away.

### F02-007 - First visit follows the OS theme, while CLAUDE.md calls dark the default

- **Area:** ThemeProvider / `public/theme-init.js`
- **Clicked:** fresh profile (no `sdi:theme`) with the OS set to light
- **Expected:** CLAUDE.md: "Dark mode is the default and is the theme diagrams are tuned for"
- **Happened:** with no saved choice the app follows `prefers-color-scheme`, so a light-OS learner
  starts in light mode. Both paths agree (init script and provider), and light is readable
- **Severity:** judgment-call
- **Status:** open. Question: should first paint (a) follow the OS preference, or (b) always start
  dark until the learner toggles? I would pick (a) - it is the least surprising and light is readable;
  CLAUDE.md could say "dark when the OS does not ask for light".
