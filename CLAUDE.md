# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this project is

**System Design Interactive** — a browser-only educational application for learning system design
through simulations the learner can manipulate. It is not a documentation site: every major concept
is backed by a lab where changing a control changes the outcome.

Non-negotiable product rule: **if a page's only possible action is scrolling, it is not finished.**

## Commands

```bash
npm install      # install dependencies
npm run dev      # dev server on http://localhost:5173
npm run build    # check:visuals + check:content + tsc -b + vite build  (this is the check that must pass)
npm run check:visuals   # diagram geometry: overlap, overflow, truncated labels
npm run check:content   # every concept has its long-form lesson, and it is not a stub
npm run preview  # serve the production build
npx tsc --noEmit -p tsconfig.app.json   # fast typecheck of src/ only
```

There is no test runner and no backend. `npm run build` is the gate: it typechecks in strict mode
(including `noUnusedLocals`/`noUnusedParameters`) and then bundles.

## Architecture

```
src/
├── app/            App, router, providers (theme, progress)
├── components/
│   ├── architecture/   DiagramCanvas, ArchNode, geometry, node kinds  <- shared visual language
│   ├── charts/         Recharts wrappers (LiveChart, DistributionBar)
│   ├── layout/         AppShell, Sidebar, TopBar, CommandSearch
│   ├── learning/       LabShell, MetricsPanel, QuizCard, TradeOffTable, RequestInspector
│   └── ui/             Button, Slider, Toggle, Tabs, Meter, Stat, ... (barrel: ui/index.ts)
├── data/           concepts/ (per category), scenarios/, glossary, categories  <- all content
│   └── concepts/deep/  long-form lesson per concept, code-split per category
├── features/       one folder per domain; labs and pages live here
├── hooks/          useRerender
├── simulations/
│   ├── engine/     useTicker, MetricWindow, RateCounter, useSeries, useEventLog, particles
│   └── models/     computeLoad (queueing model), machine tiers
├── types/          Concept, LabId, SystemNode, SimulatedRequest, ...
└── utils/          cn, math, format, search
```

### The three layers that matter

1. **Engine** (`simulations/`) — framework-agnostic simulation primitives. `useTicker` drives a
   `requestAnimationFrame` loop with a clamped `dt`; `computeLoad` turns load/capacity into CPU,
   latency and error rate.
2. **Architecture components** (`components/architecture/`) — `DiagramCanvas` renders an SVG wiring
   layer plus HTML node cards positioned on top, in a fixed 960px design space that scrolls
   horizontally on small screens. Every lab uses it, so a Redis node looks identical everywhere.
3. **LabShell** (`components/learning/`) — the chrome around every lab: toolbar, stage, control
   column, metrics strip, event log. Labs supply only their diagram and their controls.

### Simulation state pattern

Labs keep mutable simulation state in a `useRef` and call `useRerender(30)` from inside the ticker,
instead of pushing every particle position into React state. Copy this pattern in new labs — it is
what keeps 60fps animation from causing 60 array copies per second.

```tsx
const state = useRef<State>(createState());
const rerender = useRerender(30);
useTicker(running, (dt) => { /* mutate state.current */ rerender(); });
```

## How to add things

### A new concept (content only)

1. Add a `Concept` object to the right file in `src/data/concepts/<category>.ts`.
2. Add an animated diagram for it in `src/data/visuals/` - **this is the important half**. A concept
   page leads with its diagram; the prose is secondary and collapsed.
3. Add a `ConceptDepth` entry to `src/data/concepts/deep/<category>.ts`, keyed by slug. This is the
   "Full explanation" tab and `check:content` fails the build without it. See below.
4. That is it — the sidebar, search, glossary links, category page and progress tracking all read
   from `CONCEPTS`.
5. `related` slugs are resolved defensively (`resolveRelated`), so a typo degrades instead of
   crashing — but fix typos anyway.

### The long-form lesson (`src/data/concepts/deep/`)

Written for a junior who has never met the idea. Every concept has one, and the shape is fixed:

- `analogy` — one everyday picture with a title. The thing they will still remember next week.
- `deepDive` — 2-3 sections of real prose, optionally with `bullets` and one fixed-width `code`
  block (ASCII only, aligned — it renders through `AsciiBlock`).
- `examples` — at least one worked example with **concrete numbers** in every walkthrough step, and
  a `result` line saying what the numbers proved.
- `jargon` — 4-6 terms seniors use without explaining, in plain language.
- `remember` — 3-5 one-line takeaways.

Two rules that are easy to miss: it is loaded **lazily, per category** (`loadDepth`), so never
import these modules statically — that would put ~700 KB of prose into the main bundle. And the
strings are single-quoted TypeScript, so prose avoids apostrophes ("does not", "the budget of the
caller") rather than escaping them.

### A new interactive lab

1. Create the component in `src/features/<domain>/<Name>Lab.tsx`, default-exported.
2. Build it on `LabShell` + `DiagramCanvas` + the engine primitives.
3. Add a `LabId` to `src/types/index.ts`.
4. Add a row to `LABS` in `src/features/labs/registry.ts` (lazy import).
5. Set `lab: '<id>'` on the concept that should host it.

The lab then appears on the concept page's "Interactive Demo" tab, at `/labs/<id>`, in search, and
on the labs index — no other wiring.

### A new playground component kind

Add it to `NODE_KINDS` in `src/components/architecture/nodeKinds.tsx` (icon, accent, capacity,
blurb). It shows up in the palette, the diagrams and the analysis automatically.

## Visual-first rule

The product complaint that shaped this app was "too much text". Concept pages therefore lead with a
**running diagram**, not a paragraph:

- `src/data/visuals/` maps every concept slug to a `VisualSpec` (nodes, edges with a particle
  `rate`, optional `steps`). All 106 concepts have one - keep it that way.
- `FlowVisual` renders a spec as a self-running diagram; `SequenceFlow` walks the same spec one hop
  at a time with a caption of **six words or fewer**.
- The concept page shows: diagram tab, step-by-step tab, lab tab, trade-offs as chips, quiz, and one
  "Full explanation" tab that holds all the prose. The right column is short cards only.
- Run `npm run check:visuals` after editing a spec. It fails the build on overlapping boxes, nodes
  past the canvas, labels too long for their box, step captions over six words, and **edge labels
  that land behind a node card** (the SVG wiring layer is painted under the HTML nodes, so such a
  label is simply invisible). Move one with `labelT`, shorten it, or drop it.
- `SequenceFlow` shows the active step caption as a banner over the canvas, never as an edge label -
  on a short edge an edge label always lands on a node.
- `FlowVisual` auto-fits its spec to the container width (0.5x-1.3x), so a spec authored at 760px
  fills a wider card instead of stopping halfway across it. Pass `zoom` only to pin a scale.

## Content conventions

These are editorial rules, not style preferences. They are the reason the app is worth using.

- **Trade-off first.** Never write "X is better than Y". Write what X gains and what X costs. The
  `TradeOff` type forces `gains` and `costs` to both be filled in.
- **Visualization first, short explanation second, deep explanation optional** (`Expandable`).
- **Every concept must answer:** what is it, why does it exist, how does it work, when to use it,
  advantages, trade-offs, common mistakes, related concepts.
- **Scenario-based quizzes**, not definition recall.
- Prose uses plain hyphens and ASCII in `diagram` fields — the monospace blocks are rendered with
  `AsciiBlock`/`.ascii` and must line up in a fixed-width font.
- Simulations aim for **conceptual correctness + educational clarity + convincing feedback**, not
  scientific accuracy. Where a model is a simplification (e.g. `computeLoad`), say so in a comment
  and in the UI when a number could be mistaken for a measurement.

## Visual conventions

- Colors come from CSS variables in `src/styles/index.css`, exposed to Tailwind as semantic names:
  `canvas surface elevated line ink muted faint brand ok warn danger info violet`. Never hard-code a
  hex value in a component.
- Recharts and SVG attributes cannot read `var()`; use `useThemeColors()` for real color strings.
- Status is never communicated by color alone — particles have distinct shapes (circle, diamond,
  triangle, cross) and every status has a text label (`HealthIndicator`, `ParticleLegend`).
- Dark mode is the default and is the theme diagrams are tuned for; both themes must stay readable.

## Gotchas

- Do **not** `import * as Icons from 'lucide-react'` — it pulls every icon into the main bundle.
  Use named imports, or `CategoryIcon` in `src/data/categoryIcons.tsx` for name-based lookup.
- Tailwind's default scale has no `4.5` step; `h-4.5` silently does nothing.
- `noUnusedLocals` is on: an unused import fails the build, not just a lint run.
- Every route and lab is code-split. Import them with `lazyWithRetry` (`src/utils/lazyWithRetry.ts`),
  not bare `React.lazy`: after a dev-server restart or a redeploy the old document points at chunks
  that no longer exist, and a bare `lazy` turns that into "Failed to fetch dynamically imported
  module". Heavy deps reached only from lazy chunks are listed in `optimizeDeps.include` so Vite
  never re-optimizes and force-reloads mid-session.
- Labs that size node boxes at runtime (load balancer, horizontal scaling, auto scaling, queue) must
  keep the widest label readable: minimum width is 52 + 6.4 per character, and the whole row must
  stay inside the 960px canvas.
- The Bash tool on this machine has had trouble with large heredocs containing `.tsx`; prefer the
  Write tool for source files.
- `ArchNode` grows to fit its content and truncates its title, so an undersized box silently
  clips its label or overlaps the node below. `npm run check:visuals` catches both; it runs as part
  of `npm run build`. Minimum height is 62 + 12 (subtitle) + 16 (stat row); minimum width is
  52 + 6.4 per title character.
- Everything persists to `localStorage` only (`sdi:theme`, `sdi:progress:v1`). No backend, no auth,
  no network calls at runtime — keep it that way.
