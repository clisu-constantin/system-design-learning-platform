import { cn } from '@/utils/cn';

interface SegmentedControlProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
  size?: 'sm' | 'md';
  /**
   * Stretch across the container, each segment growing with its label, instead
   * of hugging the labels. Use it where the control can meet a phone-width
   * column (pair with e.g. `sm:w-auto`): the segments share the row and never
   * push the page sideways.
   */
  fill?: boolean;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className,
  size = 'md',
  fill = false,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        'rounded-xl border border-line bg-elevated p-1',
        fill ? 'flex w-full' : 'inline-flex',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-lg font-medium transition-colors',
              size === 'sm' ? 'py-1 text-xs' : 'py-1.5 text-sm',
              // Filled, a label never wraps: the segments shrink their padding
              // on a phone instead, and are back to the usual padding from sm up.
              fill
                ? cn('flex-auto whitespace-nowrap', size === 'sm' ? 'px-1.5 sm:px-2.5' : 'px-2 sm:px-3.5')
                : size === 'sm'
                  ? 'px-2.5'
                  : 'px-3.5',
              active ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
