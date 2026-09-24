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

/**
 * A duration in seconds as the one unit that reads best: "850 ms", "4.2 s", "42 s", "2.5 min",
 * "17 min", "8.8 h" or "3.1 days". Seconds and minutes keep a decimal only below 10.
 */
export function formatSeconds(seconds: number) {
  if (seconds <= 0) return '0 s';
  if (seconds < 1) return `${Math.max(1, Math.round(seconds * 1000))} ms`;
  if (seconds >= 2 * 86400) return `${(seconds / 86400).toFixed(1)} days`;
  if (seconds >= 3600) return `${(seconds / 3600).toFixed(1)} h`;
  if (seconds >= 60) return `${(seconds / 60).toFixed(seconds < 600 ? 1 : 0)} min`;
  return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
}

/** A duration in seconds as "850 ms", "4.2 s", "42 s" or "2 min 5 s": minutes and seconds, never hours. */
export function formatSecondsMinSec(seconds: number) {
  if (seconds < 1) return formatLatency(seconds * 1000);
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min ${Math.round(seconds - minutes * 60)} s`;
}

/** A duration in hours as "36 min", "5.0 h" or "2.1 days". */
export function formatHours(hours: number) {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} days`;
}
