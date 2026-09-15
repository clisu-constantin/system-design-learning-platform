/**
 * Geometry check for the concept diagrams.
 *
 * Specs in src/data/visuals are plain data, and ArchNode grows to fit its
 * content, so a box that is too small silently truncates its label or overlaps
 * the node below. This asserts that cannot happen. Run with `npm run check:visuals`.
 */
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// compact ArchNode chrome: 16 padding + 28 icon + 8 gap
const CHROME_X = 52;
const minWidth = (node) =>
  Math.ceil(CHROME_X + Math.max(node.label.length * 6.4, node.sub ? node.sub.length * 5.2 : 0));
// 16 padding + 28 icon row + 16 status + 2 gaps, then subtitle and stat row
const minHeight = (node) => 62 + (node.sub ? 12 : 0) + (node.stat ? 16 : 0);

const overlaps = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const dir = mkdtempSync(join(tmpdir(), 'sdi-visuals-'));
const outfile = join(dir, 'visuals.mjs');

try {
  await build({
    entryPoints: {
      visuals: 'src/data/visuals/index.ts',
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
  const { curveBetween, pointOnCurve, midpoint } = await import(
    pathToFileURL(join(dir, 'geometry.mjs')).href
  );
  const specs = Object.entries({ ...VISUALS, 'home hero': HERO_VISUAL });
  const problems = [];

  for (const [slug, spec] of specs) {
    const width = spec.width ?? 760;
    const height = spec.height ?? 320;
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
        problems.push(`${slug}: edge ${edge.from} -> ${edge.to} references a node that does not exist`);
      }
    }

    for (const step of spec.steps ?? []) {
      if (!ids.has(step.from) || !ids.has(step.to)) {
        problems.push(`${slug}: step ${step.from} -> ${step.to} references a node that does not exist`);
      }
      if (step.label.split(' ').length > 6) {
        problems.push(`${slug}: step caption longer than six words - "${step.label}"`);
      }
    }

    for (const node of spec.nodes) {
      const w = node.w ?? 150;
      const h = node.h ?? 74;
      if (w < minWidth(node)) {
        problems.push(`${slug}: ${node.id} is ${w}px wide, needs ${minWidth(node)}px for "${node.label}"`);
      }
      if (h < minHeight(node)) {
        problems.push(`${slug}: ${node.id} is ${h}px tall, needs ${minHeight(node)}px for its content`);
      }
      if (node.x < 0 || node.y < 0) problems.push(`${slug}: ${node.id} has a negative position`);
      if (node.x + w > width) problems.push(`${slug}: ${node.id} runs ${node.x + w - width}px past the canvas width`);
      if (node.y + h > height) problems.push(`${slug}: ${node.id} runs ${node.y + h - height}px past the canvas height`);
    }

    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        if (overlaps(boxes[i], boxes[j])) {
          problems.push(`${slug}: ${boxes[i].id} overlaps ${boxes[j].id}`);
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
            `${slug}: label "${edge.label}" on ${edge.from} -> ${edge.to} is hidden behind ${box.id}` +
              ' (move it with labelT, shorten it, or drop it)',
          );
          break;
        }
      }
      if (labelBox.x < 0 || labelBox.x + labelBox.w > width || labelBox.y < 0) {
        problems.push(`${slug}: label "${edge.label}" on ${edge.from} -> ${edge.to} falls outside the canvas`);
      }
    }
  }

  if (problems.length) {
    console.error(problems.join('\n'));
    console.error(`\n${problems.length} problem(s) in ${specs.length} diagrams`);
    process.exit(1);
  }

  console.log(`${specs.length} diagrams checked - no geometry problems`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
