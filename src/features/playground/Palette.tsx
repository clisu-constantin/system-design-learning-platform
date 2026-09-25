import { NODE_KINDS, NODE_KIND_LIST } from '@/components/architecture';
import { formatNumber } from '@/utils/format';
import { cn } from '@/utils/cn';
import type { NodeKind } from '@/types';

/** The drag payload type a palette item carries onto the canvas. */
export const NODE_DRAG_TYPE = 'application/sdi-node';

/** The component list: drag an item onto the canvas, or click it to add it. */
export function Palette({ onAdd }: { onAdd: (kind: NodeKind) => void }) {
  return (
    <div>
      <p className="mb-3 text-[11px] leading-relaxed text-faint">
        Drag onto the canvas, or click to add. Connect nodes by dragging from the bottom handle to the top handle of
        another node.
      </p>
      <div className="space-y-1.5">
        {NODE_KIND_LIST.map((kind) => {
          const style = NODE_KINDS[kind];
          return (
            <button
              key={kind}
              type="button"
              draggable
              onDragStart={(event) => event.dataTransfer.setData(NODE_DRAG_TYPE, kind)}
              onClick={() => onAdd(kind)}
              title={style.blurb}
              className="flex w-full items-center gap-2 rounded-lg border border-line px-2.5 py-2 text-left transition-colors hover:border-brand/60 hover:bg-elevated"
            >
              <span className={cn('flex h-6 w-6 items-center justify-center rounded', style.accent)}>
                <style.Icon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-medium text-ink">{style.label}</span>
                {style.capacity > 0 ? (
                  <span className="block font-mono text-[9px] text-faint">{formatNumber(style.capacity)} req/s</span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
