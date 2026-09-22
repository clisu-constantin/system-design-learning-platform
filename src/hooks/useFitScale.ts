import { useLayoutEffect, useRef, useState } from 'react';
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
  const ref = useRef<HTMLDivElement>(null);
  const [fitted, setFitted] = useState(1);

  useLayoutEffect(() => {
    if (override !== undefined) return;
    const element = ref.current;
    if (!element) return;

    const fit = (width: number) => {
      // Round to 1/1000: sub-pixel jitter in the measured width must not
      // re-render every node card on every resize tick.
      if (width > 0) setFitted(Math.round(clamp(width / designWidth, min, max) * 1000) / 1000);
    };
    fit(element.clientWidth);

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => fit(entries[0]?.contentRect.width ?? 0));
    observer.observe(element);
    return () => observer.disconnect();
  }, [designWidth, min, max, override]);

  return { ref, scale: override ?? fitted };
}
