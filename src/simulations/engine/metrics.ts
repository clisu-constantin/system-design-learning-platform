import { percentile } from '@/utils/math';

/**
 * Fixed-size ring buffer of samples. Used for latency distributions, where we
 * only care about the recent window rather than the whole history.
 */
export class MetricWindow {
  private values: number[] = [];

  constructor(private readonly size = 400) {}

  push(value: number) {
    this.values.push(value);
    if (this.values.length > this.size) this.values.shift();
  }

  clear() {
    this.values = [];
  }

  get count() {
    return this.values.length;
  }

  get avg() {
    if (!this.values.length) return 0;
    let sum = 0;
    for (const value of this.values) sum += value;
    return sum / this.values.length;
  }

  get max() {
    return this.values.length ? Math.max(...this.values) : 0;
  }

  quantile(p: number) {
    return percentile([...this.values].sort((a, b) => a - b), p);
  }

  snapshot() {
    const sorted = [...this.values].sort((a, b) => a - b);
    return {
      count: sorted.length,
      avg: this.avg,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
    };
  }
}

/** Rolling counter that reports a per-second rate over a sliding window. */
export class RateCounter {
  private events: number[] = [];

  constructor(private readonly windowMs = 2000) {}

  add(count = 1, now = performance.now()) {
    for (let i = 0; i < count; i += 1) this.events.push(now);
    this.trim(now);
  }

  rate(now = performance.now()) {
    this.trim(now);
    return (this.events.length / this.windowMs) * 1000;
  }

  clear() {
    this.events = [];
  }

  private trim(now: number) {
    const cutoff = now - this.windowMs;
    while (this.events.length && this.events[0] < cutoff) this.events.shift();
  }
}
