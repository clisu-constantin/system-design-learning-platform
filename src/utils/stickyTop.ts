/** Space between a sticky side column and the edge of the visible area, top or bottom. */
export const STICKY_GAP = 16;

/**
 * The CSS `top` of a sticky side column (the notes beside a Concept, the
 * controls beside a Lab), in pixels. `visible` is the height of the scrolling
 * area (the page scrolls inside `<main>`, under the top bar), `column` the
 * height of the column.
 *
 * A short column sticks just under the top. A tall one gets a negative top: it
 * scrolls with the page until its last card is in view, then sticks with its
 * bottom edge just above the bottom, so no card is ever out of reach.
 */
export function stickyTop({ visible, column }: { visible: number; column: number }) {
  // Not measured yet (the first render, or no layout at all).
  if (visible <= 0) return STICKY_GAP;
  const overflow = column + 2 * STICKY_GAP - visible;
  return overflow > 0 ? STICKY_GAP - overflow : STICKY_GAP;
}
