import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

const matches = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches;

/**
 * The operating-system "reduce motion" setting. Diagrams that animate on their
 * own start paused when it is on - the learner can still press Play.
 */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(matches);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(QUERY);
    const onChange = () => setReduced(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
