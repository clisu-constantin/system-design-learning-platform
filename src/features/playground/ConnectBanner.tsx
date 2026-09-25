import { Cable } from 'lucide-react';
import { Panel } from 'reactflow';

interface ConnectBannerProps {
  sourceLabel: string;
  /** True right after the learner tapped the source node itself, which is refused. */
  refusedSelf: boolean;
  onCancel: () => void;
}

/** Shown at the top of the canvas while tap-to-connect waits for its target node. */
export function ConnectBanner({ sourceLabel, refusedSelf, onCancel }: ConnectBannerProps) {
  return (
    <Panel position="top-center" className="playground-panel w-max max-w-[calc(100%-24px)]">
      <div className="glass-panel flex items-center gap-2 py-1 pl-3 pr-1">
        <Cable className="h-4 w-4 shrink-0 text-brand" aria-hidden />
        <p role="status" className="min-w-0 text-[11px] leading-snug text-ink">
          {refusedSelf ? (
            <>
              <span className="font-semibold text-warn">{sourceLabel}</span> cannot connect to itself. Tap another
              component.
            </>
          ) : (
            <>
              Tap the component <span className="font-semibold">{sourceLabel}</span> should send requests to.
            </>
          )}
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="h-8 shrink-0 rounded-lg px-2.5 text-[11px] font-medium text-muted transition-colors hover:bg-elevated/70 hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </Panel>
  );
}
