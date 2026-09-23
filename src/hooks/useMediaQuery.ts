import { useCallback, useSyncExternalStore } from 'react';

const supported = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function';

/**
 * Whether a CSS media query matches right now, updated when it flips. For
 * layout decisions that CSS alone cannot make, such as what a button toggles
 * or what `aria-expanded` should report.
 */
export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!supported()) return () => {};
      const media = window.matchMedia(query);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    [query],
  );
  const getSnapshot = () => supported() && window.matchMedia(query).matches;

  return useSyncExternalStore(subscribe, getSnapshot);
}

/** Tailwind's `lg` breakpoint: the sidebar is a static column from here up. */
export const LG_QUERY = '(min-width: 1024px)';
/** Tailwind's `xl` breakpoint: the concept page grows its side column from here up. */
export const XL_QUERY = '(min-width: 1280px)';
