import type { ReactNode } from 'react';
import { AlertTriangle, Check, Lightbulb } from 'lucide-react';
import { cn } from '@/utils/cn';

interface ExplanationCardProps {
  title: string;
  children?: ReactNode;
  items?: string[];
  tone?: 'neutral' | 'ok' | 'warn' | 'brand';
  icon?: ReactNode;
  className?: string;
  /** Bullet marker style: check for benefits, warning for mistakes. */
  marker?: 'dot' | 'check' | 'warn';
}

const toneRing = {
  neutral: 'border-line',
  ok: 'border-ok/30',
  warn: 'border-warn/30',
  brand: 'border-brand/30',
};

/**
 * A short titled block of explanation. Concept pages are assembled from these
 * so that every lesson has the same rhythm: what, why, how, when, trade-offs.
 */
export function ExplanationCard({
  title,
  children,
  items,
  tone = 'neutral',
  icon,
  className,
  marker = 'dot',
}: ExplanationCardProps) {
  return (
    <section className={cn('rounded-2xl border bg-surface p-5', toneRing[tone], className)}>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
        {icon}
        {title}
      </h3>
      {children ? <div className="mt-2 text-sm leading-relaxed text-muted">{children}</div> : null}
      {items?.length ? (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-muted">
              {marker === 'check' ? (
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden />
              ) : marker === 'warn' ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden />
              ) : (
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-faint" aria-hidden />
              )}
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** Monospace architecture sketch, scrollable on small screens. */
export function AsciiBlock({ children, className }: { children: string; className?: string }) {
  return <pre className={cn('ascii', className)}>{children}</pre>;
}

/** Highlighted teaching note used inside labs. */
export function Insight({ children, title = 'What to notice' }: { children: ReactNode; title?: string }) {
  return (
    <div className="flex gap-3 rounded-xl border border-brand/30 bg-brand/5 p-4">
      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">{title}</p>
        <div className="mt-1 text-sm leading-relaxed text-muted">{children}</div>
      </div>
    </div>
  );
}
