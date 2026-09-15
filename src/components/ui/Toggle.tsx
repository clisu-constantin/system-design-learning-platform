import { useId, type ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { InfoTip } from './Tooltip';

interface ToggleProps {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: ReactNode;
  disabled?: boolean;
  description?: ReactNode;
}

export function Toggle({ label, checked, onChange, hint, disabled, description }: ToggleProps) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="min-w-0">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
          {label}
          {hint ? <InfoTip content={hint} /> : null}
        </span>
        {description ? <span className="mt-0.5 block text-[11px] text-faint">{description}</span> : null}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-50',
          checked ? 'border-brand bg-brand' : 'border-line bg-elevated',
        )}
      >
        <span
          className={cn(
            'absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-[2px]',
          )}
        />
        <span className="sr-only">{checked ? 'On' : 'Off'}</span>
      </button>
    </div>
  );
}
