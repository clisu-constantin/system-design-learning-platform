import { useId, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/utils/cn';
import { InfoTip } from './Tooltip';

interface SelectProps<T extends string> {
  label?: ReactNode;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  hint?: ReactNode;
  className?: string;
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
  className,
}: SelectProps<T>) {
  const id = useId();
  return (
    <div className={cn('space-y-2', className)}>
      {label ? (
        <label htmlFor={id} className="flex items-center gap-1.5 text-xs font-medium text-muted">
          {label}
          {hint ? <InfoTip content={hint} /> : null}
        </label>
      ) : null}
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value as T)}
          className="h-9 w-full appearance-none rounded-xl border border-line bg-elevated px-3 pr-9 text-sm text-ink transition-colors hover:border-brand/40"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
      </div>
    </div>
  );
}
