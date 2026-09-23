/**
 * The arithmetic behind the Capacity Lab, kept out of the component so the exact and the rough
 * estimate are the same steps with different rounding.
 *
 * Every constant here is a planning assumption, not a measurement: 1,000 requests/sec per app
 * server, 50% headroom and 10,000 writes/sec for one database primary are the round numbers people
 * use on a whiteboard. Real limits depend on the hardware, the code and the queries. Sizes are
 * decimal (1 KB = 1,000 bytes), the convention for napkin math; using 1,024 changes no decision.
 */

export interface CapacityInputs {
  dau: number;
  requestsPerUser: number;
  /** Share of requests that are writes, 0..1. */
  writeShare: number;
  objectSizeKb: number;
  peakFactor: number;
  retentionYears: number;
  replicationFactor: number;
}

/** Simplified planning assumption: requests/sec one app server handles when each request does real work. */
export const SERVER_CAPACITY = 1_000;
/** Provision 50% above the peak, so a spike or a lost server is not an outage. */
export const HEADROOM = 1.5;
/** Simplified planning assumption: writes/sec one database primary absorbs before writes must be partitioned. */
export const PRIMARY_WRITE_LIMIT = 10_000;
/** Share of one day of new objects kept in cache (the 80/20 rule of thumb). */
export const HOT_SHARE = 0.2;

export const SECONDS_PER_DAY = 86_400;
export const DAYS_PER_YEAR = 365;

/** The numbers an estimate actually multiplied - rounded ones in rough mode. */
export interface UsedInputs {
  dau: number;
  requestsPerUser: number;
  secondsPerDay: number;
  peakFactor: number;
  writeShare: number;
  objectBytes: number;
  daysPerYear: number;
  retentionYears: number;
  replicationFactor: number;
}

export interface Estimate {
  used: UsedInputs;
  requestsPerDay: number;
  avgQps: number;
  peakQps: number;
  writesPerDay: number;
  writeQps: number;
  peakWriteQps: number;
  peakReadQps: number;
  dailyBytes: number;
  yearlyBytes: number;
  retainedBytes: number;
  storedBytes: number;
  bandwidthBytesPerSec: number;
  cacheBytes: number;
  serversAtPeak: number;
  servers: number;
}

/** The nearest power of ten, measured on a log scale (so 3 rounds to 1 and 4 rounds to 10). */
export const toPowerOfTen = (value: number) => (value <= 0 ? 0 : 10 ** Math.round(Math.log10(value)));

/** One significant figure: 11,574 -> 10,000; 0.15 -> 0.2; 365 -> 400. */
export function toOneFigure(value: number) {
  if (value <= 0) return 0;
  const exponent = Math.floor(Math.log10(value));
  const scale = 10 ** exponent;
  const rounded = Math.round(value / scale) * scale;
  // Clean floating-point noise such as 0.30000000000000004.
  return Number(rounded.toPrecision(1));
}

function serversFor(peakQps: number) {
  const serversAtPeak = Math.max(1, Math.ceil(peakQps / SERVER_CAPACITY));
  return { serversAtPeak, servers: Math.ceil(serversAtPeak * HEADROOM) };
}

/** Every step with the inputs as given. */
export function exactEstimate(input: CapacityInputs): Estimate {
  const used: UsedInputs = {
    dau: input.dau,
    requestsPerUser: input.requestsPerUser,
    secondsPerDay: SECONDS_PER_DAY,
    peakFactor: input.peakFactor,
    writeShare: input.writeShare,
    objectBytes: input.objectSizeKb * 1_000,
    daysPerYear: DAYS_PER_YEAR,
    retentionYears: input.retentionYears,
    replicationFactor: input.replicationFactor,
  };
  const requestsPerDay = used.dau * used.requestsPerUser;
  const avgQps = requestsPerDay / used.secondsPerDay;
  const peakQps = avgQps * used.peakFactor;
  const writesPerDay = requestsPerDay * used.writeShare;
  const writeQps = avgQps * used.writeShare;
  const peakWriteQps = writeQps * used.peakFactor;
  const dailyBytes = writesPerDay * used.objectBytes;
  const yearlyBytes = dailyBytes * used.daysPerYear;
  const retainedBytes = yearlyBytes * used.retentionYears;
  return {
    used,
    requestsPerDay,
    avgQps,
    peakQps,
    writesPerDay,
    writeQps,
    peakWriteQps,
    peakReadQps: peakQps - peakWriteQps,
    dailyBytes,
    yearlyBytes,
    retainedBytes,
    storedBytes: retainedBytes * used.replicationFactor,
    bandwidthBytesPerSec: peakQps * used.objectBytes,
    cacheBytes: dailyBytes * HOT_SHARE,
    ...serversFor(peakQps),
  };
}

/**
 * The same steps done on a napkin: the big numbers (users, requests per user, seconds in a day,
 * bytes per object) become powers of ten, the small multipliers keep one significant figure, and
 * every step's result is rounded to one figure before the next step uses it.
 */
export function roughEstimate(input: CapacityInputs): Estimate {
  const r = toOneFigure;
  const used: UsedInputs = {
    dau: toPowerOfTen(input.dau),
    requestsPerUser: toPowerOfTen(input.requestsPerUser),
    secondsPerDay: 100_000,
    peakFactor: r(input.peakFactor),
    writeShare: r(input.writeShare),
    objectBytes: toPowerOfTen(input.objectSizeKb * 1_000),
    daysPerYear: r(DAYS_PER_YEAR),
    retentionYears: r(input.retentionYears),
    replicationFactor: r(input.replicationFactor),
  };
  const requestsPerDay = r(used.dau * used.requestsPerUser);
  const avgQps = r(requestsPerDay / used.secondsPerDay);
  const peakQps = r(avgQps * used.peakFactor);
  const writesPerDay = r(requestsPerDay * used.writeShare);
  const writeQps = r(avgQps * used.writeShare);
  const peakWriteQps = r(writeQps * used.peakFactor);
  const dailyBytes = r(writesPerDay * used.objectBytes);
  const yearlyBytes = r(dailyBytes * used.daysPerYear);
  const retainedBytes = r(yearlyBytes * used.retentionYears);
  return {
    used,
    requestsPerDay,
    avgQps,
    peakQps,
    writesPerDay,
    writeQps,
    peakWriteQps,
    peakReadQps: r(Math.max(0, peakQps - peakWriteQps)),
    dailyBytes,
    yearlyBytes,
    retainedBytes,
    storedBytes: r(retainedBytes * used.replicationFactor),
    bandwidthBytesPerSec: r(peakQps * used.objectBytes),
    cacheBytes: r(dailyBytes * HOT_SHARE),
    ...serversFor(peakQps),
  };
}

/** How far apart two estimates are, as a factor of at least 1 (2 means one is twice the other). */
export function offBy(rough: number, exact: number) {
  if (rough <= 0 || exact <= 0) return rough === exact ? 1 : Infinity;
  return Math.max(rough / exact, exact / rough);
}

export type ScaleCategory = 'one-machine' | 'fleet' | 'partitioned';

/**
 * The decision an estimate is really for. Boundaries are the rule of thumb from the Lesson:
 * under ~1,000 peak req/sec one machine and a spare, up to ~50,000 a scaled-out fleet with caching,
 * above that partitioned data and per-region deployment.
 */
export function scaleOf(peakQps: number): ScaleCategory {
  if (peakQps < 1_000) return 'one-machine';
  if (peakQps <= 50_000) return 'fleet';
  return 'partitioned';
}

export const SCALE_LABEL: Record<ScaleCategory, string> = {
  'one-machine': 'One machine and a spare',
  fleet: 'A fleet behind a load balancer',
  partitioned: 'Partitioned, per-region fleet',
};

const SUPERSCRIPT: Record<string, string> = {
  '-': '⁻',
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
};

/** A rough number the way it is written on a napkin: 10^4, 5 x 10^3, 0.1, 400. */
export function formatPowerOfTen(value: number) {
  if (value <= 0) return '0';
  const exponent = Math.floor(Math.log10(value) + 1e-9);
  if (exponent < 3) return `${Number(value.toPrecision(2))}`;
  const mantissa = Number((value / 10 ** exponent).toPrecision(2));
  const power = `10${String(exponent)
    .split('')
    .map((char) => SUPERSCRIPT[char] ?? char)
    .join('')}`;
  return mantissa === 1 ? power : `${mantissa} x ${power}`;
}

/** Decimal byte sizes, 1 KB = 1,000 bytes. */
export function formatSize(bytes: number) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1_000 && unit < units.length - 1) {
    value /= 1_000;
    unit += 1;
  }
  return `${value < 10 ? Number(value.toFixed(1)) : Math.round(value)} ${units[unit]}`;
}
