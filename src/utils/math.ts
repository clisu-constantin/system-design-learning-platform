export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Exponential smoothing - keeps live metrics readable instead of jittery. */
export const smooth = (current: number, target: number, factor: number) =>
  current + (target - current) * clamp(factor, 0, 1);

export const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

export const pick = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

/** Deterministic PRNG so demos like "8,247 rows" stay stable across renders. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Poisson-ish arrivals: how many events happened in `dt` at `rate` per second. */
export function sampleArrivals(rate: number, dt: number) {
  const expected = rate * dt;
  const whole = Math.floor(expected);
  const fraction = expected - whole;
  return whole + (Math.random() < fraction ? 1 : 0);
}

export function percentile(sorted: number[], p: number) {
  if (sorted.length === 0) return 0;
  const index = clamp(Math.ceil((p / 100) * sorted.length) - 1, 0, sorted.length - 1);
  return sorted[index];
}
