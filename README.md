# System Design Interactive

**Learn. Visualize. Experiment. Design.**

An interactive System Design laboratory that runs entirely in your browser. Instead of reading that
"a load balancer distributes requests across servers", you set the traffic to 3,000 req/sec, add a
server, switch to least-connections, kill server 2, and watch health checks pull it out of the pool.

![No backend required](https://img.shields.io/badge/backend-none-informational)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Running locally](#running-locally)
- [What's inside](#whats-inside)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [How the simulations work](#how-the-simulations-work)
- [How to add a new concept](#how-to-add-a-new-concept)
- [How to add a new interactive lab](#how-to-add-a-new-interactive-lab)
- [Design principles](#design-principles)
- [Accessibility and responsiveness](#accessibility-and-responsiveness)

---

## Requirements

- **Node.js 20.19+ or 22.12+** (required by Vite 8; developed on Node 24)
- npm 9+

Nothing else. No database, no Docker, no API keys, no cloud account, no login.

## Installation

```bash
git clone <repository>
cd system-design-interactive
npm install
```

## Running locally

```bash
npm run dev       # http://localhost:5173
```

Other scripts:

| Script            | What it does                                            |
| ----------------- | ------------------------------------------------------- |
| `npm run dev`     | Vite dev server with hot reload                         |
| `npm run build`   | Content/diagram checks, strict typecheck, build to `dist/`, bundle budget |
| `npm run lint`    | ESLint (TypeScript + React hooks rules)                 |
| `npm run preview` | Serves the production build locally                     |

## What's inside

**22 interactive labs**, each one a working simulation rather than an illustration:

| Lab | What you can change | What you learn |
| --- | --- | --- |
| Load Balancer | Traffic, server count, algorithm, capacity, kill/restart servers | Distribution, health checks, failover |
| Vertical Scaling | Traffic, instance tier | The queueing knee, the hardware ceiling, SPOF |
| Horizontal Scaling | Traffic, instance count, before/after capture | Linear capacity, where the next bottleneck goes |
| Auto Scaling | Thresholds, cooldown, warm-up, max instances | Flapping vs lag, why headroom beats reaction |
| Stateless vs Stateful | Session strategy, kill servers, kill Redis | Why local sessions break horizontal scaling |
| Caching | TTL, size, keyspace, skew, cache on/off | Hit rate, eviction, database load |
| Cache Strategies | Strategy, read/write, step-through | Cache-aside, read/write-through, write-behind/around |
| CDN | CDN on/off, hit ratio, traffic | Distance as a hard constraint, origin offload |
| API Gateway | Endpoint, token validity, auth and limits on/off | Why cross-cutting concerns live at the edge |
| Database Indexing | Table size, search target, write rate | O(n) scan vs O(log n) B-tree, the write cost |
| Database Replication | Sync/async, lag, read routing, kill primary | Replication lag, stale reads, lost writes on failover |
| Database Sharding | Shard key, traffic, cross-shard ratio | Hot shards, scatter-gather, why the key matters |
| Message Queue | Producer rate, workers, worker speed, bounds | Queue depth, backpressure, capacity arithmetic |
| Rate Limiting | Algorithm, limit, window, burst | Fixed/sliding window, token and leaky bucket |
| Circuit Breaker | Failure rate, threshold, cooldown, timeout | Closed → open → half-open, cascading failure |
| Retry and Backoff | Strategy, base delay, jitter, client count | Retry storms, why jitter matters |
| CAP Theorem | CP/AP choice, partition, writes per side | What you actually give up during a partition |
| Monolith vs Microservices | Architecture, traffic, break a capability | Blast radius, deployment, latency, real trade-offs |
| Distributed Tracing | Per-service latency, cache hit, async hop | Where the time actually goes |
| Requirements | Functional checkboxes, NFR sliders | How quality targets force architecture |
| Capacity Estimation | DAU, request rate, sizes, peak factor | DAU → QPS → storage → bandwidth, step by step |
| URL Journey | Warm/cold connection, CDN, cache hit | The whole stack in twelve stages |

**Plus:**

- **Architecture Playground** — drag components onto a canvas, connect them, run traffic through
  your own design, inject failures, and get bottleneck detection plus an architecture health score.
- **System Evolution** — one system across eight stages, where each component appears because the
  previous architecture broke in a specific way, and each one brings a named cost.
- **Compare Mode** — four side-by-side comparisons scored dimension by dimension.
- **Design Scenarios** — eight full walkthroughs (URL shortener, Instagram, WhatsApp, YouTube, Uber,
  notification system, Netflix, e-commerce), each covering requirements, capacity, high-level
  design, database choice, API, scaling, caching, reliability, bottlenecks and trade-offs.
- **106 concept pages**, each one led by a **live animated diagram** (traffic flowing from users to
  the load balancer to the servers, replication streams, cache hits and misses) with a Walkthrough
  of the same diagram one hop at a time, trade-off chips and a quiz - the prose sits in a single collapsed tab.
- A searchable glossary, global search (`Ctrl`/`Cmd` + `K`), difficulty
  filtering, quizzes, and progress tracking in `localStorage`.

## Architecture

**Stack:** React 18 · TypeScript (strict) · Vite · React Router · Tailwind CSS · Framer Motion ·
Lucide React · React Flow.

Three layers do most of the work:

1. **The simulation engine** (`src/simulations/`) — framework-agnostic primitives: an rAF ticker
   with clamped delta time, rolling metric windows with percentiles, rate counters, a particle
   system, and a shared queueing model that turns load and capacity into CPU, latency and errors.
2. **The architecture canvas** (`src/components/architecture/`) — an SVG wiring layer with animated
   request particles, and HTML node cards positioned on top of it. Every lab draws with the same
   components, so a cache node looks the same in every screen.
3. **The lab shell** (`src/components/learning/`) — consistent chrome around every simulation:
   toolbar, stage, control column, live metrics and an event log. A lab supplies only its own
   diagram and controls.

Content is fully separated from presentation: concepts, scenarios and the glossary are plain
TypeScript data, and the navigation, search, progress and category pages are all derived from them.

## Project structure

```
src/
├── app/
│   ├── App.tsx              Providers + router
│   ├── router.tsx           Lazy-loaded routes
│   └── providers/           ThemeProvider (dark/light + chart colors), ProgressProvider
├── components/
│   ├── architecture/        DiagramCanvas, ArchNode, HealthIndicator, geometry, nodeKinds
│   ├── charts/              LiveChart (SVG), DistributionBar
│   ├── layout/              AppShell, Sidebar, TopBar, CommandSearch
│   ├── learning/            LabShell, MetricsPanel, QuizCard, TradeOffTable, RequestInspector
│   └── ui/                  Button, Slider, Toggle, Select, Tabs, Meter, Stat, ErrorBoundary...
├── data/
│   ├── concepts/            One file per category - all 106 concepts
│   ├── scenarios/           End-to-end design walkthroughs
│   ├── categories.ts        Navigation groups
│   └── glossary.ts          Searchable terms, linked to concepts
├── features/
│   ├── architecture/ caching/ databases/ distributed/ evolution/ fundamentals/
│   ├── labs/                Lab registry + index + standalone lab route
│   ├── load-balancing/ networking/ observability/ playground/ queues/
│   ├── reliability/ scaling/ scenarios/ security/
│   ├── compare/ concept/ categories/ glossary/ home/ progress/
├── hooks/                   useRerender
├── simulations/
│   ├── engine/              useTicker, metrics, useSeries, useEventLog, particles
│   └── models/              load (queueing model), machine tiers
├── styles/                  Tailwind entry + design tokens
├── types/                   Shared domain types
└── utils/                   cn, math, format, search
```

## How the simulations work

Everything runs in the browser on a `requestAnimationFrame` loop.

```ts
useTicker(running, (dt) => {
  // dt is in seconds and clamped, so a backgrounded tab does not fast-forward
});
```

**Components** are modelled conceptually:

```ts
interface SystemNode {
  id: string;
  type: NodeType;
  capacity: number;      // requests per second before saturation
  currentLoad: number;
  status: 'healthy' | 'degraded' | 'down';
}
```

**Requests** travel as particles along bezier paths between nodes, and carry enough context to be
inspected when clicked:

```ts
interface SimulatedRequest {
  id: number;
  createdAt: number;
  currentNode: string;
  status: 'active' | 'completed' | 'failed';
  latency: number;
  path: string[];
}
```

**Load** is turned into user-visible behaviour by one shared model (`simulations/models/load.ts`):
latency rises slowly until roughly 70% utilization, then sharply as queueing takes over, and
requests begin to fail once demand exceeds capacity. This is a deliberate simplification of M/M/1 —
the goal is a believable feel and a correct shape, not a capacity planner. Metrics (p50/p95/p99,
error rate, hit rate, queue depth) are derived from simulation state rather than stored separately.

For performance, labs keep mutable simulation state in a ref and re-render at a capped frame rate,
so particle animation does not cause array copies sixty times a second.

## How to add a new concept

1. Open the right file in `src/data/concepts/` (one per category).
2. Append a `Concept` object:

```ts
{
  slug: 'connection-pooling',
  title: 'Connection Pooling',
  tagline: 'Reuse a small number of database connections instead of one per request.',
  category: 'data',
  difficulty: 'Intermediate',
  what: '...', why: '...', how: ['...'], when: ['...'],
  tradeoffs: [{ approach: '...', gains: ['...'], costs: ['...'] }],
  mistakes: ['...'],
  related: ['horizontal-scaling'],
  quiz: [{ id: 'cp-1', prompt: '...', options: ['...'], answer: 1, explanation: '...' }],
}
```

Everything else — sidebar entry, search indexing, category page, progress tracking, related links —
is derived automatically.

## How to add a new interactive lab

1. Create `src/features/<domain>/<Name>Lab.tsx` with a default export, built on `LabShell`,
   `DiagramCanvas` and the engine primitives:

```tsx
export function MyLab() {
  const [running, setRunning] = useState(true);
  const state = useRef(createState());
  const rerender = useRerender(30);

  useTicker(running, (dt) => {
    // advance the model, move particles
    rerender();
  });

  return (
    <LabShell
      title="My Lab"
      description="What the learner is looking at."
      running={running}
      onToggleRun={() => setRunning((v) => !v)}
      controls={<Slider label="Traffic" ... />}
      metrics={<MetricsPanel items={[...]} />}
      insight={<Insight>What to notice right now.</Insight>}
    >
      <DiagramCanvas layout={layout} edges={edges} particles={particles}>
        <ArchNode kind="server" title="API" placed={layout.api} />
      </DiagramCanvas>
    </LabShell>
  );
}
export default MyLab;
```

2. Add the id to `LabId` in `src/types/index.ts`.
3. Register it in `src/features/labs/registry.ts` with a lazy import.
4. Set `lab: '<id>'` on the concept that should host it.

It now appears on that concept's **Interactive Demo** tab, at `/labs/<id>`, on the labs index and in
global search.

## Design principles

- **Trade-off first.** The app never says "microservices are better than monoliths" or "NoSQL is
  faster than SQL". Every trade-off is shown as what you gain next to what it costs, because there
  is rarely a universally correct architecture — the right one depends on requirements and
  constraints.
- **Visualization first.** A concept page opens with a running diagram, not a paragraph. Every one
  of the 106 concepts has an animated `VisualSpec` in `src/data/visuals/`, and the full prose lives
  in one collapsed tab.
- **Animation must explain.** Particles show routing and latency, marching edges show active paths,
  and nodes spring in when you scale out. Nothing moves for decoration.
- **Progressive architecture.** Designs start simple, a problem appears, and a component is
  introduced to solve that specific problem — then its cost is named. The point is not "what is
  Redis?" but "what went wrong that made Redis useful?".
- **Honest models.** Where a number is a heuristic (the architecture health score, the query-time
  estimates), the UI says so.

## Accessibility and responsiveness

- Status is never color-only: request particles use distinct shapes and every health state has a
  text label.
- Controls are real form elements with labels, `aria-*` attributes and visible focus rings; tabs
  support arrow-key navigation and search is fully keyboard driven.
- Desktop is the primary experience because diagrams need space. On tablets and phones the sidebar
  collapses into an overlay and diagrams scroll horizontally instead of shrinking into an unreadable
  mess.
- Dark and light themes are both first-class and persist to `localStorage`.

## License

MIT.
