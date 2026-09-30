/**
 * Where a Walkthrough is: Live (the free-flowing traffic, before step 1) or
 * the index of the step on show. Pure, so it runs on Node's test runner.
 */
export type WalkthroughPosition = number | null;

export const LIVE: WalkthroughPosition = null;

/** Next: Live opens step 1, then one step at a time, stopping on the last. */
export const nextStep = (position: WalkthroughPosition, count: number): WalkthroughPosition =>
  position === null ? 0 : Math.min(count - 1, position + 1);

/** Back: one step at a time, and back from step 1 is Live. */
export const previousStep = (position: WalkthroughPosition): WalkthroughPosition =>
  position === null || position === 0 ? LIVE : position - 1;

export const canGoBack = (position: WalkthroughPosition) => position !== null;

export const canGoNext = (position: WalkthroughPosition, count: number) =>
  count > 0 && (position === null || position < count - 1);

/** Play in a step loops: after the last step comes step 1 again. */
export const playStep = (position: number, count: number) => (position + 1) % count;

/**
 * How full one step bar is, 0..1: the steps already walked are full, the one on
 * show is `fill`, the rest are empty. On Live every bar is empty.
 */
export const barFill = (bar: number, position: WalkthroughPosition, fill: number) =>
  position === null ? 0 : bar < position ? 1 : bar === position ? fill : 0;
