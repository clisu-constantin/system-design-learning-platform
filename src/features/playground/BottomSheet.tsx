import { useId, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Modal } from '@/components/ui';

interface BottomSheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * A panel that slides up from the bottom edge on a phone, over the canvas. It closes on its close
 * button, a tap on the dimmed canvas or Escape; `Modal` keeps focus inside it while open.
 */
export function BottomSheet({ open, title, onClose, children }: BottomSheetProps) {
  const titleId = useId();

  if (!open) return null;

  return (
    <Modal
      onClose={onClose}
      labelledBy={titleId}
      className="items-end lg:hidden"
      panelClassName="playground-sheet flex max-h-[80vh] w-full flex-col rounded-t-2xl border-t border-line bg-surface shadow-card supports-[height:100dvh]:max-h-[80dvh]"
    >
      <div className="flex items-center justify-between gap-2 border-b border-line py-1 pl-4 pr-1">
        <h2 id={titleId} className="label">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${title.toLowerCase()}`}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-elevated hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {children}
      </div>
    </Modal>
  );
}
