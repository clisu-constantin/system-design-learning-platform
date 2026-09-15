import { useCallback, useRef, useState } from 'react';

export interface SeriesPoint {
  t: number;
  [key: string]: number;
}

/**
 * Append-only time series capped at `maxPoints`, throttled so that charts are
 * re-rendered a few times per second instead of on every animation frame.
 */
export function useSeries(maxPoints = 60, minIntervalMs = 400) {
  const [points, setPoints] = useState<SeriesPoint[]>([]);
  const lastPush = useRef(0);
  const index = useRef(0);

  const push = useCallback(
    (values: Record<string, number>, now = performance.now()) => {
      if (now - lastPush.current < minIntervalMs) return;
      lastPush.current = now;
      index.current += 1;
      const point: SeriesPoint = { t: index.current, ...values };
      setPoints((previous) => {
        const next = [...previous, point];
        return next.length > maxPoints ? next.slice(next.length - maxPoints) : next;
      });
    },
    [maxPoints, minIntervalMs],
  );

  const reset = useCallback(() => {
    setPoints([]);
    index.current = 0;
    lastPush.current = 0;
  }, []);

  return { points, push, reset };
}
