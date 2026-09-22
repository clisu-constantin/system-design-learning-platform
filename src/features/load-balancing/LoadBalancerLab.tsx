import { useCallback, useMemo, useRef, useState } from 'react';
import { Power, RotateCw } from 'lucide-react';
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
import { LiveChart } from '@/components/charts';
import { Insight, LabShell, MetricsPanel, RequestInspector } from '@/components/learning';
import { Button, Meter, Select, Slider, Stepper, Toggle } from '@/components/ui';
import {
  advanceParticles,
  MetricWindow,
  nextParticleId,
  RateCounter,
  useEventLog,
  useSeries,
  useTicker,
  visualShare,
  type Particle,
} from '@/simulations/engine';
import { computeLoad } from '@/simulations/models/load';
import { useRerender } from '@/hooks/useRerender';
import { clamp, sampleArrivals } from '@/utils/math';
import { formatLatency, formatNumber, formatPercent } from '@/utils/format';
import type { NodeStatus, SimulatedRequest } from '@/types';

type Algorithm = 'round-robin' | 'weighted' | 'least-connections' | 'random';

const ALGORITHMS: { value: Algorithm; label: string }[] = [
  { value: 'round-robin', label: 'Round Robin' },
  { value: 'weighted', label: 'Weighted Round Robin' },
  { value: 'least-connections', label: 'Least Connections' },
  { value: 'random', label: 'Random' },
];

const ALGORITHM_NOTE: Record<Algorithm, string> = {
  'round-robin': 'Each server takes the next request in turn. Even distribution, but it ignores how busy a server is.',
  weighted: 'Bigger servers receive proportionally more requests. Server 1 has weight 3 (a machine three times the size), the rest weight 1.',
  'least-connections': 'The server with the fewest in-flight requests wins, so slow servers stop receiving new work.',
  random: 'Uniformly random choice. Surprisingly close to round robin at high volume, with no shared counter.',
};

interface ServerModel {
  id: string;
  name: string;
  status: NodeStatus;
  weight: number;
  rate: RateCounter;
  /** Smoothed values used for display. */
  cpu: number;
  latency: number;
  active: number;
  /** 0..1 share of this server's requests currently failing. */
  errorRate: number;
  handled: number;
  failed: number;
  restartAt: number | null;
}

interface SimState {
  servers: ServerModel[];
  particles: Particle[];
  requests: Map<number, SimulatedRequest>;
  handled: number;
  failed: number;
  weightCursor: number;
  cursor: number;
  latency: MetricWindow;
  accepted: RateCounter;
  rejected: RateCounter;
}

const makeServer = (index: number): ServerModel => ({
  id: `s${index}`,
  name: `Server ${index + 1}`,
  status: 'healthy',
  weight: index === 0 ? 3 : 1,
  rate: new RateCounter(2000),
  cpu: 0,
  latency: 0,
  active: 0,
  errorRate: 0,
  handled: 0,
  failed: 0,
  restartAt: null,
});

const createState = (count: number): SimState => ({
  servers: Array.from({ length: count }, (_, index) => makeServer(index)),
  particles: [],
  requests: new Map(),
  handled: 0,
  failed: 0,
  weightCursor: 0,
  cursor: 0,
  latency: new MetricWindow(500),
  accepted: new RateCounter(2000),
  rejected: new RateCounter(2000),
});

const ENDPOINTS = ['/api/products/42', '/api/orders', '/api/users/me', '/api/search?q=shoes', '/api/cart'];

/**
 * Hard ceiling on particles alive at once, so the canvas stays readable. It is
 * a safety net, not the throttle: arrivals are Poisson, so the budget sits
 * above the steady-state population to keep the net from clipping every frame.
 */
const PARTICLE_BUDGET = 110;
/**
 * Requests animated per second. A route here takes about 1.2s to walk, so this
 * settles at roughly 85 particles on screen, peaking near 95.
 */
const ANIMATED_PER_SECOND = 70;
/** Sized above PARTICLE_BUDGET so no visible particle outlives its record. */
const INSPECTABLE_REQUESTS = 140;

export function LoadBalancerLab() {
  const [running, setRunning] = useState(true);
  const [traffic, setTraffic] = useState(500);
  const [serverCount, setServerCount] = useState(3);
  const [algorithm, setAlgorithm] = useState<Algorithm>('round-robin');
  const [capacity, setCapacity] = useState(400);
  const [duration, setDuration] = useState(80);
  const [slowFirst, setSlowFirst] = useState(false);
  const [inspected, setInspected] = useState<SimulatedRequest | null>(null);

  const sim = useRef<SimState>(createState(3));
  const rerender = useRerender(30);
  const { events, log, clear } = useEventLog();
  const { points, push, reset: resetSeries } = useSeries(50, 500);

  /** Adds or removes server models when the stepper changes. */
  const applyServerCount = useCallback(
    (next: number) => {
      const state = sim.current;
      if (next > state.servers.length) {
        for (let index = state.servers.length; index < next; index += 1) {
          state.servers.push(makeServer(index));
          log(`${`Server ${index + 1}`} joined the pool`, 'ok');
        }
      } else {
        const removed = state.servers.splice(next);
        for (const server of removed) log(`${server.name} removed from the pool`, 'warn');
        state.particles = state.particles.filter((particle) =>
          state.servers.some((server) => server.id === particle.route[particle.route.length - 1]),
        );
      }
      setServerCount(next);
    },
    [log],
  );

  const reset = useCallback(() => {
    sim.current = createState(serverCount);
    clear();
    resetSeries();
    setInspected(null);
  }, [serverCount, clear, resetSeries]);

  const killServer = useCallback(
    (id: string) => {
      const server = sim.current.servers.find((item) => item.id === id);
      if (!server || server.status === 'down') return;
      server.status = 'down';
      server.active = 0;
      server.cpu = 0;
      server.errorRate = 0;
      // A server out of the pool receives nothing, so its measured rate must
      // not keep decaying for another window after it is ejected.
      server.rate.clear();
      log(`${server.name}: health check failed (3 consecutive)`, 'danger');
      log(`Removing ${server.name} from the load balancer pool`, 'warn');
      rerender();
    },
    [log, rerender],
  );

  const restartServer = useCallback(
    (id: string) => {
      const server = sim.current.servers.find((item) => item.id === id);
      if (!server || server.status !== 'down') return;
      server.status = 'starting';
      server.restartAt = performance.now() + 3000;
      log(`${server.name}: starting, waiting for health check`, 'info');
      rerender();
    },
    [log, rerender],
  );

  /**
   * A weighted pool sends more traffic to bigger servers, so under that
   * algorithm a server with weight N is modelled as N times the machine -
   * "proportionally more requests" only holds if the weight matches the size.
   * The tick, the node cards and the pool-capacity meter all read this one
   * function so they cannot disagree about whether a server is coping.
   */
  const isSlow = (server: ServerModel) => slowFirst && server.id === 's0';
  /**
   * A slow server (bad disk, noisy neighbour) takes twice as long per request,
   * so each worker is busy twice as long and it absorbs half the traffic.
   */
  const durationOf = (server: ServerModel) => (isSlow(server) ? duration * 2 : duration);
  const capacityOf = (server: ServerModel) =>
    (algorithm === 'weighted' ? capacity * server.weight : capacity) / (isSlow(server) ? 2 : 1);

  /** Picks a backend according to the selected algorithm. */
  const pickServer = (state: SimState, healthy: ServerModel[]): ServerModel => {
    switch (algorithm) {
      case 'random':
        return healthy[Math.floor(Math.random() * healthy.length)];
      case 'least-connections':
        return healthy.reduce((best, server) => (server.active < best.active ? server : best), healthy[0]);
      case 'weighted': {
        const total = healthy.reduce((sum, server) => sum + server.weight, 0);
        state.weightCursor = (state.weightCursor + 1) % total;
        let cursor = state.weightCursor;
        for (const server of healthy) {
          if (cursor < server.weight) return server;
          cursor -= server.weight;
        }
        return healthy[0];
      }
      default: {
        state.cursor = (state.cursor + 1) % healthy.length;
        return healthy[state.cursor];
      }
    }
  };

  useTicker(running, (dt) => {
    const state = sim.current;
    const now = performance.now();

    for (const server of state.servers) {
      if (server.status === 'starting' && server.restartAt && now >= server.restartAt) {
        server.status = 'healthy';
        server.restartAt = null;
        log(`${server.name}: health check passed`, 'ok');
        log(`${server.name} added back to the pool`, 'ok');
      }
    }

    const healthy = state.servers.filter((server) => server.status === 'healthy');

    // Per-server load model, from the rate measured over the last window. It
    // runs before the arrivals so each request can be settled against the load
    // it actually meets on the way in.
    for (const server of state.servers) {
      if (server.status !== 'healthy') {
        server.cpu = 0;
        server.active = 0;
        server.latency = 0;
        server.errorRate = 0;
        continue;
      }
      const incoming = server.rate.rate(now);
      const load = computeLoad(incoming, capacityOf(server), { baseLatencyMs: durationOf(server), kneeAt: 0.65 });
      server.cpu = load.cpu;
      server.latency = load.latencyMs;
      server.errorRate = load.errorRate;
      // Little's law: in-flight requests = arrival rate x time in system. Only
      // the requests the server accepts stay in flight; rejected ones fail fast.
      server.active = Math.round(incoming * (1 - load.errorRate) * (load.latencyMs / 1000));
    }

    // Arrivals. Every request is counted here; only a sample of them is
    // animated, so the particle budget can never throttle the metrics.
    const arrivals = sampleArrivals(traffic, dt);
    const share = visualShare(traffic, ANIMATED_PER_SECOND);

    for (let index = 0; index < arrivals; index += 1) {
      const id = nextParticleId();
      const animate = Math.random() < share;

      if (healthy.length === 0) {
        state.failed += 1;
        state.rejected.add(1, now);
        if (animate) {
          state.particles.push({ id, route: ['users', 'lb'], leg: 0, t: 0, speed: 1.6, outcome: 'failure' });
        }
        continue;
      }

      const server = pickServer(state, healthy);
      server.rate.add(1, now);

      const failedRequest = Math.random() < server.errorRate;
      const latency = server.latency * (0.75 + Math.random() * 0.7);

      if (failedRequest) {
        server.failed += 1;
        state.failed += 1;
        state.rejected.add(1, now);
      } else {
        server.handled += 1;
        state.handled += 1;
        state.accepted.add(1, now);
        state.latency.push(latency, now);
      }

      if (!animate) continue;

      state.particles.push({
        id,
        route: ['users', 'lb', server.id],
        leg: 0,
        t: 0,
        speed: 1.5 + Math.random() * 0.4,
        outcome: failedRequest ? 'failure' : server.cpu > 0.85 ? 'warning' : 'success',
        meta: { serverId: server.id },
      });

      // Keep a rolling set of inspectable requests - one per animated particle,
      // and deeper than the particle budget so every dot on the canvas still
      // has its record when it is clicked near the end of its route.
      if (state.requests.size > INSPECTABLE_REQUESTS) {
        const oldest = state.requests.keys().next().value;
        if (oldest !== undefined) state.requests.delete(oldest);
      }
      state.requests.set(id, {
        id,
        createdAt: now,
        currentNode: server.id,
        status: failedRequest ? 'failed' : 'completed',
        outcome: failedRequest ? 'failure' : server.cpu > 0.85 ? 'warning' : 'success',
        latency,
        path: ['Client', 'Load Balancer', server.name],
        method: 'GET',
        endpoint: ENDPOINTS[id % ENDPOINTS.length],
        notes: [
          `Algorithm: ${ALGORITHMS.find((item) => item.value === algorithm)?.label}`,
          `Server CPU at arrival: ${Math.round(server.cpu * 100)}%`,
          failedRequest ? 'Rejected: server over capacity' : 'Completed successfully',
        ],
      });
    }

    // Particles are decoration from here on: they carry no accounting, so
    // dropping one at the end of its route costs nothing.
    const { alive } = advanceParticles(state.particles, dt);
    state.particles = alive.length > PARTICLE_BUDGET ? alive.slice(-PARTICLE_BUDGET) : alive;

    const snapshot = state.latency.snapshot(now);
    push(
      {
        rps: state.accepted.rate(now),
        // No request served in the MetricWindow horizon (every server down): NaN breaks the
        // line instead of drawing a stale or zero latency.
        p95: snapshot.p95 ?? NaN,
        avg: snapshot.avg ?? NaN,
        errors: state.rejected.rate(now),
      },
      now,
    );

    rerender();
  });

  const state = sim.current;
  const servers = state.servers;
  // `servers` is mutated in place (stepper, kill, restart), so its reference
  // never changes. Memoize on what the diagram actually depends on instead,
  // or added servers get no layout and an ejected server keeps a live edge.
  const poolKey = servers.map((server) => `${server.id}:${server.status}`).join(',');

  const layout = useMemo<Layout>(() => {
    const count = servers.length;
    const width = clamp((940 - (count - 1) * 12) / count, 106, 168);
    const xs = spread(count, 480, width, 12);
    const result: Layout = {
      users: { x: 390, y: 16, w: 180, h: 62 },
      lb: { x: 370, y: 160, w: 220, h: 96 },
    };
    servers.forEach((server, index) => {
      result[server.id] = { x: xs[index], y: 352, w: width, h: 132 };
    });
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- poolKey tracks the in-place mutations of servers
  }, [servers, poolKey]);

  const edges = useMemo<DiagramEdge[]>(
    () => [
      { from: 'users', to: 'lb', tone: 'brand', width: 2 },
      ...servers.map<DiagramEdge>((server) => ({
        from: 'lb',
        to: server.id,
        tone: server.status === 'healthy' ? 'ok' : 'muted',
        dashed: server.status !== 'healthy',
      })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- poolKey tracks the in-place mutations of servers
    [servers, poolKey],
  );

  const particleViews = useMemo<ParticleView[]>(
    () =>
      state.particles.map((particle) => ({
        id: particle.id,
        from: particle.route[particle.leg],
        to: particle.route[particle.leg + 1],
        t: particle.t,
        outcome: particle.outcome ?? 'success',
        onClick: () => {
          const request = state.requests.get(particle.id);
          if (request) setInspected(request);
        },
      })),
    [state.particles, state.requests],
  );

  const now = performance.now();
  const snapshot = state.latency.snapshot(now);
  const acceptedRate = state.accepted.rate(now);
  const rejectedRate = state.rejected.rate(now);
  const totalRate = acceptedRate + rejectedRate;
  const errorRatio = totalRate > 0 ? rejectedRate / totalRate : 0;
  const healthyCount = servers.filter((server) => server.status === 'healthy').length;
  const avgCpu = healthyCount ? servers.reduce((sum, server) => sum + server.cpu, 0) / healthyCount : 0;
  const totalActive = servers.reduce((sum, server) => sum + server.active, 0);
  const poolCapacity = servers
    .filter((server) => server.status === 'healthy')
    .reduce((sum, server) => sum + capacityOf(server), 0);

  return (
    <LabShell
      title="Load Balancer Lab"
      description="Change traffic, pool size and algorithm - then kill a server and watch health checks take it out of rotation."
      running={running}
      onToggleRun={() => setRunning((value) => !value)}
      onReset={reset}
      legend={<ParticleLegend />}
      events={events}
      insight={
        <Insight>
          {traffic > poolCapacity && healthyCount > 0 ? (
            <>
              Incoming traffic ({formatNumber(traffic)} req/sec) exceeds pool capacity (
              {formatNumber(poolCapacity)} req/sec). Latency climbs first, then requests start failing. Add a server
              or raise per-server capacity and watch both recover.
            </>
          ) : healthyCount === 0 ? (
            <>Every server is down, so the load balancer has nowhere to send traffic. Restart one to recover.</>
          ) : (
            <>{ALGORITHM_NOTE[algorithm]}</>
          )}
        </Insight>
      }
      metrics={
        <>
          <MetricsPanel
            items={[
              { key: 'rps', label: 'Requests/sec', value: formatNumber(acceptedRate), tone: 'brand' },
              { key: 'latency', label: 'Avg latency', value: formatLatency(snapshot.avg), hint: 'Time to serve one request. Computed by a simplified model, not measured.' },
              { key: 'p95', label: 'P95 latency', value: formatLatency(snapshot.p95), tone: snapshot.p95 !== null && snapshot.p95 > 500 ? 'warn' : 'neutral', hint: '95% of requests finish faster than this. Computed by a simplified model, not measured.' },
              { key: 'p99', label: 'P99 latency', value: formatLatency(snapshot.p99), tone: snapshot.p99 !== null && snapshot.p99 > 1000 ? 'danger' : 'neutral' },
              {
                key: 'cpu',
                label: 'Avg utilization',
                value: formatPercent(avgCpu),
                tone: avgCpu > 0.85 ? 'danger' : avgCpu > 0.7 ? 'warn' : 'ok',
              },
              {
                key: 'errorRate',
                label: 'Failed requests',
                value: formatPercent(errorRatio, 1),
                tone: errorRatio > 0.01 ? 'danger' : 'ok',
                sub: `${formatNumber(state.failed)} total`,
              },
              { key: 'activeConnections', label: 'Active conns', value: formatNumber(totalActive) },
              {
                key: 'instances',
                label: 'Healthy servers',
                value: `${healthyCount}/${servers.length}`,
                tone: healthyCount < servers.length ? 'warn' : 'ok',
              },
            ]}
          />
          <div className="card p-4">
            <p className="label mb-3">Throughput and latency over time</p>
            <LiveChart
              data={points}
              series={[
                { key: 'rps', label: 'Requests/sec', color: 'brand' },
                { key: 'errors', label: 'Failed/sec', color: 'danger' },
              ]}
              height={150}
            />
            <LiveChart
              data={points}
              series={[
                { key: 'avg', label: 'Avg latency (ms)', color: 'ok' },
                { key: 'p95', label: 'P95 latency (ms)', color: 'warn' },
              ]}
              variant="line"
              height={150}
            />
          </div>
        </>
      }
      footer={<RequestInspector request={inspected} onClose={() => setInspected(null)} />}
      controls={
        <>
          <Slider
            label="Traffic"
            value={traffic}
            min={50}
            max={5000}
            step={50}
            onChange={setTraffic}
            format={(value) => `${formatNumber(value)} req/sec`}
            scale={['50', '5000']}
            hint="Requests per second arriving at the load balancer."
            tone={traffic > poolCapacity ? 'danger' : 'brand'}
          />
          <Stepper
            label="Servers"
            value={serverCount}
            min={1}
            max={8}
            onChange={applyServerCount}
            hint="Instances registered in the load balancer pool."
          />
          <Select
            label="Algorithm"
            value={algorithm}
            options={ALGORITHMS}
            onChange={setAlgorithm}
            hint="How the load balancer chooses which server receives the next request."
          />
          <Slider
            label="Server capacity"
            value={capacity}
            min={100}
            max={1500}
            step={50}
            onChange={setCapacity}
            format={(value) => `${formatNumber(value)} req/sec`}
            hint="How much traffic one server absorbs before it saturates."
          />
          <Slider
            label="Request duration"
            value={duration}
            min={10}
            max={400}
            step={10}
            onChange={setDuration}
            format={(value) => `${value} ms`}
            hint="Base processing time per request with no queueing."
          />
          <Toggle
            label="Server 1 is slow"
            checked={slowFirst}
            onChange={(next) => {
              setSlowFirst(next);
              log(next ? 'Server 1 now takes 2x as long per request' : 'Server 1 back to normal speed', next ? 'warn' : 'ok');
            }}
            description="Each request takes 2x as long there. Compare Round Robin and Least Connections."
          />
          <div className="rounded-xl border border-line bg-elevated p-3">
            <p className="label mb-2">Pool capacity</p>
            <Meter
              value={poolCapacity ? traffic / poolCapacity : 1}
              label={`${formatNumber(traffic)} / ${formatNumber(poolCapacity)} req/sec`}
            />
          </div>
        </>
      }
    >
      <DiagramCanvas
        layout={layout}
        edges={edges}
        particles={particleViews}
        height={505}
        className="bg-canvas"
      >
        <ArchNode
          kind="client"
          title="Users"
          subtitle={`${formatNumber(traffic)} req/sec generated`}
          placed={layout.users}
          compact
        />
        <ArchNode
          kind="load-balancer"
          title="Load Balancer"
          subtitle={ALGORITHMS.find((item) => item.value === algorithm)?.label}
          placed={layout.lb}
          status={healthyCount === 0 ? 'down' : 'healthy'}
        >
          <NodeStatRow label="Incoming" value={`${formatNumber(traffic)}/s`} />
          <NodeStatRow
            label="Healthy pool"
            value={`${healthyCount}/${servers.length}`}
            tone={healthyCount < servers.length ? 'text-warn' : 'text-ok'}
          />
        </ArchNode>

        {servers.map((server) => (
          <ArchNode
            key={server.id}
            kind="server"
            title={server.name}
            subtitle={
              [algorithm === 'weighted' ? `weight ${server.weight}` : '', isSlow(server) ? '2x slower' : '']
                .filter(Boolean)
                .join(', ') || undefined
            }
            placed={layout[server.id]}
            status={server.status}
            alert={server.status === 'healthy' && server.cpu > 0.9}
            // At 8 servers a box is ~107px wide; the regular padding would
            // truncate "Server 8" to "Serve...".
            compact={servers.length > 6}
          >
            <Meter label="CPU" value={server.cpu} size="xs" />
            <NodeStatRow label="Conns" value={server.active} />
            <NodeStatRow
              label="Latency"
              value={server.status === 'healthy' ? formatLatency(server.latency) : '-'}
            />
            <Button
              size="sm"
              variant={server.status === 'down' ? 'success' : 'danger'}
              className="mt-1 w-full justify-center"
              onClick={() => (server.status === 'down' ? restartServer(server.id) : killServer(server.id))}
              disabled={server.status === 'starting'}
            >
              {server.status === 'down' ? (
                <>
                  <RotateCw className="h-3 w-3" /> Restart
                </>
              ) : (
                <>
                  <Power className="h-3 w-3" /> Kill
                </>
              )}
            </Button>
          </ArchNode>
        ))}
      </DiagramCanvas>
    </LabShell>
  );
}

export default LoadBalancerLab;
