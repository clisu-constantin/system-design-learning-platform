import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { safeLocalStorage } from '@/utils/safeStorage';

const STORAGE_KEY = 'sdi:layout';

/**
 * Which side panels the learner folded away on a wide screen. Each panel keeps
 * its own flag: the sidebar can be folded while the concept cards stay open.
 * Small screens ignore all of them - the sidebar is a drawer there, the cards
 * stack, and the Playground panels are bottom sheets.
 */
export interface LayoutState {
  sidebarFolded: boolean;
  asideFolded: boolean;
  /** The Playground component list. */
  paletteFolded: boolean;
  /** The Playground inspector. `null` until the learner chooses, so the page can pick by screen width. */
  inspectorFolded: boolean | null;
}

const DEFAULT: LayoutState = { sidebarFolded: false, asideFolded: false, paletteFolded: false, inspectorFolded: null };

function readStoredLayout(): LayoutState {
  const raw = safeLocalStorage.get(STORAGE_KEY);
  if (!raw) return DEFAULT;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT;
    const record = parsed as Record<string, unknown>;
    return {
      sidebarFolded: record.sidebarFolded === true,
      asideFolded: record.asideFolded === true,
      paletteFolded: record.paletteFolded === true,
      inspectorFolded: typeof record.inspectorFolded === 'boolean' ? record.inspectorFolded : null,
    };
  } catch {
    return DEFAULT;
  }
}

/** A side panel whose folded state is remembered. */
export type FoldablePanel = keyof LayoutState;

interface LayoutContextValue extends LayoutState {
  setFolded: (panel: FoldablePanel, folded: boolean) => void;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [layout, setLayout] = useState<LayoutState>(readStoredLayout);

  useEffect(() => {
    safeLocalStorage.set(STORAGE_KEY, JSON.stringify(layout));
  }, [layout]);

  const setFolded = useCallback(
    (panel: FoldablePanel, folded: boolean) => setLayout((current) => ({ ...current, [panel]: folded })),
    [],
  );

  const value = useMemo(() => ({ ...layout, setFolded }), [layout, setFolded]);

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
}

export function useLayout() {
  const context = useContext(LayoutContext);
  if (!context) throw new Error('useLayout must be used inside LayoutProvider');
  return context;
}
