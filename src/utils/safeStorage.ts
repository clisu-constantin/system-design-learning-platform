/**
 * Web Storage that never throws.
 *
 * Merely touching `window.localStorage` throws a SecurityError when the browser
 * blocks site data, and `setItem` throws when storage is full or disabled
 * (older Safari private mode). Theme, progress and the chunk-reload flag are
 * all conveniences, so a storage failure must degrade to "not remembered"
 * instead of taking the application down.
 */
type Area = 'local' | 'session';

function area(kind: Area): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function createStorage(kind: Area) {
  return {
    get(key: string): string | null {
      try {
        return area(kind)?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    set(key: string, value: string): void {
      try {
        area(kind)?.setItem(key, value);
      } catch {
        // Full, disabled or blocked - the value is simply not remembered.
      }
    },
    remove(key: string): void {
      try {
        area(kind)?.removeItem(key);
      } catch {
        // Same as above.
      }
    },
  };
}

export const safeLocalStorage = createStorage('local');
export const safeSessionStorage = createStorage('session');
