import { useCallback, useRef, useState } from 'react';
import { Camera, Minus, Plus } from 'lucide-react';
import {
  ArchNode,
  DiagramCanvas,
  NodeStatRow,
  ParticleLegend,
  spread,
  type DiagramEdge,
  type Layout,
  type ParticleView,
} from '@/components/architecture';
import { DistributionBar } from '@/components/charts';
import { Insight, LabShell, MetricsPanel } from '@/components/learning';
import { Button, Meter, Slider } from '@/components/ui';
import { advanceParticles, nextParticleId, useEventLog, useTicker, type Particle } from '@/simulations/engine';
import { computeLoad } from '@/simulations/models/load';
import { useRerender } from '@/hooks/useRerender';
import { clamp, sampleArrivals } from '@/utils/math';
import { formatLatency, formatNumber, formatPercent } from '@/utils/format';

const SERVER_CAPACITY = 400;
const MAX_SERVERS = 8;
// Traffic tops out at what the largest pool can serve, so every overload in
// this lab is fixable by adding servers.
const MAX_TRAFFIC = MAX_SERVERS * SERVER_CAPACITY;

interface Snapshot {
  label: string;
  servers: number;
  traffic: number;
  cpu: number;
  latency: number;
  errorRate: number;
}

/**
 * Horizontal scaling: start with one server, overload it, then add servers and
 * watch load, latency and errors redistribute.
 */
export function HorizontalScalingLab() {
  const [running, setRunning] = useState(true);
  const [traffic, setTraffic] = useState(900);
  const [servers, setServers] = useState(1);
  const [before, setBefore] = useState<Snapshot | null>(null);
  const particles = useRef<Particle[]>([]);
  const cursor = useRef(0);
  const rerender = useRerender(30);
  const { events, log, clear } = useEventLog();

  const capacity = servers * SERVER_CAPACITY;
  const perServer = computeLoad(traffic / servers, SERVER_CAPACITY, { baseLatencyMs: 40, kneeAt: 0.65 });

  // Logged outside the state updater: StrictMode runs updaters twice, which
  // wrote every add/remove into the event log twice.
  const addServer = useCallback(() => {
    if (servers >= MAX_SERVERS) return;
    setServers(servers + 1);
    log(`Added Server ${servers + 1} - pool capacity now ${formatNumber((servers + 1) * SERVER_CAPACITY)} req/sec`, 'ok');
  }, [servers, log]);

  const removeServer = useCallback(() => {
    if (servers <= 1) return;
    setServers(servers - 1);
    log(`Removed Server ${servers} - pool capacity now ${formatNumber((servers - 1) * SERVER_CAPACITY)} req/sec`, 'warn');
  }, [servers, log]);

  const capture = useCallback(() => {
    setBefore({
      label: `${servers} server${servers > 1 ? 's' : ''}`,
      servers,
      traffic,
      cpu: perServer.cpu,
      latency: perServer.latencyMs,
      errorRate: perServer.errorRate,
    });
    log(`Captured baseline: ${servers} server(s) at ${formatNumber(traffic)} req/sec`, 'info');
  }, [servers, traffic, perServer, log]);

  const reset = useCallback(() => {
    particles.current = [];
    setServers(1);
    setTraffic(900);
    setBefore(null);
    clear();
  }, [clear]);

  useTicker(running, (dt) => {
    const arrivals = sampleArrivals(Math.min(traffic, 800), dt * 0.4);
    for (let index = 0; index < arrivals; index += 1) {
      cursor.current = (cursor.current + 1) % servers;
      const failed = Math.random() < perServer.errorRate;
      particles.current.push({
        id: nextParticleId(),
        route: ['users', 'lb', `s${cursor.current}`],
        leg: 0,
        t: 0,
        speed: 1.4 + Math.random() * 0.4,
        outcome: failed ? 'failure' : perServer.cpu > 0.85 ? 'warning' : 'success',
      });
    }
    const { alive } = advanceParticles(particles.current, dt);
    particles.current = alive.slice(-80);
    rerender();
  });

  const width = clamp((940 - (servers - 1) * 12) / servers, 106, 180);
  const xs = spread(servers, 480, width, 12);
  const layout: Layout = {
    users: { x: 390, y: 16, w: 180, h: 60 },
    lb: { x: 380, y: 150, w: 200, h: 88 },
  };
  for (let index = 0; index < servers; index += 1) {
    layout[`s${index}`] = { x: xs[index], y: 320, w: width, h: 152 };
  }

  const edges: DiagramEdge[] = [
    { from: 'users', to: 'lb', tone: 'brand', width: 2 },
    ...Array.from({ length: servers }, (_, index) => ({
      from: 'lb',
      to: `s${index}`,
      tone: 'ok' as const,
    })),
  ];

  const particleViews: ParticleView[] = particles.current
    .filter((particle) => layout[particle.route[particle.route.length - 1]])
    .map((particle) => ({
      id: particle.id,
      from: particle.route[particle.leg],
      to: particle.route[particle.leg + 1],
      t: particle.t,
      outcome: particle.outcome ?? 'success',
    }));

  const after: Snapshot = {
    label: `${servers} server${servers > 1 ? 's' : ''}`,
    servers,
    traffic,
    cpu: perServer.cpu,
    latency: perServer.latencyMs,
    errorRate: perServer.errorRate,
  };

  return (
    <LabShell
      title="Horizontal Scaling Lab"
      description="One server cannot keep up. Add instances behind the load balancer and watch each one take a share of the load."
      running={running}
      onToggleRun={() => setRunning((value) => !value)}
      onReset={reset}
      legend={<ParticleLegend outcomes={['success', 'warning', 'failure']} />}
      events={events}
      actions={
        <>
          <Button onClick={capture}>
            <Camera className="h-4 w-4" />
            Capture "before"
          </Button>
          <Button variant="secondary" onClick={removeServer} disabled={servers <= 1}>
            <Minus className="h-4 w-4" />
            Remove
          </Button>
          <Button variant="primary" onClick={addServer} disabled={servers >= MAX_SERVERS}>
            <Plus className="h-4 w-4" />
            Add server
          </Button>
        </>
      }
      insight={
        <Insight>
          {traffic > capacity ? (
            <>
              {formatNumber(traffic)} req/sec against {formatNumber(capacity)} req/sec of pool capacity. Each server is
              at {formatPercent(perServer.cpu)} and rejecting {formatPercent(perServer.errorRate, 1)} of requests.
              Adding a server divides the load - this is the part that vertical scaling cannot do indefinitely.
            </>
          ) : (
            <>
              {servers === 1 ? (
                <>
                  One server is keeping up for now, but it is also a single point of failure: if it dies, the whole
                  service goes with it. Adding servers raises capacity and removes that risk at the same time.
                </>
              ) : (
                <>
                  Capacity scales roughly linearly with instance count, and redundancy arrives as a side effect: losing
                  one of {servers} servers now costs {formatPercent(1 / servers)} of capacity instead of the whole
                  service.
                </>
              )}{' '}
              The next bottleneck is usually the shared database, not the app tier.
            </>
          )}
        </Insight>
      }
      metrics={
        <>
          <MetricsPanel
            items={[
              { key: 'rps', label: 'Traffic', value: formatNumber(traffic), unit: 'req/s', tone: 'brand' },
              { key: 'instances', label: 'Servers', value: servers },
              {
                key: 'utilization',
                label: 'Pool capacity',
                value: formatNumber(capacity),
                unit: 'req/s',
                hint: 'Servers x the requests per second each one can serve.',
              },
              {
                key: 'cpu',
                label: 'CPU per server',
                value: formatPercent(perServer.cpu),
                tone: perServer.cpu > 0.9 ? 'danger' : perServer.cpu > 0.7 ? 'warn' : 'ok',
                simulated: true,
              },
              {
                key: 'latency',
                label: 'Latency',
                value: formatLatency(perServer.latencyMs),
                hint: 'Time to serve one request, from a queueing model.',
                simulated: true,
              },
              {
                key: 'errorRate',
                label: 'Errors',
                value: formatPercent(perServer.errorRate, 1),
                tone: perServer.errorRate > 0 ? 'danger' : 'ok',
                simulated: true,
              },
            ]}
          />

          <div className="card p-4">
            <p className="label mb-3">Before / after</p>
            {before ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {[before, after].map((snapshot, index) => (
                  <div key={index} className="rounded-xl border border-line p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-faint">
                      {index === 0 ? 'Before' : 'After'}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-ink">{snapshot.label}</p>
                    <dl className="mt-3 space-y-1.5 font-mono text-xs">
                      <div className="flex justify-between">
                        <dt className="text-faint">CPU</dt>
                        <dd className={snapshot.cpu > 0.85 ? 'text-danger' : 'text-ink'}>
                          {formatPercent(snapshot.cpu)}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-faint">Latency</dt>
                        <dd className={snapshot.latency > 400 ? 'text-danger' : 'text-ink'}>
                          {formatLatency(snapshot.latency)}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-faint">Errors</dt>
                        <dd className={snapshot.errorRate > 0 ? 'text-danger' : 'text-ok'}>
                          {formatPercent(snapshot.errorRate, 1)}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-faint">Traffic</dt>
                        <dd className="text-ink">{formatNumber(snapshot.traffic)} req/s</dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">
                Overload the single server, press <strong className="text-ink">Capture &ldquo;before&rdquo;</strong>,
                then add servers to see the comparison.
              </p>
            )}
          </div>

          <div className="card p-4">
            <p className="label mb-3">Load distribution</p>
            <DistributionBar
              items={Array.from({ length: servers }, (_, index) => ({
                label: `Server ${index + 1}`,
                value: traffic / servers,
                ratio: Math.min(1, traffic / servers / SERVER_CAPACITY),
                hot: traffic / servers > SERVER_CAPACITY,
                suffix: 'req/s',
              }))}
              formatValue={(value) => formatNumber(value)}
            />
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
            step={50}
            onChange={setTraffic}
            format={(value) => `${formatNumber(value)} req/sec`}
            scale={['100', formatNumber(MAX_TRAFFIC)]}
            tone={traffic > capacity ? 'danger' : 'brand'}
          />
          <div className="rounded-xl border border-line bg-elevated p-3">
            <p className="label mb-2">Pool utilization</p>
            <Meter value={traffic / capacity} label={`${formatNumber(traffic)} / ${formatNumber(capacity)} req/sec`} />
            <p className="mt-2 text-[11px] text-faint">
              Each server absorbs {SERVER_CAPACITY} req/sec before it saturates.
            </p>
          </div>
          <div className="rounded-xl border border-line bg-elevated p-3">
            <p className="label mb-2">What this does not fix</p>
            <ul className="space-y-1 text-[11px] text-muted">
              <li>The shared database still sees every query</li>
              <li>Local session state breaks across instances</li>
              <li>Connection counts multiply by instance count</li>
            </ul>
          </div>
        </>
      }
    >
      <DiagramCanvas layout={layout} edges={edges} particles={particleViews} height={490} className="bg-canvas">
        <ArchNode kind="client" title="Users" subtitle={`${formatNumber(traffic)} req/sec`} placed={layout.users} compact />
        <ArchNode kind="load-balancer" title="Load Balancer" subtitle="round robin, 2 nodes" placed={layout.lb}>
          <NodeStatRow label="Backends" value={servers} />
          <NodeStatRow label="Capacity" value={`${formatNumber(capacity)}/s`} />
        </ArchNode>
        {Array.from({ length: servers }, (_, index) => (
          <ArchNode
            key={index}
            kind="server"
            title={`Server ${index + 1}`}
            placed={layout[`s${index}`]}
            compact={width < 130}
            alert={perServer.cpu > 0.9}
            status={perServer.errorRate > 0.2 ? 'degraded' : 'healthy'}
          >
            <Meter label="CPU" value={perServer.cpu} size="xs" />
            <NodeStatRow label="Share" value={`${formatNumber(traffic / servers)}/s`} />
            <NodeStatRow label="p95" value={formatLatency(perServer.latencyMs)} />
          </ArchNode>
        ))}
      </DiagramCanvas>
    </LabShell>
  );
}

export default HorizontalScalingLab;
