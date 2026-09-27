import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
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
  // If the chosen tab disappears (the item list changed), fall back to the first one.
  const requested = value ?? internal;
  const active = items.some((item) => item.id === requested) ? requested : (items[0]?.id ?? '');
  const listRef = useRef<HTMLDivElement>(null);

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

  // The underline is one bar that slides to the selected tab, so the eye follows the
  // move from the old tab to the new one. It is placed from the DOM (tab widths
  // depend on the font), and animates only after its first placement.
  const barRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const list = listRef.current;
    const bar = barRef.current;
    if (!list || !bar) return;
    const place = () => {
      const tab = list.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
      if (!tab) {
        bar.style.opacity = '0';
        return;
      }
      bar.style.opacity = '1';
      bar.style.transform = `translateX(${tab.offsetLeft + 8}px) scaleX(${Math.max(0, tab.offsetWidth - 16)})`;
    };
    place();
    const frame = requestAnimationFrame(() => bar.setAttribute('data-ready', ''));
    const observer = new ResizeObserver(place);
    observer.observe(list);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [active, items.length]);

  return (
    <div className={className}>
      <div
        ref={listRef}
        role="tablist"
        onKeyDown={onKeyDown}
        className="relative flex gap-1 overflow-x-auto border-b border-line"
      >
        <span
          ref={barRef}
          className="tab-bar pointer-events-none absolute bottom-0 left-0 h-0.5 rounded-full bg-brand opacity-0"
          aria-hidden
        />
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
                'flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3.5 py-2.5 text-sm font-medium transition-colors',
                selected ? 'text-brand' : 'text-muted hover:text-ink',
              )}
            >
              {item.icon}
              {item.label}
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
