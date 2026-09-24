/**
 * The model behind the Cache Layers Lab: a product page that shows how many units of a product
 * were sold, read through up to three cache layers.
 *
 *   1. The in-process cache of each app instance (one LRU map per instance, with a TTL).
 *   2. The database buffer pool (an LRU of 8 KB pages in RAM; a miss reads the page from disk).
 *   3. A materialized view of the totals per product, refreshed on a schedule.
 *
 * Every number here is a simplification chosen to show the shape of the effect, not a
 * measurement: a toy database of 1,000 products, one pool of database work for CPU and disk,
 * and fixed costs per page and per query. The Lab says so next to every number it derives.
 * The mechanisms are real: LRU eviction, TTL expiry, page hits and misses, and a view that is
 * exactly as stale as the time since its last refresh. Real buffer pools evict with refinements
 * of LRU (a clock sweep in PostgreSQL, midpoint insertion in InnoDB); a plain LRU shows the
 * same effect: hot pages stay, cold pages leave.
 */

export const PRODUCTS = 1000;
/** The order rows of one product are spread over this many pages of the orders table. */
export const PAGES_PER_PRODUCT = 20;
/** One row per product in the view, many rows per page. */
export const VIEW_ROWS_PER_PAGE = 100;
export const BASE_PAGES = PRODUCTS * PAGES_PER_PRODUCT;
export const VIEW_PAGES = PRODUCTS / VIEW_ROWS_PER_PAGE;
export const PAGE_KB = 8;
export const INSTANCES = 3;
/** Entries each in-process cache may hold before it evicts the least recently used one. */
export const LOCAL_CAPACITY = 500;
/** Hot products checked for disagreement between instances. */
export const HOT_PRODUCTS = 10;

/**
 * Popularity skew: product index = floor(random ^ SKEW * PRODUCTS). With 3.4 the top 10% of
 * products take about half of the reads, and product 0 alone about 13% - real catalogues
 * are skewed like this, which is what makes every cache layer work.
 */
const SKEW = 3.4;

// Simplified costs, in milliseconds.
/** A lookup in an in-process map: no network, no serialisation. */
export const LOCAL_HIT_MS = 0.01;
/** App to database round trip inside one data centre. */
export const NETWORK_MS = 0.5;
/** Parse and bind of a prepared statement whose plan is reused. */
export const PLAN_MS = 0.05;
/** Summing the order rows of one product. */
export const AGGREGATE_MS = 1;
/** Reading one precomputed row from the view. */
export const VIEW_ROW_MS = 0.02;
/** One page found in the buffer pool: a memory access. */
export const PAGE_HIT_MS = 0.005;
/** One page read from an SSD: about 40 times slower than memory in this model. */
export const PAGE_DISK_MS = 0.2;
/** One insert into the orders table. */
export const WRITE_MS = 0.3;
/** One refresh recomputes every row of the view from the orders table. */
export const REFRESH_MS = 400;
/** Database work it can do per second: 4 cores, CPU and disk pooled into one number. */
export const DB_WORK_CAPACITY_MS = 4000;

export interface CacheLayersSetup {
  /** Product page reads per second, across all instances. */
  reads: number;
  /** New orders per second. Each one changes the units-sold total of one product. */
  writes: number;
  localCache: boolean;
  /** Seconds an entry of the in-process cache stays usable. */
  localTtl: number;
  /** Buffer pool size in pages. */
  bufferPages: number;
  /** Read the totals from the materialized view instead of aggregating the orders table. */
  view: boolean;
  /** Seconds between two refreshes of the view. */
  refreshSec: number;
}

interface LocalEntry {
  /** The version of the total this copy holds. */
  version: number;
  expiresAt: number;
}

export interface ModelState {
  /** Current units-sold version of each product in the orders table: the truth. */
  version: Int32Array;
  /** The version each product had at the last refresh of the view. */
  viewVersion: Int32Array;
  viewRefreshedAt: number;
  /** One in-process cache per instance. A Map iterates in insertion order, so it is an LRU. */
  locals: Map<number, LocalEntry>[];
  /** Page ids held in the buffer pool, least recently used first. */
  buffer: Map<number, true>;
  nextInstance: number;
}

export function createModel(now: number): ModelState {
  return {
    version: new Int32Array(PRODUCTS),
    viewVersion: new Int32Array(PRODUCTS),
    viewRefreshedAt: now,
    locals: Array.from({ length: INSTANCES }, () => new Map<number, LocalEntry>()),
    buffer: new Map(),
    nextInstance: 0,
  };
}

export const pickProduct = (random: () => number = Math.random) => Math.floor(random() ** SKEW * PRODUCTS);

const viewPage = (product: number) => BASE_PAGES + Math.floor(product / VIEW_ROWS_PER_PAGE);

/** Touches one page: true when it was already in the buffer pool. */
function touchPage(state: ModelState, page: number, capacity: number) {
  const { buffer } = state;
  if (buffer.has(page)) {
    buffer.delete(page);
    buffer.set(page, true);
    return true;
  }
  buffer.set(page, true);
  trimBuffer(state, capacity);
  return false;
}

/** Evicts least recently used pages until the pool fits its size. Also used when the size shrinks. */
export function trimBuffer(state: ModelState, capacity: number) {
  const { buffer } = state;
  while (buffer.size > capacity) {
    const oldest = buffer.keys().next().value;
    if (oldest === undefined) break;
    buffer.delete(oldest);
  }
}

export interface ReadResult {
  instance: number;
  product: number;
  localHit: boolean;
  /** The reader got an older units-sold total than the orders table holds. */
  stale: boolean;
  /** Which layer served the old total. */
  staleFrom: 'local' | 'view' | null;
  usedView: boolean;
  pagesRead: number;
  pagesFromDisk: number;
  /** Database work this read cost, in ms. Zero on a local hit. */
  workMs: number;
}

/** One product page read, through every layer that is switched on. */
export function read(state: ModelState, setup: CacheLayersSetup, now: number, random: () => number = Math.random): ReadResult {
  const product = pickProduct(random);
  const instance = state.nextInstance;
  state.nextInstance = (instance + 1) % INSTANCES;
  const local = state.locals[instance];
  const truth = state.version[product];

  if (setup.localCache) {
    const entry = local.get(product);
    if (entry && entry.expiresAt > now) {
      local.delete(product);
      local.set(product, entry);
      const stale = entry.version < truth;
      return {
        instance,
        product,
        localHit: true,
        stale,
        staleFrom: stale ? 'local' : null,
        usedView: false,
        pagesRead: 0,
        pagesFromDisk: 0,
        workMs: 0,
      };
    }
  }

  const pagesRead = setup.view ? 1 : PAGES_PER_PRODUCT;
  let pagesFromDisk = 0;
  let workMs = PLAN_MS;
  let served = truth;
  if (setup.view) {
    if (!touchPage(state, viewPage(product), setup.bufferPages)) pagesFromDisk = 1;
    workMs += VIEW_ROW_MS;
    served = state.viewVersion[product];
  } else {
    for (let index = 0; index < PAGES_PER_PRODUCT; index += 1) {
      if (!touchPage(state, product * PAGES_PER_PRODUCT + index, setup.bufferPages)) pagesFromDisk += 1;
    }
    workMs += AGGREGATE_MS;
  }
  workMs += (pagesRead - pagesFromDisk) * PAGE_HIT_MS + pagesFromDisk * PAGE_DISK_MS;

  if (setup.localCache) {
    local.delete(product);
    local.set(product, { version: served, expiresAt: now + setup.localTtl * 1000 });
    while (local.size > LOCAL_CAPACITY) {
      const oldest = local.keys().next().value;
      if (oldest === undefined) break;
      local.delete(oldest);
    }
  }

  const stale = served < truth;
  return {
    instance,
    product,
    localHit: false,
    stale,
    staleFrom: stale ? 'view' : null,
    usedView: setup.view,
    pagesRead,
    pagesFromDisk,
    workMs,
  };
}

export interface WriteResult {
  instance: number;
  product: number;
  workMs: number;
}

/**
 * One new order. The instance that takes it drops its own local copy of that product, which is
 * what most code does after a write. The other instances are not told, so they keep serving
 * their old copy until it expires.
 */
export function write(state: ModelState, random: () => number = Math.random): WriteResult {
  const product = pickProduct(random);
  const instance = state.nextInstance;
  state.nextInstance = (instance + 1) % INSTANCES;
  state.version[product] += 1;
  state.locals[instance].delete(product);
  // New rows go to the end of the orders table, a page that is always hot, so it is not modelled.
  return { instance, product, workMs: WRITE_MS };
}

/**
 * REFRESH MATERIALIZED VIEW: recompute every total from the orders table and swap the result in.
 * The view gets new files, so its old pages in the buffer pool are useless and are dropped.
 * The full read of the orders table does not flush the buffer pool: PostgreSQL reads a table
 * bigger than a quarter of shared_buffers through a small ring buffer for exactly that reason.
 */
export function refreshView(state: ModelState, now: number) {
  state.viewVersion.set(state.version);
  state.viewRefreshedAt = now;
  for (let page = 0; page < VIEW_PAGES; page += 1) state.buffer.delete(BASE_PAGES + page);
  return REFRESH_MS;
}

/** Drops expired entries so the entry counts shown on each instance stay honest. */
export function expireLocals(state: ModelState, now: number) {
  for (const local of state.locals) {
    for (const [product, entry] of local) if (entry.expiresAt <= now) local.delete(product);
  }
}

/**
 * How many of the hot products the instances disagree on: at least two instances hold a live
 * copy and the copies differ. This is what a user sees as the number changing back and forth
 * while the load balancer sends each refresh to another instance.
 */
export function hotDisagreements(state: ModelState, now: number) {
  let count = 0;
  for (let product = 0; product < HOT_PRODUCTS; product += 1) {
    let seen: number | null = null;
    for (const local of state.locals) {
      const entry = local.get(product);
      if (!entry || entry.expiresAt <= now) continue;
      if (seen === null) seen = entry.version;
      else if (seen !== entry.version) {
        count += 1;
        break;
      }
    }
  }
  return count;
}

/** Stale live copies one instance holds right now. */
export function staleEntries(state: ModelState, instance: number, now: number) {
  let count = 0;
  for (const [product, entry] of state.locals[instance]) {
    if (entry.expiresAt > now && entry.version < state.version[product]) count += 1;
  }
  return count;
}
