import { useMemo, useState } from 'react';
import { Insight, LabShell, MetricsPanel } from '@/components/learning';
import { Badge, Slider, Toggle } from '@/components/ui';
import { formatLatency, formatNumber } from '@/utils/format';
import { cn } from '@/utils/cn';

interface SpanSpec {
  id: string;
  /** Id of the span that made this call; absent for the root span. */
  parent?: string;
  name: string;
  /** The process that recorded the span - what the "Components" metric counts. */
  component: string;
  /** Own work, excluding children. */
  selfMs: number;
  kind: 'gateway' | 'service' | 'db' | 'cache' | 'queue';
  attributes: Record<string, string>;
}

interface Span extends SpanSpec {
  depth: number;
  startMs: number;
  /** Duration including every child span, as a tracing UI shows it. */
  totalMs: number;
}

/**
 * Colour is only the span kind - it never means "error". Red is kept out so a
 * cache span does not read as a failed one; the kind is also named in the
 * span detail badge.
 */
const KIND_TONE = {
  gateway: 'bg-brand',
  service: 'bg-ok',
  db: 'bg-info',
  cache: 'bg-violet',
  queue: 'bg-warn',
} as const;

/**
 * Teaching simplification: a span does its own work first, then calls its
 * children one after another (no parallel calls). A parent span therefore lasts
 * its own time plus all of its children, and the self times of every span add
 * up exactly to the root duration.
 */
function layoutSpans(specs: SpanSpec[]): Span[] {
  const place = (spec: SpanSpec, startMs: number, depth: number): Span[] => {
    let cursor = startMs + spec.selfMs;
    const descendants: Span[] = [];
    for (const child of specs.filter((item) => item.parent === spec.id)) {
      const placed = place(child, cursor, depth + 1);
      descendants.push(...placed);
      cursor = placed[0].startMs + placed[0].totalMs;
    }
    return [{ ...spec, depth, startMs, totalMs: cursor - startMs }, ...descendants];
  };
  const root = specs.find((spec) => spec.parent === undefined);
  return root ? place(root, 0, 0) : [];
}

export function TracingLab() {
  const [gatewayMs, setGatewayMs] = useState(18);
  const [orderMs, setOrderMs] = useState(35);
  const [paymentMs, setPaymentMs] = useState(120);
  const [dbMs, setDbMs] = useState(25);
  const [cacheHit, setCacheHit] = useState(true);
  const [asyncNotify, setAsyncNotify] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const spans = useMemo<Span[]>(() => {
    const specs: SpanSpec[] = [
      {
        id: 'gateway',
        name: 'API Gateway GET /api/orders/123',
        component: 'api-gateway',
        selfMs: gatewayMs,
        kind: 'gateway',
        attributes: { 'http.method': 'GET', 'http.route': '/api/orders/:id', 'user.id': 'user_42' },
      },
      {
        id: 'order',
        parent: 'gateway',
        name: 'order-service handle',
        component: 'order-service',
        selfMs: orderMs,
        kind: 'service',
        attributes: { 'service.version': '2.14.0', 'peer.service': 'payment-service' },
      },
      {
        id: 'cache',
        parent: 'order',
        name: `redis GET order:123 (${cacheHit ? 'HIT' : 'MISS'})`,
        component: 'redis',
        selfMs: cacheHit ? 3 : 5,
        kind: 'cache',
        attributes: { 'db.system': 'redis', 'cache.hit': String(cacheHit) },
      },
      ...(cacheHit
        ? []
        : [
            {
              id: 'db',
              parent: 'order',
              name: 'postgres SELECT orders',
              component: 'postgres',
              selfMs: dbMs,
              kind: 'db' as const,
              attributes: { 'db.system': 'postgresql', 'db.statement': 'SELECT * FROM orders WHERE id = $1' },
            },
          ]),
      {
        id: 'payment',
        parent: 'order',
        name: 'payment-service authorize',
        component: 'payment-service',
        selfMs: paymentMs,
        kind: 'service',
        attributes: { 'peer.service': 'stripe', 'retry.count': '0' },
      },
      {
        id: 'payment-db',
        parent: 'payment',
        name: 'postgres INSERT payment',
        component: 'postgres',
        selfMs: dbMs,
        kind: 'db',
        attributes: { 'db.system': 'postgresql', 'db.operation': 'INSERT' },
      },
      ...(asyncNotify
        ? [
            {
              id: 'queue',
              parent: 'order',
              name: 'kafka publish order.updated',
              component: 'kafka',
              selfMs: 4,
              kind: 'queue' as const,
              attributes: { 'messaging.system': 'kafka', 'messaging.destination': 'order.updated' },
            },
          ]
        : []),
    ];

    return layoutSpans(specs);
  }, [gatewayMs, orderMs, paymentMs, dbMs, cacheHit, asyncNotify]);

  const root = spans[0];
  const totalMs = root.totalMs;
  // Slowest by self time: the span whose own work costs the most, not a parent
  // that is long only because it waits on its children.
  const slowest = spans.slice(1).reduce((worst, span) => (span.selfMs > worst.selfMs ? span : worst), spans[1]);
  const active = spans.find((span) => span.id === selected) ?? null;

  return (
    <LabShell
      title="Distributed Tracing Lab"
      description="One request, one trace id, every hop with its own timing. Change a service latency and watch which span owns the total."
      onReset={() => {
        setGatewayMs(18);
        setOrderMs(35);
        setPaymentMs(120);
        setDbMs(25);
        setCacheHit(true);
        setAsyncNotify(true);
        setSelected(null);
      }}
      insight={
        <Insight>
          Total request time is {formatLatency(totalMs)}, and{' '}
          <strong className="text-ink">{slowest.name}</strong> accounts for {formatLatency(slowest.selfMs)} of it -
          about {Math.round((slowest.selfMs / totalMs) * 100)}%. Without a trace, "the order page is slow" is a
          guess; with one it is a single row on a waterfall. Metrics tell you that something is slow, traces tell you
          which hop.
        </Insight>
      }
      metrics={
        <>
          <MetricsPanel
            items={[
              { key: 'total', label: 'Total duration', value: formatLatency(totalMs), tone: totalMs > 300 ? 'warn' : 'ok' },
              { key: 'spans', label: 'Spans', value: spans.length, hint: 'Operations recorded in this trace.' },
              {
                key: 'components',
                label: 'Components',
                value: new Set(spans.map((span) => span.component)).size,
                hint: 'Distinct processes (gateway, services, stores, broker) involved in one request.',
              },
              {
                key: 'slowest',
                label: 'Slowest span (self)',
                value: formatLatency(slowest.selfMs),
                tone: 'danger',
                hint: 'The hop whose own work dominates the request - time spent waiting on children is not counted.',
              },
              {
                key: 'depth',
                label: 'Max depth',
                value: Math.max(...spans.map((span) => span.depth)) + 1,
                hint: 'How deep the synchronous call chain goes.',
              },
            ]}
          />

          {active ? (
            <div className="card p-4">
              <div className="flex items-center justify-between">
                <p className="label">Span detail</p>
                <Badge tone="brand">{active.kind}</Badge>
              </div>
              <p className="mt-2 font-mono text-sm text-ink">{active.name}</p>
              <dl className="mt-3 grid gap-x-6 gap-y-1.5 font-mono text-[11px] sm:grid-cols-2">
                <div className="flex justify-between gap-4">
                  <dt className="text-faint">duration</dt>
                  <dd className="text-ink">{formatLatency(active.totalMs)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-faint">self time</dt>
                  <dd className="text-ink">{formatLatency(active.selfMs)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-faint">start offset</dt>
                  <dd className="text-ink">+{formatLatency(active.startMs)}</dd>
                </div>
                {Object.entries(active.attributes).map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-4">
                    <dt className="text-faint">{key}</dt>
                    <dd className="truncate text-muted">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          <div className="card p-4">
            <p className="label mb-3">Logs, metrics and traces</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  title: 'Logs',
                  body: 'Discrete events with context. Answer "what exactly happened to this request?" - only if they carry the trace id.',
                },
                {
                  title: 'Metrics',
                  body: 'Cheap aggregates over time. Answer "is something wrong right now?" and drive alerts.',
                },
                {
                  title: 'Traces',
                  body: 'One request across services. Answer "where did the time go?" - this waterfall.',
                },
              ].map((item) => (
                <div key={item.title} className="rounded-xl border border-line p-3">
                  <p className="text-xs font-semibold text-ink">{item.title}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      }
      controls={
        <>
          <Slider label="API Gateway" value={gatewayMs} min={2} max={200} onChange={setGatewayMs} format={(value) => `${value} ms`} />
          <Slider label="Order service" value={orderMs} min={5} max={400} onChange={setOrderMs} format={(value) => `${value} ms`} />
          <Slider
            label="Payment service"
            value={paymentMs}
            min={5}
            max={2000}
            step={5}
            onChange={setPaymentMs}
            format={(value) => `${value} ms`}
            tone={paymentMs > 500 ? 'danger' : 'brand'}
            hint="A third-party dependency. Usually the first thing a trace exposes."
          />
          <Slider label="Database query" value={dbMs} min={1} max={500} onChange={setDbMs} format={(value) => `${value} ms`} />
          <Toggle
            label="Cache hit"
            checked={cacheHit}
            onChange={setCacheHit}
            description="Off: the order is loaded from Postgres instead"
          />
          <Toggle
            label="Async notification"
            checked={asyncNotify}
            onChange={setAsyncNotify}
            description="Publish to Kafka - context must be propagated into the message"
          />
          <div className="rounded-xl border border-line bg-elevated p-3 font-mono text-[10px] leading-relaxed text-muted">
            traceparent: 00-4bf92f3577b34da6-00f067aa0ba902b7-01
            <span className="mt-1 block text-faint">
              Propagate this header on every outbound call, including queue messages, or half the trace disappears.
            </span>
          </div>
        </>
      }
    >
      <div className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-mono text-xs text-muted">trace 4bf92f3577b34da6</p>
          <p className="font-mono text-xs text-ink">{formatLatency(totalMs)} total</p>
        </div>
        <div className="space-y-1.5">
          {spans.map((span) => {
            // Keep tiny spans visible (1.5% minimum) without pushing the bar past
            // the right edge - a span at the very end is nudged left instead.
            const width = Math.max(1.5, (span.totalMs / totalMs) * 100);
            const offset = Math.min((span.startMs / totalMs) * 100, 100 - width);
            return (
              <button
                key={span.id}
                type="button"
                onClick={() => setSelected(span.id === selected ? null : span.id)}
                className={cn(
                  // On a phone the name takes its own line; side by side it would leave the bar 0px wide.
                  'flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-2 py-1.5 text-left transition-colors sm:flex-nowrap',
                  selected === span.id ? 'bg-elevated' : 'hover:bg-elevated',
                )}
              >
                <span
                  className="w-full shrink-0 truncate font-mono text-[11px] text-muted sm:w-56"
                  title={span.name}
                  style={{ paddingLeft: span.depth * 12 }}
                >
                  {span.name}
                </span>
                <span className="relative h-4 min-w-0 flex-1 overflow-hidden rounded bg-line/40">
                  <span
                    className={cn('absolute inset-y-0 rounded', KIND_TONE[span.kind])}
                    style={{ left: `${offset}%`, width: `${width}%` }}
                  />
                </span>
                <span className="w-16 shrink-0 text-right font-mono text-[11px] text-ink">
                  {formatLatency(span.totalMs)}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-4 font-mono text-[11px] text-muted">
          Self times add up to the total: {spans.map((span) => formatNumber(span.selfMs)).join(' + ')} ={' '}
          {formatNumber(totalMs)} ms. A parent bar spans its children, so its duration includes their time.
        </p>
        <p className="mt-2 text-xs text-faint">
          Simplified: every call here runs one after another. Real services often call in parallel, and then children
          overlap. Click a span to inspect its attributes. Sampling decides which traces you keep - tail-based sampling keeps the
          slow and failed ones, which are the {formatNumber(1)}% you actually wanted.
        </p>
      </div>
    </LabShell>
  );
}

export default TracingLab;
