import { computeLoad, type LoadResponse } from '@/simulations/models/load';

/**
 * The model behind the Data Models Lab: the same shop data (carts, products,
 * orders) in one relational database and in a partitioned document store,
 * under four workloads.
 *
 * Every number here is a simplification chosen so the comparison reads clearly,
 * not a benchmark of PostgreSQL, MongoDB or DynamoDB. The shape of each result
 * follows the documented behaviour (one primary takes every write, a key names
 * one partition, a column type change rewrites the table, a document store
 * without joins ships rows to the application); the magnitudes are illustrative.
 */

export type View = 'relational' | 'both' | 'document';
export type Workload = 'key' | 'checkout' | 'report' | 'schema';

export interface Setup {
  view: View;
  workload: Workload;
  /** Key get/put operations per second, for the key workload. */
  keyOps: number;
  /** Checkouts per second, for the checkout workload. */
  checkouts: number;
  /** Index into ORDER_SIZES: how many orders are stored. */
  sizeIndex: number;
  /** Partitions (one machine each) in the document store. */
  partitions: number;
  /** Half of all key traffic goes to one key, so to one partition. */
  hotKey: boolean;
  /** Share of checkouts where a step fails after the stock was reserved (a crash, a timeout). */
  crashRate: number;
  /** The document store wraps the checkout writes in a multi-document transaction. */
  docTransactions: boolean;
  /** The relational side changes the column with expand, backfill, switch instead of one ALTER. */
  onlineMigration: boolean;
}

export const ORDER_SIZES = [1_000_000, 10_000_000, 100_000_000, 1_000_000_000];
export const MAX_PARTITIONS = 6;

// Simplified capacities - illustrative, not measured.
/** Key get/put by primary key that one PostgreSQL primary serves per second. */
export const SQL_KEY_CAPACITY = 50_000;
/** Key operations one document-store partition (one machine) serves per second. */
export const PARTITION_CAPACITY = 40_000;
/** Checkout transactions per second on the one primary (a join, a locked update, an insert). */
export const SQL_CHECKOUT_CAPACITY = 4_000;
/** Starting share of checkouts that fail half-way (1 in 50). */
export const CRASH_RATE = 0.02;
/** Share of all orders that fall in the last 30 days, which the report reads. */
export const RECENT_SHARE = 0.1;
/** Rows per second the database joins and aggregates for the report. */
export const SQL_JOIN_ROWS_PER_SEC = 2_000_000;
/** Documents per second one partition scans. */
export const DOC_SCAN_PER_SEC = 5_000_000;
/** Documents per second the application can pull over the network and join in code. */
export const APP_INGEST_PER_SEC = 100_000;
/** Distinct products whose category the application must look up, 100 per batched request. */
export const PRODUCTS = 20_000;
export const PRODUCT_BATCH = 100;
/** Product categories, so rows in the report result. */
export const CATEGORIES = 20;
/** Rows per second a blocking ALTER rewrites. */
export const SQL_REWRITE_ROWS_PER_SEC = 1_000_000;
/** Rows per second a throttled online backfill copies, in small batches. */
export const BACKFILL_ROWS_PER_SEC = 200_000;
/** Order writes per second that keep arriving while a migration runs. */
export const ORDER_WRITES_PER_SEC = 500;

/** Share of key traffic each partition receives. */
export function partitionShares(partitions: number, hotKey: boolean): number[] {
  if (!hotKey || partitions === 1) return Array.from({ length: partitions }, () => 1 / partitions);
  // One key takes half of all traffic. A single key cannot be split, so its partition takes it all.
  const rest = 0.5 / (partitions - 1);
  return Array.from({ length: partitions }, (_, index) => (index === 0 ? 0.5 : rest));
}

export interface SideLoad {
  latencyMs: number;
  errorRate: number;
  /** Utilization of the busiest machine. */
  busiest: number;
}

export interface KeyResult {
  sql: LoadResponse;
  partitions: LoadResponse[];
  shares: number[];
  doc: SideLoad;
}

export function evaluateKey(setup: Setup): KeyResult {
  const sql = computeLoad(setup.keyOps, SQL_KEY_CAPACITY, { baseLatencyMs: 1, maxLatencyMs: 2000 });
  const shares = partitionShares(setup.partitions, setup.hotKey);
  const partitions = shares.map((share) =>
    computeLoad(setup.keyOps * share, PARTITION_CAPACITY, { baseLatencyMs: 1, maxLatencyMs: 2000 }),
  );
  return { sql, partitions, shares, doc: combine(partitions, shares) };
}

export interface CheckoutResult {
  sql: LoadResponse;
  partitions: LoadResponse[];
  doc: SideLoad;
  /** Document-store operations per checkout: 2 reads, 2 writes (each write counted twice inside a transaction). */
  docOps: number;
}

export function evaluateCheckout(setup: Setup): CheckoutResult {
  const sql = computeLoad(setup.checkouts, SQL_CHECKOUT_CAPACITY, { baseLatencyMs: 6, maxLatencyMs: 3000 });
  // Get the cart, batch-get its products, update stock, put the order. A transaction
  // prepares and commits every item it writes, so its two writes cost twice.
  const docOps = setup.docTransactions ? 6 : 4;
  const shares = partitionShares(setup.partitions, false);
  const partitions = shares.map((share) =>
    computeLoad(setup.checkouts * docOps * share, PARTITION_CAPACITY, {
      baseLatencyMs: setup.docTransactions ? 7 : 4,
      maxLatencyMs: 3000,
    }),
  );
  return { sql, partitions, doc: combine(partitions, shares), docOps };
}

export interface ReportResult {
  /** Orders in the last 30 days, the rows the report aggregates. */
  matched: number;
  sqlSeconds: number;
  docSeconds: number;
  /** Rows sent to the application. */
  sqlRowsShipped: number;
  docRowsShipped: number;
  sqlRoundTrips: number;
  docRoundTrips: number;
}

export function evaluateReport(setup: Setup): ReportResult {
  const orders = ORDER_SIZES[setup.sizeIndex];
  const matched = orders * RECENT_SHARE;
  const lookups = Math.ceil(Math.min(PRODUCTS, matched) / PRODUCT_BATCH);
  // Every partition scans its share in parallel, then the application pulls every matching
  // order and looks up product categories in batches (about 1 ms each) before it can group.
  const scan = orders / setup.partitions / DOC_SCAN_PER_SEC;
  const docSeconds = scan + matched / APP_INGEST_PER_SEC + lookups * 0.001;
  return {
    matched,
    sqlSeconds: 0.005 + matched / SQL_JOIN_ROWS_PER_SEC,
    docSeconds,
    sqlRowsShipped: CATEGORIES,
    docRowsShipped: matched,
    sqlRoundTrips: 1,
    docRoundTrips: setup.partitions + lookups,
  };
}

export interface SchemaResult {
  orders: number;
  /** How long the relational change takes from start to done. */
  sqlSeconds: number;
  /** How long order writes wait on the lock. */
  sqlBlockedSeconds: number;
  /** Order writes that queue behind the lock. */
  sqlBlockedWrites: number;
}

export function evaluateSchema(setup: Setup): SchemaResult {
  const orders = ORDER_SIZES[setup.sizeIndex];
  if (setup.onlineMigration) {
    // Add the new column (instant), backfill it in small batches, then switch reads and
    // writes over. Each step holds a lock for well under a second.
    return { orders, sqlSeconds: orders / BACKFILL_ROWS_PER_SEC, sqlBlockedSeconds: 0, sqlBlockedWrites: 0 };
  }
  const seconds = orders / SQL_REWRITE_ROWS_PER_SEC;
  return { orders, sqlSeconds: seconds, sqlBlockedSeconds: seconds, sqlBlockedWrites: seconds * ORDER_WRITES_PER_SEC };
}

function combine(loads: LoadResponse[], shares: number[]): SideLoad {
  let latencyMs = 0;
  let errorRate = 0;
  let busiest = 0;
  loads.forEach((load, index) => {
    latencyMs += load.latencyMs * shares[index];
    errorRate += load.errorRate * shares[index];
    busiest = Math.max(busiest, load.utilization);
  });
  return { latencyMs, errorRate, busiest };
}
