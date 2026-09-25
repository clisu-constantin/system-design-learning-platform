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
    // On a touch screen the row is 44px tall and the switch keeps its 24px pill,
    // with an invisible 44x44 hit area around it: the ::before reaches past the
    // 1px border, 11px up and down from the 22px padding box.
    <div className="flex items-center justify-between gap-3 coarse:min-h-11">
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
          'coarse:min-h-0 coarse:before:absolute coarse:before:-inset-y-[11px] coarse:before:-inset-x-px coarse:before:content-[""]',
          checked ? 'border-brand bg-brand' : 'border-line bg-elevated',
        )}
      >
        <span
          className={cn(
            'absolute left-0 top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-[2px]',
          )}
        />
        <span className="sr-only">{checked ? 'On' : 'Off'}</span>
      </button>
    </div>
  );
}
