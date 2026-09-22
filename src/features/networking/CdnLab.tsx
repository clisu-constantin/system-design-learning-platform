import { useCallback, useRef, useState } from 'react';
import {
  ArchNode,
  DiagramCanvas,
  NodeStatRow,
  ParticleLegend,
  type DiagramEdge,
  type Layout,
  type ParticleView,
} from '@/components/architecture';
import { DistributionBar } from '@/components/charts';
import { Insight, LabShell, MetricsPanel } from '@/components/learning';
import { Meter, Slider, Toggle } from '@/components/ui';
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
import { useRerender } from '@/hooks/useRerender';
import { sampleArrivals } from '@/utils/math';
import { formatLatency, formatNumber, formatPercent } from '@/utils/format';

interface Region {
  id: string;
  name: string;
  edgeId: string;
  /** Distance from users to their nearest edge, and to the origin. */
  edgeKm: number;
  originKm: number;
  shareOfTraffic: number;
}

const REGIONS: Region[] = [
  { id: 'eu-users', name: 'Europe', edgeId: 'eu-edge', edgeKm: 300, originKm: 6200, shareOfTraffic: 0.35 },
  { id: 'us-users', name: 'North America', edgeId: 'us-edge', edgeKm: 250, originKm: 900, shareOfTraffic: 0.4 },
  { id: 'ap-users', name: 'Asia Pacific', edgeId: 'ap-edge', edgeKm: 400, originKm: 11500, shareOfTraffic: 0.25 },
];

/** One-way distance converted into a believable round-trip latency. */
const rtt = (km: number) => 6 + km / 55;

const LAYOUT: Layout = {
  origin: { x: 380, y: 20, w: 200, h: 96 },
  'eu-edge': { x: 60, y: 200, w: 190, h: 104 },
  'us-edge': { x: 385, y: 200, w: 190, h: 104 },
  'ap-edge': { x: 710, y: 200, w: 190, h: 104 },
  'eu-users': { x: 75, y: 390, w: 160, h: 86 },
  'us-users': { x: 400, y: 390, w: 160, h: 86 },
  'ap-users': { x: 725, y: 390, w: 160, h: 86 },
};

/** Requests animated per second, independent of how much traffic is counted. */
const ANIMATED_PER_SECOND = 45;
const PARTICLE_BUDGET = 120;

interface RegionStats {
  latency: MetricWindow;
  /** Rolling, so dragging the edge hit ratio moves the per-region number. */
  requests: RateCounter;
  hits: RateCounter;
}

interface State {
  particles: Particle[];
  stats: Record<string, RegionStats>;
  originRate: RateCounter;
  totalRate: RateCounter;
  latency: MetricWindow;
}

const createState = (): State => ({
  particles: [],
  stats: Object.fromEntries(
    REGIONS.map((region) => [
      region.id,
      { latency: new MetricWindow(200), requests: new RateCounter(3000), hits: new RateCounter(3000) },
    ]),
  ),
  originRate: new RateCounter(2000),
  totalRate: new RateCounter(2000),
  latency: new MetricWindow(500),
});

export function CdnLab() {
  const [running, setRunning] = useState(true);
  const [cdnEnabled, setCdnEnabled] = useState(false);
  const [traffic, setTraffic] = useState(2000);
  const [hitRatio, setHitRatio] = useState(0.9);
  const state = useRef<State>(createState());
  const rerender = useRerender(30);
  const { events, log, clear } = useEventLog();

  const reset = useCallback(() => {
    state.current = createState();
    clear();
  }, [clear]);

  const toggleCdn = useCallback(
    (value: boolean) => {
      setCdnEnabled(value);
      state.current = createState();
      log(
        value
          ? 'CDN enabled - users are routed to the nearest edge'
          : 'CDN disabled - every request travels to the origin',
        value ? 'ok' : 'warn',
      );
    },
    [log],
  );

  useTicker(running, (dt) => {
    const current = state.current;
    const now = performance.now();
    // Every request is counted, so "Total traffic" matches the slider above it.
    const arrivals = sampleArrivals(traffic, dt);
    const share = visualShare(traffic, ANIMATED_PER_SECOND);

    for (let index = 0; index < arrivals; index += 1) {
      const roll = Math.random();
      let cumulative = 0;
      const region = REGIONS.find((item) => {
        cumulative += item.shareOfTraffic;
        return roll <= cumulative;
      }) ?? REGIONS[0];

      const stats = current.stats[region.id];
      stats.requests.add(1, now);
      current.totalRate.add(1, now);

      let latency: number;
      let route: string[];
      let outcome: Particle['outcome'];

      if (!cdnEnabled) {
        latency = rtt(region.originKm) + 25;
        route = [region.id, 'origin'];
        outcome = region.originKm > 5000 ? 'warning' : 'success';
        current.originRate.add(1, now);
      } else if (Math.random() < hitRatio) {
        latency = rtt(region.edgeKm);
        route = [region.id, region.edgeId];
        outcome = 'cache-hit';
        stats.hits.add(1, now);
      } else {
        latency = rtt(region.edgeKm) + rtt(region.originKm) * 0.7 + 25;
        route = [region.id, region.edgeId, 'origin'];
        outcome = 'success';
        current.originRate.add(1, now);
      }

      stats.latency.push(latency);
      current.latency.push(latency);

      if (Math.random() >= share) continue;
      current.particles.push({
        id: nextParticleId(),
        route,
        leg: 0,
        t: 0,
        speed: 0.9 + Math.random() * 0.3,
        outcome,
      });
    }

    const { alive } = advanceParticles(current.particles, dt);
    current.particles = alive.length > PARTICLE_BUDGET ? alive.slice(-PARTICLE_BUDGET) : alive;
    rerender();
  });

  const current = state.current;
  const now = performance.now();
  const snapshot = current.latency.snapshot();
  const originQps = current.originRate.rate(now);
  const totalQps = current.totalRate.rate(now);
  const offload = totalQps > 0 ? 1 - originQps / totalQps : 0;

  const edges: DiagramEdge[] = REGIONS.flatMap<DiagramEdge>((region) =>
    cdnEnabled
      ? [
          { from: region.id, to: region.edgeId, tone: 'ok', width: 2 },
          { from: region.edgeId, to: 'origin', tone: 'muted', dashed: true, label: 'on miss' },
        ]
      : [{ from: region.id, to: 'origin', tone: region.originKm > 5000 ? 'warn' : 'brand', width: 2 }],
  );

  const particleViews: ParticleView[] = current.particles.map((particle) => ({
    id: particle.id,
    from: particle.route[particle.leg],
    to: particle.route[particle.leg + 1],
    t: particle.t,
    outcome: particle.outcome ?? 'success',
  }));

  return (
    <LabShell
      title="CDN Lab"
      description="Three regions, one origin. Turn the CDN on and watch distance stop being the dominant cost for users far from your servers."
      running={running}
      onToggleRun={() => setRunning((value) => !value)}
      onReset={reset}
      legend={<ParticleLegend outcomes={['cache-hit', 'success', 'warning']} />}
      events={events}
      insight={
        <Insight>
          {cdnEnabled ? (
            <>
              At {formatPercent(hitRatio)} edge hit rate, {formatPercent(offload)} of traffic never reaches the origin
              and average latency is {formatLatency(snapshot.avg)}. The Asia Pacific region benefits most - it was
              paying {formatLatency(rtt(11500) + 25)} per request before. Hit rate is decided by your cache keys and
              TTLs, not by the CDN vendor.
            </>
          ) : (
            <>
              Every request travels to the origin. Asia Pacific users pay about {formatLatency(rtt(11500) + 25)} per
              request purely in network distance - no amount of backend optimisation changes that. Turn the CDN on.
            </>
          )}
        </Insight>
      }
      metrics={
        <>
          <MetricsPanel
            items={[
              { key: 'latency', label: 'Avg latency', value: formatLatency(snapshot.avg), tone: snapshot.avg > 120 ? 'danger' : 'ok', hint: 'Round trip from distance to the edge or origin. Computed by a simplified model, not measured.' },
              { key: 'p95', label: 'P95 latency', value: formatLatency(snapshot.p95), hint: '95% of requests finish faster than this. Computed by a simplified model, not measured.' },
              { key: 'hitRate', label: 'Edge hit rate', value: cdnEnabled ? formatPercent(hitRatio) : '0%', tone: cdnEnabled ? 'ok' : 'danger' },
              { key: 'rps', label: 'Total traffic', value: formatNumber(totalQps), unit: 'req/s' },
              {
                key: 'dbQueries',
                label: 'Origin traffic',
                value: formatNumber(originQps),
                unit: 'req/s',
                tone: offload > 0.8 ? 'ok' : 'warn',
                hint: 'Requests that reached your origin servers.',
              },
              {
                key: 'offload',
                label: 'Origin offload',
                value: formatPercent(offload),
                tone: 'brand',
                hint: 'Share of traffic absorbed by edge caches - this is what you stop paying for.',
              },
            ]}
          />
          <div className="card p-4">
            <p className="label mb-3">Latency by region</p>
            <DistributionBar
              items={REGIONS.map((region) => {
                const stats = current.stats[region.id];
                const value = stats.latency.avg;
                return {
                  label: region.name,
                  value,
                  ratio: Math.min(1, value / 250),
                  hot: value > 150,
                  suffix: 'ms',
                };
              })}
              formatValue={(value) => Math.round(value).toString()}
            />
            <p className="mt-3 text-xs text-faint">
              Distance is a hard floor: about {Math.round(rtt(11500))} ms round trip between Asia Pacific and a US
              origin, before your application does any work at all.
            </p>
          </div>
        </>
      }
      controls={
        <>
          <Toggle
            label="CDN enabled"
            checked={cdnEnabled}
            onChange={toggleCdn}
            description="Route users to the nearest edge instead of the origin"
          />
          <Slider
            label="Traffic"
            value={traffic}
            min={200}
            max={20000}
            step={200}
            onChange={setTraffic}
            format={(value) => `${formatNumber(value)} req/sec`}
          />
          <Slider
            label="Edge hit ratio"
            value={hitRatio}
            min={0.3}
            max={0.99}
            step={0.01}
            onChange={setHitRatio}
            disabled={!cdnEnabled}
            format={(value) => formatPercent(value)}
            hint="Driven by Cache-Control TTLs and how many distinct URLs you serve."
            tone={hitRatio > 0.85 ? 'ok' : 'warn'}
          />
          <div className="rounded-xl border border-line bg-elevated p-3">
            <p className="label mb-2">Origin load</p>
            <Meter value={totalQps > 0 ? originQps / Math.max(totalQps, 1) : 0} label="Share reaching origin" tone="violet" />
            <p className="mt-2 text-[11px] text-faint">
              With no CDN this is 100%. Every point of hit rate is origin capacity and bandwidth you do not buy.
            </p>
          </div>
        </>
      }
    >
      <DiagramCanvas layout={LAYOUT} edges={edges} particles={particleViews} height={500} className="bg-canvas">
        <ArchNode kind="server" title="Origin Server" subtitle="us-east" placed={LAYOUT.origin}>
          <NodeStatRow label="Incoming" value={`${formatNumber(originQps)}/s`} />
          <NodeStatRow
            label="Offloaded"
            value={formatPercent(offload)}
            tone={offload > 0.8 ? 'text-ok' : 'text-warn'}
          />
        </ArchNode>

        {REGIONS.map((region) => {
          const stats = current.stats[region.id];
          const regionQps = stats.requests.rate(now);
          // Read both counters on every render so their windows start together;
          // the two rolling windows can still drift by a bucket, so a ratio above
          // 100% is clamped rather than shown as a hit rate no cache can have.
          const regionHits = stats.hits.rate(now);
          const regionHitRate = regionQps ? Math.min(1, regionHits / regionQps) : 0;
          return (
            <ArchNode
              key={region.edgeId}
              kind="cdn"
              title={`${region.name} Edge`}
              subtitle={cdnEnabled ? `${region.edgeKm} km from users` : 'not in use'}
              placed={LAYOUT[region.edgeId]}
              status={cdnEnabled ? 'healthy' : 'down'}
              statusLabel={cdnEnabled ? undefined : 'Off'}
            >
              <NodeStatRow label="Hit rate" value={cdnEnabled ? formatPercent(regionHitRate) : '-'} tone="text-ok" />
              <NodeStatRow label="Edge RTT" value={formatLatency(rtt(region.edgeKm))} />
            </ArchNode>
          );
        })}

        {REGIONS.map((region) => {
          const stats = current.stats[region.id];
          return (
            <ArchNode
              key={region.id}
              kind="client"
              title={region.name}
              subtitle={`${formatPercent(region.shareOfTraffic)} of traffic`}
              placed={LAYOUT[region.id]}
              compact
            >
              <NodeStatRow
                label="Latency"
                value={formatLatency(stats.latency.avg)}
                tone={stats.latency.avg > 150 ? 'text-danger' : 'text-ok'}
              />
            </ArchNode>
          );
        })}
      </DiagramCanvas>
    </LabShell>
  );
}

export default CdnLab;
