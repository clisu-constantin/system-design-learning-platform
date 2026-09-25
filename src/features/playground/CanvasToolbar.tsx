import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Maximize, Minus, Plus } from 'lucide-react';
import { Panel, useReactFlow, useStore, type FitViewOptions, type ReactFlowState } from 'reactflow';
import { cn } from '@/utils/cn';

const selectZoom = (state: ReactFlowState) => ({
  zoom: state.transform[2],
  minZoom: state.minZoom,
  maxZoom: state.maxZoom,
});

const sameZoom = (a: ReturnType<typeof selectZoom>, b: ReturnType<typeof selectZoom>) =>
  a.zoom === b.zoom && a.minZoom === b.minZoom && a.maxZoom === b.maxZoom;

interface CanvasToolbarProps {
  fitViewOptions: FitViewOptions;
  /** Extra controls on the right of the zoom group, after a divider (the minimap toggle). */
  children?: ReactNode;
}

/**
 * One horizontal glass toolbar at the bottom-left of the canvas: zoom out, the zoom level, zoom in,
 * fit view. It replaces React Flow's stack of default controls. The zoom level is read from the
 * viewport transform, so wheel, pinch and fit view all update it, not only these buttons.
 */
export function CanvasToolbar({ fitViewOptions, children }: CanvasToolbarProps) {
  const flow = useReactFlow();
  const { zoom, minZoom, maxZoom } = useStore(selectZoom, sameZoom);

  return (
    <Panel position="bottom-left" className="playground-panel">
      <div role="toolbar" aria-label="Canvas view" className="glass-panel flex items-center gap-0.5 p-1">
        <ToolbarButton aria-label="Zoom out" onClick={() => flow.zoomOut()} disabled={zoom <= minZoom}>
          <Minus className="h-4 w-4" />
        </ToolbarButton>
        <output
          aria-label="Zoom level"
          className="w-11 select-none text-center font-mono text-[11px] tabular-nums text-muted"
        >
          {Math.round(zoom * 100)}%
        </output>
        <ToolbarButton aria-label="Zoom in" onClick={() => flow.zoomIn()} disabled={zoom >= maxZoom}>
          <Plus className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton aria-label="Fit view" onClick={() => flow.fitView(fitViewOptions)}>
          <Maximize className="h-4 w-4" />
        </ToolbarButton>
        {children ? (
          <>
            <span aria-hidden className="mx-1 h-5 w-px bg-line" />
            {children}
          </>
        ) : null}
      </div>
    </Panel>
  );
}

/** A square icon button for the canvas toolbar: muted icon that turns to ink on hover. */
export function ToolbarButton({ className, type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors',
        'hover:bg-elevated/70 hover:text-ink disabled:pointer-events-none disabled:opacity-40',
        'aria-pressed:bg-brand/15 aria-pressed:text-brand',
        'coarse:h-11 coarse:w-11',
        className,
      )}
      {...props}
    />
  );
}
