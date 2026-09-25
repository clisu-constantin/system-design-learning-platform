import { useId, type ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { InfoTip } from './Tooltip';

interface SliderProps {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
  hint?: ReactNode;
  disabled?: boolean;
  tone?: 'brand' | 'warn' | 'danger' | 'ok';
  className?: string;
  /** Optional min/max captions rendered under the track. */
  scale?: [string, string];
}

const tones = {
  brand: 'accent-[rgb(var(--c-brand))]',
  warn: 'accent-[rgb(var(--c-warn))]',
  danger: 'accent-[rgb(var(--c-danger))]',
  ok: 'accent-[rgb(var(--c-ok))]',
};

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  hint,
  disabled,
  tone = 'brand',
  className,
  scale,
}: SliderProps) {
  const id = useId();
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="flex items-center gap-1.5 text-xs font-medium text-muted">
          {label}
          {hint ? <InfoTip content={hint} /> : null}
        </label>
        <span className="font-mono text-xs font-semibold tabular-nums text-ink">
          {format ? format(value) : value}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className={cn(
          'h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line disabled:cursor-not-allowed disabled:opacity-50',
          // On a touch screen the input is 44px tall for the finger, but its
          // background (the track) is clipped to the 6px content box, so the
          // track looks the same as with a mouse. The radius is 3px across and
          // 3 + 19px down, so the clipped track keeps round 3px ends.
          'coarse:h-11 coarse:bg-clip-content coarse:py-[19px] coarse:rounded-[3px_/_22px]',
          tones[tone],
        )}
      />
      {scale ? (
        <div className="flex justify-between font-mono text-[11px] text-faint">
          <span>{scale[0]}</span>
          <span>{scale[1]}</span>
        </div>
      ) : null}
    </div>
  );
}
