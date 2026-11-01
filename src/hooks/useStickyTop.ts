import { useLayoutEffect, useState, type RefObject } from 'react';
import { STICKY_GAP, stickyTop } from '@/utils/stickyTop';

/**
 * The sticky `top` of a side column, kept right as the column or the visible
 * area change height: another tab, a folded panel, a resized window. The page
 * scrolls inside `<main>`, under the top bar, so that is the area it sticks in.
 * Pass `enabled: false` while the column is not sticky (stacked layouts).
 */
export function useStickyTop(column: RefObject<HTMLElement | null>, enabled: boolean) {
  const [top, setTop] = useState(STICKY_GAP);

  useLayoutEffect(() => {
    const element = column.current;
    const scroller = element?.closest('main');
    if (!enabled || !element || !scroller) return;
    // Syncs the measured heights of the column and of the scrolling area.
    const measure = () => setTop(stickyTop({ visible: scroller.clientHeight, column: element.offsetHeight }));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [column, enabled]);

  return top;
}
