import { useCallback, useEffect, useState } from 'react';
import type { Connection, Node } from 'reactflow';
import type { PlaygroundNodeData } from './nodes';

/** Tap-to-connect: the node the new wire starts at, and whether the last tap was refused. */
interface ConnectMode {
  source: string;
  refusedSelf: boolean;
}

/** What a tap on a node did while a wire was waiting for its target. */
export type TapResult = 'idle' | 'refused' | 'connected';

/**
 * Joining two nodes without a drag: pick the source, then tap the target. A tap on the source itself
 * is refused, the same rule as a drag between handles. Escape ends it, and so does removing the source.
 */
export function useTapConnect(nodes: Node<PlaygroundNodeData>[], onConnect: (connection: Connection) => void) {
  const [mode, setMode] = useState<ConnectMode | null>(null);
  const waiting = mode && nodes.some((node) => node.id === mode.source) ? mode : null;

  useEffect(() => {
    if (!waiting) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMode(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [waiting]);

  const start = useCallback((source: string) => setMode({ source, refusedSelf: false }), []);
  const cancel = useCallback(() => setMode(null), []);

  const tap = useCallback(
    (target: string): TapResult => {
      if (!waiting) return 'idle';
      if (target === waiting.source) {
        setMode({ ...waiting, refusedSelf: true });
        return 'refused';
      }
      onConnect({ source: waiting.source, target, sourceHandle: null, targetHandle: null });
      setMode(null);
      return 'connected';
    },
    [waiting, onConnect],
  );

  return {
    source: waiting ? nodes.find((node) => node.id === waiting.source) : undefined,
    refusedSelf: waiting?.refusedSelf ?? false,
    start,
    cancel,
    tap,
  };
}
