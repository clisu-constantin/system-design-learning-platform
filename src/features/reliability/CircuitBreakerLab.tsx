import { useCallback, useRef, useState } from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { ArchNode, DiagramCanvas, NodeStatRow, ParticleLegend, type DiagramEdge, type Layout, type ParticleView } from '@/components/architecture';
import { Insight, LabShell, MetricsPanel } from '@/components/learning';
import { Badge, Button, Meter, Slider, Toggle } from '@/components/ui';
import {
  advanceParticles,
  MetricWindow,
  nextParticleId,
  useEventLog,
  useTicker,
  type Particle,
} from '@/simulations/engine';
import { useRerender } from '@/hooks/useRerender';
import { sampleArrivals } from '@/utils/math';
import { formatLatency, formatNumber, formatPercent } from '@/utils/format';
import { cn } from '@/utils/cn';

type BreakerState = 'closed' | 'open' | 'half-open';

const STATE_META: Record<BreakerState, { label: string; tone: 'ok' | 'danger' | 'warn'; note: string }> = {
  closed: {
    label: 'CLOSED',
    tone: 'ok',
    note: 'Calls pass through to the dependency while failures are counted over a rolling window.',
  },
  open: {
    label: 'OPEN',
    tone: 'danger',
    note: 'The threshold was crossed. Calls fail immediately with the fallback - no network call is made, so the caller keeps its threads and the dependency gets room to recover.',
  },
  'half-open': {
    label: 'HALF-OPEN',
    tone: 'warn',
    note: 'The cooldown elapsed. A limited number of trial calls are allowed through to test whether the dependency recovered.',
  },
};

interface CallRecord {
  id: number;
  result: 'ok' | 'fail' | 'short-circuit';
}

interface State {
  breaker: BreakerState;
  window: boolean[];
  openedAt: number;
  trials: number;
  trialSuccesses: number;
  particles: Particle[];
  calls: CallRecord[];
  passed: number;
  failed: number;
  shortCircuited: number;
  /**
   * Rolling. The whole point is that opening the breaker replaces a `timeout`
   * wait with a 2 ms fallback, and a lifetime average hides that for minutes.
   */
  latency: MetricWindow;
  transitions: number;
  /**
   * Bumped on every entry to HALF-OPEN. A trial call carries the epoch it was
   * sent in, so a trial still in flight after the breaker moved on is counted
   * but can no longer flip the state.
   */
  halfOpenEpoch: number;
}

/** Carried on a trial call's particle: the result is applied when it reaches the dependency. */
interface TrialMeta {
  trial: true;
  failed: boolean;
  epoch: number;
}

const isTrial = (particle: Particle) => (particle.meta as Partial<TrialMeta> | undefined)?.trial === true;

const createState = (): State => ({
  breaker: 'closed',
  window: [],
  openedAt: 0,
  trials: 0,
  trialSuccesses: 0,
  particles: [],
  calls: [],
  passed: 0,
  failed: 0,
  shortCircuited: 0,
  latency: new MetricWindow(300),
  transitions: 0,
  halfOpenEpoch: 0,
});

const LAYOUT: Layout = {
  client: { x: 40, y: 200, w: 160, h: 84 },
  api: { x: 265, y: 190, w: 180, h: 104 },
  breaker: { x: 470, y: 180, w: 250, h: 124 },
  payment: { x: 745, y: 100, w: 175, h: 108 },
  fallback: { x: 745, y: 300, w: 175, h: 96 },
};

const WINDOW_SIZE = 20;
const TRIAL_CALLS = 3;

export function CircuitBreakerLab() {
  const [running, setRunning] = useState(true);
  const [failureRate, setFailureRate] = useState(0.1);
  const [threshold, setThreshold] = useState(50);
  const [cooldown, setCooldown] = useState(6);
  const [timeout, setTimeoutMs] = useState(2000);
  const [breakerEnabled, setBreakerEnabled] = useState(true);
  const [requestRate, setRequestRate] = useState(10);

  const state = useRef<State>(createState());
  const rerender = useRerender(30);
  const { events, log, clear } = useEventLog(50);

  const reset = useCallback(() => {
    state.current = createState();
    clear();
  }, [clear]);

  const transition = useCallback(
    (next: BreakerState, reason: string) => {
      const current = state.current;
      if (current.breaker === next) return;
      current.breaker = next;
      current.transitions += 1;
      if (next === 'open') {
        current.openedAt = performance.now();
        current.window = [];
      }
      if (next === 'half-open') {
        current.halfOpenEpoch += 1;
        current.trials = 0;
        current.trialSuccesses = 0;
      }
      if (next === 'closed') current.window = [];
      log(`Circuit ${STATE_META[next].label}: ${reason}`, next === 'closed' ? 'ok' : next === 'open' ? 'danger' : 'warn');
    },
    [log],
  );

  useTicker(running, (dt) => {
    const current = state.current;
    const now = performance.now();

    /** Counts one call that reached the dependency. */
    const record = (failed: boolean) => {
      if (failed) {
        current.failed += 1;
        current.latency.push(timeout);
        current.calls.unshift({ id: nextParticleId(), result: 'fail' });
      } else {
        current.passed += 1;
        current.latency.push(60);
        current.calls.unshift({ id: nextParticleId(), result: 'ok' });
      }
      current.calls = current.calls.slice(0, 40);
      current.window.push(!failed);
      if (current.window.length > WINDOW_SIZE) current.window.shift();
    };

    if (breakerEnabled && current.breaker === 'open' && now - current.openedAt >= cooldown * 1000) {
      transition('half-open', `cooldown of ${cooldown}s elapsed, sending ${TRIAL_CALLS} trial calls`);
    }

    const arrivals = sampleArrivals(requestRate, dt);
    for (let index = 0; index < arrivals; index += 1) {
      const shortCircuit = breakerEnabled && current.breaker === 'open';

      if (shortCircuit) {
        current.shortCircuited += 1;
        current.latency.push(2);
        current.calls.unshift({ id: nextParticleId(), result: 'short-circuit' });
        current.calls.length = Math.min(current.calls.length, 40);
        current.particles.push({
          id: nextParticleId(),
          route: ['client', 'api', 'breaker', 'fallback'],
          leg: 0,
          t: 0,
          speed: 1.6,
          outcome: 'warning',
        });
        continue;
      }

      if (breakerEnabled && current.breaker === 'half-open' && current.trials >= TRIAL_CALLS) {
        current.shortCircuited += 1;
        current.latency.push(2);
        current.calls.unshift({ id: nextParticleId(), result: 'short-circuit' });
        current.calls.length = Math.min(current.calls.length, 40);
        current.particles.push({
          id: nextParticleId(),
          route: ['client', 'api', 'breaker', 'fallback'],
          leg: 0,
          t: 0,
          speed: 1.6,
          outcome: 'warning',
        });
        continue;
      }

      const failed = Math.random() < failureRate;

      if (breakerEnabled && current.breaker === 'half-open') {
        // A trial call. Its result is applied when its particle reaches the
        // Payment Service, so HALF-OPEN stays on screen while the probe travels.
        current.trials += 1;
        const meta: TrialMeta = { trial: true, failed, epoch: current.halfOpenEpoch };
        current.particles.push({
          id: nextParticleId(),
          route: ['client', 'api', 'breaker', 'payment'],
          leg: 0,
          t: 0,
          speed: 1.2,
          outcome: failed ? 'failure' : 'success',
          meta: { ...meta },
        });
        continue;
      }

      record(failed);

      current.particles.push({
        id: nextParticleId(),
        route: ['client', 'api', 'breaker', 'payment'],
        leg: 0,
        t: 0,
        speed: 1.2,
        outcome: failed ? 'failure' : 'success',
      });

      if (breakerEnabled) {
        if (current.breaker === 'closed' && current.window.length >= 10) {
          const failures = current.window.filter((ok) => !ok).length;
          const ratio = failures / current.window.length;
          if (ratio * 100 >= threshold) {
            transition('open', `${failures}/${current.window.length} calls failed (${Math.round(ratio * 100)}% >= ${threshold}%)`);
          }
        }
      }
    }

    const { alive, finished } = advanceParticles(current.particles, dt);
    for (const particle of finished) {
      if (!isTrial(particle)) continue;
      const trial = particle.meta as unknown as TrialMeta;
      record(trial.failed);
      if (!breakerEnabled || current.breaker !== 'half-open' || trial.epoch !== current.halfOpenEpoch) continue;
      if (trial.failed) {
        transition('open', 'trial call failed - back to open, cooldown restarts');
      } else {
        current.trialSuccesses += 1;
        if (current.trialSuccesses >= TRIAL_CALLS) transition('closed', `${TRIAL_CALLS} trial calls succeeded`);
      }
    }
    // Trial calls are never evicted by the particle cap: the state machine waits for them.
    const trials = alive.filter(isTrial);
    const others = alive.filter((particle) => !isTrial(particle));
    current.particles = [...others.slice(-Math.max(0, 60 - trials.length)), ...trials];
    rerender();
  });

  const current = state.current;
  const total = current.passed + current.failed + current.shortCircuited;
  const avgLatency = current.latency.avg;
  const windowFailures = current.window.filter((ok) => !ok).length;
  const windowRatio = current.window.length ? windowFailures / current.window.length : 0;
  const meta = STATE_META[breakerEnabled ? current.breaker : 'closed'];
  const cooldownLeft = current.breaker === 'open' ? Math.max(0, cooldown * 1000 - (performance.now() - current.openedAt)) : 0;

  const edges: DiagramEdge[] = [
    { from: 'client', to: 'api', tone: 'brand', width: 2 },
    { from: 'api', to: 'breaker', tone: 'brand' },
    {
      from: 'breaker',
      to: 'payment',
      tone: current.breaker === 'open' && breakerEnabled ? 'muted' : 'ok',
      dashed: current.breaker === 'open' && breakerEnabled,
      label: current.breaker === 'open' && breakerEnabled ? 'blocked' : undefined,
    },
    {
      from: 'breaker',
      to: 'fallback',
      tone: current.breaker === 'closed' || !breakerEnabled ? 'muted' : 'warn',
      dashed: current.breaker === 'closed' || !breakerEnabled,
      label: 'fallback',
    },
  ];

  const particleViews: ParticleView[] = current.particles.map((particle) => ({
    id: particle.id,
    from: particle.route[particle.leg],
    to: particle.route[particle.leg + 1],
    t: particle.t,
    outcome: particle.outcome ?? 'success',
  }));

  return (
    <LabShell
      title="Circuit Breaker Lab"
      description="Raise the downstream failure rate and watch the breaker trip, cool down, probe with trial calls, and either close or reopen."
      running={running}
      onToggleRun={() => setRunning((value) => !value)}
      onReset={reset}
      legend={<ParticleLegend outcomes={['success', 'failure', 'warning']} />}
      events={events}
      actions={
        <>
          <Button
            variant="danger"
            onClick={() => {
              setFailureRate(0.9);
              log('Injected an outage in the payment service (90% failures)', 'danger');
            }}
          >
            <ShieldAlert className="h-4 w-4" />
            Break the dependency
          </Button>
          <Button
            variant="success"
            onClick={() => {
              setFailureRate(0.02);
              log('Payment service recovered (2% failures)', 'ok');
            }}
          >
            <ShieldCheck className="h-4 w-4" />
            Recover it
          </Button>
        </>
      }
      insight={
        <Insight title={`Circuit ${meta.label}`}>
          {meta.note}{' '}
          {!breakerEnabled && failureRate > 0.5 ? (
            <>
              With the breaker disabled, every call waits the full {formatLatency(timeout)} timeout before failing.
              Threads and connections pile up in the caller - this is how one broken dependency takes down a healthy
              service.
            </>
          ) : current.breaker === 'open' ? (
            <>Cooldown remaining: {(cooldownLeft / 1000).toFixed(1)}s. Failing here costs about 2 ms instead of {formatLatency(timeout)}.</>
          ) : null}
        </Insight>
      }
      metrics={
        <>
          <MetricsPanel
            items={[
              { key: 'state', label: 'Breaker state', value: meta.label, tone: meta.tone, hint: 'Closed passes calls, open rejects them, half-open probes.' },
              { key: 'passed', label: 'Succeeded', value: formatNumber(current.passed), tone: 'ok' },
              { key: 'failed', label: 'Failed calls', value: formatNumber(current.failed), tone: current.failed > 0 ? 'danger' : 'neutral' },
              {
                key: 'shortCircuited',
                label: 'Short-circuited',
                value: formatNumber(current.shortCircuited),
                tone: 'warn',
                hint: 'Calls rejected instantly by the breaker, without touching the dependency.',
              },
              {
                key: 'latency',
                label: 'Avg latency',
                value: formatLatency(avgLatency),
                tone: avgLatency > 800 ? 'danger' : 'ok',
                hint: 'Simplified model, not a measurement: a success costs 60 ms, a failure the full call timeout, a short-circuit 2 ms. Failing fast is what keeps this number low during an outage.',
              },
              { key: 'transitions', label: 'State changes', value: formatNumber(current.transitions) },
            ]}
          />

          <div className="card p-4">
            <p className="label mb-3">State machine</p>
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
              {(['closed', 'open', 'half-open'] as BreakerState[]).map((value, index) => (
                <span key={value} className="flex items-center gap-2">
                  <span
                    className={cn(
                      'rounded-lg border px-3 py-1.5',
                      current.breaker === value && breakerEnabled
                        ? value === 'closed'
                          ? 'border-ok bg-ok/10 text-ok'
                          : value === 'open'
                            ? 'border-danger bg-danger/10 text-danger'
                            : 'border-warn bg-warn/10 text-warn'
                        : 'border-line text-faint',
                    )}
                  >
                    {STATE_META[value].label}
                  </span>
                  {index < 2 ? <span className="text-faint">{'->'}</span> : null}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">
              CLOSED {'->'} OPEN when the failure ratio crosses {threshold}%. OPEN {'->'} HALF-OPEN after {cooldown}s.
              HALF-OPEN {'->'} CLOSED after {TRIAL_CALLS} successful trials, or straight back to OPEN on a single failure.
            </p>

            <p className="label mb-2 mt-4">Recent calls (newest first)</p>
            <div className="flex flex-wrap gap-1">
              {current.calls.length === 0 ? (
                <span className="text-xs text-faint">No calls yet.</span>
              ) : (
                current.calls.map((call) => <CallGlyph key={call.id} result={call.result} />)
              )}
            </div>
            <div className="mt-2 flex gap-4 text-[10px] text-faint">
              <span className="flex items-center gap-1">
                <CallGlyph result="ok" /> success
              </span>
              <span className="flex items-center gap-1">
                <CallGlyph result="fail" /> failure
              </span>
              <span className="flex items-center gap-1">
                <CallGlyph result="short-circuit" /> short-circuited
              </span>
            </div>
          </div>
        </>
      }
      controls={
        <>
          <Toggle
            label="Circuit breaker"
            checked={breakerEnabled}
            onChange={(value) => {
              setBreakerEnabled(value);
              if (!value) {
                // A disabled breaker has no state. Without this an OPEN breaker kept
                // its cooldown running in the background and came back OPEN.
                const current = state.current;
                current.breaker = 'closed';
                current.window = [];
                current.trials = 0;
                current.trialSuccesses = 0;
                current.halfOpenEpoch += 1;
              }
              log(
                value ? 'Circuit breaker enabled - starts CLOSED' : 'Circuit breaker disabled - every call goes to the dependency',
                'info',
              );
            }}
            description="Off: every call waits for the timeout before failing"
          />
          <Slider
            label="Downstream failure rate"
            value={failureRate}
            min={0}
            max={1}
            step={0.01}
            onChange={setFailureRate}
            format={(value) => formatPercent(value)}
            tone={failureRate > 0.5 ? 'danger' : 'warn'}
            hint="How often the payment service currently fails."
          />
          <Slider
            label="Trip threshold"
            value={threshold}
            min={10}
            max={90}
            step={5}
            onChange={setThreshold}
            format={(value) => `${value}% failures`}
            hint="Failure ratio over the last 20 calls that opens the circuit."
          />
          <Slider
            label="Cooldown"
            value={cooldown}
            min={1}
            max={30}
            onChange={setCooldown}
            format={(value) => `${value} s`}
            hint="How long the circuit stays open before probing."
          />
          <Slider
            label="Call timeout"
            value={timeout}
            min={200}
            max={10000}
            step={100}
            onChange={setTimeoutMs}
            format={(value) => formatLatency(value)}
            hint="What a failing call costs when the breaker is not protecting you."
          />
          <Slider
            label="Request rate"
            value={requestRate}
            min={1}
            max={60}
            onChange={setRequestRate}
            format={(value) => `${value} req/sec`}
          />
          <div className="rounded-xl border border-line bg-elevated p-3">
            <p className="label mb-2">Rolling window</p>
            <Meter
              value={windowRatio}
              threshold={threshold / 100}
              label={`${windowFailures}/${current.window.length} failed`}
              tone={windowRatio * 100 >= threshold ? 'danger' : 'ok'}
            />
            {current.breaker === 'open' ? (
              <p className="mt-2 font-mono text-[11px] text-warn">
                cooldown {(cooldownLeft / 1000).toFixed(1)}s remaining
              </p>
            ) : null}
          </div>
        </>
      }
    >
      <DiagramCanvas layout={LAYOUT} edges={edges} particles={particleViews} height={480} className="bg-canvas">
        <ArchNode kind="client" title="Client" subtitle={`${requestRate} req/sec`} placed={LAYOUT.client} compact />
        <ArchNode kind="server" title="API Service" subtitle="the caller" placed={LAYOUT.api} compact>
          <NodeStatRow label="Avg latency" value={formatLatency(avgLatency)} tone={avgLatency > 800 ? 'text-danger' : 'text-ok'} />
        </ArchNode>
        <ArchNode
          kind="api-gateway"
          title="Circuit Breaker"
          subtitle={breakerEnabled ? `threshold ${threshold}%` : 'disabled'}
          placed={LAYOUT.breaker}
          status={!breakerEnabled ? 'down' : current.breaker === 'open' ? 'degraded' : 'healthy'}
          alert={current.breaker === 'half-open'}
          badge={<Badge tone={meta.tone}>{meta.label}</Badge>}
        >
          <NodeStatRow label="Window" value={`${windowFailures}/${current.window.length}`} />
          <NodeStatRow label="Short-circuit" value={formatNumber(current.shortCircuited)} tone="text-warn" />
        </ArchNode>
        <ArchNode
          kind="service"
          title="Payment Service"
          subtitle="the dependency"
          placed={LAYOUT.payment}
          status={failureRate > 0.5 ? 'down' : failureRate > 0.15 ? 'degraded' : 'healthy'}
        >
          <NodeStatRow label="Failing" value={formatPercent(failureRate)} tone={failureRate > 0.3 ? 'text-danger' : 'text-ok'} />
          <NodeStatRow label="Timeout" value={formatLatency(timeout)} />
        </ArchNode>
        <ArchNode kind="cache" title="Fallback" subtitle="cached / default response" placed={LAYOUT.fallback} compact>
          <NodeStatRow label="Served" value={formatNumber(current.shortCircuited)} />
        </ArchNode>
      </DiagramCanvas>
      <p className="px-4 pb-3 pt-1 text-[11px] text-faint">
        Total calls: {formatNumber(total)} - a breaker without a meaningful fallback only moves the error, it does not
        remove it.
      </p>
    </LabShell>
  );
}

/**
 * One call in the recent-calls strip. The shapes match the particle legend
 * (circle, cross, triangle), so the result is never carried by colour alone.
 */
function CallGlyph({ result }: { result: CallRecord['result'] }) {
  return (
    <svg
      width={12}
      height={12}
      viewBox="-6 -6 12 12"
      role="img"
      aria-label={result}
      className={cn(result === 'ok' ? 'text-ok' : result === 'fail' ? 'text-danger' : 'text-warn')}
    >
      <title>{result}</title>
      {result === 'ok' ? (
        <circle r={4.5} fill="currentColor" />
      ) : result === 'fail' ? (
        <g stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
          <line x1={-4} y1={-4} x2={4} y2={4} />
          <line x1={-4} y1={4} x2={4} y2={-4} />
        </g>
      ) : (
        <polygon points="0,-5 5,4 -5,4" fill="currentColor" />
      )}
    </svg>
  );
}

export default CircuitBreakerLab;
