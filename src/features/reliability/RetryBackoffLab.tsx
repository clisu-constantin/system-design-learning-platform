import { useCallback, useMemo, useState } from 'react';
import { Play } from 'lucide-react';
import { LiveChart } from '@/components/charts';
import { Insight, LabShell, MetricsPanel } from '@/components/learning';
import { Button, SegmentedControl, Slider, Toggle } from '@/components/ui';
import { formatLatency, formatNumber } from '@/utils/format';
import { cn } from '@/utils/cn';
import { mulberry32 } from '@/utils/math';

type Strategy = 'immediate' | 'fixed' | 'exponential';

const STRATEGIES: { value: Strategy; label: string }[] = [
  { value: 'immediate', label: 'Immediate retry' },
  { value: 'fixed', label: 'Fixed delay' },
  { value: 'exponential', label: 'Exponential backoff' },
];

interface Attempt {
  index: number;
  delayMs: number;
  startMs: number;
  success: boolean;
}

/** Delay before attempt n (1-based), in milliseconds. */
function delayFor(strategy: Strategy, attempt: number, baseMs: number, jitter: boolean, random: () => number) {
  if (attempt <= 1) return 0;
  if (strategy === 'immediate') return 0;
  const raw = strategy === 'fixed' ? baseMs : baseMs * 2 ** (attempt - 2);
  const capped = Math.min(raw, 30000);
  return jitter ? capped * random() : capped;
}

export function RetryBackoffLab() {
  const [strategy, setStrategy] = useState<Strategy>('exponential');
  const [baseMs, setBaseMs] = useState(1000);
  const [maxAttempts, setMaxAttempts] = useState(5);
  const [jitter, setJitter] = useState(true);
  const [failureRate, setFailureRate] = useState(0.7);
  const [clients, setClients] = useState(2000);
  const [seed, setSeed] = useState(7);

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

  /** Load the failing service sees, second by second, from all retrying clients. */
  const loadSeries = useMemo(() => {
    const buckets = 20;
    const points: { t: number; load: number; capacity: number }[] = [];
    const random = mulberry32(seed + 1);
    const arrivals = new Array<number>(buckets).fill(0);

    for (let client = 0; client < Math.min(clients, 3000); client += 1) {
      let clock = random() * 1000;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        clock += delayFor(strategy, attempt, baseMs, jitter, random);
        const bucket = Math.floor(clock / 1000);
        if (bucket >= 0 && bucket < buckets) arrivals[bucket] += 1;
        if (random() > failureRate) break;
      }
    }

    const scale = clients / Math.min(clients, 3000);
    for (let index = 0; index < buckets; index += 1) {
      points.push({ t: index, load: Math.round(arrivals[index] * scale), capacity: clients * 0.6 });
    }
    return points;
  }, [strategy, baseMs, maxAttempts, jitter, failureRate, clients, seed]);

  const peakLoad = Math.max(...loadSeries.map((point) => point.load));
  const capacity = clients * 0.6;

  const replay = useCallback(() => setSeed((value) => value + 1), []);

  return (
    <LabShell
      title="Retry and Exponential Backoff Lab"
      description="One request retrying, and what happens when thousands of clients retry the same way at the same time."
      onReset={() => {
        setSeed(7);
        setStrategy('exponential');
      }}
      actions={
        <Button variant="primary" onClick={replay}>
          <Play className="h-4 w-4" />
          Replay with new randomness
        </Button>
      }
      insight={
        <Insight>
          {strategy === 'immediate' ? (
            <>
              Immediate retries give up no time at all. With {formatNumber(clients)} clients retrying, the failing
              service sees a peak of {formatNumber(peakLoad)} requests/sec against {formatNumber(capacity)} of
              capacity - the retries are now the outage. This is a retry storm.
            </>
          ) : !jitter ? (
            <>
              Backoff without jitter still leaves every client synchronised: they all failed at the same moment, so
              they all wait the same {baseMs} ms and retry together. The peak is {formatNumber(peakLoad)} requests/sec.
              Turn jitter on and watch the same total volume spread out.
            </>
          ) : (
            <>
              Exponential delays with full jitter spread retries over time: peak load drops to about{' '}
              {formatNumber(peakLoad)} requests/sec, which gives the dependency room to recover. The individual request
              waits longer - {formatLatency(totalTime)} in this run - which is the price of not making the outage worse.
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
                hint: 'Highest per-second load the failing service sees from all retrying clients.',
              },
              {
                key: 'amplification',
                label: 'Load amplification',
                value: `${(peakLoad / Math.max(clients, 1)).toFixed(2)}x`,
                tone: peakLoad / clients > 1 ? 'danger' : 'ok',
                hint: 'Peak load divided by the original client count.',
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
            <p className="label mb-3">Load on the failing service ({formatNumber(clients)} clients)</p>
            <LiveChart
              data={loadSeries}
              series={[
                { key: 'load', label: 'Requests/sec', color: strategy === 'immediate' ? 'danger' : 'brand' },
                { key: 'capacity', label: 'Capacity', color: 'ok', dashed: true },
              ]}
              variant="line"
              height={180}
            />
            <p className="mt-2 text-xs text-faint">
              Same number of clients and the same failure rate in every scenario - only the retry policy changes.
              Simplified model, not a measurement: every attempt fails at the chosen rate, and capacity is assumed to
              be 60% of the client count.
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
                  onClick={() => setStrategy(item.value)}
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
            onChange={setJitter}
            description="Randomise each delay between 0 and the computed value"
            disabled={strategy === 'immediate'}
          />
          <Slider
            label="Base delay"
            value={baseMs}
            min={100}
            max={5000}
            step={100}
            onChange={setBaseMs}
            disabled={strategy === 'immediate'}
            format={(value) => `${value} ms`}
            hint="First delay. Exponential doubles it on each subsequent attempt."
          />
          <Slider
            label="Max attempts"
            value={maxAttempts}
            min={1}
            max={8}
            onChange={setMaxAttempts}
            format={(value) => `${value} attempts`}
            hint="Always cap retries - an uncapped client is a denial-of-service tool."
          />
          <Slider
            label="Failure rate"
            value={failureRate}
            min={0}
            max={0.95}
            step={0.05}
            onChange={setFailureRate}
            format={(value) => `${Math.round(value * 100)}%`}
            tone="danger"
          />
          <Slider
            label="Concurrent clients"
            value={clients}
            min={100}
            max={20000}
            step={100}
            onChange={setClients}
            format={(value) => formatNumber(value)}
            hint="Every one of them retries with the same policy at roughly the same time."
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
              onChange={(value) => setJitter(value === 'jitter')}
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
