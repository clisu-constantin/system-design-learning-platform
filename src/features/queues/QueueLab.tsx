import { useCallback, useRef, useState } from 'react';
import { ArchNode, DiagramCanvas, NodeStatRow, spread, type DiagramEdge, type Layout, type ParticleView } from '@/components/architecture';
import { LiveChart } from '@/components/charts';
import { Insight, LabShell, MetricsPanel } from '@/components/learning';
import { Meter, Slider, Stepper, Toggle } from '@/components/ui';
import { advanceParticles, nextParticleId, useEventLog, useSeries, useTicker, type Particle } from '@/simulations/engine';
import { useRerender } from '@/hooks/useRerender';
import { clamp, sampleArrivals } from '@/utils/math';
import { formatLatency, formatNumber } from '@/utils/format';

interface State {
  depth: number;
  produced: number;
  consumed: number;
  rejected: number;
  particles: Particle[];
  /** Fractional message carried between frames so slow rates still work. */
  carry: number;
}

const createState = (): State => ({
  depth: 0,
  produced: 0,
  consumed: 0,
  rejected: 0,
  particles: [],
  carry: 0,
});

export function QueueLab() {
  const [running, setRunning] = useState(true);
  const [producerRate, setProducerRate] = useState(100);
  const [workers, setWorkers] = useState(3);
  const [workerRate, setWorkerRate] = useState(20);
  const [bounded, setBounded] = useState(true);
  const [maxDepth, setMaxDepth] = useState(500);

  const state = useRef<State>(createState());
  const rerender = useRerender(30);
  const { events, log, clear } = useEventLog();
  const { points, push, reset: resetSeries } = useSeries(60, 400);
  const warned = useRef(false);
  /** Set while the depth is over a bound that shrank under it, so the event is logged once. */
  const overBound = useRef(false);

  const reset = useCallback(() => {
    state.current = createState();
    warned.current = false;
    overBound.current = false;
    clear();
    resetSeries();
  }, [clear, resetSeries]);

  const consumerRate = workers * workerRate;

  useTicker(running, (dt) => {
    const current = state.current;
    const now = performance.now();

    // A bound lowered under the current depth keeps the excess (a broker refuses
    // new publishes, it does not delete accepted messages) and says so once.
    if (bounded && current.depth > maxDepth) {
      if (!overBound.current) {
        overBound.current = true;
        warned.current = true;
        log(
          `Queue is over its new bound (${formatNumber(current.depth)} > ${formatNumber(maxDepth)}) - refusing new messages until it drains`,
          'warn',
        );
      }
    } else {
      overBound.current = false;
    }

    // Produce
    const produced = sampleArrivals(producerRate, dt);
    for (let index = 0; index < produced; index += 1) {
      if (bounded && current.depth >= maxDepth) {
        current.rejected += 1;
        if (!warned.current) {
          warned.current = true;
          log(`Queue full at ${maxDepth} - producers receive backpressure (429)`, 'danger');
        }
        continue;
      }
      current.depth += 1;
      current.produced += 1;
      if (current.particles.length < 60) {
        current.particles.push({
          id: nextParticleId(),
          route: ['producer', 'queue'],
          leg: 0,
          t: 0,
          speed: 1.6,
          outcome: 'success',
        });
      }
    }

    // Consume
    const capacity = consumerRate * dt + current.carry;
    const whole = Math.floor(capacity);
    current.carry = capacity - whole;
    const consumed = Math.min(whole, current.depth);
    current.depth -= consumed;
    current.consumed += consumed;

    for (let index = 0; index < Math.min(consumed, 6); index += 1) {
      current.particles.push({
        id: nextParticleId(),
        route: ['queue', `w${index % workers}`],
        leg: 0,
        t: 0,
        speed: 1.4,
        outcome: 'cache-hit',
      });
    }

    if (current.depth < maxDepth * 0.8) warned.current = false;

    const { alive } = advanceParticles(current.particles, dt);
    current.particles = alive.slice(-70);

    push(
      {
        depth: current.depth,
        producerRate,
        consumerRate,
      },
      now,
    );
    rerender();
  });

  const current = state.current;
  const deficit = producerRate - consumerRate;
  // Waiting time for a message entering now = depth / consumption rate.
  const waitSeconds = consumerRate > 0 ? current.depth / consumerRate : Infinity;
  // Workers are saturated whenever there is a backlog to pull from; only once
  // the queue is empty does arrival rate decide how busy they are.
  const workerBusy =
    consumerRate > 0 ? (current.depth > 0 ? 1 : clamp(producerRate / consumerRate, 0, 1)) : 0;

  // At 8 workers a 106px box clipped "Worker 8" to "Worke...": the title needs
  // about 110px. A tighter 8px gap keeps a row of 8 x 110px inside the 960px canvas.
  const workerGap = 8;
  const workerWidth = Math.max(110, Math.min(150, (920 - (workers - 1) * workerGap) / workers));
  const xs = spread(workers, 480, workerWidth, workerGap);
  const layout: Layout = {
    producer: { x: 380, y: 14, w: 200, h: 68 },
    queue: { x: 300, y: 150, w: 360, h: 120 },
  };
  for (let index = 0; index < workers; index += 1) {
    layout[`w${index}`] = { x: xs[index], y: 360, w: workerWidth, h: 110 };
  }

  const edges: DiagramEdge[] = [
    { from: 'producer', to: 'queue', tone: 'brand', width: 2 },
    ...Array.from({ length: workers }, (_, index) => ({
      from: 'queue',
      to: `w${index}`,
      tone: 'ok' as const,
    })),
  ];

  const particleViews: ParticleView[] = current.particles
    .filter((particle) => layout[particle.route[particle.leg + 1]])
    .map((particle) => ({
      id: particle.id,
      from: particle.route[particle.leg],
      to: particle.route[particle.leg + 1],
      t: particle.t,
      outcome: particle.outcome ?? 'success',
    }));

  // Visual queue: one dot per ~2% of capacity, capped so the row stays readable.
  const dots = clamp(Math.round((current.depth / Math.max(maxDepth, 1)) * 40), 0, 40);

  return (
    <LabShell
      title="Message Queue Lab"
      description="Producers on one side, workers on the other. The queue absorbs a burst - it cannot absorb a permanent deficit."
      running={running}
      onToggleRun={() => setRunning((value) => !value)}
      onReset={reset}
      events={events}
      insight={
        <Insight>
          {deficit > 0 ? (
            <>
              Producers send {producerRate} msg/sec, {workers} workers consume {consumerRate} msg/sec. The queue grows
              by {deficit} msg/sec and a message entering now waits about{' '}
              {Number.isFinite(waitSeconds) ? `${Math.round(waitSeconds)}s` : 'forever'}. Add workers, make each worker
              faster, or produce less - a bigger queue only delays the problem and makes the backlog worse.
            </>
          ) : current.depth > 0 ? (
            <>
              Consumption ({consumerRate} msg/sec) exceeds production ({producerRate} msg/sec), so the backlog is
              draining. This is what a queue is for: it turned a spike into a delay instead of dropped work.
            </>
          ) : (
            <>
              The queue is empty and workers are idle - consumption capacity exceeds arrivals. That headroom is what
              lets the system absorb the next burst without users noticing.
            </>
          )}
        </Insight>
      }
      metrics={
        <>
          <MetricsPanel
            items={[
              {
                key: 'queueDepth',
                label: 'Queue depth',
                value: formatNumber(current.depth),
                tone: current.depth > maxDepth * 0.7 ? 'danger' : current.depth > 10 ? 'warn' : 'ok',
              },
              { key: 'producerRate', label: 'Produced', value: producerRate, unit: 'msg/s', tone: 'brand', hint: 'Messages entering the queue per second.' },
              {
                key: 'consumerRate',
                label: 'Capacity',
                value: consumerRate,
                unit: 'msg/s',
                tone: consumerRate >= producerRate ? 'ok' : 'danger',
                hint: 'Total processing capacity: workers x per-worker rate.',
              },
              {
                key: 'latency',
                label: 'Wait time',
                value: Number.isFinite(waitSeconds) ? formatLatency(waitSeconds * 1000) : 'unbounded',
                tone: waitSeconds > 5 ? 'danger' : 'neutral',
                hint: 'How long a message entering now waits before being processed: queue depth divided by capacity.',
                simulated: true,
              },
              {
                key: 'rejected',
                label: 'Rejected',
                value: formatNumber(current.rejected),
                tone: current.rejected > 0 ? 'danger' : 'ok',
                hint: 'Messages refused because the bounded queue was full - this is backpressure.',
              },
              { key: 'consumedTotal', label: 'Processed', value: formatNumber(current.consumed), hint: 'Total messages successfully processed.' },
            ]}
          />
          <div className="card p-4">
            <p className="label mb-3">Queue depth over time</p>
            <LiveChart data={points} series={[{ key: 'depth', label: 'Depth', color: 'warn' }]} height={150} />
            <p className="label mb-2 mt-4">Production vs worker capacity</p>
            <LiveChart
              data={points}
              series={[
                { key: 'producerRate', label: 'Produced/sec', color: 'brand' },
                { key: 'consumerRate', label: 'Capacity/sec', color: 'ok', dashed: true },
              ]}
              variant="line"
              height={140}
            />
          </div>
        </>
      }
      controls={
        <>
          <Slider
            label="Producer rate"
            value={producerRate}
            min={0}
            max={500}
            step={5}
            onChange={setProducerRate}
            format={(value) => `${value} msg/sec`}
            tone={deficit > 0 ? 'danger' : 'brand'}
          />
          <Stepper label="Workers" value={workers} min={1} max={8} onChange={setWorkers} hint="Consumers pulling from the queue." />
          <Slider
            label="Worker speed"
            value={workerRate}
            min={1}
            max={100}
            onChange={setWorkerRate}
            format={(value) => `${value} msg/sec each`}
            hint="How fast one worker processes messages."
          />
          <Toggle
            label="Bounded queue"
            checked={bounded}
            onChange={setBounded}
            description="Off: unbounded buffering - a memory leak with a timer"
          />
          <Slider
            label="Max depth"
            value={maxDepth}
            min={50}
            max={5000}
            step={50}
            onChange={setMaxDepth}
            disabled={!bounded}
            format={(value) => `${formatNumber(value)} messages`}
            hint="When the queue is full, producers are rejected instead of buffered."
          />
          <div className="rounded-xl border border-line bg-elevated p-3">
            <p className="label mb-2">Capacity balance</p>
            <Meter
              value={consumerRate > 0 ? clamp(producerRate / consumerRate, 0, 1.4) : 1}
              label={`${producerRate} in / ${consumerRate} out`}
              tone={deficit > 0 ? 'danger' : 'ok'}
            />
            <p className="mt-2 text-[11px] text-faint">
              Stable when consumption is at least production. Everything else is a backlog with a start time.
            </p>
          </div>
        </>
      }
    >
      <DiagramCanvas layout={layout} edges={edges} particles={particleViews} height={495} className="bg-canvas">
        <ArchNode kind="server" title="Producer" subtitle={`${producerRate} msg/sec`} placed={layout.producer} compact>
          <NodeStatRow label="Rejected" value={formatNumber(current.rejected)} tone={current.rejected ? 'text-danger' : 'text-ok'} />
        </ArchNode>

        <ArchNode
          kind="queue"
          title="Message Queue"
          subtitle={bounded ? `bounded at ${formatNumber(maxDepth)}` : 'unbounded'}
          placed={layout.queue}
          alert={bounded && current.depth > maxDepth * 0.8}
          status={bounded && current.depth >= maxDepth ? 'degraded' : 'healthy'}
        >
          <NodeStatRow label="Depth" value={formatNumber(current.depth)} tone={current.depth > 100 ? 'text-warn' : 'text-ink'} />
          <div className="flex flex-wrap gap-1 pt-1" aria-hidden>
            {Array.from({ length: dots }, (_, index) => (
              <span
                key={index}
                className={`h-2 w-2 rounded-full ${
                  index > 32 ? 'bg-danger' : index > 24 ? 'bg-warn' : 'bg-brand'
                }`}
              />
            ))}
            {dots === 0 ? <span className="text-[10px] text-faint">empty</span> : null}
          </div>
        </ArchNode>

        {Array.from({ length: workers }, (_, index) => (
          <ArchNode key={index} kind="worker" title={`Worker ${index + 1}`} placed={layout[`w${index}`]} compact>
            <NodeStatRow label="Rate" value={`${workerRate}/s`} />
            <Meter label="Busy" value={workerBusy} size="xs" showValue={false} />
          </ArchNode>
        ))}
      </DiagramCanvas>
    </LabShell>
  );
}

export default QueueLab;
