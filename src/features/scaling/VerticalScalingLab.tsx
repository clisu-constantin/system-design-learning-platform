import { useCallback, useRef, useState } from 'react';
import { ArrowBigUpDash, ArrowDownToLine, Cpu, MemoryStick } from 'lucide-react';
import { ArchNode, DiagramCanvas, NodeStatRow, ParticleLegend, type DiagramEdge, type Layout, type ParticleView } from '@/components/architecture';
import { LiveChart } from '@/components/charts';
import { Insight, LabShell, MetricsPanel } from '@/components/learning';
import { Button, Meter, Slider } from '@/components/ui';
import { advanceParticles, nextParticleId, useEventLog, useSeries, useTicker, type Particle } from '@/simulations/engine';
import { computeLoad } from '@/simulations/models/load';
import { MACHINE_TIERS } from '@/simulations/models/machine';
import { useRerender } from '@/hooks/useRerender';
import { sampleArrivals } from '@/utils/math';
import { formatLatency, formatNumber, formatPercent } from '@/utils/format';

const LAYOUT: Layout = {
  users: { x: 380, y: 20, w: 200, h: 62 },
  server: { x: 340, y: 170, w: 280, h: 180 },
  db: { x: 390, y: 410, w: 180, h: 78 },
};

const EDGES: DiagramEdge[] = [
  { from: 'users', to: 'server', tone: 'brand', width: 2 },
  { from: 'server', to: 'db', tone: 'default' },
];

/**
 * Vertical scaling: one machine, a traffic slider, and an upgrade button.
 * The teaching moment is that upgrading fixes capacity but never redundancy.
 */
export function VerticalScalingLab() {
  const [running, setRunning] = useState(true);
  const [traffic, setTraffic] = useState(450);
  const [tierIndex, setTierIndex] = useState(0);
  const particles = useRef<Particle[]>([]);
  const rerender = useRerender(30);
  const { events, log, clear } = useEventLog();
  const { points, push, reset: resetSeries } = useSeries(50, 500);
  const saturatedSince = useRef<number | null>(null);

  const tier = MACHINE_TIERS[tierIndex];
  const load = computeLoad(traffic, tier.capacity, { baseLatencyMs: 30, kneeAt: 0.6 });

  const upgrade = useCallback(() => {
    if (tierIndex >= MACHINE_TIERS.length - 1) return;
    const next = MACHINE_TIERS[tierIndex + 1];
    setTierIndex(tierIndex + 1);
    log(`Upgraded to ${next.name}: ${next.cpu} vCPU, ${next.ramGb} GB, ~${next.capacity} req/sec`, 'ok');
    log('Restart required - this is downtime unless you have a standby', 'warn');
  }, [tierIndex, log]);

  const downgrade = useCallback(() => {
    if (tierIndex === 0) return;
    const next = MACHINE_TIERS[tierIndex - 1];
    setTierIndex(tierIndex - 1);
    log(`Downgraded to ${next.name} (~${next.capacity} req/sec)`, 'info');
  }, [tierIndex, log]);

  /** Jumping straight to a tier on the ladder is still a resize, so it logs like one. */
  const selectTier = useCallback(
    (index: number) => {
      if (index === tierIndex) return;
      const next = MACHINE_TIERS[index];
      setTierIndex(index);
      if (index > tierIndex) {
        log(`Upgraded to ${next.name}: ${next.cpu} vCPU, ${next.ramGb} GB, ~${next.capacity} req/sec`, 'ok');
        log('Restart required - this is downtime unless you have a standby', 'warn');
      } else {
        log(`Downgraded to ${next.name} (~${next.capacity} req/sec)`, 'info');
      }
    },
    [tierIndex, log],
  );

  const reset = useCallback(() => {
    particles.current = [];
    setTierIndex(0);
    setTraffic(450);
    clear();
    resetSeries();
  }, [clear, resetSeries]);

  useTicker(running, (dt) => {
    const now = performance.now();
    const arrivals = sampleArrivals(Math.min(traffic, 900), dt * 0.35);
    for (let index = 0; index < arrivals; index += 1) {
      const failed = Math.random() < load.errorRate;
      particles.current.push({
        id: nextParticleId(),
        route: failed ? ['users', 'server'] : ['users', 'server', 'db'],
        leg: 0,
        t: 0,
        speed: 1.1 + Math.random() * 0.5,
        outcome: failed ? 'failure' : load.cpu > 0.85 ? 'warning' : 'success',
      });
    }

    const { alive } = advanceParticles(particles.current, dt);
    particles.current = alive.slice(-70);

    if (load.saturated && saturatedSince.current === null) {
      saturatedSince.current = now;
      log(`Traffic ${formatNumber(traffic)} req/sec exceeds capacity ${formatNumber(tier.capacity)} - requests failing`, 'danger');
    } else if (!load.saturated && saturatedSince.current !== null) {
      saturatedSince.current = null;
      log('Back under capacity - latency and errors recovering', 'ok');
    }

    push({ cpu: load.cpu * 100, latency: load.latencyMs, errors: load.errorRate * 100 }, now);
    rerender();
  });

  // Recomputed on every render: the ticker re-renders at a capped frame rate.
  const particleViews: ParticleView[] = particles.current.map((particle) => ({
    id: particle.id,
    from: particle.route[particle.leg],
    to: particle.route[particle.leg + 1],
    t: particle.t,
    outcome: particle.outcome ?? 'success',
  }));

  const comparison = MACHINE_TIERS[Math.min(tierIndex + 1, MACHINE_TIERS.length - 1)];
  const nextLoad = computeLoad(traffic, comparison.capacity, { baseLatencyMs: 30, kneeAt: 0.6 });

  return (
    <LabShell
      title="Vertical Scaling Lab"
      description="Push traffic past what one machine can serve, then buy a bigger machine and watch what improves - and what does not."
      running={running}
      onToggleRun={() => setRunning((value) => !value)}
      onReset={reset}
      legend={<ParticleLegend outcomes={['success', 'warning', 'failure']} />}
      events={events}
      actions={
        <>
          <Button variant="secondary" onClick={downgrade} disabled={tierIndex === 0}>
            <ArrowDownToLine className="h-4 w-4" />
            Downgrade
          </Button>
          <Button variant="primary" onClick={upgrade} disabled={tierIndex >= MACHINE_TIERS.length - 1}>
            <ArrowBigUpDash className="h-4 w-4" />
            Upgrade server
          </Button>
        </>
      }
      insight={
        <Insight>
          {load.saturated ? (
            <>
              The machine is over capacity: CPU is pinned, latency is climbing through queueing, and{' '}
              {formatPercent(load.errorRate, 1)} of requests are being rejected. Upgrading to {comparison.name} would
              bring p95 to roughly {formatLatency(nextLoad.latencyMs)} - but the server is still a single point of
              failure, and the cost goes from ${tier.costPerMonth} to ${comparison.costPerMonth} per month.
            </>
          ) : (
            <>
              At {formatPercent(load.cpu)} CPU{' '}
              {load.cpu > 0.6
                ? 'the machine is past the knee - requests have started to queue and latency is climbing.'
                : 'there is headroom.'}{' '}
              Latency barely moves until utilization passes about 60% - then queueing takes over and it rises
              sharply. That knee is why capacity planning targets 60-70%, not 95%.
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
                key: 'utilization',
                label: 'Capacity',
                value: formatNumber(tier.capacity),
                unit: 'req/s',
                hint: 'Requests per second this machine tier can serve before it saturates.',
              },
              {
                key: 'cpu',
                label: 'CPU',
                value: formatPercent(load.cpu),
                tone: load.cpu > 0.9 ? 'danger' : load.cpu > 0.7 ? 'warn' : 'ok',
              },
              {
                key: 'latency',
                label: 'Latency',
                value: formatLatency(load.latencyMs),
                tone: load.latencyMs > 500 ? 'danger' : 'neutral',
                hint: 'Time to serve one request. Computed by a simplified queueing model, not measured.',
              },
              {
                key: 'errorRate',
                label: 'Error rate',
                value: formatPercent(load.errorRate, 1),
                tone: load.errorRate > 0 ? 'danger' : 'ok',
              },
              { key: 'cost', label: 'Relative cost', value: `$${formatNumber(tier.costPerMonth)}`, unit: '/mo' },
            ]}
          />
          <div className="card p-4">
            <p className="label mb-3">Utilization, latency and errors</p>
            <LiveChart
              data={points}
              series={[
                { key: 'cpu', label: 'CPU %', color: 'brand' },
                { key: 'errors', label: 'Errors %', color: 'danger' },
              ]}
              height={140}
              yDomain={[0, 100]}
            />
            <LiveChart
              data={points}
              series={[{ key: 'latency', label: 'Latency (ms)', color: 'warn' }]}
              variant="line"
              height={140}
            />
          </div>
          <div className="card p-4">
            <p className="label mb-3">Tier ladder</p>
            <div className="grid gap-2 sm:grid-cols-5">
              {MACHINE_TIERS.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectTier(index)}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    index === tierIndex ? 'border-brand bg-brand/5' : 'border-line hover:border-brand/50'
                  }`}
                >
                  <p className="text-xs font-semibold text-ink">{item.name}</p>
                  <p className="mt-1 font-mono text-[11px] text-muted">{item.cpu} vCPU</p>
                  <p className="font-mono text-[11px] text-muted">{item.ramGb} GB</p>
                  <p className="mt-1 font-mono text-[11px] text-brand">{formatNumber(item.capacity)} req/s</p>
                  <p className="font-mono text-[11px] text-faint">${formatNumber(item.costPerMonth)}/mo</p>
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-faint">
              Capacity grows about 16x from Small to Bare metal, while cost grows about 65x. That gap is the economic
              argument for scaling out instead of up.
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
            max={3000}
            step={50}
            onChange={setTraffic}
            format={(value) => `${formatNumber(value)} req/sec`}
            scale={['100', '3000']}
            tone={load.saturated ? 'danger' : 'brand'}
            hint="Requests per second arriving at the single server."
          />
          <div className="rounded-xl border border-line bg-elevated p-3 space-y-2">
            <p className="label">Current machine</p>
            <div className="flex items-center gap-2 text-xs text-muted">
              <Cpu className="h-3.5 w-3.5" /> {tier.cpu} vCPU
            </div>
            <div className="flex items-center gap-2 text-xs text-muted">
              <MemoryStick className="h-3.5 w-3.5" /> {tier.ramGb} GB RAM
            </div>
            <Meter label="Utilization" value={load.cpu} />
          </div>
          <div className="rounded-xl border border-line bg-elevated p-3">
            <p className="label mb-2">Still true after upgrading</p>
            <ul className="space-y-1 text-[11px] text-muted">
              <li>One machine - a single point of failure</li>
              <li>Resizing needs a restart</li>
              <li>There is a largest machine you can buy</li>
            </ul>
          </div>
        </>
      }
    >
      <DiagramCanvas layout={LAYOUT} edges={EDGES} particles={particleViews} height={505} className="bg-canvas">
        <ArchNode kind="client" title="Users" subtitle={`${formatNumber(traffic)} req/sec`} placed={LAYOUT.users} compact />
        <ArchNode
          kind="server"
          title={`Application Server (${tier.name})`}
          subtitle={`${tier.cpu} vCPU / ${tier.ramGb} GB`}
          placed={LAYOUT.server}
          status={load.errorRate > 0.2 ? 'degraded' : 'healthy'}
          alert={load.saturated}
        >
          <Meter label="CPU" value={load.cpu} />
          <Meter label="Memory" value={Math.min(0.95, load.cpu * 0.8 + 0.1)} tone="violet" />
          <NodeStatRow label="Capacity" value={`${formatNumber(tier.capacity)}/s`} />
          <NodeStatRow
            label="Latency"
            value={formatLatency(load.latencyMs)}
            tone={load.latencyMs > 400 ? 'text-danger' : 'text-ink'}
          />
          <NodeStatRow
            label="Errors"
            value={formatPercent(load.errorRate, 1)}
            tone={load.errorRate > 0 ? 'text-danger' : 'text-ok'}
          />
        </ArchNode>
        <ArchNode kind="sql" title="PostgreSQL" subtitle="single instance" placed={LAYOUT.db} compact />
      </DiagramCanvas>
    </LabShell>
  );
}

export default VerticalScalingLab;
