import type { ReactNode } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useElementWidth } from '@/hooks/useElementWidth';
import { Button, ErrorBoundary } from '@/components/ui';
import type { SimEvent } from '@/simulations/engine';

interface LabShellProps {
  title: string;
  description: ReactNode;
  children: ReactNode;
  /** Right-hand control column. */
  controls: ReactNode;
  metrics?: ReactNode;
  events?: SimEvent[];
  insight?: ReactNode;
  running?: boolean;
  onToggleRun?: () => void;
  onReset?: () => void;
  /** Extra buttons in the toolbar (kill server, upgrade, create index...). */
  actions?: ReactNode;
  legend?: ReactNode;
  footer?: ReactNode;
}

/**
 * Consistent chrome for every interactive lab: toolbar, stage, control column,
 * metrics strip and event log. Labs only supply their own diagram and controls.
 */
export function LabShell({
  title,
  description,
  children,
  controls,
  metrics,
  events,
  insight,
  running,
  onToggleRun,
  onReset,
  actions,
  legend,
  footer,
}: LabShellProps) {
  const { ref, wide } = useWideLayout();
  return (
    <section ref={ref} className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          <p className="mt-0.5 max-w-3xl text-sm text-muted">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          {onToggleRun ? (
            <Button variant={running ? 'secondary' : 'primary'} onClick={onToggleRun}>
              {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {running ? 'Pause' : 'Run simulation'}
            </Button>
          ) : null}
          {onReset ? (
            <Button size="icon" onClick={onReset} aria-label="Reset simulation">
              <RotateCcw className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className={cn('grid gap-4', wide && 'grid-cols-[minmax(0,1fr)_320px]')}>
        <div className="min-w-0 space-y-4">
          <div className="card overflow-hidden">
            <ErrorBoundary area={title}>{children}</ErrorBoundary>
            {legend ? <div className="border-t border-line px-4 py-2.5">{legend}</div> : null}
          </div>
          {metrics}
          {insight}
          {footer}
        </div>

        <div className={cn('space-y-4', wide && 'sticky top-[4.5rem] self-start')}>
          <div className="card p-4">
            <p className="label mb-3">Controls</p>
            <div className="space-y-4">{controls}</div>
          </div>
          {events ? <EventLog events={events} /> : null}
        </div>
      </div>
    </section>
  );
}

/**
 * Side-by-side stage and controls need room for both: 320px of controls plus a
 * stage wide enough that DiagramCanvas stays above its 0.5x floor (about 0.6x
 * at this width). The choice follows the
 * width of the shell itself, not the viewport, because a lab embedded in a
 * concept page shares the screen with that page's own side column.
 */
const WIDE_LAYOUT_MIN = 900;

function useWideLayout() {
  const { ref, width } = useElementWidth<HTMLElement>();
  return { ref, wide: width >= WIDE_LAYOUT_MIN };
}

const TONE_CLASS = {
  info: 'text-muted',
  ok: 'text-ok',
  warn: 'text-warn',
  danger: 'text-danger',
};

/** Timestamped feed of what the simulation just did. */
export function EventLog({ events, title = 'Event log' }: { events: SimEvent[]; title?: string }) {
  return (
    <div className="card flex max-h-72 flex-col p-4">
      <p className="label mb-2">{title}</p>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto font-mono text-[11px] leading-relaxed">
        {events.length === 0 ? (
          <p className="text-faint">No events yet. Start the simulation.</p>
        ) : (
          events.map((event) => (
            <p key={event.id} className={cn('flex gap-2', TONE_CLASS[event.tone])}>
              <span className="shrink-0 text-faint">{event.time}</span>
              <span className="min-w-0">{event.message}</span>
            </p>
          ))
        )}
      </div>
    </div>
  );
}
