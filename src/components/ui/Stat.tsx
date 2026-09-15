import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { InfoTip } from './Tooltip';
import type { Tone } from './Badge';

const valueTones: Record<Tone, string> = {
  neutral: 'text-ink',
  brand: 'text-brand',
  ok: 'text-ok',
  warn: 'text-warn',
  danger: 'text-danger',
  info: 'text-info',
  violet: 'text-violet',
};

interface StatProps {
  label: ReactNode;
  value: ReactNode;
  unit?: string;
  tone?: Tone;
  hint?: ReactNode;
  sub?: ReactNode;
  className?: string;
  size?: 'sm' | 'md';
}

/** Single live metric readout. Hint powers the contextual tooltips. */
export function Stat({ label, value, unit, tone = 'neutral', hint, sub, className, size = 'md' }: StatProps) {
  return (
    <div className={cn('rounded-xl border border-line bg-elevated px-3 py-2.5', className)}>
      <div className="flex items-center gap-1.5">
        <span className="label truncate">{label}</span>
        {hint ? <InfoTip content={hint} /> : null}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span
          className={cn(
            'font-mono font-semibold tabular-nums',
            size === 'sm' ? 'text-base' : 'text-xl',
            valueTones[tone],
          )}
        >
          {value}
        </span>
        {unit ? <span className="text-[11px] font-medium text-faint">{unit}</span> : null}
      </div>
      {sub ? <div className="mt-0.5 text-[11px] text-faint">{sub}</div> : null}
    </div>
  );
}

export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4', className)}>{children}</div>
  );
}
