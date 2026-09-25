/**
 * Geometry helpers for the diagram canvas.
 *
 * Every lab works in the same fixed design space (pixels inside the canvas),
 * which keeps edge routing and particle movement identical everywhere.
 */

export interface Placed {
  /** Top-left corner inside the canvas. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Layout = Record<string, Placed>;

export interface Point {
  x: number;
  y: number;
}

export interface Curve {
  p0: Point;
  p1: Point;
  p2: Point;
  p3: Point;
}

const center = (box: Placed): Point => ({ x: box.x + box.w / 2, y: box.y + box.h / 2 });

/**
 * Builds a cubic bezier between two boxes. The edge leaves and enters through
 * the facing sides, so connections read like an architecture diagram rather
 * than like arbitrary lines between rectangles.
 */
export function curveBetween(from: Placed, to: Placed, curvature = 0.55): Curve {
  const a = center(from);
  const b = center(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const vertical = Math.abs(dy) >= Math.abs(dx);

  if (vertical) {
    const down = dy >= 0;
    const p0 = { x: a.x, y: down ? from.y + from.h : from.y };
    const p3 = { x: b.x, y: down ? to.y : to.y + to.h };
    const offset = Math.abs(p3.y - p0.y) * curvature;
    return {
      p0,
      p1: { x: p0.x, y: p0.y + (down ? offset : -offset) },
      p2: { x: p3.x, y: p3.y - (down ? offset : -offset) },
      p3,
    };
  }

  const right = dx >= 0;
  const p0 = { x: right ? from.x + from.w : from.x, y: a.y };
  const p3 = { x: right ? to.x : to.x + to.w, y: b.y };
  const offset = Math.abs(p3.x - p0.x) * curvature;
  return {
    p0,
    p1: { x: p0.x + (right ? offset : -offset), y: p0.y },
    p2: { x: p3.x - (right ? offset : -offset), y: p3.y },
    p3,
  };
}

export const curveToPath = ({ p0, p1, p2, p3 }: Curve) =>
  `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`;

export function pointOnCurve({ p0, p1, p2, p3 }: Curve, t: number): Point {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

export const midpoint = (curve: Curve) => pointOnCurve(curve, 0.5);

/**
 * Edge labels are 11px monospace (the app-wide text floor). One character
 * advances 6.62px in the Tailwind mono stack as headless Chromium resolves it,
 * rounded up here. DiagramCanvas draws the chip behind the label from this box
 * and scripts/check-visuals.mjs checks the same box against the node cards, so
 * the two cannot disagree about where a label is.
 */
export const EDGE_LABEL_FONT_SIZE = 11;
const EDGE_LABEL_CHAR_W = 6.7;

/** The chip behind an edge label whose anchor point is `point`; the text baseline sits 5px above it. */
export function edgeLabelBox(point: Point, label: string): Placed {
  const w = label.length * EDGE_LABEL_CHAR_W + 10;
  return { x: point.x - w / 2, y: point.y - 17, w, h: 16 };
}

/** Evenly spaces `count` boxes of width `w` across `span`, centred on `cx`. */
export function spread(count: number, cx: number, w: number, gap: number) {
  const total = count * w + (count - 1) * gap;
  const start = cx - total / 2;
  return Array.from({ length: count }, (_, index) => start + index * (w + gap));
}
