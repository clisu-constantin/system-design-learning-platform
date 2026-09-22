import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Width of an element in whole pixels, tracked with ResizeObserver. Attach `ref`
 * to the element to measure. It must not take its width from content that
 * depends on this value (use `w-full` / `min-w-0`), or the two chase each other.
 *
 * Whole pixels, so sub-pixel jitter during a resize does not re-render the
 * consumer on every observer tick.
 */
export function useElementWidth<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    // Syncs the measured DOM width. The first read happens before paint, so a
    // consumer never shows one frame at the wrong size and then snaps.
    setWidth(Math.floor(element.clientWidth));
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => setWidth(Math.floor(entries[0]?.contentRect.width ?? 0)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}
