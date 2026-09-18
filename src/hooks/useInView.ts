import { useEffect, useState, type RefObject } from 'react';

/**
 * Whether the element is on screen, so an animation loop can stop while it is
 * scrolled away. `requestAnimationFrame` already pauses in a background tab,
 * but not for a diagram that is merely scrolled out of view.
 *
 * Starts as `true` so the first frame renders normally, and stays `true` where
 * IntersectionObserver is unavailable.
 */
export function useInView(ref: RefObject<Element | null>, rootMargin = '100px') {
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (entry) setInView(entry.isIntersecting);
      },
      { rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, rootMargin]);

  return inView;
}
