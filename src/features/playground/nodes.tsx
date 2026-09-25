import { Handle, Position, type NodeProps } from 'reactflow';
import { NODE_KINDS } from '@/components/architecture';
import { Meter } from '@/components/ui';
import { HealthIndicator } from '@/components/architecture/HealthIndicator';
import { cn } from '@/utils/cn';
import { formatNumber } from '@/utils/format';
import type { NodeKind, NodeStatus } from '@/types';

export interface PlaygroundNodeData {
  kind: NodeKind;
  label: string;
  capacity: number;
  /** Live values written by the simulation. */
  load: number;
  status: NodeStatus;
  bottleneck: boolean;
}

/** A card's size in flow units: its fixed width, and its usual height with a load meter. Used to center new nodes. */
export const NODE_SIZE = { width: 190, height: 110 };

/**
 * React Flow node renderer. It reuses the same icon, colour and status language
 * as the fixed lab diagrams so components look identical everywhere.
 */
export function PlaygroundNode({ data, selected }: NodeProps<PlaygroundNodeData>) {
  const { Icon, accent } = NODE_KINDS[data.kind];
  const utilization = data.capacity > 0 ? data.load / data.capacity : 0;

  return (
    <div
      className={cn(
        'w-[190px] rounded-xl border bg-surface p-3 shadow-node transition-colors',
        data.status === 'down' ? 'border-danger/60 opacity-70 saturate-0' : 'border-line',
        selected && 'border-brand shadow-glow',
        data.bottleneck && 'border-warn ring-2 ring-warn/40',
      )}
    >
      <Handle type="target" position={Position.Top} />
      <div className="flex items-start gap-2">
        <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', accent)}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-ink">{data.label}</p>
          <p className="truncate text-[10px] text-faint">
            {data.capacity > 0 ? `${formatNumber(data.capacity)} req/s capacity` : 'traffic source'}
          </p>
        </div>
      </div>

      {data.capacity > 0 ? (
        <div className="mt-2 space-y-1">
          <Meter value={utilization} size="xs" label={`${formatNumber(data.load)} req/s`} />
        </div>
      ) : null}

      <div className="mt-2 flex items-center justify-between">
        <HealthIndicator status={data.status} />
        {data.bottleneck ? <span className="text-[10px] font-semibold uppercase text-warn">bottleneck</span> : null}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export const nodeTypes = { component: PlaygroundNode };
