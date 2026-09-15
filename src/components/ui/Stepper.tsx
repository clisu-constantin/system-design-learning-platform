import { Minus, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './Button';
import { InfoTip } from './Tooltip';

interface StepperProps {
  label: ReactNode;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  hint?: ReactNode;
  suffix?: string;
}

export function Stepper({ label, value, min = 1, max = 10, onChange, hint, suffix }: StepperProps) {
  const name = typeof label === 'string' ? label : 'value';
  return (
    <div className="space-y-2">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
        {label}
        {hint ? <InfoTip content={hint} /> : null}
      </span>
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          aria-label={'Decrease ' + name}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <div className="flex h-9 min-w-[4.5rem] flex-1 items-center justify-center rounded-xl border border-line bg-elevated font-mono text-sm font-semibold tabular-nums">
          {value}
          {suffix ? <span className="ml-1 text-[11px] font-normal text-faint">{suffix}</span> : null}
        </div>
        <Button
          size="icon"
          aria-label={'Increase ' + name}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
