/**
 * Geometry and wiring check for every diagram in the app.
 *
 * Specs in src/data/visuals and the stage layouts in src/features/evolution are
 * plain data, and ArchNode grows to fit its content, so a box that is too small
 * silently truncates its label or overlaps the node below. This asserts that
 * cannot happen, and that the wiring says something true: identical replicas
 * must have identical connections unless the diagram declares otherwise.
 * Run with `npm run check:visuals`.
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// compact ArchNode chrome: 16 padding (p-2) + 2 border + 28 icon (w-7) + 8 gap (gap-2).
// The border was once left out, and "WHERE created_at >= Sep" passed at 210px
// while the browser clipped it by a fraction of a pixel.
const CHROME_X = 54;
// A "new" badge sits on the title row and pushes the title into its truncation:
// chip padding 20 + border 2 + ~19 of text + 6 gap. Without this, a node with a
// badge silently renders as "Replic..." instead of "Replica 1".
const BADGE_X = 47;
// Advance width of each printable ASCII character in the ArchNode title font
// (text-xs font-semibold: 600 12px, the Tailwind sans stack as the browser
// resolves it), measured in headless Chromium with canvas measureText and
// rounded up to 0.1px. A flat per-character estimate under-shot titles with
// wide letters: "Message Queue" renders at 94px, 7.2px per character.
// Re-measure if the title font, size or weight changes.
const TITLE_CHAR_W = {
  " ": 3.2, "!": 4.1, "\"": 6.5, "#": 7.9, "$": 7.9, "%": 12, "&": 8.8, "'": 4, "(": 5, ")": 5,
  "*": 5.8, "+": 7.9, ",": 4, "-": 5.8, ".": 4, "/": 3.9, "0": 8, "1": 6, "2": 7.6, "3": 7.9,
  "4": 8.1, "5": 7.8, "6": 8.1, "7": 7.2, "8": 8.1, "9": 8.1, ":": 4, ";": 4, "<": 7.9, "=": 7.9,
  ">": 7.9, "?": 6.6, "@": 11.1, "A": 8.6, "B": 8.2, "C": 8.8, "D": 8.9, "E": 7.4, "F": 7.1,
  "G": 9.1, "H": 9.3, "I": 3.7, "J": 7, "K": 8.4, "L": 7.1, "M": 10.8, "N": 9.2, "O": 9.4, "P": 8,
  "Q": 9.4, "R": 8.2, "S": 8, "T": 7.9, "U": 9.1, "V": 8.5, "W": 12, "X": 8.6, "Y": 8.3, "Z": 8.1,
  "[": 5, "\\": 3.9, "]": 5, "^": 7.9, "_": 7.4, "`": 6, "a": 7, "b": 7.7, "c": 7, "d": 7.7,
  "e": 7.1, "f": 4.8, "g": 7.6, "h": 7.5, "i": 3.3, "j": 3.3, "k": 7, "l": 3.4, "m": 11, "n": 7.4,
  "o": 7.4, "p": 7.7, "q": 7.7, "r": 5, "s": 6.7, "t": 4.8, "u": 7.4, "v": 6.9, "w": 9.9, "x": 6.8,
  "y": 7, "z": 6.7, "{": 5, "|": 3.5, "}": 5, "~": 7.9,
};
// Anything outside the table (non-ASCII) is assumed as wide as a "W".
const titleWidth = (label) => [...label].reduce((sum, ch) => sum + (TITLE_CHAR_W[ch] ?? 12), 0);
const minWidth = (node) =>
  Math.ceil(
    CHROME_X +
      Math.max(titleWidth(node.label) + (node.badge ? BADGE_X : 0), node.sub ? node.sub.length * 5.2 : 0),
  );
// 16 padding + 28 icon row + 16 status + 2 gaps, then subtitle and stat row
const minHeight = (node) => 62 + (node.sub ? 12 : 0) + (node.stat ? 16 : 0);

const overlaps = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/**
 * Two nodes are peers when they are the same kind of component and their labels
 * differ only by a trailing number: "API 1"/"API 2", "api-1"/"api-2".
 * Letters are deliberately NOT stripped, so "Service A" and "Service B" stay
 * distinct - those name roles in a chain, not replicas of each other.
 */
const peerKey = (node) => {
  const base = node.label
    .trim()
    .replace(/[\s#_-]*\d+$/, '')
    .toLowerCase();
  return `${node.kind}|${base}`;
};

const dir = mkdtempSync(join(tmpdir(), 'sdi-visuals-'));

try {
  await build({
    entryPoints: {
      visuals: 'src/data/visuals/index.ts',
      stages: 'src/features/evolution/stages.ts',
      geometry: 'src/components/architecture/geometry.ts',
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    outdir: dir,
    outExtension: { '.js': '.mjs' },
    logLevel: 'error',
  });

  const { VISUALS, HERO_VISUAL } = await import(pathToFileURL(join(dir, 'visuals.mjs')).href);
  const { STAGES } = await import(pathToFileURL(join(dir, 'stages.mjs')).href);
  const { curveBetween, pointOnCurve, midpoint } = await import(
    pathToFileURL(join(dir, 'geometry.mjs')).href
  );

  // The evolution stages use a different shape (title + placed box) and a taller
  // canvas, so normalise both sources into one list before checking.
  const specs = [
    // Concept Diagrams show a Walkthrough; the home hero does not.
    ...[
      ...Object.entries(VISUALS).map(([slug, spec]) => [slug, spec, true]),
      ['home hero', HERO_VISUAL, false],
    ].map(([slug, spec, walkthrough]) => ({
      name: slug,
      width: spec.width ?? 760,
      height: spec.height ?? 320,
      nodes: spec.nodes,
      edges: spec.edges,
      steps: spec.steps ?? [],
      asymmetric: spec.asymmetric,
      walkthrough,
    })),
    ...STAGES.map((stage) => ({
      name: `evolution ${stage.id}`,
      width: 960,
      height: 540,
      nodes: stage.nodes.map((node) => ({
        id: node.id,
        kind: node.kind,
        label: node.title,
        sub: node.subtitle,
        badge: node.isNew,
        ...node.placed,
      })),
      edges: stage.edges,
      steps: [],
      asymmetric: stage.asymmetric,
    })),
  ];

  const problems = [];

  for (const spec of specs) {
    const { name, width, height } = spec;
    const ids = new Set(spec.nodes.map((node) => node.id));
    const boxes = spec.nodes.map((node) => ({
      id: node.id,
      x: node.x,
      y: node.y,
      w: node.w ?? 150,
      h: node.h ?? 74,
    }));

    for (const edge of spec.edges) {
      if (!ids.has(edge.from) || !ids.has(edge.to)) {
        problems.push(`${name}: edge ${edge.from} -> ${edge.to} references a node that does not exist`);
      }
    }

    for (const step of spec.steps) {
      if (!ids.has(step.from) || !ids.has(step.to)) {
        problems.push(`${name}: step ${step.from} -> ${step.to} references a node that does not exist`);
      }
      if (step.label.split(' ').length > 6) {
        problems.push(`${name}: step caption longer than six words - "${step.label}"`);
      }
      // The Walkthrough is read as the story of the drawn system, so a step may
      // only travel a wire the Diagram draws (either way: a response goes back).
      const drawn = spec.edges.some(
        (edge) => (edge.from === step.from && edge.to === step.to) || (edge.from === step.to && edge.to === step.from),
      );
      if (!drawn) problems.push(`${name}: step ${step.from} -> ${step.to} follows no drawn edge`);
    }

    // Every concept Diagram carries a Walkthrough, and the Walkthrough visits every
    // node: a box the story never reaches is a part the learner is never told about.
    // A part that is deliberately not reached gets a `skipped` step, not a request.
    if (spec.walkthrough && spec.steps.length < 2) {
      problems.push(`${name}: needs a Walkthrough of at least 2 steps`);
    } else if (spec.walkthrough) {
      const visited = new Set(spec.steps.flatMap((step) => [step.from, step.to]));
      for (const node of spec.nodes) {
        if (!visited.has(node.id)) problems.push(`${name}: ${node.id} ("${node.label}") is never visited by a step`);
      }
    }

    // A node nobody connects to is either a forgotten edge or a forgotten node.
    const wired = new Set(spec.edges.flatMap((edge) => [edge.from, edge.to]));
    for (const node of spec.nodes) {
      if (!wired.has(node.id)) problems.push(`${name}: ${node.id} has no edges - it is drawn but not wired`);
    }

    for (const node of spec.nodes) {
      const w = node.w ?? 150;
      const h = node.h ?? 74;
      if (w < minWidth(node)) {
        problems.push(`${name}: ${node.id} is ${w}px wide, needs ${minWidth(node)}px for "${node.label}"`);
      }
      if (h < minHeight(node)) {
        problems.push(`${name}: ${node.id} is ${h}px tall, needs ${minHeight(node)}px for its content`);
      }
      if (node.x < 0 || node.y < 0) problems.push(`${name}: ${node.id} has a negative position`);
      if (node.x + w > width) problems.push(`${name}: ${node.id} runs ${node.x + w - width}px past the canvas width`);
      if (node.y + h > height) problems.push(`${name}: ${node.id} runs ${node.y + h - height}px past the canvas height`);
    }

    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        if (overlaps(boxes[i], boxes[j])) {
          problems.push(`${name}: ${boxes[i].id} overlaps ${boxes[j].id}`);
        }
      }
    }

    // Identical replicas must have identical wiring. "API 1 talks to Redis but
    // API 2 does not" is drawn for visual balance and read as architecture - it
    // teaches a system where instances are not interchangeable, which is the
    // opposite of the lesson. A diagram that is asymmetric on purpose (a failed
    // node, one partition holding the key) says so with `asymmetric`.
    if (!spec.asymmetric) {
      const groups = new Map();
      for (const node of spec.nodes) {
        const key = peerKey(node);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(node);
      }

      for (const [key, members] of groups) {
        if (members.length < 2) continue;
        const memberIds = new Set(members.map((member) => member.id));
        const neighbours = new Map(members.map((member) => [member.id, new Set()]));

        for (const edge of spec.edges) {
          // Edges between the peers themselves describe their relationship to
          // each other (leader to follower), not a shared dependency.
          if (memberIds.has(edge.from) && !memberIds.has(edge.to)) neighbours.get(edge.from).add(`-> ${edge.to}`);
          if (memberIds.has(edge.to) && !memberIds.has(edge.from)) neighbours.get(edge.to).add(`<- ${edge.from}`);
        }

        const everyNeighbour = new Set([...neighbours.values()].flatMap((set) => [...set]));
        for (const neighbour of everyNeighbour) {
          const missing = members.filter((member) => !neighbours.get(member.id).has(neighbour));
          if (missing.length) {
            problems.push(
              `${name}: ${key.split('|')[1] || key} replicas are wired differently - ` +
                `${neighbour} is missing on ${missing.map((member) => member.id).join(', ')} ` +
                '(wire every replica the same, or set `asymmetric` with the reason)',
            );
          }
        }
      }
    }

    // Edge labels are drawn on the wiring layer, underneath the node cards, so
    // a label that lands on a box is simply invisible.
    const byId = Object.fromEntries(boxes.map((box) => [box.id, box]));
    for (const edge of spec.edges) {
      if (!edge.label) continue;
      const from = byId[edge.from];
      const to = byId[edge.to];
      if (!from || !to) continue;

      const curve = curveBetween(from, to, edge.curvature);
      const point = edge.labelT === undefined ? midpoint(curve) : pointOnCurve(curve, edge.labelT);
      const labelBox = {
        id: `label "${edge.label}"`,
        x: point.x - (edge.label.length * 5.1) / 2 - 5,
        y: point.y - 16,
        w: edge.label.length * 5.1 + 10,
        h: 15,
      };

      for (const box of boxes) {
        if (overlaps(labelBox, box)) {
          problems.push(
            `${name}: label "${edge.label}" on ${edge.from} -> ${edge.to} is hidden behind ${box.id}` +
              ' (move it with labelT, shorten it, or drop it)',
          );
          break;
        }
      }
      if (labelBox.x < 0 || labelBox.x + labelBox.w > width || labelBox.y < 0) {
        problems.push(`${name}: label "${edge.label}" on ${edge.from} -> ${edge.to} falls outside the canvas`);
      }
    }
  }

  if (problems.length) {
    console.error(problems.join('\n'));
    console.error(`\n${problems.length} problem(s) in ${specs.length} diagrams`);
    process.exit(1);
  }

  console.log(`${specs.length} diagrams checked - geometry and wiring consistent`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
