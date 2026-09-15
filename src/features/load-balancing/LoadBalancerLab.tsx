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
import { Button, Meter, Select, Slider, Stepper } from '@/components/ui';
import {
  advanceParticles,
  MetricWindow,
  nextParticleId,
  RateCounter,
  useEventLog,
  useSeries,
  useTicker,
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
  weighted: 'Bigger servers receive proportionally more requests. Server 1 has weight 3, the rest weight 1.',
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

export function LoadBalancerLab() {
  const [running, setRunning] = useState(true);
  const [traffic, setTraffic] = useState(500);
  const [serverCount, setServerCount] = useState(3);
  const [algorithm, setAlgorithm] = useState<Algorithm>('round-robin');
  const [capacity, setCapacity] = useState(400);
  const [duration, setDuration] = useState(80);
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

    // Arrivals
    const arrivals = sampleArrivals(traffic, dt);
    for (let index = 0; index < arrivals; index += 1) {
      const id = nextParticleId();
      if (healthy.length === 0) {
        state.failed += 1;
        state.rejected.add(1, now);
        state.particles.push({
          id,
          route: ['users', 'lb'],
          leg: 0,
          t: 0,
          speed: 1.6,
          outcome: 'failure',
        });
        continue;
      }
      const server = pickServer(state, healthy);
      server.rate.add(1, now);
      state.particles.push({
        id,
        route: ['users', 'lb', server.id],
        leg: 0,
        t: 0,
        speed: 1.5 + Math.random() * 0.4,
        meta: { serverId: server.id },
      });
    }

    // Per-server load model
    for (const server of state.servers) {
      if (server.status !== 'healthy') {
        server.cpu = 0;
        server.active = 0;
        server.latency = 0;
        continue;
      }
      const incoming = server.rate.rate(now);
      const effectiveCapacity =
        algorithm === 'weighted' && server.weight > 1 ? capacity * 1.6 : capacity;
      const load = computeLoad(incoming, effectiveCapacity, { baseLatencyMs: duration, kneeAt: 0.65 });
      server.cpu = load.cpu;
      server.latency = load.latencyMs;
      // Little's law: in-flight requests = arrival rate x time in system.
      server.active = Math.round(incoming * (load.latencyMs / 1000));
    }

    // Move particles and settle completed ones
    const { alive, finished } = advanceParticles(state.particles, dt);
    state.particles = alive;

    for (const particle of finished) {
      const serverId = particle.meta?.serverId as string | undefined;
      const server = state.servers.find((item) => item.id === serverId);
      if (!server) {
        continue;
      }
      const load = computeLoad(server.rate.rate(now), capacity, { baseLatencyMs: duration, kneeAt: 0.65 });
      const failedRequest = Math.random() < load.errorRate;
      const latency = load.latencyMs * (0.75 + Math.random() * 0.7);

      if (failedRequest) {
        server.failed += 1;
        state.failed += 1;
        state.rejected.add(1, now);
      } else {
        server.handled += 1;
        state.handled += 1;
        state.accepted.add(1, now);
        state.latency.push(latency);
      }

      // Keep a small rolling set of inspectable requests.
      if (state.requests.size > 40) {
        const oldest = state.requests.keys().next().value;
        if (oldest !== undefined) state.requests.delete(oldest);
      }
      state.requests.set(particle.id, {
        id: particle.id,
        createdAt: now,
        currentNode: server.id,
        status: failedRequest ? 'failed' : 'completed',
        outcome: failedRequest ? 'failure' : load.cpu > 0.85 ? 'warning' : 'success',
        latency,
        path: ['Client', 'Load Balancer', server.name],
        method: 'GET',
        endpoint: ENDPOINTS[particle.id % ENDPOINTS.length],
        notes: [
          `Algorithm: ${ALGORITHMS.find((item) => item.value === algorithm)?.label}`,
          `Server CPU at arrival: ${Math.round(load.cpu * 100)}%`,
          failedRequest ? 'Rejected: server over capacity' : 'Completed successfully',
        ],
      });
    }

    // Cap particle count so the canvas stays readable at high traffic.
    if (state.particles.length > 90) state.particles = state.particles.slice(-90);

    const snapshot = state.latency.snapshot();
    push(
      {
        rps: state.accepted.rate(now),
        p95: snapshot.p95,
        avg: snapshot.avg,
        errors: state.rejected.rate(now),
      },
      now,
    );

    rerender();
  });

  const state = sim.current;
  const servers = state.servers;

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
  }, [servers]);

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
    [servers],
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
  const snapshot = state.latency.snapshot();
  const acceptedRate = state.accepted.rate(now);
  const rejectedRate = state.rejected.rate(now);
  const totalRate = acceptedRate + rejectedRate;
  const errorRatio = totalRate > 0 ? rejectedRate / totalRate : 0;
  const healthyCount = servers.filter((server) => server.status === 'healthy').length;
  const avgCpu = healthyCount ? servers.reduce((sum, server) => sum + server.cpu, 0) / healthyCount : 0;
  const totalActive = servers.reduce((sum, server) => sum + server.active, 0);
  const poolCapacity = healthyCount * capacity;

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
              { key: 'latency', label: 'Avg latency', value: formatLatency(snapshot.avg) },
              { key: 'p95', label: 'P95 latency', value: formatLatency(snapshot.p95), tone: snapshot.p95 > 500 ? 'warn' : 'neutral' },
              { key: 'p99', label: 'P99 latency', value: formatLatency(snapshot.p99), tone: snapshot.p99 > 1000 ? 'danger' : 'neutral' },
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
            subtitle={algorithm === 'weighted' ? `weight ${server.weight}` : undefined}
            placed={layout[server.id]}
            status={server.status}
            alert={server.status === 'healthy' && server.cpu > 0.9}
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
