# Behavior sweep findings

One file per sweep area, so the sweep tickets can run at the same time without editing the same
file. Ticket 11 merges them into one report.

| File | Ticket |
| --- | --- |
| `02-browse-surface.md` | 02 - Sweep the browse surface |
| `03-concept-category.md` | 03 - Sweep the concept and category pages |
| `04-playground.md` | 04 - Sweep the playground |
| `05-scenarios-evolution.md` | 05 - Sweep scenarios and evolution |
| `06-fundamentals-scaling.md` | 06 - Sweep the fundamentals and scaling labs |
| `07-networking-load-balancing.md` | 07 - Sweep the networking and load balancing labs |
| `08-caching-databases.md` | 08 - Sweep the caching and database labs |
| `09-queues-reliability.md` | 09 - Sweep the queue, rate limiting and reliability labs |
| `10-distributed-architecture-observability.md` | 10 - Sweep the distributed, architecture and observability labs |

## Getting the app on screen

```bash
npm install
npm run dev
```

The app runs on http://localhost:5173. In Claude Code, `.claude/launch.json` starts the same server
(`preview_start` with name `dev`).

Verify in a real browser. Reading the code is not enough - a slider wired to nothing looks fine in
source.

## Finding format

Every finding is one `###` block with a stable id and five fields:

```md
### F02-003 - Theme toggle does not survive reload

- **Area:** TopBar theme toggle
- **Clicked:** switched to light theme, reloaded the page
- **Expected:** the page stays light (`sdi:theme` is `light`)
- **Happened:** the page came back dark; `sdi:theme` was never written
- **Severity:** bug
- **Status:** fixed in `src/app/providers/ThemeProvider.tsx` | open | escalated
```

- **Id:** `F<ticket number>-<three digit counter>`, for example `F07-004`. Never reuse or renumber
  an id - ticket 11 refers to findings by id.
- **Area:** the page, lab or component.
- **Clicked:** the exact steps, so someone else can do them again.
- **Expected:** what a junior developer (or `CLAUDE.md`) would expect.
- **Happened:** what the app actually did. Include numbers, console errors, screenshots paths.
- **Severity:** one of the three below.
- **Status:** `fixed in <file>`, `open` (with a reason it was not fixed), or `escalated`.

## Severities

- **`bug`** - something is broken: a crash, a dead control, a blank screen, NaN or Infinity, a
  link to nowhere, a number that contradicts the animation. Fix it on the sweep branch.
- **`misleading`** - it works, but it teaches the wrong thing to a junior who has never heard of a
  load balancer. Examples: a metric that moves the wrong way, a diagram that says replicas are not
  interchangeable, a simplified number shown as if it was measured. Fix it when `CLAUDE.md`
  settles what is correct.
- **`judgment-call`** - something `CLAUDE.md` does not settle. Example: "should this slider cap at
  10 or 100 servers". **This severity is reserved for the human.** Do not change the code. Write it
  as a question, give two options and say which one you would pick.

A crash is never a judgment call.

## Scope

- In scope: things that are broken, and things that work but mislead.
- Out of scope: content rewrites, refactors, visual polish, and building labs for the concepts that
  have none.
- `npm run build` and `npm run lint` must still pass when a sweep ticket is done.
