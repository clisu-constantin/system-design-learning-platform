import { useCallback, useRef, useState } from 'react';
import { Power, RotateCw, ShieldAlert } from 'lucide-react';
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
import { Insight, LabShell, MetricsPanel } from '@/components/learning';
import { Button, SegmentedControl, Slider } from '@/components/ui';
import {
  advanceParticles,
  nextParticleId,
  RateCounter,
  useEventLog,
  useTicker,
  type Particle,
} from '@/simulations/engine';
import { useRerender } from '@/hooks/useRerender';
import { sampleArrivals } from '@/utils/math';
import { formatLatency, formatNumber, formatPercent } from '@/utils/format';
import type { NodeStatus } from '@/types';

type Mode = 'async' | 'sync';

interface Node {
  id: string;
  name: string;
  role: 'primary' | 'replica';
  status: NodeStatus;
  /** Highest write version this node has applied. */
  applied: number;
  reads: number;
  staleReads: number;
}

interface State {
  nodes: Node[];
  version: number;
  particles: Particle[];
  writes: number;
  reads: number;
  staleReads: number;
  /**
   * Rolling copies of the two counters above, used for the stale percentage.
   * Switching sync/async or dragging the lag has to move that number now, not
   * once the lifetime average has been diluted enough to notice.
   */
  recentReads: RateCounter;
  recentStale: RateCounter;
  lostWrites: number;
  failoverAt: number | null;
  cursor: number;
  /** Pending async replication: [targetId, applyAt, version] */
  pending: { id: string; at: number; version: number }[];
}

const createState = (): State => ({
  nodes: [
    { id: 'primary', name: 'Primary', role: 'primary', status: 'healthy', applied: 0, reads: 0, staleReads: 0 },
    { id: 'r1', name: 'Replica 1', role: 'replica', status: 'healthy', applied: 0, reads: 0, staleReads: 0 },
    { id: 'r2', name: 'Replica 2', role: 'replica', status: 'healthy', applied: 0, reads: 0, staleReads: 0 },
    { id: 'r3', name: 'Replica 3', role: 'replica', status: 'healthy', applied: 0, reads: 0, staleReads: 0 },
  ],
  version: 0,
  particles: [],
  writes: 0,
  reads: 0,
  staleReads: 0,
  recentReads: new RateCounter(3000),
  recentStale: new RateCounter(3000),
  lostWrites: 0,
  failoverAt: null,
  cursor: 0,
  pending: [],
});

export function ReplicationLab() {
  const [running, setRunning] = useState(true);
  const [mode, setMode] = useState<Mode>('async');
  const [writeRate, setWriteRate] = useState(20);
  const [readRate, setReadRate] = useState(80);
  const [lagMs, setLagMs] = useState(400);
  const [readFromReplicas, setReadFromReplicas] = useState(true);

  const state = useRef<State>(createState());
  const rerender = useRerender(30);
  const { events, log, clear } = useEventLog(50);

  const reset = useCallback(() => {
    state.current = createState();
    clear();
  }, [clear]);

  const killNode = useCallback(
    (id: string) => {
      const current = state.current;
      const node = current.nodes.find((item) => item.id === id);
      if (!node || node.status === 'down') return;
      node.status = 'down';
      if (node.role === 'primary') {
        log('Primary unreachable - health checks failing', 'danger');
        current.failoverAt = performance.now() + 3000;
        // Writes still waiting to ship died with the primary. Letting them land
        // afterwards meant every replica caught up during the failover delay, so
        // "Lost writes" stayed 0 at any lag under ~2s - the opposite of the lesson.
        current.pending = [];
      } else {
        log(`${node.name} down - read capacity reduced`, 'warn');
      }
      rerender();
    },
    [log, rerender],
  );

  const reviveNode = useCallback(
    (id: string) => {
      const current = state.current;
      const node = current.nodes.find((item) => item.id === id);
      if (!node) return;
      node.status = 'healthy';
      // Compare against the other nodes: this one is already marked healthy, so
      // matching itself turned a recovered primary into a replica and left the
      // cluster with no primary until the pending failover promoted one.
      const otherPrimary = current.nodes.some(
        (item) => item !== node && item.role === 'primary' && item.status !== 'down',
      );
      if (node.role === 'primary' && !otherPrimary) {
        current.failoverAt = null;
        node.applied = current.version;
        log(`${node.name} recovered before failover - it stays the primary`, 'ok');
        rerender();
        return;
      }
      node.role = 'replica';
      node.applied = current.version;
      log(`${node.name} recovered and caught up as a replica`, 'ok');
      rerender();
    },
    [log, rerender],
  );

  useTicker(running, (dt) => {
    const current = state.current;
    const now = performance.now();

    // Failover: promote the most up-to-date replica.
    if (current.failoverAt && now >= current.failoverAt) {
      current.failoverAt = null;
      const candidates = current.nodes.filter((node) => node.role === 'replica' && node.status === 'healthy');
      if (candidates.length > 0) {
        const winner = candidates.reduce((best, node) => (node.applied > best.applied ? node : best), candidates[0]);
        const lost = current.version - winner.applied;
        current.lostWrites += Math.max(0, lost);
        // The failed primary is no longer the primary; if it comes back it
        // rejoins as a replica. Leaving it as 'primary' kept the dead node in
        // the diagram and hid the promoted one.
        for (const node of current.nodes) {
          if (node.role === 'primary') node.role = 'replica';
        }
        winner.role = 'primary';
        winner.name = `${winner.name} (promoted)`;
        current.version = winner.applied;
        log(`${winner.name} promoted to PRIMARY`, 'ok');
        if (lost > 0) {
          log(`${lost} acknowledged write(s) lost - async replication had not shipped them`, 'danger');
        } else {
          log('No writes lost - the promoted replica was fully caught up', 'ok');
        }
      } else {
        log('No healthy replica available to promote - the database is down', 'danger');
      }
    }

    const primary = current.nodes.find((node) => node.role === 'primary' && node.status === 'healthy');
    const replicas = current.nodes.filter((node) => node.role === 'replica' && node.status === 'healthy');

    // Writes
    const writes = sampleArrivals(writeRate, dt);
    for (let index = 0; index < writes; index += 1) {
      if (!primary) continue;
      current.version += 1;
      current.writes += 1;
      primary.applied = current.version;
      const version = current.version;

      current.particles.push({
        id: nextParticleId(),
        route: ['client', primary.id],
        leg: 0,
        t: 0,
        speed: 1.4,
        outcome: 'success',
      });

      for (const replica of replicas) {
        if (mode === 'sync') {
          replica.applied = version;
        } else {
          current.pending.push({ id: replica.id, at: now + lagMs * (0.7 + Math.random() * 0.6), version });
        }
        current.particles.push({
          id: nextParticleId(),
          route: [primary.id, replica.id],
          leg: 0,
          t: 0,
          speed: mode === 'sync' ? 1.6 : 900 / Math.max(120, lagMs),
          outcome: mode === 'sync' ? 'success' : 'warning',
        });
      }
    }

    // Apply pending async replication
    current.pending = current.pending.filter((item) => {
      if (now < item.at) return true;
      const replica = current.nodes.find((node) => node.id === item.id);
      if (replica && replica.status === 'healthy') replica.applied = Math.max(replica.applied, item.version);
      return false;
    });

    // Reads
    const reads = sampleArrivals(readRate, dt);
    const readTargets = readFromReplicas && replicas.length > 0 ? replicas : primary ? [primary] : [];
    for (let index = 0; index < reads; index += 1) {
      if (readTargets.length === 0) continue;
      current.cursor = (current.cursor + 1) % readTargets.length;
      const target = readTargets[current.cursor];
      const stale = target.applied < current.version;
      target.reads += 1;
      current.reads += 1;
      current.recentReads.add(1, now);
      if (stale) {
        target.staleReads += 1;
        current.staleReads += 1;
        current.recentStale.add(1, now);
      }
      current.particles.push({
        id: nextParticleId(),
        route: ['client', target.id],
        leg: 0,
        t: 0,
        speed: 1.5,
        outcome: stale ? 'warning' : 'cache-hit',
      });
    }

    const { alive } = advanceParticles(current.particles, dt);
    current.particles = alive.slice(-90);
    rerender();
  });

  const current = state.current;
  const primary = current.nodes.find((node) => node.role === 'primary');
  const replicas = current.nodes.filter((node) => node.role === 'replica');
  // One timestamp for both counters: reading them at two different instants
  // (the first read also starts each ring) put their buckets out of step, and
  // the stale share climbed past 100%.
  const renderNow = performance.now();
  const recentReadQps = current.recentReads.rate(renderNow);
  const staleRate = recentReadQps ? Math.min(1, current.recentStale.rate(renderNow) / recentReadQps) : 0;
  const writeLatency = mode === 'sync' ? 8 + lagMs * 0.25 : 8;

  const xs = spread(replicas.length, 480, 170, 30);
  const layout: Layout = {
    client: { x: 390, y: 16, w: 180, h: 58 },
  };
  if (primary) layout[primary.id] = { x: 370, y: 130, w: 220, h: 116 };
  replicas.forEach((replica, index) => {
    layout[replica.id] = { x: xs[index], y: 330, w: 170, h: 130 };
  });

  const edges: DiagramEdge[] = [
    ...(primary ? [{ from: 'client', to: primary.id, tone: 'brand' as const, width: 2, label: 'writes' }] : []),
    ...(primary
      ? replicas.map<DiagramEdge>((replica) => ({
          from: primary.id,
          to: replica.id,
          tone: replica.status === 'healthy' ? (mode === 'sync' ? 'ok' : 'warn') : 'muted',
          dashed: mode === 'async',
          label: mode === 'async' ? `lag ${lagMs} ms` : 'sync',
        }))
      : []),
    ...(readFromReplicas
      ? replicas
          .filter((replica) => replica.status === 'healthy')
          .map<DiagramEdge>((replica) => ({
            from: 'client',
            to: replica.id,
            tone: 'ok',
            curvature: 0.8,
          }))
      : []),
  ];

  const particleViews: ParticleView[] = current.particles
    .filter((particle) => layout[particle.route[particle.leg]] && layout[particle.route[particle.leg + 1]])
    .map((particle) => ({
      id: particle.id,
      from: particle.route[particle.leg],
      to: particle.route[particle.leg + 1],
      t: particle.t,
      outcome: particle.outcome ?? 'success',
    }));

  return (
    <LabShell
      title="Database Replication Lab"
      description="Writes go to the primary and stream to replicas. Watch replication lag create stale reads - then kill the primary and see what a failover costs."
      running={running}
      onToggleRun={() => setRunning((value) => !value)}
      onReset={reset}
      legend={<ParticleLegend outcomes={['success', 'cache-hit', 'warning']} />}
      events={events}
      actions={
        primary && primary.status === 'healthy' ? (
          <Button variant="danger" onClick={() => killNode(primary.id)}>
            <ShieldAlert className="h-4 w-4" />
            Kill primary
          </Button>
        ) : (
          <Button variant="success" onClick={() => reset()}>
            <RotateCw className="h-4 w-4" />
            Rebuild cluster
          </Button>
        )
      }
      insight={
        <Insight>
          {mode === 'async' ? (
            <>
              Asynchronous replication acknowledges the write as soon as the primary has it, so writes cost about{' '}
              {formatLatency(writeLatency)} - but replicas are up to {lagMs} ms behind, which is why{' '}
              {formatPercent(staleRate, 1)} of replica reads come from a replica that is behind the primary. Kill the primary and any write not yet shipped
              is lost on promotion.
            </>
          ) : (
            <>
              Synchronous replication waits for replicas before acknowledging, so no acknowledged write can be lost -
              but every write now pays about {formatLatency(writeLatency)}, and a slow replica slows every writer.
              Drag the network delay to replicas and watch write latency follow - that is the durability-versus-latency
              trade in one slider.
            </>
          )}
        </Insight>
      }
      metrics={
        <>
          <MetricsPanel
            items={[
              { key: 'writes', label: 'Writes', value: formatNumber(current.writes), hint: 'Total writes accepted by the primary.' },
              { key: 'reads', label: 'Reads', value: formatNumber(current.reads), hint: 'Total reads served.' },
              {
                key: 'staleReads',
                label: 'Reads behind',
                value: formatPercent(staleRate, 1),
                tone: staleRate > 0.05 ? 'warn' : 'ok',
                hint: 'Reads behind the primary: replica reads served while that replica had not yet applied the newest write. Simplified: the model treats the database as one key, so any lag counts. In a real system a read is only stale if it asks for a row that just changed, so the stale share is far lower.',
              },
              {
                key: 'replicationLag',
                label: 'Replication lag',
                value: mode === 'sync' ? '0 ms' : `${lagMs} ms`,
                tone: mode === 'sync' ? 'ok' : 'warn',
              },
              {
                key: 'latency',
                label: 'Write latency',
                value: formatLatency(writeLatency),
                tone: mode === 'sync' ? 'warn' : 'ok',
                hint: 'Time until the write is acknowledged. Simulated by a simplified model, not measured.',
              },
              {
                key: 'lost',
                label: 'Lost writes',
                value: formatNumber(current.lostWrites),
                tone: current.lostWrites > 0 ? 'danger' : 'ok',
                hint: 'Acknowledged writes that did not survive a failover.',
              },
            ]}
          />
          <div className="card p-4">
            <p className="label mb-3">Per-node state</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left font-mono text-[11px]">
                <thead className="text-faint">
                  <tr>
                    <th className="py-1.5 font-medium">node</th>
                    <th className="py-1.5 font-medium">role</th>
                    <th className="py-1.5 font-medium">status</th>
                    <th className="py-1.5 font-medium">applied version</th>
                    <th className="py-1.5 font-medium">behind</th>
                    <th className="py-1.5 font-medium">stale reads</th>
                  </tr>
                </thead>
                <tbody>
                  {current.nodes.map((node) => (
                    <tr key={node.id} className="border-t border-line">
                      <td className="py-1.5 text-ink">{node.name}</td>
                      <td className="py-1.5 text-muted">{node.role}</td>
                      <td className={`py-1.5 ${node.status === 'down' ? 'text-danger' : 'text-ok'}`}>{node.status}</td>
                      <td className="py-1.5 text-muted">{node.applied}</td>
                      <td className={`py-1.5 ${current.version - node.applied > 0 ? 'text-warn' : 'text-ok'}`}>
                        {Math.max(0, current.version - node.applied)}
                      </td>
                      <td className="py-1.5 text-muted">{node.staleReads}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      }
      controls={
        <>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted">Replication mode</p>
            <SegmentedControl
              value={mode}
              size="sm"
              className="w-full"
              options={[
                { value: 'async', label: 'Asynchronous' },
                { value: 'sync', label: 'Synchronous' },
              ]}
              onChange={(value) => {
                setMode(value);
                log(
                  value === 'sync'
                    ? 'Synchronous replication: writes wait for replicas'
                    : 'Asynchronous replication: writes acknowledge immediately',
                  'info',
                );
              }}
            />
          </div>
          <Slider
            label="Write rate"
            value={writeRate}
            min={1}
            max={200}
            onChange={setWriteRate}
            format={(value) => `${value} writes/sec`}
          />
          <Slider
            label="Read rate"
            value={readRate}
            min={1}
            max={500}
            onChange={setReadRate}
            format={(value) => `${value} reads/sec`}
          />
          <Slider
            label="Network delay to replicas"
            value={lagMs}
            min={50}
            max={3000}
            step={50}
            onChange={setLagMs}
            format={(value) => `${value} ms`}
            tone={lagMs > 1000 ? 'danger' : 'warn'}
            hint={
              mode === 'sync'
                ? 'Synchronous: every write waits for the replicas to confirm, so a slower network means slower writes (simplified model).'
                : 'Asynchronous: how long a change takes to reach a replica. This is the replication lag.'
            }
          />
          <div className="flex items-center justify-between gap-2 rounded-xl border border-line bg-elevated p-3">
            <span className="text-xs text-muted">Route reads to replicas</span>
            <SegmentedControl
              size="sm"
              value={readFromReplicas ? 'replicas' : 'primary'}
              options={[
                { value: 'replicas', label: 'Replicas' },
                { value: 'primary', label: 'Primary' },
              ]}
              onChange={(value) => setReadFromReplicas(value === 'replicas')}
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted">Failure injection</p>
            {current.nodes.map((node) => (
              <Button
                key={node.id}
                size="sm"
                variant={node.status === 'down' ? 'success' : 'secondary'}
                className="w-full justify-center"
                onClick={() => (node.status === 'down' ? reviveNode(node.id) : killNode(node.id))}
              >
                {node.status === 'down' ? <RotateCw className="h-3 w-3" /> : <Power className="h-3 w-3" />}
                {node.status === 'down' ? `Recover ${node.name}` : `Kill ${node.name}`}
              </Button>
            ))}
          </div>
        </>
      }
    >
      <DiagramCanvas layout={layout} edges={edges} particles={particleViews} height={490} className="bg-canvas">
        <ArchNode
          kind="client"
          title="Application"
          subtitle={`${writeRate} writes/s - ${readRate} reads/s`}
          placed={layout.client}
          compact
        />
        {primary ? (
          <ArchNode
            kind="sql"
            title={primary.name}
            subtitle="accepts all writes"
            placed={layout[primary.id]}
            status={primary.status}
          >
            <NodeStatRow label="Version" value={current.version} />
            <NodeStatRow label="Mode" value={mode === 'sync' ? 'synchronous' : 'asynchronous'} />
            <NodeStatRow label="Write latency" value={formatLatency(writeLatency)} />
          </ArchNode>
        ) : null}
        {replicas.map((replica) => {
          const behind = Math.max(0, current.version - replica.applied);
          return (
            <ArchNode
              key={replica.id}
              kind="sql"
              title={replica.name}
              subtitle="read-only"
              placed={layout[replica.id]}
              status={replica.status}
              alert={behind > 10}
            >
              <NodeStatRow label="Applied" value={replica.applied} />
              <NodeStatRow
                label="Behind"
                value={behind}
                tone={behind > 0 ? 'text-warn' : 'text-ok'}
              />
              <NodeStatRow label="Reads" value={formatNumber(replica.reads)} />
              <NodeStatRow
                label="Stale"
                value={formatNumber(replica.staleReads)}
                tone={replica.staleReads > 0 ? 'text-warn' : 'text-ok'}
              />
            </ArchNode>
          );
        })}
      </DiagramCanvas>
    </LabShell>
  );
}

export default ReplicationLab;
