/**
 * The running system behind the Monitoring Lab, one simulated second at a time.
 *
 * Simplified model, not a measurement. A shop with a gateway, an orders service, a payments
 * service and a database serves two kinds of request: checkout (orders -> payments) and browse
 * (orders -> database). Every simulated second produces what real telemetry would: request and
 * error counts, a latency histogram per service, a few sampled requests with their log lines, and
 * a saturation gauge. Faults change those numbers the way the real failure would, so logs, metrics,
 * dashboards and alert rules all read from the same data.
 */

/** One real second of the Lab is this many simulated seconds, so a 2-minute `for` is 12 s of waiting. */
export const SIM_SPEED = 10;
/** Simulated seconds of history kept for charts and windows. */
export const HISTORY_S = 900;

export const SERVICES = ['gateway', 'orders', 'payments', 'db'] as const;
export type ServiceId = (typeof SERVICES)[number];
export const SERVICE_LABEL: Record<ServiceId, string> = {
  gateway: 'Gateway',
  orders: 'Orders',
  payments: 'Payments',
  db: 'Database',
};

export type Fault = 'none' | 'payment-errors' | 'slow-db' | 'blips' | 'unreachable';
export type Panel = 'logs' | 'metrics' | 'dashboard' | 'alerts';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogFormat = 'text' | 'json';
export type AlertSignal = 'error-ratio' | 'p99' | 'cpu';

export interface Setup {
  panel: Panel;
  /** Requests per second the users send, before the daily wave. */
  traffic: number;
  fault: Fault;
  /** Share of payment calls failing, of DB queries slow, or error ratio of a blip - depends on the fault. */
  faultSize: number;
  logFormat: LogFormat;
  logLevel: LogLevel;
  /** Keep 10% of successful requests' log lines, and every line of a failing one. */
  sampleSuccess: boolean;
  /** Aggregation window of the metric graphs, in simulated seconds. */
  windowS: number;
  /** Adds a user_id label to the request metrics - the cardinality mistake. */
  userIdLabel: boolean;
  /** The black-box probe: a scripted user journey from outside. */
  probe: boolean;
  alertSignal: AlertSignal;
  threshold: number;
  /** How long the condition must hold before the rule fires, in simulated seconds. */
  forS: number;
}

export const FAULTS: { value: Fault; label: string; sized: boolean }[] = [
  { value: 'none', label: 'No fault', sized: false },
  { value: 'payment-errors', label: 'Payments failing', sized: true },
  { value: 'slow-db', label: 'Slow database queries', sized: true },
  { value: 'blips', label: 'Short error blips (heal alone)', sized: true },
  { value: 'unreachable', label: 'Users cannot reach us (DNS)', sized: false },
];

/** What the fault size slider means for each fault. */
export const FAULT_SIZE_LABEL: Record<Fault, string> = {
  none: 'Fault size',
  'payment-errors': 'Payment calls failing',
  'slow-db': 'Database queries slow',
  blips: 'Payment calls failing in a blip',
  unreachable: 'Fault size',
};

export const SIGNALS: Record<AlertSignal, { label: string; rule: string; unit: string; min: number; max: number; step: number; start: number }> = {
  'error-ratio': { label: 'Error ratio (symptom)', rule: 'gateway error ratio [1m]', unit: '%', min: 0.5, max: 20, step: 0.5, start: 2 },
  p99: { label: 'p99 latency (symptom)', rule: 'gateway p99 latency [1m]', unit: 'ms', min: 200, max: 3000, step: 100, start: 1000 },
  cpu: { label: 'CPU (cause)', rule: 'orders CPU', unit: '%', min: 30, max: 95, step: 5, start: 60 },
};

/** Share of requests that are checkouts (orders -> payments); the rest browse (orders -> database). */
export const CHECKOUT_SHARE = 0.4;
/** Requests per second one orders instance handles at 100% CPU. */
const ORDERS_CAPACITY = 900;
/** Database connection pool size - saturation is connections in use over this. */
const DB_POOL = 50;
/** Payment calls per second the card processor contract allows. */
const PAYMENTS_QUOTA = 400;
/** Blips: this many seconds of errors, every BLIP_EVERY seconds. */
export const BLIP_LENGTH_S = 20;
export const BLIP_EVERY_S = 150;
/** The daily wave, squeezed into 10 simulated minutes so it is visible. */
const WAVE_PERIOD_S = 600;
/** Share of users still reaching us while DNS is broken (they have the old answer cached). */
const REACH_WHEN_UNREACHABLE = 0.03;
const BASE_PAYMENT_ERRORS = 0.001;
/** Requests simulated individually per second; counts are scaled up from them. */
const SAMPLES_PER_SECOND = 120;

/** Histogram bucket upper bounds in ms, Prometheus style (`le`), last one is +Inf. */
export const BUCKETS_MS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, Infinity];

export interface ServiceSecond {
  req: number;
  err: number;
  /** Count per bucket of BUCKETS_MS (not cumulative). */
  hist: number[];
  sumMs: number;
}

export interface Second {
  t: number;
  /** Requests users sent this second, before any of them failed to arrive. */
  offered: number;
  /** Share of those that reached the gateway. */
  reachShare: number;
  services: Record<ServiceId, ServiceSecond>;
  /** Saturation gauges, 0..1. */
  saturation: Record<ServiceId, number>;
  /** Result of the black-box probe this second, if it ran. */
  probe: 'pass' | 'fail' | null;
  /** Users are clearly having a bad time (errors, slowness or not reaching us), over the last 10 s. Set by markHurt. */
  hurt: boolean;
  alert: AlertPhase;
}

export interface LogLine {
  t: number;
  level: LogLevel;
  service: ServiceId;
  msg: string;
  fields: Record<string, string | number>;
}

export interface Trace {
  id: string;
  t: number;
  route: '/checkout' | '/products';
  failed: boolean;
  lines: LogLine[];
}

export type AlertPhase = 'ok' | 'pending' | 'firing';

export interface AlertState {
  phase: AlertPhase;
  pendingSince: number | null;
  firingSince: number | null;
  /** Whether sustained user pain happened while this alert was pending or firing. */
  sawRealPain: boolean;
  pages: number;
  noisyPages: number;
  /** Simulated seconds users were hurt for over a minute with no alert firing. */
  missedS: number;
  /** Consecutive seconds of user pain. */
  hurtRun: number;
}

export const newAlertState = (): AlertState => ({
  phase: 'ok',
  pendingSince: null,
  firingSince: null,
  sawRealPain: false,
  pages: 0,
  noisyPages: 0,
  missedS: 0,
  hurtRun: 0,
});

const emptyService = (): ServiceSecond => ({ req: 0, err: 0, hist: BUCKETS_MS.map(() => 0), sumMs: 0 });

const bucketIndex = (ms: number) => BUCKETS_MS.findIndex((bound) => ms <= bound);

export function blipActive(t: number) {
  return t % BLIP_EVERY_S >= BLIP_EVERY_S - BLIP_LENGTH_S;
}

/** Payment failure probability at simulated second `t`. */
export function paymentErrorRate(setup: Setup, t: number) {
  if (setup.fault === 'payment-errors') return setup.faultSize;
  if (setup.fault === 'blips' && blipActive(t)) return setup.faultSize;
  return BASE_PAYMENT_ERRORS;
}

// Park-Miller generator: stays well inside safe integers, and gives ids that look random.
let traceCounter = 0x4bf92f;
const nextTraceId = () => {
  traceCounter = (traceCounter * 48271) % 0x7fffffff;
  return traceCounter.toString(16).padStart(8, '0').slice(-6);
};

/**
 * Simulates one second of the shop. Returns the second's telemetry and a couple of sampled
 * requests with full log lines (always including a failing one when there was a failure).
 */
export function simulateSecond(setup: Setup, t: number, random: () => number): { second: Second; traces: Trace[] } {
  const wave = 1 + 0.2 * Math.sin((2 * Math.PI * t) / WAVE_PERIOD_S);
  const offered = setup.traffic * wave * (0.95 + 0.1 * random());
  const reaching = setup.fault === 'unreachable' ? offered * REACH_WHEN_UNREACHABLE : offered;
  const services = { gateway: emptyService(), orders: emptyService(), payments: emptyService(), db: emptyService() };
  const payErr = paymentErrorRate(setup, t);
  const slowShare = setup.fault === 'slow-db' ? setup.faultSize : 0;

  const samples = Math.max(1, Math.min(SAMPLES_PER_SECOND, Math.round(reaching)));
  const weight = reaching / samples;
  const traces: Trace[] = [];
  let failingKept = false;

  const record = (service: ServiceId, ms: number, failed: boolean) => {
    const s = services[service];
    s.req += weight;
    if (failed) s.err += weight;
    s.hist[bucketIndex(ms)] += weight;
    s.sumMs += ms * weight;
  };

  for (let index = 0; index < samples; index += 1) {
    const checkout = random() < CHECKOUT_SHARE;
    const gatewayOwn = 3 + 3 * random();
    const ordersOwn = 12 + 25 * random() ** 2;
    let downstream: number;
    let failed = false;
    let slow = false;
    if (checkout) {
      failed = random() < payErr;
      downstream = failed ? 70 + 40 * random() : 55 + 120 * random() ** 3;
      record('payments', downstream, failed);
    } else {
      slow = random() < slowShare;
      downstream = slow ? 1500 + 1000 * random() : 3 + 14 * random() ** 2;
      record('db', downstream, false);
    }
    const ordersMs = ordersOwn + downstream;
    record('orders', ordersMs, failed);
    const gatewayMs = gatewayOwn + ordersMs;
    record('gateway', gatewayMs, failed);

    const keepAsSample = index < 2 || (failed && !failingKept) || (slow && traces.length < 3);
    if (keepAsSample) {
      if (failed) failingKept = true;
      traces.push(buildTrace(t, checkout, failed, slow, { gatewayMs, ordersMs, downstream }));
    }
  }

  const dbRate = services.db.req;
  const dbAvgMs = dbRate > 0 ? services.db.sumMs / dbRate : 0;
  const saturation: Record<ServiceId, number> = {
    gateway: Math.min(1, reaching / 3000),
    orders: Math.min(1, reaching / ORDERS_CAPACITY + 0.03 * random()),
    payments: Math.min(1, services.payments.req / PAYMENTS_QUOTA),
    // Little's law: connections busy = queries per second x seconds per query.
    db: Math.min(1, (dbRate * dbAvgMs) / 1000 / DB_POOL),
  };

  let probe: Second['probe'] = null;
  if (setup.probe && t % 10 === 0) probe = setup.fault === 'unreachable' ? 'fail' : 'pass';

  const reachShare = offered > 0 ? reaching / offered : 1;
  return { second: { t, offered, reachShare, services, saturation, probe, hurt: false, alert: 'ok' }, traces };
}

/**
 * Whether users are clearly hurting at the newest second, judged over the last 10 seconds so one
 * unlucky sample does not count: over 1% of requests failing, p99 over 1 s, or under half of the
 * users reaching the gateway at all.
 */
export function markHurt(history: Second[]) {
  const now = history[history.length - 1];
  const agg = aggregate(history, 'gateway', 10);
  now.hurt = agg.errorRatio > 0.01 || agg.p99 > 1000 || now.reachShare < 0.5;
}

function buildTrace(
  t: number,
  checkout: boolean,
  failed: boolean,
  slow: boolean,
  ms: { gatewayMs: number; ordersMs: number; downstream: number },
): Trace {
  const id = nextTraceId();
  const route = checkout ? '/checkout' : '/products';
  const lines: LogLine[] = [];
  const add = (level: LogLevel, service: ServiceId, msg: string, fields: Record<string, string | number> = {}) =>
    lines.push({ t, level, service, msg, fields });
  add('info', 'gateway', 'request received', { route, method: checkout ? 'POST' : 'GET' });
  if (checkout) {
    add('debug', 'orders', 'loading cart', { items: 3 });
    add('info', 'orders', 'calling payments', { amount_eur: 42.5 });
    add('debug', 'payments', 'charge attempt', { processor: 'acme-pay' });
    if (failed) {
      add('error', 'payments', 'card processor returned 503', { processor: 'acme-pay', duration_ms: Math.round(ms.downstream) });
      add('warn', 'orders', 'payment failed, returning 502', { order_id: 9000 + Math.round(ms.ordersMs) });
    } else {
      add('info', 'payments', 'charge ok', { duration_ms: Math.round(ms.downstream) });
    }
  } else {
    add('debug', 'orders', 'querying products', { category: 'shoes' });
    if (slow) add('warn', 'db', 'slow query', { duration_ms: Math.round(ms.downstream), table: 'products' });
  }
  add('info', 'gateway', 'response sent', { status: failed ? 502 : 200, duration_ms: Math.round(ms.gatewayMs) });
  return { id, t, route, failed, lines };
}

/**
 * Percentile from bucket counts, the way Prometheus histogram_quantile does it: find the bucket
 * holding the rank and interpolate linearly inside it. So it is an estimate, only as precise as
 * the bucket bounds.
 */
export function quantile(q: number, hist: number[]) {
  const total = hist.reduce((sum, count) => sum + count, 0);
  if (total <= 0) return 0;
  const rank = q * total;
  let seen = 0;
  for (let index = 0; index < hist.length; index += 1) {
    const count = hist[index];
    if (seen + count >= rank && count > 0) {
      const lower = index === 0 ? 0 : BUCKETS_MS[index - 1];
      const upper = Number.isFinite(BUCKETS_MS[index]) ? BUCKETS_MS[index] : lower;
      return lower + (upper - lower) * ((rank - seen) / count);
    }
    seen += count;
  }
  return BUCKETS_MS[BUCKETS_MS.length - 2];
}

export interface Aggregate {
  /** Requests per second over the window. */
  rate: number;
  errorRatio: number;
  avgMs: number;
  p50: number;
  p95: number;
  p99: number;
  hist: number[];
  saturation: number;
}

/** Aggregates the last `windowS` seconds ending at index `end` (inclusive) of the history. */
export function aggregate(history: Second[], service: ServiceId, windowS: number, end = history.length - 1): Aggregate {
  const hist = BUCKETS_MS.map(() => 0);
  let req = 0;
  let err = 0;
  let sumMs = 0;
  let saturation = 0;
  const start = Math.max(0, end - windowS + 1);
  const count = end - start + 1;
  for (let index = start; index <= end; index += 1) {
    const s = history[index].services[service];
    req += s.req;
    err += s.err;
    sumMs += s.sumMs;
    saturation += history[index].saturation[service];
    for (let b = 0; b < hist.length; b += 1) hist[b] += s.hist[b];
  }
  return {
    rate: count > 0 ? req / count : 0,
    errorRatio: req > 0 ? err / req : 0,
    avgMs: req > 0 ? sumMs / req : 0,
    p50: quantile(0.5, hist),
    p95: quantile(0.95, hist),
    p99: quantile(0.99, hist),
    hist,
    saturation: count > 0 ? saturation / count : 0,
  };
}

/** The alert rule value at history index `end`, in the rule unit. */
export function signalValue(history: Second[], signal: AlertSignal, end = history.length - 1) {
  if (history.length === 0) return 0;
  if (signal === 'cpu') return history[end].saturation.orders * 100;
  const agg = aggregate(history, 'gateway', 60, end);
  return signal === 'p99' ? agg.p99 : agg.errorRatio * 100;
}

/**
 * Evaluates the alert rule once per simulated second, like Prometheus: the condition must hold
 * for `forS` seconds (pending) before the alert fires. A page is counted as noise when no
 * sustained user pain (over a minute) happened while it was pending or firing.
 */
export function evaluateAlert(
  alert: AlertState,
  setup: Setup,
  history: Second[],
  onChange: (message: string, tone: 'ok' | 'warn' | 'danger') => void,
) {
  const now = history[history.length - 1];
  alert.hurtRun = now.hurt ? alert.hurtRun + 1 : 0;
  const realPain = alert.hurtRun >= 60;
  const value = signalValue(history, setup.alertSignal);
  const condition = value > setup.threshold;
  const unit = SIGNALS[setup.alertSignal].unit;

  if (condition) {
    if (alert.pendingSince === null) {
      alert.pendingSince = now.t;
      alert.sawRealPain = false;
    }
    if (realPain) alert.sawRealPain = true;
    if (alert.phase !== 'firing' && now.t - alert.pendingSince >= setup.forS) {
      alert.phase = 'firing';
      alert.firingSince = now.t;
      alert.pages += 1;
      onChange(`PAGE: ${SIGNALS[setup.alertSignal].rule} = ${formatValue(value, unit)} > ${formatValue(setup.threshold, unit)}`, 'danger');
    } else if (alert.phase === 'ok') {
      alert.phase = 'pending';
    }
  } else {
    if (alert.phase === 'firing') {
      const noisy = !alert.sawRealPain;
      if (noisy) alert.noisyPages += 1;
      onChange(
        noisy
          ? `Resolved after ${Math.round(now.t - (alert.firingSince ?? now.t))} s with no lasting user pain - a noisy page`
          : 'Alert resolved',
        noisy ? 'warn' : 'ok',
      );
    }
    alert.phase = 'ok';
    alert.pendingSince = null;
    alert.firingSince = null;
  }
  if (realPain && alert.phase !== 'firing') alert.missedS += 1;
  now.alert = alert.phase;
}

const formatValue = (value: number, unit: string) =>
  unit === 'ms' ? `${Math.round(value)} ms` : `${value.toFixed(1)}${unit}`;

/** Log lines per request at or above each level, for the volume estimate. */
const LEVEL_RANK: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
export const levelKept = (line: LogLevel, minimum: LogLevel) => LEVEL_RANK[line] >= LEVEL_RANK[minimum];

/** Bytes per line: a short sentence, or a JSON object with the context fields. Rough, for scale only. */
export const BYTES_PER_LINE: Record<LogFormat, number> = { text: 110, json: 320 };

/**
 * Keeps a successful trace in about one in ten cases when sampling is on. Decided by the trace
 * id, like head sampling, so every line of one request is kept or dropped together.
 */
export const traceKept = (trace: Trace, sampleSuccess: boolean) =>
  !sampleSuccess || trace.failed || parseInt(trace.id.slice(-2), 16) % 10 === 0;

/**
 * Log lines written per second for the current traffic and fault, given the level and sampling.
 * Counted from a typical request of each kind rather than from the simulation.
 */
export function logVolume(setup: Setup, requestsPerSecond: number, payErr: number) {
  const perKind = (failed: boolean, checkout: boolean, slow: boolean) => {
    const lines = buildTrace(0, checkout, failed, slow, { gatewayMs: 0, ordersMs: 0, downstream: 0 }).lines;
    return lines.filter((line) => levelKept(line.level, setup.logLevel)).length;
  };
  const slowShare = setup.fault === 'slow-db' ? setup.faultSize : 0;
  const keepOk = setup.sampleSuccess ? 0.1 : 1;
  const checkoutRate = requestsPerSecond * CHECKOUT_SHARE;
  const browseRate = requestsPerSecond - checkoutRate;
  const lines =
    checkoutRate * (1 - payErr) * perKind(false, true, false) * keepOk +
    checkoutRate * payErr * perKind(true, true, false) +
    browseRate * (1 - slowShare) * perKind(false, false, false) * keepOk +
    browseRate * slowShare * perKind(false, false, true) * keepOk;
  return { linesPerSecond: lines, bytesPerDay: lines * BYTES_PER_LINE[setup.logFormat] * 86400 };
}

/**
 * Time series the metrics backend stores for the request metrics. Every distinct combination
 * of label values is its own series: 4 services x 2 routes x 3 status classes x (10 buckets +
 * sum + count) = 288, plus a handful of gauges. A user_id label multiplies that by the number
 * of distinct users. Simplified count, for scale only.
 */
export const ACTIVE_USERS = 25000;
export function seriesCount(userIdLabel: boolean) {
  const base = SERVICES.length * 2 * 3 * (BUCKETS_MS.length + 2);
  const gauges = SERVICES.length * 2;
  return (userIdLabel ? base * ACTIVE_USERS : base) + gauges;
}

/** Simulated clock text, starting at 10:00:00. */
export function clockText(t: number) {
  const total = 10 * 3600 + Math.floor(t);
  const h = Math.floor(total / 3600) % 24;
  const m = Math.floor(total / 60) % 60;
  const s = total % 60;
  return [h, m, s].map((part) => String(part).padStart(2, '0')).join(':');
}

export function durationText(seconds: number) {
  const s = Math.round(seconds);
  if (s < 60) return `${s} s`;
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}
