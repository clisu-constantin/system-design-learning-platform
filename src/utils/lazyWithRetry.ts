import { lazy, type ComponentType } from 'react';

const RELOAD_FLAG = 'sdi:chunk-reload';

/**
 * `React.lazy` that survives a stale chunk reference.
 *
 * Every lab and page is code-split, so the browser fetches its module on first
 * use. If the dev server restarted or a new build was deployed since the page
 * loaded, that fetch fails with "Failed to fetch dynamically imported module"
 * and the whole view crashes. Retrying once fixes a transient failure; a single
 * guarded reload fixes a genuinely stale document.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const module = await factory();
      sessionStorage.removeItem(RELOAD_FLAG);
      return module;
    } catch (error) {
      // A single retry covers a momentary network or dev-server hiccup.
      try {
        await new Promise((resolve) => setTimeout(resolve, 400));
        const module = await factory();
        sessionStorage.removeItem(RELOAD_FLAG);
        return module;
      } catch (retryError) {
        const alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG) === '1';
        if (!alreadyReloaded && typeof window !== 'undefined') {
          // The document references chunks that no longer exist - reload once.
          sessionStorage.setItem(RELOAD_FLAG, '1');
          window.location.reload();
          // Keep the promise pending while the page reloads.
          return new Promise<{ default: T }>(() => {});
        }
        throw retryError;
      }
    }
  });
}
