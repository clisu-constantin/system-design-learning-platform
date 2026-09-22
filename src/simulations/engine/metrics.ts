import { percentile } from '@/utils/math';

/**
 * What a `MetricWindow` holds right now. Every statistic is `null` when no
 * sample landed inside the horizon: "nothing was served" is not "0 ms", and it
 * is not the last value seen either. Render it as a dash (`formatLatency(null)`)
 * and push `?? NaN` into a chart series so the line breaks instead of lying.
 */
export interface WindowSnapshot {
  count: number;
  avg: number | null;
  p50: number | null;
  p95: number | null;
  p99: number | null;
}

/** How long a latency sample counts, in ms. */
export const METRIC_HORIZON_MS = 2000;

/**
 * Sliding time window of samples - the last `horizonMs` of them, not the last
 * N. Used for latency distributions.
 *
 * A count-based window lagged at low traffic (50 req/sec took 10 s to refill
 * 500 slots) and kept showing the last value when nothing was served at all.
 * Here a sample expires `horizonMs` after it was pushed, so the numbers follow
 * the load within the horizon and an idle window reports no data.
 *
 * `capacity` still bounds memory and sort cost: at high traffic the window
 * holds the newest `capacity` samples, which are all recent anyway.
 *
 * Time is whatever clock the caller passes as `now`, in milliseconds - the
 * same convention as `RateCounter`. Labs pass both the same `now`, so both
 * read the same clock - but a `RateCounter` has its own window length, so a
 * rate and a latency in one strip can cover different spans.
 * Timestamps must not go backwards between pushes.
 *
 * Writes are O(1): a lab at 5,000 req/sec pushes a sample per request, so
 * shifting an array on every one of them showed up in a profile.
 */
export class MetricWindow {
  private readonly values: number[];
  private readonly times: number[];
  /** Live samples, the newest ending just before `cursor`. */
  private filled = 0;
  /** Ring index the next sample is written to. */
  private cursor = 0;

  constructor(
    private readonly capacity = 400,
    private readonly horizonMs = METRIC_HORIZON_MS,
  ) {
    this.values = new Array<number>(capacity).fill(0);
    this.times = new Array<number>(capacity).fill(0);
  }

  /** `now` must come from the same clock the lab gives its RateCounters. */
  push(value: number, now: number) {
    this.values[this.cursor] = value;
    this.times[this.cursor] = now;
    this.cursor = (this.cursor + 1) % this.capacity;
    if (this.filled < this.capacity) this.filled += 1;
  }

  clear() {
    this.filled = 0;
    this.cursor = 0;
  }

  snapshot(now: number): WindowSnapshot {
    const sorted = this.sorted(now);
    if (sorted.length === 0) return { count: 0, avg: null, p50: null, p95: null, p99: null };
    let sum = 0;
    for (const value of sorted) sum += value;
    return {
      count: sorted.length,
      avg: sum / sorted.length,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
    };
  }

  /**
   * Drops samples older than the horizon. Pushes arrive in time order, so the
   * expired ones are always the oldest: walk forward from the tail until one
   * is still fresh. Amortized O(1) per sample.
   */
  private expire(now: number) {
    const cutoff = now - this.horizonMs;
    while (this.filled > 0) {
      const oldest = (this.cursor - this.filled + this.capacity) % this.capacity;
      if (this.times[oldest] >= cutoff) break;
      this.filled -= 1;
    }
  }

  /** The live samples, ascending. Percentiles ignore order. */
  private sorted(now: number) {
    this.expire(now);
    const result = new Array<number>(this.filled);
    const start = (this.cursor - this.filled + this.capacity) % this.capacity;
    for (let index = 0; index < this.filled; index += 1) {
      result[index] = this.values[(start + index) % this.capacity];
    }
    return result.sort((a, b) => a - b);
  }
}

/**
 * Rolling counter that reports a per-second rate over a sliding window.
 *
 * Counts live in fixed time buckets instead of one entry per event, so a lab
 * running at 20,000 events/sec costs the same as one running at 20. Storing a
 * timestamp per event meant a 40,000-element array being shifted every frame.
 */
export class RateCounter {
  private readonly buckets: number[];
  private readonly bucketMs: number;
  /** Ring index of the bucket currently being written. */
  private head = 0;
  /** When the current bucket started. Null until the first event or read. */
  private headAt: number | null = null;

  constructor(private readonly windowMs = 2000, bucketCount = 20) {
    this.buckets = new Array<number>(bucketCount).fill(0);
    this.bucketMs = windowMs / bucketCount;
  }

  add(count = 1, now = performance.now()) {
    this.advance(now);
    this.buckets[this.head] += count;
  }

  rate(now = performance.now()) {
    this.advance(now);
    let sum = 0;
    for (const bucket of this.buckets) sum += bucket;
    return (sum / this.windowMs) * 1000;
  }

  clear() {
    this.buckets.fill(0);
    this.head = 0;
    this.headAt = null;
  }

  /** Rolls the ring forward to `now`, zeroing whichever buckets just expired. */
  private advance(now: number) {
    if (this.headAt === null) {
      this.headAt = now;
      return;
    }
    const steps = Math.floor((now - this.headAt) / this.bucketMs);
    if (steps <= 0) return;

    if (steps >= this.buckets.length) {
      this.buckets.fill(0);
    } else {
      for (let step = 0; step < steps; step += 1) {
        this.head = (this.head + 1) % this.buckets.length;
        this.buckets[this.head] = 0;
      }
    }
    this.headAt += steps * this.bucketMs;
  }
}
