import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
}

interface TabsProps {
  items: TabItem[];
  value?: string;
  onChange?: (id: string) => void;
  className?: string;
}

/** Underlined tab bar with roving focus (arrow keys move between tabs). */
export function Tabs({ items, value, onChange, className }: TabsProps) {
  const [internal, setInternal] = useState(items[0]?.id ?? '');
  const active = value ?? internal;
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!items.some((item) => item.id === active) && items[0]) {
      setInternal(items[0].id);
    }
  }, [items, active]);

  const select = (id: string) => {
    setInternal(id);
    onChange?.(id);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const index = items.findIndex((item) => item.id === active);
    const next = event.key === 'ArrowRight' ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
    select(items[next].id);
    const buttons = listRef.current?.querySelectorAll('button');
    buttons?.[next]?.focus();
  };

  const current = items.find((item) => item.id === active) ?? items[0];

  return (
    <div className={className}>
      <div
        ref={listRef}
        role="tablist"
        onKeyDown={onKeyDown}
        className="flex gap-1 overflow-x-auto border-b border-line"
      >
        {items.map((item) => {
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(item.id)}
              className={cn(
                'relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3.5 py-2.5 text-sm font-medium transition-colors',
                selected ? 'text-brand' : 'text-muted hover:text-ink',
              )}
            >
              {item.icon}
              {item.label}
              {selected ? (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" aria-hidden />
              ) : null}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="pt-5 animate-fade-in" key={current?.id}>
        {current?.content}
      </div>
    </div>
  );
}
