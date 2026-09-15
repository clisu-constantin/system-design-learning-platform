import { useCallback, useState } from 'react';
import { CloudOff, Cloud } from 'lucide-react';
import { ArchNode, DiagramCanvas, NodeStatRow, type DiagramEdge, type Layout } from '@/components/architecture';
import { Insight, LabShell, MetricsPanel } from '@/components/learning';
import { Badge, Button, SegmentedControl } from '@/components/ui';
import { useEventLog } from '@/simulations/engine';
import { cn } from '@/utils/cn';

type Choice = 'cp' | 'ap';

interface WriteResult {
  id: number;
  node: 'a' | 'b';
  accepted: boolean;
  note: string;
}

const LAYOUT: Layout = {
  clientA: { x: 70, y: 40, w: 160, h: 70 },
  clientB: { x: 730, y: 40, w: 160, h: 70 },
  nodeA: { x: 110, y: 210, w: 210, h: 140 },
  nodeB: { x: 640, y: 210, w: 210, h: 140 },
};

export function CapTheoremLab() {
  const [choice, setChoice] = useState<Choice>('cp');
  const [partitioned, setPartitioned] = useState(false);
  const [valueA, setValueA] = useState(1);
  const [valueB, setValueB] = useState(1);
  const [version, setVersion] = useState(1);
  const [writes, setWrites] = useState<WriteResult[]>([]);
  const { events, log, clear } = useEventLog(30);

  const reset = useCallback(() => {
    setPartitioned(false);
    setValueA(1);
    setValueB(1);
    setVersion(1);
    setWrites([]);
    clear();
  }, [clear]);

  const write = useCallback(
    (node: 'a' | 'b') => {
      const next = version + 1;
      if (!partitioned) {
        setValueA(next);
        setValueB(next);
        setVersion(next);
        setWrites((list) => [{ id: next, node, accepted: true, note: 'replicated to both nodes' }, ...list].slice(0, 8));
        log(`Write v${next} on node ${node.toUpperCase()} - replicated normally`, 'ok');
        return;
      }

      if (choice === 'cp') {
        const isMajority = node === 'a';
        if (isMajority) {
          setValueA(next);
          setVersion(next);
          setWrites((list) => [{ id: next, node, accepted: true, note: 'majority side accepted' }, ...list].slice(0, 8));
          log(`Write v${next} accepted on node A (majority side)`, 'ok');
        } else {
          setWrites((list) =>
            [{ id: next, node, accepted: false, note: 'rejected: minority side cannot reach quorum' }, ...list].slice(0, 8),
          );
          log('Write on node B REJECTED - minority side cannot guarantee consistency', 'danger');
        }
      } else {
        if (node === 'a') setValueA(next);
        else setValueB(next);
        setVersion(next);
        setWrites((list) =>
          [{ id: next, node, accepted: true, note: 'accepted locally - will need reconciliation' }, ...list].slice(0, 8),
        );
        log(`Write v${next} accepted on node ${node.toUpperCase()} - the two sides now disagree`, 'warn');
      }
    },
    [choice, partitioned, version, log],
  );

  const heal = useCallback(() => {
    setPartitioned(false);
    if (choice === 'ap' && valueA !== valueB) {
      const winner = Math.max(valueA, valueB);
      const loser = Math.min(valueA, valueB);
      setValueA(winner);
      setValueB(winner);
      log(`Partition healed. Conflict resolved by last-write-wins: v${winner} kept, v${loser} silently discarded`, 'danger');
    } else {
      setValueA(Math.max(valueA, valueB));
      setValueB(Math.max(valueA, valueB));
      log('Partition healed. Both nodes converge - no conflicts to resolve', 'ok');
    }
  }, [choice, valueA, valueB, log]);

  const diverged = valueA !== valueB;

  const edges: DiagramEdge[] = [
    { from: 'clientA', to: 'nodeA', tone: 'brand' },
    { from: 'clientB', to: 'nodeB', tone: partitioned && choice === 'cp' ? 'danger' : 'brand' },
    {
      from: 'nodeA',
      to: 'nodeB',
      tone: partitioned ? 'danger' : 'ok',
      dashed: partitioned,
      label: partitioned ? 'X NETWORK PARTITION X' : 'replication',
    },
  ];

  return (
    <LabShell
      title="CAP Theorem Lab"
      description="Partition the network, then try to write on both sides. The system must pick: refuse the write, or accept it and diverge."
      onReset={reset}
      events={events}
      actions={
        <Button
          variant={partitioned ? 'success' : 'danger'}
          onClick={() => {
            if (partitioned) heal();
            else {
              setPartitioned(true);
              log('Network partition: node A and node B can no longer reach each other', 'danger');
            }
          }}
        >
          {partitioned ? <Cloud className="h-4 w-4" /> : <CloudOff className="h-4 w-4" />}
          {partitioned ? 'Heal partition' : 'Create partition'}
        </Button>
      }
      insight={
        <Insight title={partitioned ? `Partitioned - behaving as ${choice.toUpperCase()}` : 'Healthy network'}>
          {!partitioned ? (
            <>
              With no partition there is no dilemma: writes replicate and every reader sees the same value. CAP only
              forces a choice while the network is split - which is why it describes behaviour during failure, not a
              permanent label for a system.
            </>
          ) : choice === 'cp' ? (
            <>
              A CP system keeps one truth: only the majority side accepts writes, and the minority side returns errors.
              Clients on node B are unavailable, but nothing diverges and no write is ever lost or contradicted. This is
              what you want for payments, inventory and unique constraints.
            </>
          ) : (
            <>
              An AP system keeps answering on both sides. Nobody sees an error - but the two nodes now hold different
              values, and someone has to decide which one wins when the partition heals. Last-write-wins is simple and
              silently throws away the other update.
            </>
          )}
        </Insight>
      }
      metrics={
        <>
          <MetricsPanel
            items={[
              { key: 'a', label: 'Node A value', value: `v${valueA}`, tone: 'brand', hint: 'Value stored on the majority side.' },
              { key: 'b', label: 'Node B value', value: `v${valueB}`, tone: diverged ? 'danger' : 'brand', hint: 'Value stored on the minority side.' },
              {
                key: 'consistent',
                label: 'Consistent',
                value: diverged ? 'No' : 'Yes',
                tone: diverged ? 'danger' : 'ok',
                hint: 'Do both nodes agree on the current value?',
              },
              {
                key: 'available',
                label: 'Both sides writable',
                value: partitioned && choice === 'cp' ? 'No' : 'Yes',
                tone: partitioned && choice === 'cp' ? 'warn' : 'ok',
                hint: 'Can a client on either node complete a write right now?',
              },
              { key: 'writes', label: 'Writes attempted', value: writes.length },
            ]}
          />

          <div className="card p-4">
            <p className="label mb-3">The triangle</p>
            <pre className="ascii">{`               Consistency
                    ^
                   / \\
        ${choice === 'cp' ? '>> CP <<' : '   CP   '}  /   \\
                 /     \\
                /       \\   ${choice === 'ap' ? '>> AP <<' : '   AP   '}
               v---------v
   Availability            Partition tolerance

Networks partition, so "CA" is not an option for a
distributed system - you are choosing CP or AP.`}</pre>
          </div>

          <div className="card p-4">
            <p className="label mb-3">Write attempts</p>
            {writes.length === 0 ? (
              <p className="text-sm text-muted">Send a write on either node to see what the system does.</p>
            ) : (
              <ul className="space-y-1.5 font-mono text-[11px]">
                {writes.map((item) => (
                  <li key={`${item.id}-${item.node}-${item.note}`} className={item.accepted ? 'text-muted' : 'text-danger'}>
                    <span className="text-faint">node {item.node.toUpperCase()}</span> write v{item.id}{' '}
                    <Badge tone={item.accepted ? 'ok' : 'danger'} className="ml-1">
                      {item.accepted ? '200 OK' : '503 Unavailable'}
                    </Badge>{' '}
                    <span className="text-faint">{item.note}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      }
      controls={
        <>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted">During a partition, prefer</p>
            <SegmentedControl
              value={choice}
              className="w-full"
              size="sm"
              options={[
                { value: 'cp', label: 'CP - consistency' },
                { value: 'ap', label: 'AP - availability' },
              ]}
              onChange={(value) => {
                setChoice(value);
                log(
                  value === 'cp'
                    ? 'CP: reject writes the system cannot make safely'
                    : 'AP: accept writes everywhere and reconcile later',
                  'info',
                );
              }}
            />
            <p className="text-[11px] text-faint">
              {choice === 'cp'
                ? 'Reject the request and preserve a single truth.'
                : 'Accept the request and allow temporary inconsistency.'}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted">Send a write</p>
            <Button className="w-full justify-center" onClick={() => write('a')}>
              Write on node A (majority)
            </Button>
            <Button className="w-full justify-center" onClick={() => write('b')}>
              Write on node B (minority)
            </Button>
          </div>

          <div className="rounded-xl border border-line bg-elevated p-3 text-[11px] text-muted">
            <p className="label mb-2">Where this shows up</p>
            <ul className="space-y-1">
              <li>CP: ZooKeeper, etcd, Spanner, most relational primaries</li>
              <li>AP: Cassandra and DynamoDB at low quorum, DNS, CDNs</li>
              <li>Tunable: many stores let you choose per query</li>
            </ul>
          </div>
        </>
      }
    >
      <DiagramCanvas layout={LAYOUT} edges={edges} height={400} className="bg-canvas">
        <ArchNode kind="client" title="Client (region A)" placed={LAYOUT.clientA} compact />
        <ArchNode kind="client" title="Client (region B)" placed={LAYOUT.clientB} compact />
        <ArchNode
          kind="sql"
          title="Node A"
          subtitle="majority side"
          placed={LAYOUT.nodeA}
          status={partitioned ? 'degraded' : 'healthy'}
        >
          <NodeStatRow label="Value" value={`v${valueA}`} tone="text-brand" />
          <NodeStatRow label="Writes" value={partitioned && choice === 'cp' ? 'accepted' : 'accepted'} tone="text-ok" />
        </ArchNode>
        <ArchNode
          kind="sql"
          title="Node B"
          subtitle="minority side"
          placed={LAYOUT.nodeB}
          status={partitioned ? (choice === 'cp' ? 'down' : 'degraded') : 'healthy'}
          alert={diverged}
        >
          <NodeStatRow label="Value" value={`v${valueB}`} tone={diverged ? 'text-danger' : 'text-brand'} />
          <NodeStatRow
            label="Writes"
            value={partitioned && choice === 'cp' ? 'rejected' : 'accepted'}
            tone={partitioned && choice === 'cp' ? 'text-danger' : 'text-ok'}
          />
        </ArchNode>

        {partitioned ? (
          <div
            className={cn(
              'absolute left-1/2 top-[250px] -translate-x-1/2 rounded-lg border border-danger bg-surface px-3 py-1.5',
              'font-mono text-[11px] font-semibold text-danger',
            )}
          >
            X NETWORK PARTITION X
          </div>
        ) : null}
      </DiagramCanvas>
    </LabShell>
  );
}

export default CapTheoremLab;
