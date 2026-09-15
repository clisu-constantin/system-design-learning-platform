import { clamp } from '@/utils/math';

export interface LoadResponse {
  /** 0..1+ - above 1 the node is over capacity. */
  utilization: number;
  /** 0..1 - what a dashboard would show for CPU. */
  cpu: number;
  latencyMs: number;
  /** 0..1 share of requests that fail. */
  errorRate: number;
  saturated: boolean;
}

export interface LoadOptions {
  /** Latency with no queueing at all. */
  baseLatencyMs?: number;
  /** Utilization at which queueing starts to hurt noticeably. */
  kneeAt?: number;
  /** Latency ceiling so charts stay readable. */
  maxLatencyMs?: number;
}

/**
 * Educational queueing model.
 *
 * It is deliberately a simplification of M/M/1: latency grows slowly until the
 * knee, then sharply as utilization approaches 1, and requests start failing
 * once demand exceeds capacity. The goal is a believable feel, not a
 * scientifically accurate queueing simulation.
 */
export function computeLoad(
  incoming: number,
  capacity: number,
  { baseLatencyMs = 20, kneeAt = 0.7, maxLatencyMs = 4000 }: LoadOptions = {},
): LoadResponse {
  if (capacity <= 0) {
    return { utilization: Infinity, cpu: 1, latencyMs: maxLatencyMs, errorRate: 1, saturated: true };
  }

  const utilization = incoming / capacity;
  const served = Math.min(utilization, 1);
  const queueing = served < 0.98 ? 1 / (1 - served) : 50;
  const pressure = served <= kneeAt ? 1 + served * 0.35 : queueing * 0.55;
  const overflow = Math.max(0, utilization - 1);

  const latencyMs = clamp(baseLatencyMs * pressure * (1 + overflow * 2.5), baseLatencyMs, maxLatencyMs);
  const errorRate = overflow <= 0 ? 0 : clamp(overflow / (1 + overflow), 0, 0.98);

  return {
    utilization,
    cpu: clamp(utilization * 0.94 + (utilization > 1 ? 0.06 : 0), 0, 1),
    latencyMs,
    errorRate,
    saturated: utilization >= 1,
  };
}

/** Distance-based network latency used by the CDN and replication labs. */
export const networkLatency = (km: number) => 8 + km / 90;
