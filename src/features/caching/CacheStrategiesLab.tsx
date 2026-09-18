import { useCallback, useMemo, useRef, useState } from 'react';
import { ArchNode, DiagramCanvas, NodeStatRow, type DiagramEdge, type Layout, type ParticleView } from '@/components/architecture';
import { Insight, LabShell, TradeOffTable } from '@/components/learning';
import { SegmentedControl, Slider } from '@/components/ui';
import { useTicker } from '@/simulations/engine';
import { useRerender } from '@/hooks/useRerender';
import type { RequestOutcome } from '@/types';
// Imported directly: this lab is its own lazy chunk, and it needs the full trade-offs, not the index.
import { performanceConcepts } from '@/data/concepts/performance';

type Strategy = 'cache-aside' | 'read-through' | 'write-through' | 'write-behind' | 'write-around';
type Operation = 'read' | 'write';

interface Step {
  from: string;
  to: string;
  label: string;
  outcome: RequestOutcome;
  /** Rendered under the diagram while this step is active. */
  note: string;
  async?: boolean;
}

const LAYOUT: Layout = {
  app: { x: 90, y: 200, w: 180, h: 96 },
  cache: { x: 390, y: 90, w: 190, h: 110 },
  db: { x: 390, y: 320, w: 190, h: 110 },
  client: { x: 700, y: 200, w: 170, h: 96 },
};

const STRATEGIES: { value: Strategy; label: string }[] = [
  { value: 'cache-aside', label: 'Cache aside' },
  { value: 'read-through', label: 'Read through' },
  { value: 'write-through', label: 'Write through' },
  { value: 'write-behind', label: 'Write behind' },
  { value: 'write-around', label: 'Write around' },
];

const FLOWS: Record<Strategy, Record<Operation, Step[]>> = {
  'cache-aside': {
    read: [
      { from: 'app', to: 'cache', label: 'GET key', outcome: 'success', note: 'The application asks the cache first.' },
      { from: 'cache', to: 'app', label: 'MISS', outcome: 'warning', note: 'Nothing cached - the application must go to the database itself.' },
      { from: 'app', to: 'db', label: 'SELECT', outcome: 'success', note: 'The application queries the source of truth.' },
      { from: 'db', to: 'app', label: 'row', outcome: 'success', note: 'The row comes back.' },
      { from: 'app', to: 'cache', label: 'SET key', outcome: 'cache-hit', note: 'The application populates the cache for next time. This step is what makes it "aside".' },
      { from: 'app', to: 'client', label: '200 OK', outcome: 'success', note: 'Response returned. The next read for this key is a hit.' },
    ],
    write: [
      { from: 'app', to: 'db', label: 'UPDATE', outcome: 'success', note: 'Writes go directly to the database.' },
      { from: 'app', to: 'cache', label: 'DEL key', outcome: 'warning', note: 'The cached copy is invalidated. Forgetting this step is the classic stale-data bug.' },
      { from: 'app', to: 'client', label: '200 OK', outcome: 'success', note: 'Next read misses and reloads the fresh value.' },
    ],
  },
  'read-through': {
    read: [
      { from: 'app', to: 'cache', label: 'GET key', outcome: 'success', note: 'The application only ever talks to the cache.' },
      { from: 'cache', to: 'db', label: 'load on miss', outcome: 'warning', note: 'The cache itself loads from the database - the application never sees the miss.' },
      { from: 'db', to: 'cache', label: 'row', outcome: 'success', note: 'The cache stores the value.' },
      { from: 'cache', to: 'app', label: 'value', outcome: 'cache-hit', note: 'One code path for hits and misses - less duplicated logic than cache-aside.' },
      { from: 'app', to: 'client', label: '200 OK', outcome: 'success', note: 'Response returned.' },
    ],
    write: [
      { from: 'app', to: 'db', label: 'UPDATE', outcome: 'success', note: 'Read-through says nothing about writes - pair it with a write strategy.' },
      { from: 'app', to: 'client', label: '200 OK', outcome: 'success', note: 'The cache will reload the value on the next read after expiry or invalidation.' },
    ],
  },
  'write-through': {
    read: [
      { from: 'app', to: 'cache', label: 'GET key', outcome: 'success', note: 'Reads hit the cache.' },
      { from: 'cache', to: 'app', label: 'HIT', outcome: 'cache-hit', note: 'Because every write populated the cache, written keys are always present.' },
      { from: 'app', to: 'client', label: '200 OK', outcome: 'success', note: 'Fast, and never stale for keys that were written through.' },
    ],
    write: [
      { from: 'app', to: 'cache', label: 'SET key', outcome: 'success', note: 'The write goes to the cache first.' },
      { from: 'cache', to: 'db', label: 'UPDATE (sync)', outcome: 'success', note: 'The cache writes through to the database synchronously - the caller waits for both.' },
      { from: 'db', to: 'cache', label: 'ack', outcome: 'success', note: 'Only after the database confirms is the write considered done.' },
      { from: 'app', to: 'client', label: '200 OK', outcome: 'success', note: 'Consistent, but every write now pays cache latency plus database latency.' },
    ],
  },
  'write-behind': {
    read: [
      { from: 'app', to: 'cache', label: 'GET key', outcome: 'success', note: 'Reads hit the cache.' },
      { from: 'cache', to: 'app', label: 'HIT', outcome: 'cache-hit', note: 'The cache may hold values the database has not received yet.' },
      { from: 'app', to: 'client', label: '200 OK', outcome: 'success', note: 'Fast reads, but the database is temporarily behind.' },
    ],
    write: [
      { from: 'app', to: 'cache', label: 'SET key', outcome: 'success', note: 'The write lands in the cache.' },
      { from: 'app', to: 'client', label: '200 OK (fast)', outcome: 'success', note: 'The caller is acknowledged immediately - this is why write-behind is fast.' },
      { from: 'cache', to: 'db', label: 'flush (async)', outcome: 'warning', async: true, note: 'The cache flushes to the database later, often batched. If the cache dies first, that write is gone.' },
    ],
  },
  'write-around': {
    read: [
      { from: 'app', to: 'cache', label: 'GET key', outcome: 'success', note: 'Reads check the cache.' },
      { from: 'cache', to: 'app', label: 'MISS', outcome: 'warning', note: 'Recently written keys are not cached, so the first read always misses.' },
      { from: 'app', to: 'db', label: 'SELECT', outcome: 'success', note: 'The value is loaded from the database.' },
      { from: 'app', to: 'cache', label: 'SET key', outcome: 'cache-hit', note: 'Now it is cached - populated by reads, not by writes.' },
      { from: 'app', to: 'client', label: '200 OK', outcome: 'success', note: 'Response returned.' },
    ],
    write: [
      { from: 'app', to: 'db', label: 'INSERT', outcome: 'success', note: 'The write goes straight to the database, bypassing the cache entirely.' },
      { from: 'app', to: 'client', label: '201 Created', outcome: 'success', note: 'The cache is never polluted with write-once data that nobody reads.' },
    ],
  },
};

export function CacheStrategiesLab() {
  const [running, setRunning] = useState(true);
  const [strategy, setStrategy] = useState<Strategy>('cache-aside');
  const [operation, setOperation] = useState<Operation>('read');
  const [speed, setSpeed] = useState(0.8);
  const progress = useRef({ step: 0, t: 0 });
  const rerender = useRerender(30);

  const steps = FLOWS[strategy][operation];

  const reset = useCallback(() => {
    progress.current = { step: 0, t: 0 };
    rerender();
  }, [rerender]);

  useTicker(running, (dt) => {
    const current = progress.current;
    current.t += dt * speed;
    if (current.t >= 1.35) {
      current.t = 0;
      current.step = (current.step + 1) % steps.length;
    }
    rerender();
  });

  const active = steps[Math.min(progress.current.step, steps.length - 1)];

  const edges = useMemo<DiagramEdge[]>(() => {
    const unique = new Map<string, DiagramEdge>();
    for (const step of steps) {
      const key = `${step.from}->${step.to}`;
      unique.set(key, {
        from: step.from,
        to: step.to,
        tone: step === active ? 'brand' : 'muted',
        dashed: step.async,
        animated: step === active,
        label: step === active ? step.label : undefined,
      });
    }
    return [...unique.values()];
  }, [steps, active]);

  const particles: ParticleView[] = [
    {
      id: 1,
      from: active.from,
      to: active.to,
      t: Math.min(1, progress.current.t),
      outcome: active.outcome,
    },
  ];

  const concept = performanceConcepts.find((item) => item.slug === 'cache-strategies');

  return (
    <LabShell
      title="Cache Strategies Lab"
      description="Step through the exact sequence of hops for each strategy, for both reads and writes."
      running={running}
      onToggleRun={() => setRunning((value) => !value)}
      onReset={reset}
      insight={
        <Insight title={`Step ${progress.current.step + 1} of ${steps.length}`}>
          <strong className="text-ink">{active.label}:</strong> {active.note}
        </Insight>
      }
      metrics={
        <>
          <div className="card p-4">
            <p className="label mb-3">Sequence</p>
            <ol className="space-y-1.5">
              {steps.map((step, index) => (
                <li
                  key={`${step.from}-${step.to}-${index}`}
                  className={`flex items-start gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${
                    index === progress.current.step ? 'bg-brand/10 text-ink' : 'text-muted'
                  }`}
                >
                  <span className="mt-0.5 font-mono text-[11px] text-faint">{index + 1}</span>
                  <span className="font-mono text-xs text-brand">
                    {step.from} {'->'} {step.to}
                  </span>
                  <span className="flex-1">{step.label}</span>
                  {step.async ? <span className="text-[10px] uppercase text-warn">async</span> : null}
                </li>
              ))}
            </ol>
          </div>
          {concept?.tradeoffs ? (
            <div className="card p-4">
              <p className="label mb-3">Trade-offs</p>
              <TradeOffTable tradeoffs={concept.tradeoffs} />
            </div>
          ) : null}
        </>
      }
      controls={
        <>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted">Strategy</p>
            <div className="space-y-1.5">
              {STRATEGIES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    setStrategy(item.value);
                    progress.current = { step: 0, t: 0 };
                  }}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors ${
                    strategy === item.value
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-line text-muted hover:border-brand/50 hover:text-ink'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted">Operation</p>
            <SegmentedControl
              value={operation}
              size="sm"
              options={[
                { value: 'read', label: 'Read' },
                { value: 'write', label: 'Write' },
              ]}
              onChange={(value) => {
                setOperation(value);
                progress.current = { step: 0, t: 0 };
              }}
              className="w-full"
            />
          </div>
          <Slider
            label="Animation speed"
            value={speed}
            min={0.2}
            max={2}
            step={0.1}
            onChange={setSpeed}
            format={(value) => `${value.toFixed(1)}x`}
          />
          <button
            type="button"
            onClick={() => {
              progress.current = {
                step: (progress.current.step + 1) % steps.length,
                t: 0,
              };
              setRunning(false);
              rerender();
            }}
            className="w-full rounded-xl border border-line px-3 py-2 text-xs font-medium text-ink transition-colors hover:border-brand hover:text-brand"
          >
            Step forward
          </button>
        </>
      }
    >
      <DiagramCanvas layout={LAYOUT} edges={edges} particles={particles} height={470} className="bg-canvas">
        <ArchNode kind="server" title="Application" subtitle="your code" placed={LAYOUT.app}>
          <NodeStatRow label="Strategy" value={STRATEGIES.find((item) => item.value === strategy)?.label ?? ''} />
        </ArchNode>
        <ArchNode kind="cache" title="Cache" subtitle="Redis" placed={LAYOUT.cache}>
          <NodeStatRow label="Latency" value="~4 ms" />
        </ArchNode>
        <ArchNode kind="sql" title="Database" subtitle="source of truth" placed={LAYOUT.db}>
          <NodeStatRow label="Latency" value="~120 ms" />
        </ArchNode>
        <ArchNode kind="client" title="Caller" subtitle="waiting for the response" placed={LAYOUT.client} compact />
      </DiagramCanvas>
    </LabShell>
  );
}

export default CacheStrategiesLab;
