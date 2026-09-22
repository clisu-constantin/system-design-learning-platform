import { percentile } from '@/utils/math';

/**
 * Fixed-size ring buffer of samples. Used for latency distributions, where we
 * only care about the recent window rather than the whole history.
 *
 * Writes are O(1): a lab at 5,000 req/sec pushes a sample per request, so
 * shifting a 400-element array on every one of them showed up in a profile.
 */
export class MetricWindow {
  private readonly values: number[];
  private filled = 0;
  private cursor = 0;

  constructor(private readonly size = 400) {
    this.values = new Array<number>(size).fill(0);
  }

  push(value: number) {
    this.values[this.cursor] = value;
    this.cursor = (this.cursor + 1) % this.size;
    if (this.filled < this.size) this.filled += 1;
  }

  clear() {
    this.filled = 0;
    this.cursor = 0;
  }

  get count() {
    return this.filled;
  }

  get avg() {
    if (!this.filled) return 0;
    let sum = 0;
    for (let index = 0; index < this.filled; index += 1) sum += this.values[index];
    return sum / this.filled;
  }

  get max() {
    if (!this.filled) return 0;
    let max = this.values[0];
    for (let index = 1; index < this.filled; index += 1) {
      if (this.values[index] > max) max = this.values[index];
    }
    return max;
  }

  quantile(p: number) {
    return percentile(this.sorted(), p);
  }

  snapshot() {
    const sorted = this.sorted();
    return {
      count: sorted.length,
      avg: this.avg,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
    };
  }

  /** Only the slots that have been written, ascending. Percentiles ignore order. */
  private sorted() {
    return this.values.slice(0, this.filled).sort((a, b) => a - b);
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
