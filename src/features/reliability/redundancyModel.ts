/**
 * The availability arithmetic behind the Redundancy Lab.
 *
 * Simplified model, not a measurement. It assumes every part fails independently of
 * every other part (except through a shared zone), that a failed part is repaired in
 * REPAIR_HOURS, and that a tier in series with the others is needed by every request.
 * It is there to make three real rules visible:
 *
 * - in series, availabilities multiply down (every part a request needs is one more factor);
 * - in parallel, failure probabilities multiply down (n copies fail together with q^n);
 * - a redundant pair is only as good as its failover: each failure still costs the time
 *   it takes to notice and switch.
 */

export type Tier = 'lb' | 'app' | 'config' | 'db';
export type Zone = 'A' | 'B';
export type FailoverMode = 'automatic' | 'manual';
export type Replication = 'async' | 'sync';

/** The design choices the model needs. The Lab setup carries more (live-only controls). */
export interface Design {
  lbCopies: number;
  appCopies: number;
  configCopies: number;
  standby: boolean;
  zones: 1 | 2;
  failover: FailoverMode;
  /** Share of the time each single part is up, 0..1. */
  partAvailability: number;
  /** Requests per second. */
  traffic: number;
  /** Seconds a health check needs to notice a dead part. */
  detectSec: number;
}

export const MAX_COPIES: Record<Exclude<Tier, 'db'>, number> = { lb: 2, app: 3, config: 2 };

/** Requests per second one app server can serve. Simplified. */
export const APP_CAPACITY = 100;
/** Seconds to promote a standby once the failure is detected. Simplified. */
export const PROMOTE_SEC = 5;
/**
 * A human failover: paged, awake, logged in, diagnosed, promoted. Tens of minutes is the
 * usual order of magnitude (the Lesson example measured 25). Used by the yearly model only;
 * in the live Lab the learner is the human, so the gap is however long they take.
 */
export const MANUAL_FAILOVER_SEC = 30 * 60;
/** Hours to replace a failed part. Sets how often a part fails for a given availability. */
export const REPAIR_HOURS = 1;
/** Share of the time a whole zone is up. Simplified - providers do not publish one number. */
export const ZONE_AVAILABILITY = 0.9995;
/** Share of requests that are writes, for the data lost at an async failover. */
export const WRITE_SHARE = 0.2;

export const SECONDS_PER_YEAR = 365.25 * 24 * 3600;
const HOURS_PER_YEAR = 365.25 * 24;

export const TIER_LABEL: Record<Tier, string> = {
  lb: 'Load balancer',
  app: 'App servers',
  config: 'Config service',
  db: 'Database',
};

/** Which zone copy `index` (0-based) of a tier sits in: alternating when there are two zones. */
export const zoneOf = (index: number, zones: 1 | 2): Zone => (zones === 2 && index % 2 === 1 ? 'B' : 'A');

/** How many times a year one part fails, given its availability and the repair time. */
export const failuresPerYear = (availability: number) => ((1 - availability) * HOURS_PER_YEAR) / REPAIR_HOURS;

/** Seconds a database failover takes in the yearly model. */
export const failoverSeconds = (design: Pick<Design, 'failover' | 'detectSec'>) =>
  design.failover === 'automatic' ? design.detectSec + PROMOTE_SEC : MANUAL_FAILOVER_SEC;

export interface TierResult {
  tier: Tier | 'zone';
  label: string;
  copies: string;
  availability: number;
  note: string;
}

export interface DesignResult {
  rows: TierResult[];
  /** Product of every row. */
  total: number;
  downtimeSecPerYear: number;
}

function binomial(n: number, k: number) {
  let result = 1;
  for (let index = 1; index <= k; index += 1) result = (result * (n - index + 1)) / index;
  return result;
}

/** Share of traffic `up` app servers can serve. */
const appServed = (up: number, traffic: number) => (traffic <= 0 ? 1 : Math.min(1, (up * APP_CAPACITY) / traffic));

export function designAvailability(design: Design): DesignResult {
  const a = design.partAvailability;
  const q = 1 - a;
  // A dead copy keeps receiving its share of traffic until a health check ejects it. Each
  // copy fails f times a year and costs 1/n of the traffic for detectSec: summed over n
  // copies that is f x detectSec of full downtime a year, whatever n is.
  const detectionCost = (failuresPerYear(a) * design.detectSec) / SECONDS_PER_YEAR;

  const stateless = (copies: number) => (copies > 1 ? 1 - q ** copies - detectionCost : a);

  let appAvailability = 0;
  for (let up = 0; up <= design.appCopies; up += 1) {
    const probability = binomial(design.appCopies, up) * a ** up * q ** (design.appCopies - up);
    appAvailability += probability * appServed(up, design.traffic);
  }
  if (design.appCopies > 1) appAvailability -= detectionCost;

  const failoverSec = failoverSeconds(design);
  const dbAvailability = design.standby
    ? 1 - q * q - (failuresPerYear(a) * failoverSec) / SECONDS_PER_YEAR
    : a;

  // A zone outage takes every part in that zone at once - the correlated failure the
  // copy arithmetic above ignores. Single copies always sit in zone A.
  const qz = 1 - ZONE_AVAILABILITY;
  const servedWithout = (lost: Zone) => {
    const outside = (copies: number) =>
      Array.from({ length: copies }, (_, index) => zoneOf(index, design.zones)).filter((zone) => zone !== lost).length;
    const dbOutside = design.standby ? outside(2) : outside(1);
    if (outside(design.lbCopies) === 0 || outside(design.configCopies) === 0 || dbOutside === 0) return 0;
    return appServed(outside(design.appCopies), design.traffic);
  };
  const zoneAvailability =
    1 -
    (qz * (1 - qz) * (1 - servedWithout('A')) + (1 - qz) * qz * (1 - servedWithout('B')) + qz * qz);

  const spread = (copies: number) => (design.zones === 2 && copies > 1 ? 'zones A+B' : 'zone A');
  const detectNote = `+ ${design.detectSec} s to eject each dead copy`;
  const rows: TierResult[] = [
    {
      tier: 'lb',
      label: TIER_LABEL.lb,
      copies: `${design.lbCopies} (${spread(design.lbCopies)})`,
      availability: stateless(design.lbCopies),
      note: design.lbCopies > 1 ? `down only if all ${design.lbCopies} are down, ${detectNote}` : 'no spare: its downtime is yours',
    },
    {
      tier: 'app',
      label: TIER_LABEL.app,
      copies: `${design.appCopies} (${spread(design.appCopies)})`,
      availability: appAvailability,
      note:
        design.traffic > design.appCopies * APP_CAPACITY
          ? 'too few for the traffic even when all are up'
          : design.appCopies > 1 && design.traffic > (design.appCopies - 1) * APP_CAPACITY
            ? 'not N+1: losing one overloads the rest'
            : design.appCopies > 1
              ? `N+1 holds, ${detectNote}`
              : 'no spare: its downtime is yours',
    },
    {
      tier: 'config',
      label: TIER_LABEL.config,
      copies: `${design.configCopies} (${spread(design.configCopies)})`,
      // App servers try the other copy themselves when a read fails, so no health check sits in between.
      availability: 1 - q ** design.configCopies,
      note: design.configCopies > 1 ? 'down only if both are down: apps try the other copy' : 'no spare: its downtime is yours',
    },
    {
      tier: 'db',
      label: TIER_LABEL.db,
      copies: design.standby ? `primary + standby (${design.zones === 2 ? 'zones A+B' : 'zone A'})` : 'primary only',
      availability: dbAvailability,
      note: design.standby
        ? `each primary failure costs a ${formatDuration(failoverSec)} ${design.failover} failover`
        : 'no standby: its downtime is yours',
    },
    {
      tier: 'zone',
      label: 'Zone outage',
      copies: design.zones === 2 ? '2 zones' : '1 zone',
      availability: zoneAvailability,
      note:
        design.zones === 1
          ? 'everything shares one zone'
          : servedWithout('A') >= 1
            ? 'every tier has a copy in each zone'
            : servedWithout('A') > 0
              ? 'zone B alone cannot carry the traffic'
              : 'some tier lives only in zone A',
    },
  ];
  const total = rows.reduce((product, row) => product * row.availability, 1);
  return { rows, total, downtimeSecPerYear: (1 - total) * SECONDS_PER_YEAR };
}

/** Downtime a given availability allows per year, in seconds. */
export const downtimeFor = (availability: number) => (1 - availability) * SECONDS_PER_YEAR;

/** A duration as the one unit that reads best: days, hours, minutes or seconds. */
export function formatDuration(seconds: number) {
  if (seconds >= 2 * 86400) return `${(seconds / 86400).toFixed(1)} days`;
  if (seconds >= 3600) return `${(seconds / 3600).toFixed(1)} h`;
  if (seconds >= 60) return `${(seconds / 60).toFixed(1)} min`;
  return `${Math.max(0, seconds).toFixed(seconds < 10 ? 1 : 0)} s`;
}

/** An availability as a percentage with as many decimals as its nines need. */
export function formatAvailability(availability: number) {
  if (availability >= 0.999999) return '>99.9999%';
  const nines = -Math.log10(1 - availability);
  const digits = Math.min(4, Math.max(1, Math.ceil(nines) - 1));
  return `${(availability * 100).toFixed(digits)}%`;
}
