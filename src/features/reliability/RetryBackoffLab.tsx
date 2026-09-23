import { useCallback, useMemo, useState } from 'react';
import { Play } from 'lucide-react';
import { LiveChart } from '@/components/charts';
import { Insight, LabShell, MetricsPanel } from '@/components/learning';
import { Button, SegmentedControl, Slider, Toggle } from '@/components/ui';
import { formatLatency, formatNumber } from '@/utils/format';
import { cn } from '@/utils/cn';
import { mulberry32 } from '@/utils/math';
import type { LabFocus, LabProps } from '@/types';
import { BUCKET_MS, FAILURE_WINDOW_MS, delayFor, simulateFleetLoad, type Strategy } from './retryLoadModel';

const STRATEGIES: { value: Strategy; label: string }[] = [
  { value: 'immediate', label: 'Immediate retry' },
  { value: 'fixed', label: 'Fixed delay' },
  { value: 'exponential', label: 'Exponential backoff' },
];

interface Setup {
  strategy: Strategy;
  baseMs: number;
  maxAttempts: number;
  jitter: boolean;
  failureRate: number;
  clients: number;
}

/** What the lab opens on at /labs/retry-backoff, with no Lab focus. */
const DEFAULT_SETUP: Setup = {
  strategy: 'exponential',
  baseMs: 1000,
  maxAttempts: 5,
  jitter: true,
  failureRate: 0.7,
  clients: 2000,
};

/**
 * The Lab focus of each Concept that hosts this lab. Retry opens on immediate
 * retries, so the first thing the learner sees is the retry storm; Exponential
 * backoff opens on the cure, backoff with jitter.
 */
const FOCUS_SETUPS: Record<LabFocus<'retry-backoff'>, Setup> = {
  'no-backoff': { ...DEFAULT_SETUP, strategy: 'immediate', jitter: false },
  // The same as the default today, on purpose: spelled out so it stays the cure if the default moves.
  'backoff-jitter': { ...DEFAULT_SETUP, strategy: 'exponential', jitter: true },
};

const SEED = 7;

interface Attempt {
  index: number;
  delayMs: number;
  startMs: number;
  success: boolean;
}

export function RetryBackoffLab({ focus }: LabProps<'retry-backoff'>) {
  // The page keys this lab by Concept, so the focus never changes under a mounted lab.
  const start = focus ? FOCUS_SETUPS[focus] : DEFAULT_SETUP;
  // Every control lives in one object, so Reset cannot miss one.
  const [setup, setSetup] = useState(start);
  const { strategy, baseMs, maxAttempts, jitter, failureRate, clients } = setup;
  const change =
    <K extends keyof Setup>(key: K) =>
    (value: Setup[K]) =>
      setSetup((current) => ({ ...current, [key]: value }));
  const [seed, setSeed] = useState(SEED);

  /** One request's attempt timeline, deterministic per seed so it can be replayed. */
  const attempts = useMemo<Attempt[]>(() => {
    const random = mulberry32(seed);
    const list: Attempt[] = [];
    let clock = 0;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const delay = delayFor(strategy, attempt, baseMs, jitter, random);
      clock += delay;
      const success = random() > failureRate;
      list.push({ index: attempt, delayMs: delay, startMs: clock, success });
      clock += 120; // the attempt itself
      if (success) break;
    }
    return list;
  }, [strategy, baseMs, maxAttempts, jitter, failureRate, seed]);

  const succeeded = attempts.some((attempt) => attempt.success);
  const totalTime = attempts.length ? attempts[attempts.length - 1].startMs + 120 : 0;

  /**
   * Retry load the failing service sees from the whole fleet after a correlated
   * failure, plus the same run with jitter flipped so the insight can compare.
   */
  const { fleet, otherPeak } = useMemo(() => {
    const input = { strategy, baseMs, maxAttempts, failureRate, clients, seed };
    return {
      fleet: simulateFleetLoad({ ...input, jitter }),
      otherPeak: simulateFleetLoad({ ...input, jitter: !jitter }).peak,
    };
  }, [strategy, baseMs, maxAttempts, jitter, failureRate, clients, seed]);
  const loadSeries = fleet.series;
  const peakLoad = fleet.peak;
  const capacity = fleet.capacity;

  const replay = useCallback(() => setSeed((value) => value + 1), []);

  return (
    <LabShell
      title="Retry and Exponential Backoff Lab"
      description="One request retrying, and what happens when thousands of clients retry the same way at the same time."
      onReset={() => {
        // Back to this Concept's starting setup, not the lab's global default.
        setSetup(start);
        setSeed(SEED);
      }}
      actions={
        <Button variant="primary" onClick={replay}>
          <Play className="h-4 w-4" />
          Replay with new randomness
        </Button>
      }
      insight={
        <Insight>
          {maxAttempts <= 1 ? (
            <>
              With a cap of one attempt nobody retries: every client sees the failure and stops, so the failing
              service gets no retry load at all. Raise Max attempts to see what each retry policy adds.
            </>
          ) : strategy === 'immediate' ? (
            <>
              Immediate retries give up no time at all. All {formatNumber(clients)} clients failed within{' '}
              {FAILURE_WINDOW_MS} ms of each other and fire every retry back to back, so the failing service sees a peak
              of {formatNumber(peakLoad)} requests/sec against {formatNumber(capacity)} of capacity - the retries are
              now the outage. This is a retry storm.
            </>
          ) : !jitter ? (
            <>
              Backoff without jitter still leaves every client synchronised: they all failed within {FAILURE_WINDOW_MS}{' '}
              ms of each other, so they all wait the same {baseMs} ms and retry together - each wave is a spike on the
              chart, peaking at {formatNumber(peakLoad)} requests/sec.{' '}
              {otherPeak < peakLoad ? (
                <>
                  Turn jitter on and the same total volume spreads out, to a peak of about {formatNumber(otherPeak)}{' '}
                  requests/sec.
                </>
              ) : (
                <>
                  At a {baseMs} ms base delay jitter has little room to spread them - raise the base delay, then
                  compare jitter on and off.
                </>
              )}
            </>
          ) : otherPeak > peakLoad ? (
            <>
              Full jitter spreads the same retries over time: peak load drops to about {formatNumber(peakLoad)}{' '}
              requests/sec, down from {formatNumber(otherPeak)} without jitter, which gives the dependency room to
              recover. The individual request waits longer - {formatLatency(totalTime)} in this run - which is the price
              of not making the outage worse.
            </>
          ) : (
            <>
              With a {baseMs} ms base delay, jitter has almost no room to work: the delays are about as short as the
              window the clients failed in, and full jitter halves the average wait, so retries arrive sooner. Peak is{' '}
              {formatNumber(peakLoad)} requests/sec with jitter against {formatNumber(otherPeak)} without. Raise the base
              delay and jitter starts to flatten the waves.
            </>
          )}
        </Insight>
      }
      metrics={
        <>
          <MetricsPanel
            items={[
              { key: 'attempts', label: 'Attempts used', value: attempts.length, hint: 'Attempts before success or giving up.' },
              {
                key: 'outcome',
                label: 'Outcome',
                value: succeeded ? 'Success' : 'Gave up',
                tone: succeeded ? 'ok' : 'danger',
                hint: 'Whether this request eventually got an answer.',
              },
              { key: 'total', label: 'Total time', value: formatLatency(totalTime), tone: totalTime > 10000 ? 'warn' : 'neutral' },
              {
                key: 'peak',
                label: 'Peak fleet load',
                value: formatNumber(peakLoad),
                unit: 'req/s',
                tone: peakLoad > capacity ? 'danger' : 'ok',
                hint: `Highest retry rate the failing service sees, counted in ${BUCKET_MS} ms buckets.`,
                simulated: true,
              },
              {
                key: 'amplification',
                label: 'Load amplification',
                value: `${(peakLoad / Math.max(clients, 1)).toFixed(2)}x`,
                tone: peakLoad / clients > 1 ? 'danger' : 'ok',
                hint: `Peak retry rate divided by the normal load, taken as one request per client per second. A burst packed into one ${BUCKET_MS} ms bucket reads high on purpose - that is what the failing service feels.`,
                simulated: true,
              },
            ]}
          />

          <div className="card p-4">
            <p className="label mb-3">Attempt timeline (one request)</p>
            <ol className="space-y-2">
              {attempts.map((attempt) => (
                <li key={attempt.index} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 font-mono text-[11px] text-faint">attempt {attempt.index}</span>
                  <span
                    className="h-4 shrink-0 rounded-sm bg-line"
                    style={{ width: `${Math.min(70, (attempt.delayMs / 1000) * 12)}%`, minWidth: attempt.delayMs ? 8 : 0 }}
                    title={`waited ${Math.round(attempt.delayMs)} ms`}
                  />
                  <span
                    className={cn(
                      'rounded px-2 py-0.5 font-mono text-[11px]',
                      attempt.success ? 'bg-ok/15 text-ok' : 'bg-danger/15 text-danger',
                    )}
                  >
                    {attempt.success ? '200 OK' : '503'}
                  </span>
                  <span className="font-mono text-[11px] text-faint">
                    {attempt.delayMs > 0 ? `waited ${(attempt.delayMs / 1000).toFixed(2)}s` : 'no wait'}
                  </span>
                  <span className="ml-auto font-mono text-[11px] text-muted">t+{(attempt.startMs / 1000).toFixed(2)}s</span>
                </li>
              ))}
            </ol>
            {!succeeded ? (
              <p className="mt-3 text-xs text-danger">
                Gave up after {maxAttempts} attempts. Without a cap, a client can retry forever against a dependency
                that is never coming back.
              </p>
            ) : null}
          </div>

          <div className="card p-4">
            <p className="label mb-3">Retry load on the failing service ({formatNumber(clients)} clients, first 20 s)</p>
            <LiveChart
              data={loadSeries}
              series={[
                { key: 'load', label: 'Retries/sec', color: strategy === 'immediate' ? 'danger' : 'brand' },
                { key: 'capacity', label: 'Capacity', color: 'ok', dashed: true },
              ]}
              variant="line"
              height={180}
            />
            <p className="mt-2 text-xs text-faint">
              Same number of clients and the same failure rate in every scenario - only the retry policy changes.
              Simplified model, not a measurement: the dependency goes down and the first request of every client fails
              within the same {FAILURE_WINDOW_MS} ms, each retry fails at the chosen rate, retries are counted in{' '}
              {BUCKET_MS} ms buckets and shown per second, and capacity is assumed to be 60% of the client count.
            </p>
          </div>
        </>
      }
      controls={
        <>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted">Retry strategy</p>
            <div className="space-y-1.5">
              {STRATEGIES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => change('strategy')(item.value)}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors',
                    strategy === item.value
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-line text-muted hover:border-brand/50 hover:text-ink',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <Toggle
            label="Jitter"
            checked={jitter}
            onChange={change('jitter')}
            description="Randomise each delay between 0 and the computed value"
            disabled={strategy === 'immediate'}
          />
          <Slider
            label="Base delay"
            value={baseMs}
            min={100}
            max={5000}
            step={100}
            onChange={change('baseMs')}
            disabled={strategy === 'immediate'}
            format={(value) => `${value} ms`}
            hint="First delay. Exponential doubles it on each subsequent attempt."
          />
          <Slider
            label="Max attempts"
            value={maxAttempts}
            min={1}
            max={8}
            onChange={change('maxAttempts')}
            format={(value) => `${value} attempts`}
            hint="Always cap retries - an uncapped client is a denial-of-service tool."
          />
          <Slider
            label="Failure rate"
            value={failureRate}
            min={0}
            max={0.95}
            step={0.05}
            onChange={change('failureRate')}
            format={(value) => `${Math.round(value * 100)}%`}
            tone="danger"
          />
          <Slider
            label="Concurrent clients"
            value={clients}
            min={100}
            max={20000}
            step={100}
            onChange={change('clients')}
            format={(value) => formatNumber(value)}
            hint={`They all fail within ${FAILURE_WINDOW_MS} ms of each other and retry with the same policy.`}
          />
          {/* Immediate retries have no delay to randomise; the Jitter toggle above is
              disabled then, so this shortcut is hidden instead of doing nothing. */}
          {strategy !== 'immediate' ? (
            <SegmentedControl
              size="sm"
              className="w-full"
              value={jitter ? 'jitter' : 'none'}
              options={[
                { value: 'none', label: 'No jitter' },
                { value: 'jitter', label: 'Full jitter' },
              ]}
              onChange={(value) => change('jitter')(value === 'jitter')}
            />
          ) : null}
        </>
      }
    >
      <div className="p-5">
        <pre className="ascii">{policySketch(strategy, baseMs, maxAttempts, jitter)}</pre>
      </div>
    </LabShell>
  );
}

/**
 * The fixed-width sketch above the metrics. It draws the policy for a request
 * that succeeds on its fourth attempt, but never more attempts than the cap
 * allows - with a cap below four the sketch ends in a give-up instead.
 */
function policySketch(strategy: Strategy, baseMs: number, maxAttempts: number, jitter: boolean) {
  const shown = Math.min(maxAttempts, 4);
  const lines = ['Client                          Failing service'];
  for (let attempt = 1; attempt <= shown; attempt += 1) {
    const result = attempt === 4 ? '200 OK' : attempt === shown ? '503  (cap reached, give up)' : '503';
    lines.push(`  |-- attempt ${attempt} -----------------> ${result}`);
    if (attempt < shown) {
      const wait = strategy === 'immediate' ? 0 : strategy === 'fixed' ? baseMs : baseMs * 2 ** (attempt - 1);
      lines.push(`  |      wait ${Math.min(wait, 30000)} ms`);
    }
  }
  lines.push('');
  if (strategy === 'immediate') {
    lines.push('Immediate retries do not wait at all, so every client retries in lockstep.');
  } else if (jitter) {
    lines.push('With full jitter each wait is a random value between 0 and the delay above,');
    lines.push('so clients that failed together do not retry together.');
  } else {
    lines.push('Without jitter every client waits exactly the same amount and retries in lockstep.');
  }
  return lines.join('\n');
}

export default RetryBackoffLab;
