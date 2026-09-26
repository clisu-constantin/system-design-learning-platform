import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SETUP,
  FOCUS_SETUPS,
  NFRS,
  RELAXED,
  REQUIREMENTS,
  REGION2,
  SLOTS,
  WRITE_FLOWS,
  architecture,
  coreOf,
  edgesFor,
  implicationsFor,
  legendFor,
  routesFor,
  subtitleFor,
  switchProduct,
  type Nfr,
  type Setup,
} from './requirementsArchitecture.ts';
import { PRODUCTS, type Product } from './requirementsSizing.ts';

const setup = (product: Product, ids: string[], nfr: Partial<Nfr> = {}): Setup => ({
  product,
  selected: Object.fromEntries(ids.map((id) => [id, true])),
  nfr: { ...RELAXED, ...nfr },
  panel: 'features',
  start: 'core',
});

const allRoutes = (s: Setup) => {
  const arch = architecture(s);
  return arch.flows.flatMap((flow) => routesFor(flow, arch).map((variant) => ({ flow, ...variant })));
};

/** True when `route` walks `hops` in order, one after the other. */
const walks = (route: string[], hops: string[]) =>
  route.some((_, start) => hops.every((id, offset) => route[start + offset] === id));

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------

test('the legend lists only the wire tones and particle shapes on screen', () => {
  const legend = legendFor(architecture(setup('whatsapp', ['send'])));

  assert.deepEqual(
    legend.wires.map((wire) => wire.tone),
    ['brand'],
  );
  assert.deepEqual(
    legend.outcomes.map((entry) => entry.outcome),
    ['success'],
  );
});

test('every wire tone drawn has a legend line, and every legend line is drawn', () => {
  const settings: Setup[] = [
    setup('whatsapp', ['send', 'receive', 'groups', 'images'], { latency: 2, users: 3 }),
    setup('instagram', ['upload', 'feed', 'search'], { users: 2 }),
    setup('uber', ['location', 'match', 'track'], { availability: 3 }),
    DEFAULT_SETUP,
  ];
  for (const s of settings) {
    const arch = architecture(s);
    const drawn = new Set(edgesFor(arch).map((edge) => (edge.dashed ? 'dashed' : edge.tone)));
    const listed = new Set(legendFor(arch).wires.map((wire) => wire.tone));
    assert.deepEqual([...listed].sort(), [...drawn].sort(), JSON.stringify(s));
  }
});

test('the legend names each wire colour the way it is drawn', () => {
  const legend = legendFor(architecture(setup('whatsapp', ['send', 'receive', 'groups', 'images'], { users: 3 })));
  const label = (tone: string) => legend.wires.find((wire) => wire.tone === tone)?.label ?? '';

  assert.match(label('info'), /^Indigo/);
  assert.match(label('violet'), /^Violet/);
  assert.match(label('ok'), /^Green/);
  assert.match(label('dashed'), /region 2/);
  assert.ok(!legend.wires.some((wire) => /cyan/i.test(wire.label)));
});

test('a cache hit shape is listed only when a cache or CDN answers something', () => {
  const plain = legendFor(architecture(setup('whatsapp', ['send', 'receive'])));
  const cached = legendFor(architecture(setup('whatsapp', ['send', 'receive'], { users: 2 })));

  assert.ok(!plain.outcomes.some((entry) => entry.outcome === 'cache-hit'));
  assert.ok(cached.outcomes.some((entry) => entry.outcome === 'cache-hit'));
});

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

test('a group message travels through the queue to the WebSocket tier and on to the phones', () => {
  const routes = allRoutes(setup('whatsapp', ['groups']));
  const delivered = routes.filter(({ route }) => walks(route, ['async', 'ws']) && route[route.length - 1] === 'users');

  assert.ok(delivered.length > 0, JSON.stringify(routes.map(({ route }) => route)));
});

test('an image upload reaches object storage without passing through the queue', () => {
  const routes = allRoutes(setup('whatsapp', ['send', 'images']));
  const uploads = routes.filter(({ flow }) => flow === 'upload');

  assert.ok(uploads.length > 0);
  for (const { route } of uploads) {
    assert.equal(route[route.length - 1], 'objects');
    assert.ok(!route.includes('async'), route.join(' -> '));
  }
  // Processing is a separate, queued job.
  assert.ok(routes.some(({ flow, route }) => flow === 'process' && walks(route, ['api', 'async'])));
});

test('with only text features picked, no latency level adds a CDN', () => {
  for (const product of PRODUCTS) {
    const text = REQUIREMENTS[product].filter((option) => !option.flows.includes('media')).map((option) => option.id);
    for (let latency = 0; latency <= 3; latency += 1) {
      const arch = architecture(setup(product, text, { latency }));
      assert.equal(arch.parts.cdn, undefined, `${product} at latency level ${latency}`);
    }
  }
  assert.ok(architecture(setup('whatsapp', ['send', 'images'], { latency: 2 })).parts.cdn);
});

test('only write traffic is drawn going to region 2', () => {
  for (const product of PRODUCTS) {
    const routes = allRoutes(setup(product, Object.keys(coreOf(product)), { users: 3 }));
    const copied = routes.filter(({ route }) => route.includes('r2-db'));

    for (const { flow, route } of copied) {
      assert.ok(WRITE_FLOWS.has(flow), `${product}: ${flow} copied (${route.join(' -> ')})`);
      assert.equal(route[route.length - 2], 'db');
    }
    for (const { flow, route } of routes) {
      if (WRITE_FLOWS.has(flow) && route.includes('db')) assert.ok(route.includes('r2-db'), `${product}: ${flow}`);
    }
  }
});

test('the copy to region 2 is one dashed wire from the database', () => {
  const edges = edgesFor(architecture(setup('whatsapp', ['send'], { users: 3 })));
  const copy = edges.filter((edge) => edge.to === 'r2-db' || edge.from === 'r2-db');

  assert.equal(copy.length, 1);
  assert.equal(copy[0].from, 'db');
  assert.equal(copy[0].dashed, true);
});

// ---------------------------------------------------------------------------
// Baselines and forced decisions
// ---------------------------------------------------------------------------

test('the relaxed baseline keeps durable storage', () => {
  assert.equal(NFRS.find((spec) => spec.id === 'durability')?.values[RELAXED.durability], 'Normal');
});

/** Words a forced-decision line uses for a part, and whether that part is on the diagram. */
const NAMED_PARTS: [RegExp, (arch: ReturnType<typeof architecture>) => boolean][] = [
  [/\breplicas?\b/i, (arch) => arch.sizing.database.readReplicas > 0 && Boolean(arch.parts.db)],
  [/conflict/i, (arch) => arch.region2],
  [/\bCDN\b/, (arch) => Boolean(arch.parts.cdn)],
  [/cach/i, (arch) => Boolean(arch.parts.cache)],
  [/database|standby/i, (arch) => Boolean(arch.parts.db)],
  [/multi-region|region 2|between regions/i, (arch) => arch.region2],
];

test('no forced-decision line names a part that is not drawn', () => {
  const starts = [...Object.values(FOCUS_SETUPS), DEFAULT_SETUP];
  const settings: Setup[] = [...starts];
  for (const product of PRODUCTS) {
    for (const option of REQUIREMENTS[product]) {
      for (const users of [0, 1, 2, 3]) {
        for (const latency of [0, 2, 3]) {
          for (const consistency of [0, 1, 2]) {
            for (const [availability, durability] of [[0, 1], [2, 2], [3, 0]]) {
              settings.push(setup(product, [option.id], { users, latency, consistency, availability, durability }));
            }
          }
        }
      }
    }
  }
  for (const s of settings) {
    const arch = architecture(s);
    for (const line of implicationsFor(s, arch)) {
      for (const [pattern, drawn] of NAMED_PARTS) {
        if (pattern.test(line)) assert.ok(drawn(arch), `"${line}" with ${JSON.stringify(s)}`);
      }
    }
  }
});

test('the relaxed baseline of one text feature is Users, one app server and one database', () => {
  const arch = architecture(FOCUS_SETUPS['what-is-system-design']);
  const drawn = Object.values(arch.parts).map((part) => part?.title);

  assert.deepEqual(drawn, ['Users', 'App server', 'Database']);
});

// ---------------------------------------------------------------------------
// Switching product
// ---------------------------------------------------------------------------

test('switching product and back restores the focus start, not every core feature', () => {
  const start = FOCUS_SETUPS['what-is-system-design'];
  const away = switchProduct(start, 'instagram');
  const back = switchProduct(away, 'whatsapp');

  assert.equal(Object.keys(away.selected).length, 1);
  assert.deepEqual(back.selected, start.selected);
  assert.deepEqual(back.nfr, start.nfr);
});

test('a focus that starts on the core features gets the core features of the other product', () => {
  const away = switchProduct(FOCUS_SETUPS['functional-requirements'], 'uber');

  assert.deepEqual(away.selected, coreOf('uber'));
});

// ---------------------------------------------------------------------------
// Nothing truncated
// ---------------------------------------------------------------------------

// Advance widths from scripts/check-visuals.mjs (measured in headless Chromium): the title font
// (text-xs semibold) and the 11px subtitle font. Anything else counts as wide as a "W".
const TITLE_CHAR_W: Record<string, number> = {
  ' ': 3.2, '+': 7.9, '-': 5.8, ':': 4, '0': 8, '1': 6, '2': 7.6, '3': 7.9, '4': 8.1, '5': 7.8, '6': 8.1, '7': 7.2,
  '8': 8.1, '9': 8.1, A: 8.6, B: 8.2, C: 8.8, D: 8.9, E: 7.4, G: 9.1, I: 3.7, L: 7.1, M: 10.8, N: 9.2, O: 9.4, P: 8,
  Q: 9.4, R: 8.2, S: 8, U: 9.1, W: 12, a: 7, b: 7.7, c: 7, d: 7.7, e: 7.1, f: 4.8, g: 7.6, h: 7.5, i: 3.3, k: 7,
  l: 3.4, m: 11, n: 7.4, o: 7.4, p: 7.7, q: 7.7, r: 5, s: 6.7, t: 4.8, u: 7.4, v: 6.9, w: 9.9, x: 6.8, y: 7, z: 6.7,
};
const SUB_CHAR_W: Record<string, number> = {
  '0': 7, '1': 5.2, '2': 6.8, '3': 7, '4': 7.2, '5': 6.9, '6': 7.1, '7': 6.4, '8': 7.1, '9': 7.1, ' ': 3.2, '%': 10.3,
  '+': 7, ',': 3.4, '-': 5.3, '.': 3.4, '/': 3.5, ':': 3.4, '~': 7, A: 7.5, B: 7.3, C: 8, D: 8.1, E: 6.7, F: 6.4,
  G: 8.3, H: 8.3, I: 3.1, K: 7.4, L: 6.4, M: 9.7, N: 8.3, O: 8.6, P: 7.1, R: 7.3, S: 7.1, T: 7.1, U: 8.2, W: 10.8,
  a: 6.2, b: 6.9, c: 6.3, d: 6.9, e: 6.4, f: 4.1, g: 6.8, h: 6.6, i: 2.8, j: 2.8, k: 6.1, l: 2.9, m: 9.7, n: 6.5,
  o: 6.6, p: 6.8, q: 6.8, r: 4.3, s: 5.9, t: 4.1, u: 6.5, v: 6.1, w: 8.6, x: 5.9, y: 6.1, z: 6,
};
const width = (table: Record<string, number>, wide: number) => (text: string) =>
  [...text].reduce((sum, ch) => sum + (table[ch] ?? wide), 0);
const titleWidth = width(TITLE_CHAR_W, 12);
const subWidth = width(SUB_CHAR_W, 10.8);
/** Stat values are 11px monospace semibold: 6.7px a character. */
const monoWidth = (text: string) => text.length * 6.7;
/** Compact ArchNode: 16 padding + 2 border, and the 28 icon + 8 gap before the title column. */
const INNER = 18;
const TITLE_COLUMN = 54;

function* everySetting(): Generator<Setup> {
  for (const product of PRODUCTS) {
    const ids = REQUIREMENTS[product].map((option) => option.id);
    for (let mask = 1; mask < 1 << ids.length; mask += 1) {
      const chosen = ids.filter((_, index) => mask & (1 << index));
      for (const availability of [0, 1, 2, 3]) {
        for (const users of [0, 1, 2, 3]) {
          for (const latency of [0, 2, 3]) {
            for (const consistency of [0, 2]) {
              for (const durability of [0, 2]) {
                yield setup(product, chosen, { availability, users, latency, consistency, durability });
              }
            }
          }
        }
      }
    }
  }
}

test('no part title, subtitle, stat or status line is truncated at any setting', () => {
  let checked = 0;
  for (const s of everySetting()) {
    const arch = architecture(s);
    for (const part of Object.values(arch.parts)) {
      if (!part) continue;
      const w = part.id === 'region2' ? REGION2.w : SLOTS[part.id].w;
      const where = `${part.id} in ${JSON.stringify(s)}`;
      assert.ok(TITLE_COLUMN + titleWidth(part.title) <= w, `title "${part.title}" of ${where}`);
      const subtitle = subtitleFor(part, arch);
      assert.ok(TITLE_COLUMN + subWidth(subtitle) <= w, `subtitle "${subtitle}" of ${where}`);
      if (part.stat) {
        const row = subWidth(part.stat.label) + 8 + monoWidth(part.stat.value);
        assert.ok(INNER + row <= w, `stat "${part.stat.label} ${part.stat.value}" of ${where}`);
      }
      if (part.status) {
        // 8px dot + 6px gap, text at 11px medium (a little wider than regular).
        assert.ok(INNER + 14 + subWidth(part.status) * 1.04 <= w, `status "${part.status}" of ${where}`);
      }
      checked += 1;
    }
  }
  assert.ok(checked > 1000);
});

test('a part with several reasons names the first and counts the rest', () => {
  const arch = architecture(setup('whatsapp', ['send', 'receive', 'groups', 'receipts']));
  const api = arch.parts.api;

  assert.ok(api);
  assert.equal(subtitleFor(api, arch), 'for send +3 more');
});
