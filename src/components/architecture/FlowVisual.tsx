import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { cn } from '@/utils/cn';
import { clamp } from '@/utils/math';
import type { NodeKind, NodeStatus, RequestOutcome } from '@/types';
import { advanceParticles, nextParticleId, useTicker, type Particle } from '@/simulations/engine';
import { useRerender } from '@/hooks/useRerender';
import { useInView } from '@/hooks/useInView';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { ArchNode, NodeStatRow } from './ArchNode';
import { DiagramCanvas, type DiagramEdge, type ParticleView } from './DiagramCanvas';
import type { Layout } from './geometry';

export interface VisualNode {
  id: string;
  kind: NodeKind;
  label: string;
  sub?: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  status?: NodeStatus;
  /** One short metric line inside the card, e.g. "CPU 38%". */
  stat?: [string, string];
  alert?: boolean;
}

export interface VisualEdge {
  from: string;
  to: string;
  tone?: DiagramEdge['tone'];
  label?: string;
  /** Where the label sits along the edge, 0..1. Use it to clear a node box. */
  labelT?: number;
  dashed?: boolean;
  /** Particles per second on this edge. 0 means a static connection. */
  rate?: number;
  outcome?: RequestOutcome;
  curvature?: number;
}

export interface VisualStep {
  from: string;
  to: string;
  /** Six words or fewer - this is a caption, not a paragraph. */
  label: string;
  outcome?: RequestOutcome;
}

export interface VisualSpec {
  nodes: VisualNode[];
  edges: VisualEdge[];
  /** Optional stepped walkthrough of the same diagram. */
  steps?: VisualStep[];
  width?: number;
  height?: number;
  /** One short line under the diagram. */
  caption?: string;
  /**
   * Why replicas in this diagram are deliberately wired differently - a failed
   * node, one partition holding the key, one attempt that succeeds. Setting it
   * exempts the spec from the replica-wiring rule in scripts/check-visuals.mjs,
   * so it must say what the asymmetry is teaching.
   */
  asymmetric?: string;
}

/**
 * Scales a diagram to the width it is actually given.
 *
 * Specs are authored in a fixed design space; without this the diagram sits in
 * the top-left of a wider card and looks like it stops halfway across.
 */
function useFitScale(designWidth: number, override?: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [fitted, setFitted] = useState(1);

  useEffect(() => {
    if (override !== undefined) return;
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width > 0) setFitted(clamp(width / designWidth, 0.5, 1.3));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [designWidth, override]);

  return { ref, scale: override ?? fitted };
}

const toLayout = (spec: VisualSpec): Layout =>
  Object.fromEntries(
    spec.nodes.map((node) => [node.id, { x: node.x, y: node.y, w: node.w ?? 150, h: node.h ?? 74 }]),
  );

/**
 * Play/pause state for a diagram that animates on its own: it starts paused
 * when the OS asks for reduced motion, and the ticker only runs while the
 * diagram is on screen. WCAG 2.2.2 requires the explicit pause either way.
 */
function useAutoplay() {
  const reducedMotion = usePrefersReducedMotion();
  // null until the learner presses Play/Pause; until then the OS setting decides.
  const [choice, setChoice] = useState<boolean | null>(null);
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref);

  const playing = choice ?? !reducedMotion;
  const setPlaying = (next: boolean | ((current: boolean) => boolean)) =>
    setChoice(typeof next === 'function' ? next(playing) : next);

  return { ref, playing, setPlaying, running: playing && inView, reducedMotion };
}

function PlayPauseButton({ playing, onToggle, className }: { playing: boolean; onToggle: () => void; className?: string }) {
  const Icon = playing ? Pause : Play;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={playing ? 'Pause animation' : 'Play animation'}
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border border-line bg-surface/90 px-2 py-1 text-[11px] text-muted transition-colors hover:border-brand hover:text-brand',
        className,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {playing ? 'Pause' : 'Play'}
    </button>
  );
}

const renderNodes = (spec: VisualSpec, layout: Layout, activeIds?: Set<string>) =>
  spec.nodes.map((node) => (
    <ArchNode
      key={node.id}
      kind={node.kind}
      title={node.label}
      subtitle={node.sub}
      placed={layout[node.id]}
      status={node.status ?? 'healthy'}
      alert={node.alert}
      selected={activeIds?.has(node.id)}
      compact
    >
      {node.stat ? <NodeStatRow label={node.stat[0]} value={node.stat[1]} /> : null}
    </ArchNode>
  ));

/**
 * A self-running architecture diagram: traffic flows along the edges on its own,
 * with no controls. Used as the primary content of a concept page, so the first
 * thing a learner meets is a working system rather than a paragraph.
 */
export function FlowVisual({
  spec,
  className,
  grid = true,
  zoom,
}: {
  spec: VisualSpec;
  className?: string;
  grid?: boolean;
  /** Fixes the scale instead of fitting to the container width. */
  zoom?: number;
}) {
  const particles = useRef<Particle[]>([]);
  const carry = useRef<number[]>(spec.edges.map(() => 0));
  const rerender = useRerender(30);
  const autoplay = useAutoplay();

  // Only the particles change from frame to frame. Keeping layout, edges and
  // node elements referentially stable lets DiagramCanvas reuse its curves and
  // lets React skip the node cards entirely - each is a framer-motion `layout`
  // component, which measures the DOM whenever it re-renders.
  const layout = useMemo(() => toLayout(spec), [spec]);
  const edges = useMemo(
    () =>
      spec.edges.map((edge) => ({
        from: edge.from,
        to: edge.to,
        tone: edge.tone ?? 'default',
        label: edge.label,
        labelT: edge.labelT,
        dashed: edge.dashed,
        curvature: edge.curvature,
      })),
    [spec],
  );
  const nodes = useMemo(() => renderNodes(spec, layout), [spec, layout]);

  useTicker(autoplay.running, (dt) => {
    spec.edges.forEach((edge, index) => {
      const rate = edge.rate ?? 0;
      if (rate <= 0) return;
      carry.current[index] = (carry.current[index] ?? 0) + rate * dt;
      while (carry.current[index] >= 1) {
        carry.current[index] -= 1;
        particles.current.push({
          id: nextParticleId(),
          route: [edge.from, edge.to],
          leg: 0,
          t: 0,
          speed: 0.75 + Math.random() * 0.35,
          outcome: edge.outcome ?? 'success',
        });
      }
    });

    const { alive } = advanceParticles(particles.current, dt);
    particles.current = alive.slice(-60);
    rerender();
  });

  const particleViews: ParticleView[] = particles.current.map((particle) => ({
    id: particle.id,
    from: particle.route[0],
    to: particle.route[1],
    t: particle.t,
    outcome: particle.outcome ?? 'success',
  }));

  const width = spec.width ?? 760;
  const height = spec.height ?? 320;
  const { ref, scale } = useFitScale(width, zoom);

  return (
    <figure ref={autoplay.ref} className={cn('overflow-hidden rounded-2xl border border-line bg-canvas', className)}>
      <div ref={ref} className="w-full">
        <div style={{ height: height * scale, overflow: 'hidden' }}>
          <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width, height }}>
            <DiagramCanvas
              layout={layout}
              edges={edges}
              particles={particleViews}
              width={width}
              height={height}
              grid={grid}
            >
              {nodes}
            </DiagramCanvas>
          </div>
        </div>
      </div>
      {/* The control sits under the canvas, not over it, so it can never cover a node. */}
      <div className="flex items-center gap-3 border-t border-line px-4 py-2">
        {spec.caption ? <figcaption className="min-w-0 flex-1 text-xs text-muted">{spec.caption}</figcaption> : null}
        <PlayPauseButton
          playing={autoplay.playing}
          onToggle={() => autoplay.setPlaying((value) => !value)}
          className="ml-auto shrink-0"
        />
      </div>
    </figure>
  );
}

/**
 * The same diagram, walked one hop at a time with a short caption. This replaces
 * a numbered list of paragraphs in the "How it works" tab.
 */
export function SequenceFlow({ spec, className }: { spec: VisualSpec; className?: string }) {
  const steps = useMemo(() => spec.steps ?? [], [spec.steps]);
  const [index, setIndex] = useState(0);
  const autoplay = useAutoplay();
  // With reduced motion the request is shown parked mid-edge instead of travelling.
  const restingProgress = autoplay.reducedMotion ? 0.5 : 0;
  const progress = useRef(restingProgress);
  const rerender = useRerender(30);
  const layout = useMemo(() => toLayout(spec), [spec]);
  const width = spec.width ?? 760;
  const height = spec.height ?? 320;
  const { ref, scale } = useFitScale(width);

  useTicker(autoplay.running && steps.length > 0, (dt) => {
    progress.current += dt * 0.85;
    if (progress.current >= 1.25) {
      progress.current = 0;
      setIndex((value) => (value + 1) % steps.length);
    }
    rerender();
  });

  const active = steps[Math.min(index, Math.max(steps.length - 1, 0))];
  const activeFrom = active?.from;
  const activeTo = active?.to;

  // Nodes and wiring change once per step, not once per frame.
  const nodes = useMemo(
    () => renderNodes(spec, layout, new Set([activeFrom, activeTo].filter((id): id is string => Boolean(id)))),
    [spec, layout, activeFrom, activeTo],
  );
  const edges = useMemo(
    () =>
      steps.map((step, position) => ({
        from: step.from,
        to: step.to,
        tone: position === index ? ('brand' as const) : ('muted' as const),
        animated: position === index,
      })),
    [steps, index],
  );

  if (steps.length === 0 || !active) return <FlowVisual spec={spec} className={className} />;

  return (
    <div className={cn('space-y-3', className)}>
      <figure ref={autoplay.ref} className="relative overflow-hidden rounded-2xl border border-line bg-canvas">
        {/* The caption is a banner, not an edge label: on a short edge it would
            land on top of a node and become unreadable. */}
        <span className="absolute left-3 top-3 z-20 inline-flex items-center gap-2 rounded-lg border border-brand/40 bg-surface px-2.5 py-1.5 text-[11px] font-medium text-brand shadow-card">
          <span className="font-mono text-faint">
            {index + 1}/{steps.length}
          </span>
          {active.label}
        </span>
        <div ref={ref} className="w-full">
          <div style={{ height: height * scale, overflow: 'hidden' }}>
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width, height }}>
              <DiagramCanvas
                layout={layout}
                edges={edges}
                particles={[
                  {
                    id: 1,
                    from: active.from,
                    to: active.to,
                    t: Math.min(1, progress.current),
                    outcome: active.outcome ?? 'success',
                  },
                ]}
                width={width}
                height={height}
              >
                {nodes}
              </DiagramCanvas>
            </div>
          </div>
        </div>
      </figure>

      <div className="flex flex-wrap items-center gap-1.5">
        {steps.map((step, position) => (
          <button
            key={`${step.from}-${step.to}-${position}`}
            type="button"
            onClick={() => {
              setIndex(position);
              autoplay.setPlaying(false);
              progress.current = restingProgress;
            }}
            className={cn(
              'rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors',
              position === index
                ? 'border-brand bg-brand/10 text-brand'
                : 'border-line text-muted hover:border-brand/40 hover:text-ink',
            )}
          >
            <span className="mr-1.5 font-mono text-faint">{position + 1}</span>
            {step.label}
          </button>
        ))}
        <PlayPauseButton
          playing={autoplay.playing}
          onToggle={() => autoplay.setPlaying((value) => !value)}
          className="ml-auto px-2.5 py-1.5"
        />
      </div>
    </div>
  );
}
