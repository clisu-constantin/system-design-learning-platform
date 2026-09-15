import { useId, useState, type ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';
import { cn } from '@/utils/cn';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  className?: string;
  side?: 'top' | 'bottom';
}

/**
 * Keyboard-accessible tooltip: hover or focus reveals it, and the trigger is
 * wired to the bubble with aria-describedby.
 */
export function Tooltip({ content, children, className, side = 'top' }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span aria-describedby={open ? id : undefined} tabIndex={0} className="inline-flex outline-none">
        {children}
      </span>
      {open ? (
        <span
          id={id}
          role="tooltip"
          className={cn(
            'pointer-events-none absolute left-1/2 z-50 w-56 -translate-x-1/2 rounded-lg border border-line bg-surface px-3 py-2',
            'text-xs font-normal leading-relaxed text-muted shadow-card animate-fade-in',
            side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
          )}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}

/** Small "?" affordance used next to metric labels. */
export function InfoTip({ content }: { content: ReactNode }) {
  return (
    <Tooltip content={content}>
      <HelpCircle className="h-3.5 w-3.5 text-faint transition-colors hover:text-brand" aria-label="More information" />
    </Tooltip>
  );
}
