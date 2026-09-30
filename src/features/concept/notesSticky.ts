/** Space between the notes column and the edge of the visible area, top or bottom. */
export const NOTES_GAP = 16;

/**
 * The CSS `top` of the sticky notes column beside a Concept, in pixels. `visible`
 * is the height of the scrolling area (the page scrolls inside `<main>`, under
 * the top bar), `notes` the height of the column.
 *
 * Short notes stick just under the top. Tall notes get a negative top: they
 * scroll with the page until their last card is in view, then stick with their
 * bottom edge just above the bottom, so no card is ever out of reach.
 */
export function notesStickyTop({ visible, notes }: { visible: number; notes: number }) {
  // Not measured yet (the first render, or no layout at all).
  if (visible <= 0) return NOTES_GAP;
  const overflow = notes + 2 * NOTES_GAP - visible;
  return overflow > 0 ? NOTES_GAP - overflow : NOTES_GAP;
}
