import type { ReactNode } from 'react';
import { Stat } from '@/components/ui';
import type { Tone } from '@/components/ui/Badge';

/**
 * Contextual explanations for every metric the labs display. Hovering a metric
 * should always answer "what am I looking at?".
 */
export const METRIC_HINTS: Record<string, string> = {
  rps: 'Requests the system is currently accepting per second.',
  throughput: 'Requests successfully completed per second.',
  latency: 'Average time to complete one request, measured over the recent window.',
  p50: 'Half of requests finished faster than this value.',
  p95: '95% of requests finished faster than this value. This is where most users notice slowness.',
  p99: '99% of requests finished faster than this value. The tail that generates support tickets.',
  errorRate: 'Share of requests that failed, usually because a component was over capacity.',
  cpu: 'How much of the available processing capacity is currently in use.',
  memory: 'How much of the available memory is currently in use.',
  utilization: 'Incoming load divided by capacity. Above 100% the component cannot keep up.',
  hitRate: 'Percentage of requests successfully served from cache.',
  missRate: 'Percentage of requests that were not in cache and had to go to the source.',
  dbQueries: 'Queries reaching the database per second. Caching is what keeps this low.',
  evictions: 'Entries removed from the cache because it ran out of space.',
  queueDepth: 'Messages waiting to be processed. Growing depth means consumers cannot keep up.',
  activeConnections: 'Requests currently in flight on this component.',
  failed: 'Requests rejected or dropped because capacity was exceeded.',
  replicationLag: 'How far behind the primary a replica currently is.',
  rowsScanned: 'Rows the database had to read to answer the query.',
  cost: 'Relative monthly cost. Useful for comparing options, not as a real quote.',
  instances: 'Number of application instances currently serving traffic.',
  allowed: 'Requests permitted by the rate limiter.',
  rejected: 'Requests rejected with HTTP 429 by the rate limiter.',
};

export interface MetricItem {
  key: string;
  label: string;
  value: ReactNode;
  unit?: string;
  tone?: Tone;
  hint?: string;
  sub?: ReactNode;
}

/** Live metrics strip shown under a lab diagram. */
export function MetricsPanel({ items, title = 'Live metrics' }: { items: MetricItem[]; title?: string }) {
  return (
    <div className="card p-4">
      <p className="label mb-3">{title}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
        {items.map((item) => (
          <Stat
            key={item.key}
            label={item.label}
            value={item.value}
            unit={item.unit}
            tone={item.tone}
            sub={item.sub}
            hint={item.hint ?? METRIC_HINTS[item.key]}
            size="sm"
          />
        ))}
      </div>
    </div>
  );
}
