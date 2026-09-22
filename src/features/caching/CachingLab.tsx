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
import { LiveChart } from '@/components/charts';
import { Insight, LabShell, MetricsPanel, RequestInspector } from '@/components/learning';
import { Meter, Slider, Toggle } from '@/components/ui';
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
import type { SimulatedRequest } from '@/types';

const CACHE_LATENCY = 4;
const DB_CAPACITY = 900;

/** Requests animated per second, independent of how much traffic is counted. */
const ANIMATED_PER_SECOND = 45;
const PARTICLE_BUDGET = 110;
/** Sized above PARTICLE_BUDGET so no visible particle outlives its record. */
const INSPECTABLE_REQUESTS = 140;

const LAYOUT: Layout = {
  users: { x: 60, y: 210, w: 150, h: 70 },
  api: { x: 280, y: 200, w: 170, h: 92 },
  cache: { x: 520, y: 90, w: 190, h: 128 },
  db: { x: 520, y: 320, w: 190, h: 128 },
};

const EDGES: DiagramEdge[] = [
  { from: 'users', to: 'api', tone: 'brand', width: 2 },
  { from: 'api', to: 'cache', tone: 'ok' },
  // Cache-aside: on a miss the API itself queries the database and then stores
  // the row. A cache -> db edge would describe read-through instead, which the
  // Cache Strategies lab teaches as a different pattern.
  { from: 'api', to: 'db', tone: 'violet', label: 'on miss' },
];

interface CacheEntry {
  key: string;
  expiresAt: number;
  lastUsed: number;
}

interface State {
  entries: Map<string, CacheEntry>;
  particles: Particle[];
  requests: Map<number, SimulatedRequest>;
  /**
   * Rolling rather than cumulative. A lifetime hit rate barely moves once the
   * simulation has been running for a minute, so raising the TTL or the cache
   * size appeared to do nothing - which is the opposite of the lesson.
   */
  hits: RateCounter;
  misses: RateCounter;
  evictions: number;
  dbQueries: RateCounter;
  latency: MetricWindow;
}

const createState = (): State => ({
  entries: new Map(),
  particles: [],
  requests: new Map(),
  hits: new RateCounter(3000),
  misses: new RateCounter(3000),
  evictions: 0,
  dbQueries: new RateCounter(2000),
  latency: new MetricWindow(400),
});

/**
 * Zipf-ish key selection: a small number of keys account for most requests,
 * which is what makes caching work in the real world.
 */
function pickKey(keyspace: number, skew: number) {
  const random = Math.random() ** (1 + skew * 4);
  return `product:${Math.floor(random * keyspace) + 1}`;
}

export function CachingLab() {
  const [running, setRunning] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [traffic, setTraffic] = useState(1000);
  const [ttl, setTtl] = useState(60);
  const [size, setSize] = useState(100);
  const [keyspace, setKeyspace] = useState(500);
  const [skew, setSkew] = useState(0.6);
  const [inspected, setInspected] = useState<SimulatedRequest | null>(null);

  const state = useRef<State>(createState());
  const rerender = useRerender(30);
  const { events, log, clear } = useEventLog();
  const { points, push, reset: resetSeries } = useSeries(50, 500);

  const reset = useCallback(() => {
    state.current = createState();
    clear();
    resetSeries();
    setInspected(null);
  }, [clear, resetSeries]);

  const flush = useCallback(() => {
    state.current.entries.clear();
    log('Cache flushed - every request now misses until it warms up again', 'warn');
    rerender();
  }, [log, rerender]);

  useTicker(running, (dt) => {
    const current = state.current;
    const now = performance.now();
    const dbLoad = computeLoad(current.dbQueries.rate(now), DB_CAPACITY, { baseLatencyMs: 110, kneeAt: 0.6 });

    // Every request is counted, so the database sees the traffic the slider
    // actually asks for. Only a sample of them is animated.
    const arrivals = sampleArrivals(traffic, dt);
    const share = visualShare(traffic, ANIMATED_PER_SECOND);

    // Shrinking the cache-size slider must shrink the cache now. Evicting one
    // entry per miss (and then inserting one) never brought an over-full cache
    // back under its limit, so a 10-item cache kept ~500 keys and a 99% hit rate.
    while (current.entries.size > size) {
      const lru = current.entries.keys().next().value;
      if (lru === undefined) break;
      current.entries.delete(lru);
      current.evictions += 1;
    }

    for (let index = 0; index < arrivals; index += 1) {
      const key = pickKey(keyspace, skew);
      const entry = current.entries.get(key);
      const fresh = entry && entry.expiresAt > now;
      const hit = enabled && Boolean(fresh);

      let latency: number;
      let note: string;

      if (hit) {
        current.hits.add(1, now);
        entry!.lastUsed = now;
        // A Map iterates in insertion order, so re-inserting the key moves it
        // to the most-recently-used end. That turns eviction below into an O(1)
        // lookup instead of a scan of every entry on every miss.
        current.entries.delete(key);
        current.entries.set(key, entry!);
        latency = CACHE_LATENCY * (0.8 + Math.random() * 0.5);
        note = 'Cache HIT - no database query';
      } else {
        current.misses.add(1, now);
        current.dbQueries.add(1, now);
        // With the cache off there is no cache lookup to pay for first.
        latency = (enabled ? CACHE_LATENCY : 0) + dbLoad.latencyMs * (0.8 + Math.random() * 0.5);
        note = enabled ? 'Cache MISS - loaded from database and stored' : 'Cache disabled - straight to database';
        if (enabled) {
          if (current.entries.size >= size && !current.entries.has(key)) {
            const lru = current.entries.keys().next().value;
            if (lru !== undefined) {
              current.entries.delete(lru);
              current.evictions += 1;
            }
          }
          current.entries.delete(key);
          current.entries.set(key, { key, expiresAt: now + ttl * 1000, lastUsed: now });
        }
      }

      current.latency.push(latency);

      if (Math.random() >= share) continue;

      const particleId = nextParticleId();
      current.particles.push({
        id: particleId,
        route: hit
          ? ['users', 'api', 'cache']
          : enabled
            ? ['users', 'api', 'cache', 'api', 'db']
            : ['users', 'api', 'db'],
        leg: 0,
        t: 0,
        speed: 1.3 + Math.random() * 0.3,
        outcome: hit ? 'cache-hit' : dbLoad.saturated ? 'warning' : 'success',
      });

      if (current.requests.size > INSPECTABLE_REQUESTS) {
        const oldest = current.requests.keys().next().value;
        if (oldest !== undefined) current.requests.delete(oldest);
      }
      current.requests.set(particleId, {
        id: particleId,
        createdAt: now,
        currentNode: hit ? 'cache' : 'db',
        status: 'completed',
        outcome: hit ? 'cache-hit' : 'success',
        latency,
        path: hit
          ? ['Client', 'API', 'Redis (HIT)']
          : enabled
            ? ['Client', 'API', 'Redis (MISS)', 'API', 'PostgreSQL', 'API', 'Redis (store)']
            : ['Client', 'API', 'PostgreSQL'],
        method: 'GET',
        endpoint: `/api/${key.replace(':', '/')}`,
        notes: [note, `Key: ${key}`, `TTL: ${ttl}s`],
      });
    }

    // Expire entries lazily so the cache size metric stays honest.
    for (const [key, entry] of current.entries) {
      if (entry.expiresAt <= now) current.entries.delete(key);
    }

    const { alive } = advanceParticles(current.particles, dt);
    current.particles = alive.length > PARTICLE_BUDGET ? alive.slice(-PARTICLE_BUDGET) : alive;

    const served = current.hits.rate(now) + current.misses.rate(now);
    push(
      {
        hitRate: served ? (current.hits.rate(now) / served) * 100 : 0,
        dbQps: current.dbQueries.rate(now),
        latency: current.latency.avg,
      },
      now,
    );

    if (dbLoad.saturated && Math.random() < dt) {
      log(`Database over capacity: ${formatNumber(current.dbQueries.rate(now))} queries/sec`, 'danger');
    }

    rerender();
  });

  const current = state.current;
  const now = performance.now();
  const servedQps = current.hits.rate(now) + current.misses.rate(now);
  const hitRate = servedQps ? current.hits.rate(now) / servedQps : 0;
  const dbQps = current.dbQueries.rate(now);
  const dbLoad = computeLoad(dbQps, DB_CAPACITY, { baseLatencyMs: 110, kneeAt: 0.6 });
  const snapshot = current.latency.snapshot();

  const particleViews: ParticleView[] = current.particles.map((particle) => ({
    id: particle.id,
    from: particle.route[particle.leg],
    to: particle.route[particle.leg + 1],
    t: particle.t,
    outcome: particle.outcome ?? 'success',
    onClick: () => {
      const request = current.requests.get(particle.id);
      if (request) setInspected(request);
    },
  }));

  return (
    <LabShell
      title="Caching Lab"
      description="Watch two request paths: a hit that returns from memory, and a miss that pays for the database round trip - then stores the result."
      running={running}
      onToggleRun={() => setRunning((value) => !value)}
      onReset={reset}
      legend={<ParticleLegend outcomes={['cache-hit', 'success', 'warning']} />}
      events={events}
      insight={
        <Insight>
          {!enabled ? (
            <>
              With the cache off, every one of {formatNumber(traffic)} req/sec becomes a database query. The database
              saturates at about {DB_CAPACITY} queries/sec, after which latency climbs sharply. Turn the cache on and
              watch database load fall by roughly the hit rate.
            </>
          ) : hitRate < 0.5 && servedQps > 50 ? (
            <>
              Hit rate is only {formatPercent(hitRate)}. With {keyspace} distinct keys and room for {size}, most
              requests find nothing cached. Either raise the cache size, raise the TTL, or accept that this access
              pattern is not cacheable.
            </>
          ) : (
            <>
              At {formatPercent(hitRate)} hit rate the database sees about {formatNumber(dbQps)} queries/sec instead of{' '}
              {formatNumber(traffic)}. Average latency is {formatLatency(snapshot.avg)} - the misses dominate it, which
              is why the last few points of hit rate matter so much.
            </>
          )}
        </Insight>
      }
      metrics={
        <>
          <MetricsPanel
            items={[
              { key: 'hitRate', label: 'Hit rate', value: formatPercent(hitRate), tone: hitRate > 0.8 ? 'ok' : hitRate > 0.5 ? 'warn' : 'danger' },
              { key: 'missRate', label: 'Miss rate', value: formatPercent(1 - hitRate) },
              { key: 'dbQueries', label: 'DB queries', value: formatNumber(dbQps), unit: '/s', tone: dbLoad.saturated ? 'danger' : 'neutral' },
              {
                key: 'latency',
                label: 'Avg latency',
                value: formatLatency(snapshot.avg),
                hint: 'Simulated, not measured: a simplified queueing model of the database, meant to show the shape of the curve.',
              },
              {
                key: 'p95',
                label: 'P95 latency',
                value: formatLatency(snapshot.p95),
                hint: '95% of requests finished faster than this. Simulated by a simplified model, not measured.',
              },
              { key: 'evictions', label: 'Evictions', value: formatNumber(current.evictions), tone: current.evictions > 0 ? 'warn' : 'neutral' },
            ]}
          />
          <div className="card p-4">
            <p className="label mb-3">Hit rate and database load</p>
            <LiveChart
              data={points}
              series={[{ key: 'hitRate', label: 'Hit rate %', color: 'ok' }]}
              height={140}
              yDomain={[0, 100]}
            />
            <LiveChart
              data={points}
              series={[
                { key: 'dbQps', label: 'DB queries/sec', color: 'violet' },
                { key: 'latency', label: 'Avg latency (ms)', color: 'warn' },
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
          <Toggle
            label="Cache enabled"
            checked={enabled}
            onChange={(value) => {
              setEnabled(value);
              log(value ? 'Cache enabled' : 'Cache disabled - all reads go to the database', value ? 'ok' : 'warn');
            }}
            description="Turn off to send every read to the database"
          />
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
            label="TTL"
            value={ttl}
            min={1}
            max={300}
            onChange={setTtl}
            format={(value) => `${value} s`}
            hint="How long a cached value stays valid. Longer TTL means higher hit rate and staler data."
          />
          <Slider
            label="Cache size"
            value={size}
            min={10}
            max={1000}
            step={10}
            onChange={setSize}
            format={(value) => `${formatNumber(value)} items`}
            hint="Maximum entries. When full, the least recently used entry is evicted."
          />
          <Slider
            label="Distinct keys"
            value={keyspace}
            min={20}
            max={5000}
            step={20}
            onChange={setKeyspace}
            format={(value) => `${formatNumber(value)} keys`}
            hint="Size of the working set. A cache only helps when the hot subset fits."
          />
          <Slider
            label="Access skew"
            value={skew}
            min={0}
            max={1}
            step={0.05}
            onChange={setSkew}
            format={(value) => (value < 0.2 ? 'uniform' : value > 0.7 ? 'very hot keys' : 'moderate')}
            hint="How concentrated traffic is on popular keys. Real traffic is highly skewed."
          />
          <button
            type="button"
            onClick={flush}
            className="w-full rounded-xl border border-danger/40 px-3 py-2 text-xs font-medium text-danger transition-colors hover:bg-danger/10"
          >
            Flush cache (cold start)
          </button>
        </>
      }
    >
      <DiagramCanvas layout={LAYOUT} edges={EDGES} particles={particleViews} height={475} className="bg-canvas">
        <ArchNode kind="client" title="Users" subtitle={`${formatNumber(traffic)} req/sec`} placed={LAYOUT.users} compact />
        <ArchNode kind="server" title="API" subtitle="cache-aside" placed={LAYOUT.api} compact>
          <NodeStatRow label="Avg" value={formatLatency(snapshot.avg)} />
        </ArchNode>
        <ArchNode
          kind="cache"
          title="Redis Cache"
          subtitle={enabled ? `TTL ${ttl}s - LRU` : 'disabled'}
          placed={LAYOUT.cache}
          status={enabled ? 'healthy' : 'down'}
        >
          <Meter label="Fill" value={clamp(current.entries.size / size, 0, 1)} tone="danger" size="xs" />
          <NodeStatRow label="Hit rate" value={formatPercent(hitRate)} tone="text-ok" />
          <NodeStatRow label="Keys" value={formatNumber(current.entries.size)} />
          <NodeStatRow label="Hit latency" value={`${CACHE_LATENCY} ms`} />
        </ArchNode>
        <ArchNode
          kind="sql"
          title="PostgreSQL"
          subtitle={`capacity ${DB_CAPACITY} q/s`}
          placed={LAYOUT.db}
          alert={dbLoad.saturated}
          status={dbLoad.errorRate > 0.1 ? 'degraded' : 'healthy'}
        >
          <Meter label="Load" value={dbLoad.cpu} size="xs" />
          <NodeStatRow label="Queries" value={`${formatNumber(dbQps)}/s`} />
          <NodeStatRow label="Latency" value={formatLatency(dbLoad.latencyMs)} />
        </ArchNode>
      </DiagramCanvas>
    </LabShell>
  );
}

export default CachingLab;
