import { useCallback, useRef, useState } from 'react';
import { ArchNode, DiagramCanvas, NodeStatRow, ParticleLegend, type DiagramEdge, type Layout, type ParticleView } from '@/components/architecture';
import { LiveChart } from '@/components/charts';
import { Insight, LabShell, MetricsPanel } from '@/components/learning';
import { Button, Slider } from '@/components/ui';
import { advanceParticles, nextParticleId, RateCounter, useEventLog, useSeries, useTicker, type Particle } from '@/simulations/engine';
import { useRerender } from '@/hooks/useRerender';
import { clamp, sampleArrivals } from '@/utils/math';
import { formatNumber, formatPercent } from '@/utils/format';

type Algorithm = 'fixed-window' | 'sliding-window' | 'token-bucket' | 'leaky-bucket';

const ALGORITHMS: { value: Algorithm; label: string }[] = [
  { value: 'fixed-window', label: 'Fixed Window' },
  { value: 'sliding-window', label: 'Sliding Window' },
  { value: 'token-bucket', label: 'Token Bucket' },
  { value: 'leaky-bucket', label: 'Leaky Bucket' },
];

const NOTES: Record<Algorithm, string> = {
  'fixed-window':
    'A counter per calendar window, reset at the boundary. Simple - but a client can send a full limit at the end of one window and another full limit at the start of the next, producing twice the intended rate in a moment.',
  'sliding-window':
    'The previous window count is weighted by how far into the current window we are. No boundary spike, at the cost of a little more state and arithmetic per request.',
  'token-bucket':
    'Tokens refill at a steady rate up to a capacity. A request spends one token. An idle client accumulates tokens and may burst - which is usually what you want for real API clients.',
  'leaky-bucket':
    'Requests enter a queue that drains at a constant rate. Output is perfectly smooth, which protects a fragile downstream - but bursts wait instead of passing.',
};

interface State {
  particles: Particle[];
  allowed: number;
  rejected: number;
  allowedRate: RateCounter;
  rejectedRate: RateCounter;
  /** Token bucket. */
  tokens: number;
  /** Leaky bucket queue length. */
  queue: number;
  leakCarry: number;
  /** Window counters. */
  windowStart: number;
  windowCount: number;
  previousWindowCount: number;
}

const createState = (limit: number): State => ({
  particles: [],
  allowed: 0,
  rejected: 0,
  allowedRate: new RateCounter(2000),
  rejectedRate: new RateCounter(2000),
  tokens: limit,
  queue: 0,
  leakCarry: 0,
  windowStart: performance.now(),
  windowCount: 0,
  previousWindowCount: 0,
});

const LAYOUT: Layout = {
  client: { x: 60, y: 200, w: 170, h: 88 },
  limiter: { x: 350, y: 170, w: 230, h: 150 },
  api: { x: 720, y: 110, w: 180, h: 92 },
  rejected: { x: 720, y: 320, w: 180, h: 92 },
};

const EDGES: DiagramEdge[] = [
  { from: 'client', to: 'limiter', tone: 'brand', width: 2 },
  { from: 'limiter', to: 'api', tone: 'ok', label: 'allowed' },
  { from: 'limiter', to: 'rejected', tone: 'danger', label: '429' },
];

export function RateLimitingLab() {
  const [running, setRunning] = useState(true);
  const [algorithm, setAlgorithm] = useState<Algorithm>('token-bucket');
  const [limit, setLimit] = useState(10);
  const [windowSeconds, setWindowSeconds] = useState(1);
  const [requestRate, setRequestRate] = useState(14);

  const state = useRef<State>(createState(10));
  const rerender = useRerender(30);
  const { events, log, clear } = useEventLog();
  const { points, push, reset: resetSeries } = useSeries(60, 400);

  const reset = useCallback(() => {
    state.current = createState(limit);
    clear();
    resetSeries();
  }, [limit, clear, resetSeries]);

  const burst = useCallback(() => {
    const current = state.current;
    const now = performance.now();
    let allowed = 0;
    for (let index = 0; index < limit * 2; index += 1) {
      if (admit(current, algorithm, limit, windowSeconds, now)) allowed += 1;
    }
    log(`Burst of ${limit * 2} requests: ${allowed} allowed, ${limit * 2 - allowed} rejected with 429`, 'warn');
    rerender();
  }, [algorithm, limit, windowSeconds, log, rerender]);

  useTicker(running, (dt) => {
    const current = state.current;
    const now = performance.now();

    // Refill / drain
    if (algorithm === 'token-bucket') {
      current.tokens = Math.min(limit, current.tokens + (limit / windowSeconds) * dt);
    }
    if (algorithm === 'leaky-bucket') {
      const drain = (limit / windowSeconds) * dt + current.leakCarry;
      const whole = Math.floor(drain);
      current.leakCarry = drain - whole;
      const leaked = Math.min(whole, current.queue);
      current.queue -= leaked;
      for (let index = 0; index < Math.min(leaked, 4); index += 1) {
        current.allowed += 1;
        current.allowedRate.add(1, now);
        current.particles.push({
          id: nextParticleId(),
          route: ['limiter', 'api'],
          leg: 0,
          t: 0,
          speed: 1.5,
          outcome: 'success',
        });
      }
    }

    // Window roll
    if (algorithm === 'fixed-window' || algorithm === 'sliding-window') {
      if (now - current.windowStart >= windowSeconds * 1000) {
        current.previousWindowCount = current.windowCount;
        current.windowCount = 0;
        current.windowStart = now;
      }
    }

    const arrivals = sampleArrivals(requestRate, dt);
    for (let index = 0; index < arrivals; index += 1) {
      const ok = admit(current, algorithm, limit, windowSeconds, now);
      if (algorithm === 'leaky-bucket') {
        // Admission only enqueues; the drain loop above emits the allowed particle.
        current.particles.push({
          id: nextParticleId(),
          route: ok ? ['client', 'limiter'] : ['client', 'rejected'],
          leg: 0,
          t: 0,
          speed: 1.4,
          outcome: ok ? 'success' : 'failure',
        });
        if (!ok) {
          current.rejected += 1;
          current.rejectedRate.add(1, now);
        }
        continue;
      }

      if (ok) {
        current.allowed += 1;
        current.allowedRate.add(1, now);
      } else {
        current.rejected += 1;
        current.rejectedRate.add(1, now);
      }
      current.particles.push({
        id: nextParticleId(),
        route: ok ? ['client', 'limiter', 'api'] : ['client', 'limiter', 'rejected'],
        leg: 0,
        t: 0,
        speed: 1.3,
        outcome: ok ? 'success' : 'failure',
      });
    }

    const { alive } = advanceParticles(current.particles, dt);
    current.particles = alive.slice(-70);

    push(
      {
        allowed: current.allowedRate.rate(now),
        rejected: current.rejectedRate.rate(now),
        limit: limit / windowSeconds,
      },
      now,
    );
    rerender();
  });

  const current = state.current;
  const now = performance.now();
  const total = current.allowed + current.rejected;
  const rejectShare = total ? current.rejected / total : 0;
  const windowElapsed = clamp((now - current.windowStart) / (windowSeconds * 1000), 0, 1);

  const particleViews: ParticleView[] = current.particles.map((particle) => ({
    id: particle.id,
    from: particle.route[particle.leg],
    to: particle.route[particle.leg + 1],
    t: particle.t,
    outcome: particle.outcome ?? 'success',
  }));

  return (
    <LabShell
      title="Rate Limiting Lab"
      description="Four algorithms, one traffic source. Watch tokens refill, windows roll and buckets leak - and see which one lets a burst through."
      running={running}
      onToggleRun={() => setRunning((value) => !value)}
      onReset={reset}
      legend={<ParticleLegend outcomes={['success', 'failure']} />}
      events={events}
      actions={
        <Button variant="secondary" onClick={burst}>
          Send a burst of {limit * 2}
        </Button>
      }
      insight={<Insight title={ALGORITHMS.find((item) => item.value === algorithm)?.label}>{NOTES[algorithm]}</Insight>}
      metrics={
        <>
          <MetricsPanel
            items={[
              { key: 'allowed', label: 'Allowed', value: formatNumber(current.allowed), tone: 'ok' },
              { key: 'rejected', label: 'Rejected (429)', value: formatNumber(current.rejected), tone: current.rejected > 0 ? 'danger' : 'neutral' },
              { key: 'rejectShare', label: 'Reject rate', value: formatPercent(rejectShare, 1), tone: rejectShare > 0.3 ? 'danger' : 'warn', hint: 'Share of requests refused by the limiter.' },
              { key: 'limit', label: 'Configured limit', value: `${limit} / ${windowSeconds}s`, hint: 'Allowance per client per window.' },
              {
                key: 'state',
                label: algorithm === 'token-bucket' ? 'Tokens left' : algorithm === 'leaky-bucket' ? 'Queued' : 'Window count',
                value:
                  algorithm === 'token-bucket'
                    ? current.tokens.toFixed(1)
                    : algorithm === 'leaky-bucket'
                      ? formatNumber(current.queue)
                      : formatNumber(current.windowCount),
                tone: 'brand',
                hint: 'Internal state the algorithm keeps per client.',
              },
              { key: 'rps', label: 'Incoming', value: requestRate, unit: 'req/s', tone: 'brand' },
            ]}
          />
          <div className="card p-4">
            <p className="label mb-3">Allowed vs rejected over time</p>
            <LiveChart
              data={points}
              series={[
                { key: 'allowed', label: 'Allowed/sec', color: 'ok' },
                { key: 'rejected', label: 'Rejected/sec', color: 'danger' },
                { key: 'limit', label: 'Configured rate', color: 'faint', dashed: true },
              ]}
              variant="line"
              height={170}
            />
          </div>
        </>
      }
      controls={
        <>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted">Algorithm</p>
            <div className="grid grid-cols-2 gap-1.5">
              {ALGORITHMS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    setAlgorithm(item.value);
                    state.current = createState(limit);
                    log(`Algorithm: ${item.label}`, 'info');
                  }}
                  className={`rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors ${
                    algorithm === item.value
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-line text-muted hover:border-brand/50 hover:text-ink'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <Slider
            label="Limit"
            value={limit}
            min={1}
            max={50}
            onChange={(value) => {
              setLimit(value);
              state.current = createState(value);
            }}
            format={(value) => `${value} requests`}
            hint="Allowance per window (or bucket capacity)."
          />
          <Slider
            label="Window"
            value={windowSeconds}
            min={1}
            max={10}
            onChange={setWindowSeconds}
            format={(value) => `${value} s`}
            hint="Window length, or the time in which the bucket fully refills."
          />
          <Slider
            label="Client request rate"
            value={requestRate}
            min={1}
            max={80}
            onChange={setRequestRate}
            format={(value) => `${value} req/sec`}
            tone={requestRate > limit / windowSeconds ? 'danger' : 'brand'}
          />
          <div className="rounded-xl border border-line bg-elevated p-3">
            <p className="label mb-2">Limiter state</p>
            {algorithm === 'token-bucket' ? (
              <TokenBucket tokens={current.tokens} capacity={limit} />
            ) : algorithm === 'leaky-bucket' ? (
              <LeakyBucket queued={current.queue} capacity={limit * 3} />
            ) : (
              <WindowView
                count={current.windowCount}
                previous={current.previousWindowCount}
                limit={limit}
                elapsed={windowElapsed}
                sliding={algorithm === 'sliding-window'}
              />
            )}
          </div>
        </>
      }
    >
      <DiagramCanvas layout={LAYOUT} edges={EDGES} particles={particleViews} height={490} className="bg-canvas">
        <ArchNode kind="client" title="Client" subtitle={`${requestRate} req/sec`} placed={LAYOUT.client} compact />
        <ArchNode
          kind="api-gateway"
          title="Rate Limiter"
          subtitle={ALGORITHMS.find((item) => item.value === algorithm)?.label}
          placed={LAYOUT.limiter}
        >
          <NodeStatRow label="Limit" value={`${limit} / ${windowSeconds}s`} />
          {algorithm === 'token-bucket' ? (
            <div className="flex flex-wrap gap-1 pt-1" aria-label={`${Math.floor(current.tokens)} tokens available`}>
              {Array.from({ length: Math.min(limit, 20) }, (_, index) => (
                <span
                  key={index}
                  className={`h-2.5 w-2.5 rounded-full transition-colors ${
                    index < Math.floor(current.tokens) ? 'bg-ok' : 'bg-line'
                  }`}
                />
              ))}
            </div>
          ) : null}
          {algorithm === 'leaky-bucket' ? <NodeStatRow label="Queued" value={formatNumber(current.queue)} /> : null}
          {algorithm !== 'token-bucket' && algorithm !== 'leaky-bucket' ? (
            <NodeStatRow label="Window" value={`${current.windowCount}/${limit}`} />
          ) : null}
        </ArchNode>
        <ArchNode kind="server" title="API" subtitle="protected service" placed={LAYOUT.api} compact>
          <NodeStatRow label="Allowed" value={formatNumber(current.allowed)} tone="text-ok" />
        </ArchNode>
        <ArchNode kind="client" title="HTTP 429" subtitle="Too Many Requests" placed={LAYOUT.rejected} compact>
          <NodeStatRow label="Rejected" value={formatNumber(current.rejected)} tone="text-danger" />
        </ArchNode>
      </DiagramCanvas>
    </LabShell>
  );
}

/** Applies the selected algorithm. Returns true when the request is admitted. */
function admit(state: State, algorithm: Algorithm, limit: number, windowSeconds: number, now: number) {
  switch (algorithm) {
    case 'token-bucket': {
      if (state.tokens >= 1) {
        state.tokens -= 1;
        return true;
      }
      return false;
    }
    case 'leaky-bucket': {
      if (state.queue < limit * 3) {
        state.queue += 1;
        return true;
      }
      return false;
    }
    case 'sliding-window': {
      const elapsed = clamp((now - state.windowStart) / (windowSeconds * 1000), 0, 1);
      const weighted = state.previousWindowCount * (1 - elapsed) + state.windowCount;
      if (weighted < limit) {
        state.windowCount += 1;
        return true;
      }
      return false;
    }
    default: {
      if (state.windowCount < limit) {
        state.windowCount += 1;
        return true;
      }
      return false;
    }
  }
}

function TokenBucket({ tokens, capacity }: { tokens: number; capacity: number }) {
  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: Math.min(capacity, 30) }, (_, index) => (
          <span
            key={index}
            className={`h-3 w-3 rounded-full ${index < Math.floor(tokens) ? 'bg-ok' : 'border border-line bg-transparent'}`}
          />
        ))}
      </div>
      <p className="mt-2 font-mono text-[11px] text-muted">
        {tokens.toFixed(1)} / {capacity} tokens
      </p>
      <p className="mt-1 text-[11px] text-faint">
        Idle clients accumulate tokens up to the capacity, then may spend them in one burst.
      </p>
    </div>
  );
}

function LeakyBucket({ queued, capacity }: { queued: number; capacity: number }) {
  return (
    <div>
      <div className="h-24 w-full overflow-hidden rounded-lg border border-line bg-canvas">
        <div
          className="mt-auto h-full w-full origin-bottom bg-brand/40 transition-transform"
          style={{ transform: `scaleY(${clamp(queued / capacity, 0, 1)})`, transformOrigin: 'bottom' }}
        />
      </div>
      <p className="mt-2 font-mono text-[11px] text-muted">
        {queued} queued / {capacity} capacity
      </p>
      <p className="mt-1 text-[11px] text-faint">Output drains at a constant rate; overflow is rejected.</p>
    </div>
  );
}

function WindowView({
  count,
  previous,
  limit,
  elapsed,
  sliding,
}: {
  count: number;
  previous: number;
  limit: number;
  elapsed: number;
  sliding: boolean;
}) {
  const weighted = sliding ? previous * (1 - elapsed) + count : count;
  return (
    <div>
      <div className="flex gap-1">
        <div className="flex-1">
          <p className="text-[10px] text-faint">previous</p>
          <div className="mt-1 h-10 rounded bg-line/60">
            <div
              className="h-full rounded bg-faint/50"
              style={{ width: `${clamp(previous / limit, 0, 1) * 100}%` }}
            />
          </div>
        </div>
        <div className="flex-1">
          <p className="text-[10px] text-faint">current ({Math.round(elapsed * 100)}%)</p>
          <div className="mt-1 h-10 rounded bg-line/60">
            <div
              className={`h-full rounded ${count >= limit ? 'bg-danger' : 'bg-brand'}`}
              style={{ width: `${clamp(count / limit, 0, 1) * 100}%` }}
            />
          </div>
        </div>
      </div>
      <p className="mt-2 font-mono text-[11px] text-muted">
        {sliding ? `weighted ${weighted.toFixed(1)}` : `count ${count}`} / {limit}
      </p>
      <p className="mt-1 text-[11px] text-faint">
        {sliding
          ? 'The previous window still counts, fading out as the current one progresses.'
          : 'The counter resets instantly at the boundary - that is the 2x burst hole.'}
      </p>
    </div>
  );
}

export default RateLimitingLab;
