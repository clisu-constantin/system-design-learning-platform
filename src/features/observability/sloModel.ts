/**
 * The model behind the SLO Lab: one service, one SLI, an SLO with its error
 * budget, burn-rate alerts and an SLA with service credits.
 *
 * Simplified, and said so in the UI: traffic is a constant 100 user requests
 * per second plus 25 from bots and probes, faults are fixed shares of that
 * traffic, and a 30-day month runs in a couple of real minutes. Requests are
 * counted in 5-minute buckets, which is enough for the burn-rate windows of the
 * Google SRE Workbook (chapter 5, "Alerting on SLOs").
 */

export const USER_RPS = 100;
export const SYNTHETIC_RPS = 25;
export const MONTH_MIN = 30 * 24 * 60;
export const MONTHLY_FEE = 5000;
/** The Bad deploy button: this share of requests fails with a 5xx for this long. */
export const INCIDENT_ERROR = 0.1;
export const INCIDENT_MIN = 240;
/** A request slower than this is not good under the status + speed SLI. */
export const LATENCY_THRESHOLD_MS = 300;

const BUCKET_MIN = 5;
/** Three days of 5-minute buckets: the longest alert window. */
const BUCKETS = (3 * 24 * 60) / BUCKET_MIN;

export type GoodDefinition = 'status' | 'status-latency';
export type MeasurementPoint = 'server' | 'load-balancer';

export interface SliDefinition {
  good: GoodDefinition;
  point: MeasurementPoint;
  countSynthetic: boolean;
}

export interface Faults {
  /** Share of requests that reach the server and get a 5xx. */
  errorRate: number;
  /** Share of answered requests slower than the latency threshold. */
  slowRate: number;
  /** Share of requests the load balancer fails to pass to the server (it answers 502). */
  dropRate: number;
}

interface Bucket {
  index: number;
  valid: number;
  bad: number;
}

export interface MonthResult {
  month: number;
  sli: number;
  users: number;
  sloMet: boolean;
  slaMet: boolean;
  creditPct: number;
}

export interface SloState {
  /** Simulated minutes since the start. */
  clock: number;
  month: number;
  monthValid: number;
  monthBad: number;
  userValid: number;
  userBad: number;
  buckets: Bucket[];
  incidentUntil: number;
  paging: boolean;
  ticket: boolean;
  budgetGone: boolean;
  slaBroken: boolean;
  history: MonthResult[];
  /** One point every 6 simulated hours, for the month chart. */
  series: { t: number; budget: number; sla: number; month: number }[];
}

export const createSloState = (): SloState => ({
  clock: 0,
  month: 1,
  monthValid: 0,
  monthBad: 0,
  userValid: 0,
  userBad: 0,
  buckets: Array.from({ length: BUCKETS }, () => ({ index: -1, valid: 0, bad: 0 })),
  incidentUntil: -1,
  paging: false,
  ticket: false,
  budgetGone: false,
  slaBroken: false,
  history: [],
  series: [{ t: 0, budget: 100, sla: 100, month: 100 }],
});

export const incidentActive = (state: SloState) => state.clock < state.incidentUntil;

/** The 5xx share right now, with a Bad deploy on top of the slider. */
export const currentErrorRate = (state: SloState, faults: Faults) =>
  Math.min(1, faults.errorRate + (incidentActive(state) ? INCIDENT_ERROR : 0));

/**
 * Requests per simulated minute: what the SLI counts, and what users felt.
 * Users feel a request as bad when it was dropped, failed, or slower than the
 * threshold - whatever the SLI happens to count.
 */
export function perMinute(sli: SliDefinition, faults: Faults, errorRate: number) {
  const users = USER_RPS * 60;
  const { slowRate, dropRate } = faults;
  const reached = users * (1 - dropRate);
  const userBad = users * (1 - (1 - dropRate) * (1 - errorRate) * (1 - slowRate));
  const badAtServer = sli.good === 'status' ? reached * errorRate : reached * (1 - (1 - errorRate) * (1 - slowRate));
  // A dropped request never reaches the server, so the server cannot count it.
  // The load balancer answered it with a 502, so its access log does.
  let valid = sli.point === 'server' ? reached : users;
  const bad = sli.point === 'server' ? badAtServer : users * dropRate + badAtServer;
  // Bots and probes hit cheap endpoints and always get a fast 200.
  if (sli.countSynthetic) valid += SYNTHETIC_RPS * 60;
  return { valid, bad, userValid: users, userBad };
}

export const monthElapsed = (state: SloState) => state.clock - (state.month - 1) * MONTH_MIN;

export const ratio = (bad: number, valid: number) => (valid > 0 ? bad / valid : 0);

/**
 * Error budget spent this month, in minutes of full outage: the bad share so far
 * times the minutes elapsed. At the end of the month it is exactly
 * (1 - SLI) x 30 days, so it compares directly with (1 - SLO) x 30 days.
 */
export const spentMinutes = (state: SloState) => ratio(state.monthBad, state.monthValid) * monthElapsed(state);

/** Burn rate over the last `minutes`: the bad share divided by the share the SLO allows. */
export function burnRate(state: SloState, minutes: number, slo: number) {
  // The bucket holding the last simulated minute. At a bucket boundary the next
  // bucket has no requests yet, and reading it would drop every alert for a frame.
  const current = Math.max(0, Math.ceil(state.clock / BUCKET_MIN) - 1);
  const oldest = current - Math.ceil(minutes / BUCKET_MIN) + 1;
  let valid = 0;
  let bad = 0;
  for (const bucket of state.buckets) {
    if (bucket.index >= oldest && bucket.index <= current) {
      valid += bucket.valid;
      bad += bucket.bad;
    }
  }
  return ratio(bad, valid) / (1 - slo);
}

/**
 * The multiwindow burn-rate alerts recommended for a 30-day SLO in the Google
 * SRE Workbook: each fires only while both its long and its short window burn
 * faster than the threshold, so it stops soon after the problem does.
 */
export const ALERT_RULES = [
  { long: 60, short: 5, burn: 14.4, action: 'page', label: '14.4x over 1 h' },
  { long: 360, short: 30, burn: 6, action: 'page', label: '6x over 6 h' },
  { long: 4320, short: 360, burn: 1, action: 'ticket', label: '1x over 3 days' },
] as const;

export function alertState(state: SloState, slo: number) {
  // A burn exactly on a threshold (0.6% errors against 99.9% is 6x) must not flap on float noise.
  const atLeast = (value: number, threshold: number) => value >= threshold * (1 - 1e-9);
  const firing = ALERT_RULES.filter(
    (rule) => atLeast(burnRate(state, rule.long, slo), rule.burn) && atLeast(burnRate(state, rule.short, slo), rule.burn),
  );
  return {
    page: firing.some((rule) => rule.action === 'page'),
    ticket: firing.some((rule) => rule.action === 'ticket'),
    rule: firing[0],
  };
}

/**
 * Service credit for a month, with tiers modelled on the Amazon EC2 SLA
 * (10%, 30%, 100% of the monthly bill) and simplified: 10% below the SLA,
 * 30% below 99.0% when the SLA is above that, 100% below 95%.
 */
export function creditPct(availability: number, sla: number) {
  if (availability >= sla) return 0;
  if (availability < 0.95) return 100;
  if (sla > 0.99 && availability < 0.99) return 30;
  return 10;
}

export interface Targets {
  slo: number;
  sla: number;
}

type Log = (message: string, tone: 'info' | 'ok' | 'warn' | 'danger') => void;

const pct = (value: number, digits = 2) => `${(value * 100).toFixed(digits)}%`;

/** Moves the simulation forward by `minutes` of simulated time. */
export function advance(state: SloState, minutes: number, sli: SliDefinition, faults: Faults, targets: Targets, log: Log) {
  let left = minutes;
  while (left > 1e-9) {
    const intoBucket = state.clock % BUCKET_MIN;
    const toMonthEnd = MONTH_MIN - monthElapsed(state);
    const toIncidentEnd = incidentActive(state) ? state.incidentUntil - state.clock : Infinity;
    const step = Math.min(left, BUCKET_MIN - intoBucket, toMonthEnd, toIncidentEnd);

    const counts = perMinute(sli, faults, currentErrorRate(state, faults));
    const index = Math.floor(state.clock / BUCKET_MIN);
    const bucket = state.buckets[index % BUCKETS];
    if (bucket.index !== index) {
      bucket.index = index;
      bucket.valid = 0;
      bucket.bad = 0;
    }
    bucket.valid += counts.valid * step;
    bucket.bad += counts.bad * step;
    state.monthValid += counts.valid * step;
    state.monthBad += counts.bad * step;
    state.userValid += counts.userValid * step;
    state.userBad += counts.userBad * step;

    const before = monthElapsed(state);
    const wasIncident = incidentActive(state);
    state.clock += step;
    left -= step;
    const after = monthElapsed(state);
    if (Math.floor(after / 360) > Math.floor(before / 360)) pushPoint(state, targets);

    if (wasIncident && !incidentActive(state)) {
      log('Bad deploy rolled back - the 5xx share is back to the slider value', 'ok');
    }
    watchThresholds(state, targets, log);
    if (after >= MONTH_MIN - 1e-9) closeMonth(state, targets, log);
  }
}

function pushPoint(state: SloState, targets: Targets) {
  const spent = spentMinutes(state);
  const point = {
    t: state.series.length,
    budget: Math.max(0, 100 * (1 - spent / ((1 - targets.slo) * MONTH_MIN))),
    sla: Math.max(0, 100 * (1 - spent / ((1 - targets.sla) * MONTH_MIN))),
    month: Math.max(0, 100 * (1 - monthElapsed(state) / MONTH_MIN)),
  };
  state.series = [...state.series, point];
}

function watchThresholds(state: SloState, targets: Targets, log: Log) {
  const spent = spentMinutes(state);
  const day = `Month ${state.month} day ${(monthElapsed(state) / 1440).toFixed(1)}`;
  if (!state.budgetGone && spent >= (1 - targets.slo) * MONTH_MIN) {
    state.budgetGone = true;
    log(`${day}: error budget spent - by the budget policy, risky changes stop and reliability work comes first`, 'danger');
  }
  if (!state.slaBroken && spent >= (1 - targets.sla) * MONTH_MIN) {
    state.slaBroken = true;
    log(`${day}: SLA ${pct(targets.sla, 2)} can no longer be met this month - service credits are owed`, 'danger');
  }
  const alerts = alertState(state, targets.slo);
  if (alerts.page && !state.paging) log(`${day}: PAGE - burn rate ${alerts.rule?.label}`, 'danger');
  if (!alerts.page && state.paging) log(`${day}: page resolved - burn rate back under the page thresholds`, 'ok');
  if (alerts.ticket && !alerts.page && !state.ticket) log(`${day}: ticket opened - burn rate 1x over 3 days, budget will run out`, 'warn');
  state.paging = alerts.page;
  state.ticket = alerts.ticket;
}

function closeMonth(state: SloState, targets: Targets, log: Log) {
  const sli = 1 - ratio(state.monthBad, state.monthValid);
  const users = 1 - ratio(state.userBad, state.userValid);
  const credit = creditPct(sli, targets.sla);
  const result: MonthResult = {
    month: state.month,
    sli,
    users,
    sloMet: sli >= targets.slo,
    slaMet: sli >= targets.sla,
    creditPct: credit,
  };
  state.history = [result, ...state.history].slice(0, 4);
  log(
    `Month ${state.month} closed: SLI ${pct(sli, 3)} - SLO ${result.sloMet ? 'met' : 'missed'}, SLA ${
      result.slaMet ? 'met, no credit' : `broken, ${credit}% credit (${Math.round((MONTHLY_FEE * credit) / 100)} euro)`
    }`,
    result.slaMet ? (result.sloMet ? 'ok' : 'warn') : 'danger',
  );
  state.month += 1;
  state.monthValid = 0;
  state.monthBad = 0;
  state.userValid = 0;
  state.userBad = 0;
  state.budgetGone = false;
  state.slaBroken = false;
  state.series = [{ t: 0, budget: 100, sla: 100, month: 100 }];
}
