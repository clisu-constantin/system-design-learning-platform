import { useCallback, useRef, useState } from 'react';
import { Rocket, Zap } from 'lucide-react';
import { ArchNode, DiagramCanvas, NodeStatRow, ParticleLegend, type DiagramEdge, type Layout, type ParticleView } from '@/components/architecture';
import { Insight, LabShell, MetricsPanel } from '@/components/learning';
import { Button, Meter, SegmentedControl, Slider } from '@/components/ui';
import { advanceParticles, nextParticleId, useEventLog, useTicker, type Particle } from '@/simulations/engine';
import { computeLoad } from '@/simulations/models/load';
import { useRerender } from '@/hooks/useRerender';
import { sampleArrivals } from '@/utils/math';
import { formatLatency, formatNumber, formatPercent } from '@/utils/format';
import { cn } from '@/utils/cn';

type Mode = 'monolith' | 'microservices';

const FEATURES = ['Users', 'Orders', 'Payments', 'Notifications'] as const;
type Feature = (typeof FEATURES)[number];

/** Share of traffic each capability receives. Orders is the hot path. */
const TRAFFIC_SHARE: Record<Feature, number> = {
  Users: 0.2,
  Orders: 0.5,
  Payments: 0.2,
  Notifications: 0.1,
};

interface State {
  particles: Particle[];
  handled: number;
  failed: number;
  latencyTotal: number;
  latencyCount: number;
}

const createState = (): State => ({ particles: [], handled: 0, failed: 0, latencyTotal: 0, latencyCount: 0 });

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
  const serviceCapacity = (feature: Feature) => (feature === 'Orders' ? instances * 500 : 400);

  const monolithLoad = computeLoad(traffic, monolithCapacity, { baseLatencyMs: 35, kneeAt: 0.65 });
  const serviceLoads = Object.fromEntries(
    FEATURES.map((feature) => [
      feature,
      computeLoad(traffic * TRAFFIC_SHARE[feature], serviceCapacity(feature), { baseLatencyMs: 30, kneeAt: 0.65 }),
    ]),
  ) as Record<Feature, ReturnType<typeof computeLoad>>;

  useTicker(running, (dt) => {
    const current = state.current;
    const arrivals = sampleArrivals(Math.min(traffic, 500), dt * 0.4);

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
        current.particles.push({
          id: nextParticleId(),
          route: failed ? ['client', 'lb', 'app'] : ['client', 'lb', 'app', 'db'],
          leg: 0,
          t: 0,
          speed: 1.4,
          outcome: failed ? 'failure' : monolithLoad.cpu > 0.85 ? 'warning' : 'success',
        });
        if (failed) current.failed += 1;
        else {
          current.handled += 1;
          current.latencyTotal += monolithLoad.latencyMs;
          current.latencyCount += 1;
        }
      } else {
        const load = serviceLoads[feature];
        const failed = broken === feature || Math.random() < load.errorRate;
        // Orders calls Payments synchronously - one extra network hop.
        const extraHop = feature === 'Orders' && !failed && Math.random() < 0.5;
        current.particles.push({
          id: nextParticleId(),
          route: failed
            ? ['client', 'gateway', `svc-${feature}`]
            : extraHop
              ? ['client', 'gateway', 'svc-Orders', 'svc-Payments', 'db-Payments']
              : ['client', 'gateway', `svc-${feature}`, `db-${feature}`],
          leg: 0,
          t: 0,
          speed: 1.3,
          outcome: failed ? 'failure' : load.cpu > 0.85 ? 'warning' : 'success',
        });
        if (failed) current.failed += 1;
        else {
          current.handled += 1;
          current.latencyTotal += load.latencyMs + 12 + (extraHop ? 25 : 0);
          current.latencyCount += 1;
        }
      }
    }

    const { alive } = advanceParticles(current.particles, dt);
    current.particles = alive.slice(-80);
    rerender();
  });

  const current = state.current;
  const total = current.handled + current.failed;
  const errorRate = total ? current.failed / total : 0;
  const avgLatency = current.latencyCount ? current.latencyTotal / current.latencyCount : 0;

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
          { from: 'svc-Orders', to: 'svc-Payments', tone: 'warn', dashed: true, label: 'sync call' },
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
            ) : (
              <>
                The {broken} service is down, but the other three keep serving. Fault isolation is real - as long as
                callers degrade gracefully instead of blocking on a dead dependency.
              </>
            )
          ) : mode === 'monolith' ? (
            <>
              One deployment, one database, in-process calls. Average latency is {formatLatency(avgLatency)} with no
              network hops between features. The costs are coarse scaling and a shared release train - not performance.
            </>
          ) : (
            <>
              Each service scales and fails on its own, at the price of network hops: latency is{' '}
              {formatLatency(avgLatency)}, and the synchronous Orders {'->'} Payments call means Orders is only as
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
              { key: 'latency', label: 'Avg latency', value: formatLatency(avgLatency) },
              {
                key: 'errorRate',
                label: 'Error rate',
                value: formatPercent(errorRate, 1),
                tone: errorRate > 0.05 ? 'danger' : 'ok',
              },
              {
                key: 'blast',
                label: 'Blast radius',
                value: broken ? (mode === 'monolith' ? 'All features' : `${broken} only`) : 'None',
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
            max={5000}
            step={100}
            onChange={setTraffic}
            format={(value) => `${formatNumber(value)} req/sec`}
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
              <Meter label="Application" value={monolithLoad.cpu} />
            ) : (
              FEATURES.map((feature) => (
                <Meter key={feature} label={feature} value={serviceLoads[feature].cpu} size="xs" className="mb-1.5" />
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
                subtitle={feature === 'Orders' ? `x${instances}` : 'x1'}
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
      <div className="flex items-center gap-4 px-4 pb-3 pt-1 text-[11px] text-faint">
        <span className="flex items-center gap-1.5">
          <Rocket className="h-3.5 w-3.5" /> Deployable units: {mode === 'monolith' ? 1 : FEATURES.length}
        </span>
        <span className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5" /> Network hops per request: {mode === 'monolith' ? 1 : '2-3'}
        </span>
      </div>
    </LabShell>
  );
}

export default MonolithMicroservicesLab;
