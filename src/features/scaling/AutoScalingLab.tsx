import { useCallback, useRef, useState } from 'react';
import { TrendingUp, Zap } from 'lucide-react';
import {
  ArchNode,
  DiagramCanvas,
  NodeStatRow,
  spread,
  type DiagramEdge,
  type Layout,
} from '@/components/architecture';
import { LiveChart } from '@/components/charts';
import { Insight, LabShell, MetricsPanel } from '@/components/learning';
import { Button, Meter, Slider, Toggle } from '@/components/ui';
import { useEventLog, useSeries, useTicker } from '@/simulations/engine';
import { computeLoad } from '@/simulations/models/load';
import { useRerender } from '@/hooks/useRerender';
import { clamp, smooth } from '@/utils/math';
import { formatLatency, formatNumber, formatPercent } from '@/utils/format';
import type { NodeStatus } from '@/types';

const SERVER_CAPACITY = 500;
const WARMUP_SECONDS = 4;

interface Instance {
  id: string;
  name: string;
  status: NodeStatus;
  readyAt: number | null;
}

interface AutoScaleState {
  instances: Instance[];
  elapsed: number;
  cooldownUntil: number;
  cpu: number;
  nextId: number;
  /** Seconds the signal has been continuously above/below the threshold. */
  aboveFor: number;
  belowFor: number;
}

const newInstance = (id: number, ready: boolean, now: number): Instance => ({
  id: `i${id}`,
  name: `api-${id}`,
  status: ready ? 'healthy' : 'starting',
  readyAt: ready ? null : now + WARMUP_SECONDS * 1000,
});

const initialState = (): AutoScaleState => ({
  instances: [newInstance(1, true, 0)],
  elapsed: 0,
  cooldownUntil: 0,
  cpu: 0,
  nextId: 2,
  aboveFor: 0,
  belowFor: 0,
});

/** Traffic curve: a calm start, a steep ramp, a plateau, then a drop. */
function trafficAt(seconds: number, peak: number) {
  const cycle = seconds % 60;
  if (cycle < 8) return peak * 0.08;
  if (cycle < 20) return peak * (0.08 + ((cycle - 8) / 12) * 0.92);
  if (cycle < 38) return peak;
  if (cycle < 46) return peak * (1 - ((cycle - 38) / 8) * 0.85);
  return peak * 0.15;
}

export function AutoScalingLab() {
  const [running, setRunning] = useState(true);
  const [peak, setPeak] = useState(4000);
  const [scaleOut, setScaleOut] = useState(70);
  const [scaleIn, setScaleIn] = useState(30);
  const [cooldown, setCooldown] = useState(8);
  const [autoScale, setAutoScale] = useState(true);
  const [maxInstances, setMaxInstances] = useState(8);

  const state = useRef<AutoScaleState>(initialState());
  const rerender = useRerender(20);
  const { events, log, clear } = useEventLog(60);
  const { points, push, reset: resetSeries } = useSeries(80, 400);

  const reset = useCallback(() => {
    state.current = initialState();
    clear();
    resetSeries();
  }, [clear, resetSeries]);

  const addInstance = useCallback(
    (reason: string) => {
      const current = state.current;
      if (current.instances.length >= maxInstances) return;
      const now = performance.now();
      const instance = newInstance(current.nextId, false, now);
      current.nextId += 1;
      current.instances.push(instance);
      current.cooldownUntil = now + cooldown * 1000;
      log(`${reason} - launching instance ${instance.name}`, 'warn');
    },
    [cooldown, log, maxInstances],
  );

  useTicker(running, (dt) => {
    const current = state.current;
    const now = performance.now();
    current.elapsed += dt;

    for (const instance of current.instances) {
      if (instance.status === 'starting' && instance.readyAt && now >= instance.readyAt) {
        instance.status = 'healthy';
        instance.readyAt = null;
        log(`${instance.name} health check passed`, 'ok');
        log(`${instance.name} added to the load balancer pool`, 'ok');
      }
    }

    const ready = current.instances.filter((instance) => instance.status === 'healthy');
    const traffic = trafficAt(current.elapsed, peak);
    const capacity = Math.max(1, ready.length) * SERVER_CAPACITY;
    const load = computeLoad(traffic, capacity, { baseLatencyMs: 45, kneeAt: 0.65 });
    current.cpu = smooth(current.cpu, load.cpu, 0.12);

    const cpuPercent = current.cpu * 100;
    if (cpuPercent > scaleOut) {
      current.aboveFor += dt;
      current.belowFor = 0;
    } else if (cpuPercent < scaleIn) {
      current.belowFor += dt;
      current.aboveFor = 0;
    } else {
      current.aboveFor = 0;
      current.belowFor = 0;
    }

    if (autoScale && now >= current.cooldownUntil) {
      if (current.aboveFor > 1.5 && current.instances.length < maxInstances) {
        addInstance(`CPU ${Math.round(cpuPercent)}% > ${scaleOut}% threshold`);
        current.aboveFor = 0;
      } else if (current.belowFor > 4 && ready.length > 1) {
        const victim = current.instances.pop();
        if (victim) {
          current.cooldownUntil = now + cooldown * 1000;
          log(`CPU ${Math.round(cpuPercent)}% < ${scaleIn}% - terminating ${victim.name}`, 'info');
        }
        current.belowFor = 0;
      }
    }

    push(
      {
        traffic,
        capacity,
        cpu: cpuPercent,
        instances: current.instances.length,
        latency: load.latencyMs,
      },
      now,
    );
    rerender();
  });

  const current = state.current;
  const ready = current.instances.filter((instance) => instance.status === 'healthy');
  const traffic = trafficAt(current.elapsed, peak);
  const capacity = Math.max(1, ready.length) * SERVER_CAPACITY;
  const load = computeLoad(traffic, capacity, { baseLatencyMs: 45, kneeAt: 0.65 });

  const count = current.instances.length;
  const width = clamp((940 - (count - 1) * 10) / count, 94, 150);
  const xs = spread(count, 480, width, 10);
  const layout: Layout = {
    users: { x: 380, y: 16, w: 200, h: 62 },
    lb: { x: 370, y: 158, w: 220, h: 92 },
  };
  current.instances.forEach((instance, index) => {
    layout[instance.id] = { x: xs[index], y: 340, w: width, h: 112 };
  });

  const edges: DiagramEdge[] = [
    { from: 'users', to: 'lb', tone: 'brand', width: 2 },
    ...current.instances.map<DiagramEdge>((instance) => ({
      from: 'lb',
      to: instance.id,
      tone: instance.status === 'healthy' ? 'ok' : 'warn',
      dashed: instance.status !== 'healthy',
      animated: instance.status === 'healthy',
    })),
  ];

  return (
    <LabShell
      title="Auto Scaling Lab"
      description="Traffic follows a repeating spike. Set thresholds and cooldown, then watch the fleet chase the curve - always a little behind it."
      running={running}
      onToggleRun={() => setRunning((value) => !value)}
      onReset={reset}
      events={events}
      actions={
        <Button onClick={() => addInstance('Manual scale-out')} disabled={count >= maxInstances}>
          <Zap className="h-4 w-4" />
          Add instance now
        </Button>
      }
      insight={
        <Insight>
          {load.cpu > 0.9 ? (
            <>
              CPU is saturated and a new instance takes {WARMUP_SECONDS}s to boot and pass health checks. During that
              window users feel the spike regardless of the threshold - which is why headroom, queueing or load
              shedding matters more than an aggressive rule.
            </>
          ) : (
            <>
              Scale-out fires above {scaleOut}% and scale-in below {scaleIn}%, with a {cooldown}s cooldown between
              actions. Narrow the gap between those thresholds and the fleet starts flapping; widen the cooldown and it
              reacts too slowly. Both failure modes are visible on the chart.
            </>
          )}
        </Insight>
      }
      metrics={
        <>
          <MetricsPanel
            items={[
              { key: 'rps', label: 'Traffic', value: formatNumber(traffic), unit: 'req/s', tone: 'brand' },
              { key: 'utilization', label: 'Capacity', value: formatNumber(capacity), unit: 'req/s' },
              {
                key: 'cpu',
                label: 'Fleet CPU',
                value: formatPercent(current.cpu),
                tone: current.cpu * 100 > scaleOut ? 'warn' : 'ok',
              },
              { key: 'instances', label: 'Instances', value: `${ready.length}/${count}` },
              { key: 'latency', label: 'Latency', value: formatLatency(load.latencyMs) },
              {
                key: 'errorRate',
                label: 'Errors',
                value: formatPercent(load.errorRate, 1),
                tone: load.errorRate > 0 ? 'danger' : 'ok',
              },
            ]}
          />
          <div className="card p-4">
            <p className="label mb-3">Traffic vs capacity</p>
            <LiveChart
              data={points}
              series={[
                { key: 'traffic', label: 'Traffic', color: 'brand' },
                { key: 'capacity', label: 'Capacity', color: 'ok', dashed: true },
              ]}
              variant="line"
              height={160}
            />
            <p className="label mb-2 mt-4">CPU and instance count</p>
            <LiveChart
              data={points}
              series={[
                { key: 'cpu', label: 'CPU %', color: 'warn' },
                { key: 'instances', label: 'Instances', color: 'violet' },
              ]}
              variant="line"
              height={150}
            />
          </div>
        </>
      }
      controls={
        <>
          <Slider
            label="Peak traffic"
            value={peak}
            min={1000}
            max={10000}
            step={250}
            onChange={setPeak}
            format={(value) => `${formatNumber(value)} req/sec`}
            hint="The plateau the repeating traffic curve reaches."
          />
          <Toggle
            label="Auto scaling"
            checked={autoScale}
            onChange={setAutoScale}
            description="Turn off to see what a fixed fleet does with the same spike"
          />
          <Slider
            label="Scale out above"
            value={scaleOut}
            min={40}
            max={95}
            onChange={(value) => setScaleOut(Math.max(value, scaleIn + 10))}
            format={(value) => `${value}% CPU`}
            tone="warn"
            hint="Sustained CPU above this for 1.5s triggers a new instance."
          />
          <Slider
            label="Scale in below"
            value={scaleIn}
            min={5}
            max={60}
            onChange={(value) => setScaleIn(Math.min(value, scaleOut - 10))}
            format={(value) => `${value}% CPU`}
            tone="ok"
            hint="Sustained CPU below this for 4s removes an instance."
          />
          <Slider
            label="Cooldown"
            value={cooldown}
            min={2}
            max={30}
            onChange={setCooldown}
            format={(value) => `${value} s`}
            hint="Minimum time between two scaling actions. Prevents flapping."
          />
          <Slider
            label="Max instances"
            value={maxInstances}
            min={2}
            max={8}
            onChange={setMaxInstances}
            format={(value) => `${value}`}
            hint="Upper bound so a traffic bug cannot scale you to bankruptcy."
          />
          <div className="rounded-xl border border-line bg-elevated p-3">
            <p className="label mb-2">Signal</p>
            <Meter value={current.cpu} threshold={scaleOut / 100} label="Fleet CPU vs scale-out threshold" />
            <p className="mt-2 text-[11px] text-faint">Warm-up: {WARMUP_SECONDS}s before an instance serves traffic.</p>
          </div>
        </>
      }
    >
      <DiagramCanvas layout={layout} edges={edges} height={475} className="bg-canvas">
        <ArchNode
          kind="client"
          title="Traffic generator"
          subtitle={`${formatNumber(traffic)} req/sec`}
          placed={layout.users}
          compact
        />
        <ArchNode kind="load-balancer" title="Load Balancer" subtitle="auto scaling group" placed={layout.lb}>
          <NodeStatRow label="In pool" value={ready.length} />
          <NodeStatRow label="Warming up" value={count - ready.length} tone="text-warn" />
        </ArchNode>
        {current.instances.map((instance) => (
          <ArchNode
            key={instance.id}
            kind="server"
            title={instance.name}
            placed={layout[instance.id]}
            status={instance.status}
            alert={instance.status === 'healthy' && current.cpu > 0.9}
          >
            <Meter label="CPU" value={instance.status === 'healthy' ? current.cpu : 0} size="xs" />
            <NodeStatRow
              label="State"
              value={instance.status === 'starting' ? 'booting' : 'serving'}
              tone={instance.status === 'starting' ? 'text-warn' : 'text-ok'}
            />
          </ArchNode>
        ))}
      </DiagramCanvas>
      <div className="flex items-center gap-2 px-4 pb-3 pt-1 text-[11px] text-faint">
        <TrendingUp className="h-3.5 w-3.5" />
        Traffic repeats on a 60-second cycle: ramp, plateau, drop.
      </div>
    </LabShell>
  );
}

export default AutoScalingLab;
