/**
 * The model behind the API Styles Lab: one Order history screen fetched with REST,
 * GraphQL or gRPC, reduced to calls, round trips, bytes and database queries.
 *
 * Simplified on purpose, and labelled as such in the UI. The byte sizes are
 * illustrative JSON body sizes (headers are not counted), protobuf is taken as a
 * flat share of the same JSON, every database query costs the same 2 ms, and the
 * link is one round trip time plus one bandwidth. Real numbers depend on the data,
 * the network and the implementation - the directions are what the Lab teaches.
 */

export type Style = 'rest' | 'graphql' | 'grpc';
export type Caller = 'browser' | 'mobile' | 'service';
export type RestShape = 'per-resource' | 'include';
export type RpcDesign = 'per-resource' | 'screen';

export interface Setup {
  style: Style;
  caller: Caller;
  rttMs: number;
  /** Orders shown on the screen, each with ITEMS_PER_ORDER items. */
  orders: number;
  restShape: RestShape;
  sparseFields: boolean;
  batching: boolean;
  rpcDesign: RpcDesign;
}

export const CALLERS: Record<Caller, { label: string; title: string; rttMs: number; mbps: number }> = {
  browser: { label: 'Browser on home broadband', title: 'Browser', rttMs: 40, mbps: 50 },
  mobile: { label: 'Mobile app on a 4G network', title: 'Mobile app', rttMs: 100, mbps: 10 },
  service: { label: 'Service in the same data centre', title: 'Web backend', rttMs: 1, mbps: 1000 },
};

export const ITEMS_PER_ORDER = 2;

// Illustrative JSON body sizes, in bytes: the full resource, and the part the screen shows.
const USER_FULL = 1800; // profile, addresses, preferences...
const USER_USED = 40; // name
const ORDER_FULL = 900; // status history, shipping, billing...
const ORDER_USED = 40; // id, total
const ITEM_FULL = 400; // sku, quantity, price, product id...
const ITEM_USED = 20; // the nesting that holds the product name
const PRODUCT_FULL = 1200; // description, images, specs...
const PRODUCT_USED = 40; // name
/** A sparse (?fields=) response still carries a little JSON structure of its own. */
const SPARSE_OVERHEAD = 20;
/** The GraphQL response envelope: { "data": { ... } }. */
const GRAPHQL_ENVELOPE = 30;
/** Protobuf size as a share of the same data in JSON. Simplified: the real ratio depends on the data. */
export const PROTO_RATIO = 0.4;
/** Every database query, simplified to one fixed cost. */
export const DB_MS = 2;
/** The grpc-web proxy sits next to the server, so its hop is short. */
export const PROXY_MS = 1;

export interface Call {
  /** What the caller sends, as it would read in a log. */
  label: string;
  /** Response body bytes on the wire. */
  bytes: number;
  /** Of those, the bytes the screen actually shows. */
  usedBytes: number;
}

export interface Wave {
  /** Calls sent at the same time, because none needs the answer of another. */
  calls: Call[];
  /** Database queries the server runs for this wave, level by level (each level waits for the one before). */
  dbLevels: number[];
}

export interface Plan {
  waves: Wave[];
  requests: number;
  bytes: number;
  usedBytes: number;
  dbQueries: number;
  /** Time until the screen can render, in ms. Simplified model. */
  readyMs: number;
  /** A grpc-web proxy sits between a browser and the gRPC server. */
  proxy: boolean;
  /** Short name of the variant, for the comparison table. */
  variant: string;
}

const usedTotal = (orders: number) => USER_USED + orders * (ORDER_USED + ITEMS_PER_ORDER * (ITEM_USED + PRODUCT_USED));

const range = (count: number) => Array.from({ length: count }, (_, index) => index);
const orderId = (index: number) => 901 + index;
const productId = (index: number) => 31 + index;

/** The calls of one resource-per-call design, in the three waves the ids force. */
function perResourceWaves(orders: number, size: (full: number, used: number) => number, names: {
  user: string;
  orders: string;
  items: (id: number) => string;
  product: (id: number) => string;
}): Wave[] {
  const products = orders * ITEMS_PER_ORDER;
  return [
    {
      calls: [
        { label: names.user, bytes: size(USER_FULL, USER_USED), usedBytes: USER_USED },
        { label: names.orders, bytes: size(orders * ORDER_FULL, orders * ORDER_USED), usedBytes: orders * ORDER_USED },
      ],
      dbLevels: [2],
    },
    {
      calls: range(orders).map((index) => ({
        label: names.items(orderId(index)),
        bytes: size(ITEMS_PER_ORDER * ITEM_FULL, ITEMS_PER_ORDER * ITEM_USED),
        usedBytes: ITEMS_PER_ORDER * ITEM_USED,
      })),
      dbLevels: [orders],
    },
    {
      calls: range(products).map((index) => ({
        label: names.product(productId(index)),
        bytes: size(PRODUCT_FULL, PRODUCT_USED),
        usedBytes: PRODUCT_USED,
      })),
      dbLevels: [products],
    },
  ];
}

function wavesFor(setup: Setup): { waves: Wave[]; variant: string } {
  const { orders } = setup;
  const embedded = orders * (ORDER_FULL + ITEMS_PER_ORDER * (ITEM_FULL + PRODUCT_FULL));
  const embeddedUsed = usedTotal(orders) - USER_USED;

  if (setup.style === 'rest') {
    const size = (full: number, used: number) => (setup.sparseFields ? used + SPARSE_OVERHEAD : full);
    const fields = setup.sparseFields ? '&fields=...' : '';
    if (setup.restShape === 'include') {
      return {
        variant: setup.sparseFields ? 'REST, ?include= + ?fields=' : 'REST, ?include=',
        waves: [
          {
            calls: [
              { label: `GET /users/42${setup.sparseFields ? '?fields=name' : ''}`, bytes: size(USER_FULL, USER_USED), usedBytes: USER_USED },
              {
                label: `GET /users/42/orders?limit=${orders}&include=items.product${fields}`,
                bytes: size(embedded, embeddedUsed),
                usedBytes: embeddedUsed,
              },
            ],
            // user and orders together, then the items of those orders, then their products
            dbLevels: [2, 1, 1],
          },
        ],
      };
    }
    return {
      variant: setup.sparseFields ? 'REST, per resource + ?fields=' : 'REST, per resource',
      waves: perResourceWaves(orders, size, {
        user: `GET /users/42${setup.sparseFields ? '?fields=name' : ''}`,
        orders: `GET /users/42/orders?limit=${orders}${fields}`,
        items: (id) => `GET /orders/${id}/items${fields}`,
        product: (id) => `GET /products/${id}${setup.sparseFields ? '?fields=name' : ''}`,
      }),
    };
  }

  if (setup.style === 'graphql') {
    return {
      variant: setup.batching ? 'GraphQL, batched' : 'GraphQL, no batching',
      waves: [
        {
          calls: [{ label: 'POST /graphql  query OrderHistory', bytes: usedTotal(orders) + GRAPHQL_ENVELOPE, usedBytes: usedTotal(orders) }],
          // One resolver level per nesting level: user, orders, items, products.
          // Without batching every item and product resolver runs its own query - the N+1.
          dbLevels: setup.batching ? [1, 1, 1, 1] : [1, 1, orders, orders * ITEMS_PER_ORDER],
        },
      ],
    };
  }

  const proto = (bytes: number) => Math.round(bytes * PROTO_RATIO);
  if (setup.rpcDesign === 'screen') {
    return {
      variant: 'gRPC, one RPC for the screen',
      waves: [
        {
          calls: [{ label: `OrderHistory.GetOrderHistory(user_id: 42, limit: ${orders})`, bytes: proto(usedTotal(orders)), usedBytes: proto(usedTotal(orders)) }],
          dbLevels: [2, 1, 1],
        },
      ],
    };
  }
  return {
    variant: 'gRPC, one RPC per resource',
    waves: perResourceWaves(orders, (full) => proto(full), {
      user: 'Users.GetUser(id: 42)',
      orders: `Orders.ListOrders(user_id: 42, limit: ${orders})`,
      items: (id) => `Orders.ListItems(order_id: ${id})`,
      product: (id) => `Catalog.GetProduct(id: ${id})`,
    }).map((wave) => ({
      ...wave,
      // Protobuf shrinks the encoding, not the choice of fields: the used share stays the same.
      calls: wave.calls.map((call) => ({ ...call, usedBytes: proto(call.usedBytes) })),
    })),
  };
}

/** The whole plan for one screen load with this setup. */
export function planFor(setup: Setup): Plan {
  const { waves, variant } = wavesFor(setup);
  const caller = CALLERS[setup.caller];
  const proxy = setup.style === 'grpc' && setup.caller === 'browser';
  let readyMs = 0;
  let requests = 0;
  let bytes = 0;
  let usedBytes = 0;
  let dbQueries = 0;
  for (const wave of waves) {
    const waveBytes = wave.calls.reduce((sum, call) => sum + call.bytes, 0);
    // bytes * 8 bits, over Mbit/s, in ms
    const transferMs = (waveBytes * 8) / (caller.mbps * 1000);
    readyMs += setup.rttMs + wave.dbLevels.length * DB_MS + transferMs + (proxy ? PROXY_MS : 0);
    requests += wave.calls.length;
    bytes += waveBytes;
    usedBytes += wave.calls.reduce((sum, call) => sum + call.usedBytes, 0);
    dbQueries += wave.dbLevels.reduce((sum, level) => sum + level, 0);
  }
  return { waves, requests, bytes, usedBytes, dbQueries, readyMs, proxy, variant };
}

export const overFetched = (plan: Plan) => (plan.bytes > 0 ? 1 - plan.usedBytes / plan.bytes : 0);
