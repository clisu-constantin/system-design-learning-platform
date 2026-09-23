const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const plain = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export const formatNumber = (value: number) => plain.format(Math.round(value));

export const formatCompact = (value: number) =>
  Math.abs(value) < 1000 ? plain.format(Math.round(value)) : compact.format(value);

/** `null` means no sample to report (an idle `MetricWindow`) and renders as a dash. */
export const formatLatency = (ms: number | null) =>
  ms === null
    ? '-'
    : ms >= 1000
      ? `${(ms / 1000).toFixed(2)} s`
      : `${ms < 10 ? ms.toFixed(1) : Math.round(ms)} ms`;

/**
 * Tone for a latency reading: neutral with no data, danger above `limit`, ok
 * otherwise. `LATENCY_TEXT` maps it to a text class for node stat rows.
 */
export const latencyTone = (ms: number | null, limit: number) =>
  ms === null ? 'neutral' : ms > limit ? 'danger' : 'ok';

export const LATENCY_TEXT = { neutral: 'text-muted', danger: 'text-danger', ok: 'text-ok' } as const;

export const formatPercent = (ratio: number, digits = 0) => `${(ratio * 100).toFixed(digits)}%`;

export function formatBytes(bytes: number) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 ? value.toFixed(2) : value.toFixed(0)} ${units[unit]}`;
}

export const formatClock = (date = new Date()) =>
  date.toLocaleTimeString('en-GB', { hour12: false });
