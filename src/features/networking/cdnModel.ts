/**
 * The edge cache model behind the CDN Lab. Simplified on purpose, and labelled
 * as such in the Lab:
 *
 * - The site serves a catalogue of CATALOGUE objects whose popularity follows a
 *   Zipf curve (a few files are asked for constantly, most rarely), which is the
 *   usual shape of web traffic.
 * - Every edge keeps its own store, keyed by the cache key. An entry lives until
 *   its TTL runs out, a purge removes it, or the store is full and the oldest
 *   entry is dropped.
 * - Latency is only distance (see `rtt`) plus a fixed amount of origin work.
 */

export type CacheControl = 'no-store' | 'no-cache' | 'ttl' | 'immutable';
export type CacheKey = 'path' | 'utm' | 'cookie';
export type EdgeFootprint = 'nearby' | 'us-only';

export const CACHE_CONTROL_OPTIONS: { value: CacheControl; label: string }[] = [
  { value: 'immutable', label: 'max-age=1 year, immutable (hashed URL)' },
  { value: 'ttl', label: 'public, s-maxage=TTL (same URL)' },
  { value: 'no-cache', label: 'no-cache (revalidate every time)' },
  { value: 'no-store', label: 'private, no-store' },
];

export const CACHE_KEY_OPTIONS: { value: CacheKey; label: string }[] = [
  { value: 'path', label: 'Host + path' },
  { value: 'utm', label: 'Host + path + every query parameter' },
  { value: 'cookie', label: 'Host + path + Cookie header' },
];

/** Distinct files the site serves. */
export const CATALOGUE = 400;
/** Distinct utm_campaign values in shared links, when the query string is in the key. */
export const UTM_VARIANTS = 40;
/** Objects one edge can hold in this model before it drops the oldest. */
export const EDGE_CAPACITY = 4000;
/** Origin work for a full response, and for a 304 Not Modified with no body. */
export const ORIGIN_MS = 25;
export const REVALIDATE_MS = 5;
/**
 * The edge keeps warm connections to the origin over the provider backbone, so
 * its leg costs less than a user making the same trip. 0.7 is illustrative.
 */
export const BACKBONE_FACTOR = 0.7;

/**
 * One-way distance converted into a believable round-trip latency. A simplified
 * model, not a measurement: real RTT also depends on routing, congestion and the
 * last mile.
 */
export const rtt = (km: number) => 6 + km / 55;

/** Cumulative Zipf (s = 1) popularity of the catalogue, for sampling a file. */
const ZIPF_CDF = (() => {
  const weights = Array.from({ length: CATALOGUE }, (_, index) => 1 / (index + 1));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cumulative = 0;
  return weights.map((weight) => (cumulative += weight / total));
})();

/** A file index, most popular first. */
export function pickObject(roll = Math.random()) {
  let low = 0;
  let high = ZIPF_CDF.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (ZIPF_CDF[mid] < roll) low = mid + 1;
    else high = mid;
  }
  return low;
}

/**
 * The URL the browser asks for. With hashed file names a deploy changes the
 * URL (app.v2.js); without them the URL stays the same and only the bytes change.
 */
export const urlFor = (object: number, version: number, control: CacheControl) =>
  control === 'immutable' ? `/static/file-${object}.v${version}` : `/static/file-${object}`;

/** What the edge looks the request up by. Everything added here multiplies the copies. */
export function cacheKeyFor(url: string, key: CacheKey) {
  if (key === 'utm') return `${url}?utm_campaign=${Math.floor(Math.random() * UTM_VARIANTS)}`;
  // Every visitor carries a different session cookie, so the key is close to unique.
  if (key === 'cookie') return `${url}|cookie=${Math.floor(Math.random() * 1_000_000)}`;
  return url;
}

/** How long an edge may answer from its copy without asking the origin. */
export function ttlMsFor(control: CacheControl, ttlSec: number) {
  if (control === 'immutable') return Number.POSITIVE_INFINITY;
  if (control === 'ttl') return ttlSec * 1000;
  return 0;
}

export interface Entry {
  expiresAt: number;
  /** The deploy the stored bytes came from. */
  version: number;
}

export type Lookup =
  /** Answered from the edge copy, fresh or not. */
  | { kind: 'hit'; stale: boolean }
  /** Edge had a copy and asked the origin if it is still good: 304 Not Modified. */
  | { kind: 'revalidated' }
  /** Full response from the origin. */
  | { kind: 'miss' };

/**
 * One request at one edge. Mutates `store` the way the edge would: a miss (or a
 * 200 on revalidation) stores the new copy, unless the response says no-store.
 */
export function lookup(
  store: Map<string, Entry>,
  cacheKey: string,
  control: CacheControl,
  ttlSec: number,
  version: number,
  now: number,
): Lookup {
  if (control === 'no-store') return { kind: 'miss' };
  const entry = store.get(cacheKey);
  if (entry && entry.expiresAt > now) return { kind: 'hit', stale: entry.version !== version };
  const expiresAt = now + ttlMsFor(control, ttlSec);
  if (entry && entry.version === version) {
    // Expired, or no-cache: ask the origin with If-None-Match; the ETag still matches.
    entry.expiresAt = expiresAt;
    return { kind: 'revalidated' };
  }
  store.delete(cacheKey);
  store.set(cacheKey, { expiresAt, version });
  if (store.size > EDGE_CAPACITY) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  return { kind: 'miss' };
}
