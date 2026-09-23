import { useMediaQuery } from './useMediaQuery';

/**
 * The operating-system "reduce motion" setting. Diagrams that animate on their
 * own start paused when it is on - the learner can still press Play.
 */
export const usePrefersReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)');
