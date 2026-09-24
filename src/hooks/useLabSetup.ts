import { useState } from 'react';

/**
 * Every control of a Lab in one Setup object, started from its Lab focus (see "A Lab focus for a
 * shared lab" in CLAUDE.md). Reset calls `setSetup(start)`, so it cannot miss a control.
 * `change(key)` returns the onChange handler for that one control.
 */
export function useLabSetup<S extends object>(start: S) {
  const [setup, setSetup] = useState(start);
  const change =
    <K extends keyof S>(key: K) =>
    (value: S[K]) =>
      setSetup((current) => ({ ...current, [key]: value }));
  return { setup, setSetup, change };
}
