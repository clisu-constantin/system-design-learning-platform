import { useEffect, useRef } from 'react';

type TickCallback = (dt: number, elapsed: number) => void;

/**
 * requestAnimationFrame loop for simulations.
 *
 * `dt` is delivered in seconds and clamped so that a backgrounded tab does not
 * fast-forward the whole simulation when it regains focus.
 */
export function useTicker(running: boolean, onTick: TickCallback, maxStep = 0.1) {
  const callbackRef = useRef(onTick);
  callbackRef.current = onTick;

  useEffect(() => {
    if (!running) return;
    let frame = 0;
    let last = performance.now();
    let elapsed = 0;

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, maxStep);
      last = now;
      elapsed += dt;
      callbackRef.current(dt, elapsed);
      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [running, maxStep]);
}
