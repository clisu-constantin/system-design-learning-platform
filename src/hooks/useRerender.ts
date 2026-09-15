import { useCallback, useRef, useState } from 'react';

/**
 * Forces a re-render without copying simulation state into React state.
 *
 * Labs keep their mutable model in a ref and call this at a capped frame rate,
 * which keeps 60fps particle movement from causing 60 array copies per second.
 */
export function useRerender(maxFps = 30) {
  const [, setTick] = useState(0);
  const last = useRef(0);

  return useCallback(() => {
    const now = performance.now();
    if (now - last.current < 1000 / maxFps) return;
    last.current = now;
    setTick((value) => value + 1);
  }, [maxFps]);
}
