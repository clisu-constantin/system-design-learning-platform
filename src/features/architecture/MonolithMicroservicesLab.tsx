import { useCallback, useRef, useState } from 'react';
import { Rocket, Zap } from 'lucide-react';
import { ArchNode, DiagramCanvas, NodeStatRow, ParticleLegend, type DiagramEdge, type Layout, type ParticleView } from '@/components/architecture';
import { Insight, LabShell, MetricsPanel } from '@/components/learning';
import { Button, Meter, SegmentedControl, Slider } from '@/components/ui';
import {
  advanceParticles,
  MetricWindow,
  nextParticleId,
  RateCounter,
  useEventLog,
  useTicker,
  visualShare,
  type Particle,
} from '@/simulations/engine';
import { computeLoad } from '@/simulations/models/load';
import { useRerender } from '@/hooks/useRerender';
import { sampleArrivals } from '@/utils/math';
import { formatLatency, formatNumber, formatPercent } from '@/utils/format';
import { cn } from '@/utils/cn';

type Mode = 'monolith' | 'microservices';

/** Requests animated per second, independent of how much traffic is counted. */
const ANIMATED_PER_SECOND = 45;
const PARTICLE_BUDGET = 110;

const FEATURES = ['Users', 'Orders', 'Payments', 'Notifications'] as const;
type Feature = (typeof FEATURES)[number];

/** Share of traffic each capability receives. Orders is the hot path. */
const TRAFFIC_SHARE: Record<Feature, number> = {
  Users: 0.2,
  Orders: 0.5,
  Payments: 0.2,
  Notifications: 0.1,
};

/** Share of Orders requests that call Payments synchronously (one extra hop). */
const ORDERS_CALLING_PAYMENTS = 0.5;

/**
 * Traffic ceiling. Only Orders scales in microservices mode, so the fixed
 * services are sized to stay under capacity at this maximum (the busiest,
 * Payments and Users, run at about 85%) - no
 * setting of the controls produces a failure that no control can fix.
 */
const MAX_TRAFFIC = 2000;

/**
 * Fixed capacity of the services that do not scale. Payments is larger because
 * it also serves the synchronous calls Orders makes to it: at MAX_TRAFFIC it
 * sees 20% + 50% x 50% = 45% of traffic (900 req/s), Users 400 and
 * Notifications 200 req/s.
 */
const FIXED_CAPACITY: Record<Exclude<Feature, 'Orders'>, number> = {
  Users: 450,
  Payments: 1000,
  Notifications: 450,
};

/** Requests per second each service receives: its own share plus calls from other services. */
const serviceDemand = (feature: Feature, traffic: number) =>
  traffic * TRAFFIC_SHARE[feature] +
  (feature === 'Payments' ? traffic * TRAFFIC_SHARE.Orders * ORDERS_CALLING_PAYMENTS : 0);

interface State {
  particles: Particle[];
  /**
   * Rolling rather than cumulative. Breaking a capability has to show up in the
   * error rate within a second or two; a lifetime average of a simulation that
   * has been healthy for a minute barely moves when something starts failing.
   */
  handled: RateCounter;
  failed: RateCounter;
  latency: MetricWindow;
}

const createState = (): State => ({
  particles: [],
  handled: new RateCounter(3000),
  failed: new RateCounter(3000),
  latency: new MetricWindow(400),
});

const MONO_LAYOUT: Layout = {
  client: { x: 390, y: 20, w: 180, h: 60 },
  lb: { x: 390, y: 130, w: 180, h: 74 },
  app: { x: 300, y: 240, w: 360, h: 150 },
  db: { x: 390, y: 420, w: 180, h: 72 },
};

const MICRO_LAYOUT: Layout = {
  client: { x: 390, y: 14, w: 180, h: 56 },
  gateway: { x: 370, y: 110, w: 220, h: 72 },
  'svc-Users': { x: 40, y: 220, w: 190, h: 120 },
  'svc-Orders': { x: 260, y: 220, w: 190, h: 120 },
  'svc-Payments': { x: 480, y: 220, w: 190, h: 120 },
  'svc-Notifications': { x: 700, y: 220, w: 190, h: 120 },
  'db-Users': { x: 60, y: 390, w: 150, h: 76 },
  'db-Orders': { x: 280, y: 390, w: 150, h: 76 },
  'db-Payments': { x: 500, y: 390, w: 150, h: 76 },
  'db-Notifications': { x: 720, y: 390, w: 150, h: 76 },
};

export function MonolithMicroservicesLab() {
  const [running, setRunning] = useState(true);
  const [mode, setMode] = useState<Mode>('monolith');
  const [traffic, setTraffic] = useState(900);
  const [instances, setInstances] = useState(2);
  const [broken, setBroken] = useState<Feature | null>(null);

  const state = useRef<State>(createState());
  const rerender = useRerender(30);
  const { events, log, clear } = useEventLog();

  const reset = useCallback(() => {
    state.current = createState();
    setBroken(null);
    clear();
  }, [clear]);

  // Monolith: all features share one pool. Microservices: capacity per service.
  const monolithCapacity = instances * 700;
  const serviceCapacity = (feature: Feature) => (feature === 'Orders' ? instances * 500 : FIXED_CAPACITY[feature]);

  const monolithLoad = computeLoad(traffic, monolithCapacity, { baseLatencyMs: 35, kneeAt: 0.65 });
  const serviceLoads = Object.fromEntries(
    FEATURES.map((feature) => [
      feature,
      computeLoad(serviceDemand(feature, traffic), serviceCapacity(feature), { baseLatencyMs: 30, kneeAt: 0.65 }),
    ]),
  ) as Record<Feature, ReturnType<typeof computeLoad>>;

  useTicker(running, (dt) => {
    const current = state.current;
    const now = performance.now();
    // Every request is counted; only a sample of them is animated.
    const arrivals = sampleArrivals(traffic, dt);
    const share = visualShare(traffic, ANIMATED_PER_SECOND);
    const animate = () => Math.random() < share;

    for (let index = 0; index < arrivals; index += 1) {
      const roll = Math.random();
      let cumulative = 0;
      let feature: Feature = 'Orders';
      for (const item of FEATURES) {
        cumulative += TRAFFIC_SHARE[item];
        if (roll <= cumulative) {
          feature = item;
          break;
        }
      }

      if (mode === 'monolith') {
        // A crash in any feature takes down the whole process.
        const failed = broken !== null || Math.random() < monolithLoad.errorRate;
        if (failed) current.failed.add(1, now);
        else {
          current.handled.add(1, now);
          current.latency.push(monolithLoad.latencyMs, now);
        }
        if (!animate()) continue;
        current.particles.push({
          id: nextParticleId(),
          route: failed ? ['client', 'lb', 'app'] : ['client', 'lb', 'app', 'db'],
          leg: 0,
          t: 0,
          speed: 1.4,
          outcome: failed ? 'failure' : monolithLoad.cpu > 0.85 ? 'warning' : 'success',
        });
      } else {
        const load = serviceLoads[feature];
        const ownFailure = broken === feature || Math.random() < load.errorRate;
        // Orders calls Payments synchronously - one extra network hop, and Orders
        // is only as available as Payments: if the call fails, the order fails.
        const extraHop = feature === 'Orders' && !ownFailure && Math.random() < ORDERS_CALLING_PAYMENTS;
        const dependencyFailure =
          extraHop && (broken === 'Payments' || Math.random() < serviceLoads.Payments.errorRate);
        const failed = ownFailure || dependencyFailure;
        if (failed) current.failed.add(1, now);
        else {
          current.handled.add(1, now);
          current.latency.push(load.latencyMs + 12 + (extraHop ? serviceLoads.Payments.latencyMs : 0), now);
        }
        if (!animate()) continue;
        current.particles.push({
          id: nextParticleId(),
          route: ownFailure
            ? ['client', 'gateway', `svc-${feature}`]
            : dependencyFailure
              ? ['client', 'gateway', 'svc-Orders', 'svc-Payments']
              : extraHop
                ? ['client', 'gateway', 'svc-Orders', 'svc-Payments', 'db-Payments']
                : ['client', 'gateway', `svc-${feature}`, `db-${feature}`],
          leg: 0,
          t: 0,
          speed: 1.3,
          outcome: failed ? 'failure' : load.cpu > 0.85 ? 'warning' : 'success',
        });
      }
    }

    const { alive } = advanceParticles(current.particles, dt);
    current.particles = alive.length > PARTICLE_BUDGET ? alive.slice(-PARTICLE_BUDGET) : alive;
    rerender();
  });

  const current = state.current;
  const now = performance.now();
  const failedQps = current.failed.rate(now);
  const servedQps = current.handled.rate(now) + failedQps;
  const errorRate = servedQps ? failedQps / servedQps : 0;
  // With every request failing (or none sent in the last 2 s) there is no
  // latency to average - the window reports null and it renders as a dash,
  // instead of a 0 ms that reads as "very fast" or a stale last value.
  const latencyText = formatLatency(current.latency.snapshot(now).avg);

  const layout = mode === 'monolith' ? MONO_LAYOUT : MICRO_LAYOUT;

  const edges: DiagramEdge[] =
    mode === 'monolith'
      ? [
          { from: 'client', to: 'lb', tone: 'brand', width: 2 },
          { from: 'lb', to: 'app', tone: 'ok', width: 2 },
          { from: 'app', to: 'db', tone: 'info' },
        ]
      : [
          { from: 'client', to: 'gateway', tone: 'brand', width: 2 },
          ...FEATURES.map<DiagramEdge>((feature) => ({
            from: 'gateway',
            to: `svc-${feature}`,
            tone: broken === feature ? 'muted' : 'ok',
            dashed: broken === feature,
          })),
          ...FEATURES.map<DiagramEdge>((feature) => ({
            from: `svc-${feature}`,
            to: `db-${feature}`,
            tone: 'info',
          })),
          // No edge label: the two cards are 30px apart, so any label lands behind a
          // node. The Orders card subtitle says "calls Payments" instead.
          { from: 'svc-Orders', to: 'svc-Payments', tone: broken === 'Payments' ? 'danger' : 'warn', dashed: true },
        ];

  const particleViews: ParticleView[] = current.particles
    .filter((particle) => layout[particle.route[particle.leg]] && layout[particle.route[particle.leg + 1]])
    .map((particle) => ({
      id: particle.id,
      from: particle.route[particle.leg],
      to: particle.route[particle.leg + 1],
      t: particle.t,
      outcome: particle.outcome ?? 'success',
    }));

  const comparison = [
    {
      dimension: 'Deployment',
      monolith: 'One pipeline, one artefact. Every team ships together.',
      microservices: 'Each service deploys independently, on its own schedule.',
    },
    {
      dimension: 'Scaling',
      monolith: 'Scale the whole application, even if only one endpoint is hot.',
      microservices: 'Scale only the hot service - here, Orders.',
    },
    {
      dimension: 'Fault isolation',
      monolith: 'A crash or memory leak in one feature takes down everything.',
      microservices: 'A failed service degrades one capability, if callers handle it.',
    },
    {
      dimension: 'Data consistency',
      monolith: 'One database, real transactions across features.',
      microservices: 'A database per service - cross-service workflows need sagas.',
    },
    {
      dimension: 'Latency',
      monolith: 'In-process calls. No serialization, no network failures.',
      microservices: 'Every hop adds latency and a new way to fail.',
    },
    {
      dimension: 'Operational cost',
      monolith: 'One service to monitor, log and deploy.',
      microservices: 'Service discovery, tracing, CI/CD and on-call per service.',
    },
    {
      dimension: 'Development velocity',
      monolith: 'Fast while the team is small; slows as the release train fills.',
      microservices: 'Slower per change, but teams stop blocking each other.',
    },
  ];

  return (
    <LabShell
      title="Monolith vs Microservices Lab"
      description="Same product, two architectures. Send traffic, break a capability, and compare what actually changes."
      running={running}
      onToggleRun={() => setRunning((value) => !value)}
      onReset={reset}
      legend={<ParticleLegend outcomes={['success', 'warning', 'failure']} />}
      events={events}
      actions={
        <SegmentedControl
          value={mode}
          options={[
            { value: 'monolith', label: 'Monolith' },
            { value: 'microservices', label: 'Microservices' },
          ]}
          onChange={(value) => {
            setMode(value);
            state.current = createState();
            log(`Switched to ${value}`, 'info');
          }}
        />
      }
      insight={
        <Insight>
          {broken ? (
            mode === 'monolith' ? (
              <>
                The {broken} feature crashed the process. In a monolith there is one process, so{' '}
                <strong className="text-ink">every</strong> capability is down - including checkout, which has nothing
                to do with the bug.
              </>
            ) : broken === 'Payments' ? (
              <>
                Payments is down, and so is every order that calls it synchronously - Users and Notifications keep
                serving, but Orders fails whenever it needs Payments. Fault isolation only holds where there is no
                synchronous dependency, or where the caller degrades gracefully instead of failing with it.
              </>
            ) : (
              <>
                The {broken} service is down, but the other three keep serving. Fault isolation is real - as long as
                callers degrade gracefully instead of blocking on a dead dependency.
              </>
            )
          ) : mode === 'monolith' ? (
            <>
              One deployment, one database, in-process calls. Average latency is {latencyText} with no
              network hops between features. The costs are coarse scaling and a shared release train - not performance.
            </>
          ) : (
            <>
              Each service scales and fails on its own, at the price of network hops: latency is{' '}
              {latencyText}, and the synchronous Orders {'->'} Payments call means Orders is only as
              available as Payments. Microservices are an organisational tool before they are a technical one.
            </>
          )}
        </Insight>
      }
      metrics={
        <>
          <MetricsPanel
            items={[
              { key: 'rps', label: 'Traffic', value: formatNumber(traffic), unit: 'req/s', tone: 'brand' },
              {
                key: 'latency',
                label: 'Avg latency',
                value: latencyText,
                hint: 'Average over successful requests. n/a when every request is failing.',
              },
              {
                key: 'errorRate',
                label: 'Error rate',
                value: formatPercent(errorRate, 1),
                tone: errorRate > 0.05 ? 'danger' : 'ok',
              },
              {
                key: 'blast',
                label: 'Blast radius',
                value: broken
                  ? mode === 'monolith'
                    ? 'All features'
                    : broken === 'Payments'
                      ? 'Payments + some Orders'
                      : `${broken} only`
                  : 'None',
                tone: broken && mode === 'monolith' ? 'danger' : broken ? 'warn' : 'ok',
                hint: 'What stops working when one capability fails.',
              },
              {
                key: 'deployUnits',
                label: 'Deployable units',
                value: mode === 'monolith' ? 1 : FEATURES.length,
                hint: 'How many things can ship independently.',
              },
              {
                key: 'databases',
                label: 'Databases',
                value: mode === 'monolith' ? 1 : FEATURES.length,
                hint: 'Microservices own their data - no shared schema.',
              },
            ]}
          />

          <div className="card overflow-hidden">
            <p className="label border-b border-line px-4 py-3">Side-by-side comparison</p>
            <div className="divide-y divide-line">
              {comparison.map((row) => (
                <div key={row.dimension} className="grid gap-2 px-4 py-3 sm:grid-cols-[130px_1fr_1fr]">
                  <p className="text-xs font-semibold text-ink">{row.dimension}</p>
                  <p className={cn('text-xs', mode === 'monolith' ? 'text-muted' : 'text-faint')}>{row.monolith}</p>
                  <p className={cn('text-xs', mode === 'microservices' ? 'text-muted' : 'text-faint')}>
                    {row.microservices}
                  </p>
                </div>
              ))}
            </div>
            <p className="border-t border-line px-4 py-3 text-xs text-faint">
              Neither column is the winner. The question is which costs you can afford and which benefits you actually
              need right now.
            </p>
          </div>
        </>
      }
      controls={
        <>
          <Slider
            label="Traffic"
            value={traffic}
            min={100}
            max={MAX_TRAFFIC}
            step={100}
            onChange={setTraffic}
            format={(value) => `${formatNumber(value)} req/sec`}
            hint="Capped so the services that do not scale stay under capacity."
          />
          <Slider
            label="Instances"
            value={instances}
            min={1}
            max={8}
            onChange={setInstances}
            format={(value) => `${value}`}
            hint={
              mode === 'monolith'
                ? 'Copies of the whole application - every feature scales together.'
                : 'Copies of the Orders service, the hot path. Others stay fixed.'
            }
          />
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted">Break a capability</p>
            {FEATURES.map((feature) => (
              <Button
                key={feature}
                size="sm"
                variant={broken === feature ? 'success' : 'secondary'}
                className="w-full justify-center"
                onClick={() => {
                  const next = broken === feature ? null : feature;
                  setBroken(next);
                  state.current = createState();
                  log(
                    next
                      ? mode === 'monolith'
                        ? `${feature} crashed - the whole monolith process is down`
                        : feature === 'Payments'
                          ? 'Payments service down - Orders requests that call it fail too'
                          : `${feature} service down - other services unaffected`
                      : `${feature} recovered`,
                    next ? 'danger' : 'ok',
                  );
                }}
              >
                {broken === feature ? `Recover ${feature}` : `Break ${feature}`}
              </Button>
            ))}
          </div>
          <div className="rounded-xl border border-line bg-elevated p-3">
            <p className="label mb-2">Utilization</p>
            {mode === 'monolith' ? (
              <Meter label="Application" value={broken ? 0 : monolithLoad.cpu} />
            ) : (
              FEATURES.map((feature) => (
                <Meter
                  key={feature}
                  label={feature}
                  value={broken === feature ? 0 : serviceLoads[feature].cpu}
                  size="xs"
                  className="mb-1.5"
                />
              ))
            )}
          </div>
        </>
      }
    >
      <DiagramCanvas layout={layout} edges={edges} particles={particleViews} height={505} className="bg-canvas">
        {mode === 'monolith' ? (
          <>
            <ArchNode kind="client" title="Clients" subtitle={`${formatNumber(traffic)} req/sec`} placed={layout.client} compact />
            <ArchNode kind="load-balancer" title="Load Balancer" placed={layout.lb} compact />
            <ArchNode
              kind="server"
              title={`Application x${instances}`}
              subtitle="one deployable unit"
              placed={layout.app}
              status={broken ? 'down' : monolithLoad.errorRate > 0.2 ? 'degraded' : 'healthy'}
              alert={monolithLoad.saturated}
            >
              <div className="flex flex-wrap gap-1.5 pb-1">
                {FEATURES.map((feature) => (
                  <span
                    key={feature}
                    className={cn(
                      'rounded-md border px-2 py-0.5 text-[10px]',
                      broken === feature ? 'border-danger bg-danger/10 text-danger' : 'border-line text-muted',
                    )}
                  >
                    {feature}
                  </span>
                ))}
              </div>
              <Meter label="CPU" value={broken ? 0 : monolithLoad.cpu} size="xs" />
              <NodeStatRow label="Latency" value={formatLatency(monolithLoad.latencyMs)} />
            </ArchNode>
            <ArchNode kind="sql" title="Database" subtitle="shared by all features" placed={layout.db} compact />
          </>
        ) : (
          <>
            <ArchNode kind="client" title="Clients" subtitle={`${formatNumber(traffic)} req/sec`} placed={layout.client} compact />
            <ArchNode kind="api-gateway" title="API Gateway" subtitle="routing + auth" placed={layout.gateway} compact />
            {FEATURES.map((feature) => (
              <ArchNode
                key={feature}
                kind="service"
                title={`${feature} Service`}
                subtitle={feature === 'Orders' ? `x${instances}, calls Payments` : 'x1'}
                placed={layout[`svc-${feature}`]}
                status={broken === feature ? 'down' : serviceLoads[feature].errorRate > 0.2 ? 'degraded' : 'healthy'}
                alert={serviceLoads[feature].saturated}
              >
                <Meter label="CPU" value={broken === feature ? 0 : serviceLoads[feature].cpu} size="xs" />
                <NodeStatRow label="Share" value={formatPercent(TRAFFIC_SHARE[feature])} />
              </ArchNode>
            ))}
            {FEATURES.map((feature) => (
              <ArchNode
                key={`db-${feature}`}
                kind="sql"
                title={`${feature} DB`}
                placed={layout[`db-${feature}`]}
                status={broken === feature ? 'degraded' : 'healthy'}
                compact
              />
            ))}
          </>
        )}
      </DiagramCanvas>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-3 pt-1 text-[11px] text-faint">
        <span className="flex items-center gap-1.5">
          <Rocket className="h-3.5 w-3.5" /> Deployable units: {mode === 'monolith' ? 1 : FEATURES.length}
        </span>
        <span className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5" /> Network hops per request: {mode === 'monolith' ? 2 : '2-3'}
        </span>
        <span className="ml-auto">Simplified load model - latency and errors are illustrative, not measured.</span>
      </div>
    </LabShell>
  );
}

export default MonolithMicroservicesLab;
