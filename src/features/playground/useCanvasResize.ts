import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { FitViewOptions, ReactFlowInstance } from 'reactflow';
import { NODE_SIZE } from './nodes';

/** Room kept between a revealed node and the edge of the canvas. */
const REVEAL_MARGIN = 24;

/**
 * What the canvas does the next time a side panel changes its width. A fold or unfold asks for a
 * refit, so the diagram fills the new space. A panel that opened to answer a node selection asks
 * only to reveal that node: the view pans just enough to keep it clear of the panel, and not at all
 * when it is already in view, so the diagram does not jump away from under the pointer.
 */
export function useCanvasResize(
  canvas: RefObject<HTMLDivElement | null>,
  flow: RefObject<ReactFlowInstance | null>,
  fitViewOptions: FitViewOptions,
) {
  const pending = useRef<{ kind: 'refit' } | { kind: 'reveal'; nodeId: string } | null>(null);

  useEffect(() => {
    const element = canvas.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      const request = pending.current;
      if (!request) return;
      pending.current = null;
      // One frame later, so React Flow has read the new size before it moves the view.
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const instance = flow.current;
        if (!instance) return;
        if (request.kind === 'refit') {
          instance.fitView(fitViewOptions);
          return;
        }
        const node = instance.getNode(request.nodeId);
        if (!node) return;
        const { x, y, zoom } = instance.getViewport();
        const left = (node.positionAbsolute?.x ?? node.position.x) * zoom + x;
        const right = left + (node.width ?? NODE_SIZE.width) * zoom;
        const overflow = right - (element.clientWidth - REVEAL_MARGIN);
        // Never pan the left edge of the node out of view to show its right edge.
        const shift = Math.min(overflow, left - REVEAL_MARGIN);
        if (shift > 0) instance.setViewport({ x: x - shift, y, zoom }, { duration: 200 });
      });
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [canvas, flow, fitViewOptions]);

  const refitOnResize = useCallback(() => {
    pending.current = { kind: 'refit' };
  }, []);
  const revealOnResize = useCallback((nodeId: string) => {
    pending.current = { kind: 'reveal', nodeId };
  }, []);

  return { refitOnResize, revealOnResize };
}
