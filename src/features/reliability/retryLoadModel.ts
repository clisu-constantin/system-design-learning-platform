import { mulberry32 } from '@/utils/math';

/**
 * Fleet load model for the Retry lab. Pure: the same inputs always give the
 * same series, so it can be checked numerically outside React.
 *
 * Simplified model, not a measurement. What it assumes:
 * - Correlated failure: the dependency goes down and every client's first
 *   request fails within the same ~100 ms window. That shared moment is what
 *   makes un-jittered retries line up into waves.
 * - A failed attempt comes back fast (a 503 in 30-70 ms), then the client
 *   waits its retry delay and tries again.
 * - Every attempt fails at the chosen rate, independently.
 * - Load is counted in 250 ms buckets and reported as requests/sec, so a
 *   synchronized wave shows up as a spike instead of being averaged away.
 * - Only retries are counted. The first failing request is the same in every
 *   scenario; the chart and the peak are about what the retry policy adds.
 */

export type Strategy = 'immediate' | 'fixed' | 'exponential';

/** All clients fail within this window of each other. */
export const FAILURE_WINDOW_MS = 100;
/** Width of one load bucket. */
export const BUCKET_MS = 250;
/** How much of the storm the chart shows. */
export const HORIZON_MS = 20_000;
/** A failing attempt returns in FAIL_MIN_MS + up to FAIL_SPREAD_MS. */
const FAIL_MIN_MS = 30;
const FAIL_SPREAD_MS = 40;
/** Clients actually simulated; larger fleets are scaled up from this sample. */
const MAX_SIMULATED = 3000;

/** Delay before attempt n (1-based), in milliseconds. */
export function delayFor(strategy: Strategy, attempt: number, baseMs: number, jitter: boolean, random: () => number) {
  if (attempt <= 1) return 0;
  if (strategy === 'immediate') return 0;
  const raw = strategy === 'fixed' ? baseMs : baseMs * 2 ** (attempt - 2);
  const capped = Math.min(raw, 30000);
  return jitter ? capped * random() : capped;
}

export interface FleetLoadInput {
  strategy: Strategy;
  baseMs: number;
  maxAttempts: number;
  jitter: boolean;
  failureRate: number;
  clients: number;
  seed: number;
}

export interface FleetLoadPoint {
  /** Bucket start, in seconds after the failure. */
  t: number;
  /** Retries arriving in this bucket, as requests/sec. */
  load: number;
  capacity: number;
  [key: string]: number;
}

export interface FleetLoad {
  series: FleetLoadPoint[];
  /** Highest bucket of the retry waves, in requests/sec. */
  peak: number;
  /** Assumed capacity of the failing service, in requests/sec. */
  capacity: number;
}

export function simulateFleetLoad({
  strategy,
  baseMs,
  maxAttempts,
  jitter,
  failureRate,
  clients,
  seed,
}: FleetLoadInput): FleetLoad {
  const buckets = Math.ceil(HORIZON_MS / BUCKET_MS);
  const arrivals = new Array<number>(buckets).fill(0);
  const random = mulberry32(seed + 1);
  const simulated = Math.min(clients, MAX_SIMULATED);

  for (let client = 0; client < simulated; client += 1) {
    // Attempt 1: the original request, failing together with everyone else's.
    let clock = random() * FAILURE_WINDOW_MS;
    for (let attempt = 2; attempt <= maxAttempts; attempt += 1) {
      // The previous attempt failed; its 503 takes a moment to come back.
      clock += FAIL_MIN_MS + random() * FAIL_SPREAD_MS;
      clock += delayFor(strategy, attempt, baseMs, jitter, random);
      const bucket = Math.floor(clock / BUCKET_MS);
      if (bucket < buckets) arrivals[bucket] += 1;
      if (random() > failureRate) break;
    }
  }

  const scale = simulated > 0 ? clients / simulated : 0;
  const perSecond = 1000 / BUCKET_MS;
  const capacity = clients * 0.6;
  const series: FleetLoadPoint[] = arrivals.map((count, index) => ({
    t: (index * BUCKET_MS) / 1000,
    load: Math.round(count * scale * perSecond),
    capacity,
  }));
  const peak = series.reduce((max, point) => Math.max(max, point.load), 0);
  return { series, peak, capacity };
}
