import { useElementWidth } from './useElementWidth';
import { clamp } from '@/utils/math';

export interface FitRange {
  /** Smallest scale. Below it the container scrolls sideways instead of shrinking further. */
  min?: number;
  /** Largest scale. */
  max?: number;
}

/**
 * Scales a fixed design space (a diagram authored at, say, 960px) to the width
 * its container actually has, clamped to `[min, max]`.
 *
 * Attach `ref` to the element whose width should be filled. That element must
 * not take its width from the scaled content (use `w-full` / `min-w-0`), or the
 * two would chase each other.
 *
 * The first measurement happens in a layout effect, so the diagram is never
 * painted at the wrong size and then snapped. `override` pins the scale.
 */
export function useFitScale(designWidth: number, { min = 0.5, max = 1 }: FitRange = {}, override?: number) {
  const { ref, width } = useElementWidth();
  // Round to 1/1000 so a 1px width change does not re-render every node card.
  const fitted = width > 0 ? Math.round(clamp(width / designWidth, min, max) * 1000) / 1000 : clamp(1, min, max);
  return { ref, scale: override ?? fitted };
}
