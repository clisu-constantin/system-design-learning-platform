import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { NodeKind, NodeStatus, RequestOutcome } from '@/types';
import { advanceParticles, nextParticleId, useTicker, type Particle } from '@/simulations/engine';
import { useRerender } from '@/hooks/useRerender';
import { useInView } from '@/hooks/useInView';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { ArchNode, NodeStatRow } from './ArchNode';
import { DiagramCanvas, type DiagramEdge, type ParticleView } from './DiagramCanvas';
import type { FitRange } from '@/hooks/useFitScale';
import type { Layout } from './geometry';
import {
  LIVE,
  barFill,
  canGoBack,
  canGoNext,
  nextStep,
  playStep,
  previousStep,
  type WalkthroughPosition,
} from './walkthrough';

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
  /** Replaces the status text, e.g. "Not built" for a part a cut feature would need. */
  statusLabel?: string;
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
  /**
   * The hop this step walks. `from` equal to `to` is work done inside one part
   * (a browser rendering, a server computing): that part lights up and no
   * request travels, as a Lab stage with no hops shows it.
   */
  from: string;
  to: string;
  /** Six words or fewer - this is a caption, not a paragraph. */
  label: string;
  outcome?: RequestOutcome;
  /**
   * The hop is deliberately not taken - a pruned partition, a feature cut from
   * scope. The wire is shown dashed and no request travels it, so the step can
   * point at the part without claiming traffic reaches it.
   */
  skipped?: boolean;
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
 * Concept diagrams are authored in a smaller design space (760px by default)
 * than labs, so they may grow up to 1.3x to fill a wide card instead of sitting
 * in its top-left corner. Below 0.5x they scroll sideways instead of clipping.
 */
const FLOW_FIT: FitRange = { min: 0.5, max: 1.3 };

const toLayout = (spec: VisualSpec): Layout =>
  Object.fromEntries(
    spec.nodes.map((node) => [node.id, { x: node.x, y: node.y, w: node.w ?? 150, h: node.h ?? 74 }]),
  );

/**
 * Play/pause state for a diagram that animates on its own: it starts paused
 * when the OS asks for reduced motion, and the ticker only runs while the
 * diagram is on screen. WCAG 2.2.2 requires the explicit pause either way.
 */
export function useAutoplay<T extends HTMLElement = HTMLElement>() {
  const reducedMotion = usePrefersReducedMotion();
  // null until the learner presses Play/Pause; until then the OS setting decides.
  const [choice, setChoice] = useState<boolean | null>(null);
  const ref = useRef<T>(null);
  const inView = useInView(ref);

  const playing = choice ?? !reducedMotion;
  const setPlaying = (next: boolean | ((current: boolean) => boolean)) =>
    setChoice(typeof next === 'function' ? next(playing) : next);

  return { ref, playing, setPlaying, running: playing && inView, reducedMotion };
}

export function PlayPauseButton({ playing, onToggle, className }: { playing: boolean; onToggle: () => void; className?: string }) {
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

/**
 * The drawn edge a Walkthrough step travels. A step may run against the arrow
 * (a response going back), so it reuses that edge reversed instead of drawing
 * a second curve between the same two nodes.
 */
const wireFor = (edges: VisualEdge[], from: string, to: string) => {
  const forward = edges.find((edge) => edge.from === from && edge.to === to);
  if (forward) return { edge: forward, reversed: false };
  const backward = edges.find((edge) => edge.from === to && edge.to === from);
  return backward ? { edge: backward, reversed: true } : undefined;
};

const renderNodes = (spec: VisualSpec, layout: Layout, activeIds?: Set<string>) =>
  spec.nodes.map((node) => (
    <ArchNode
      key={node.id}
      kind={node.kind}
      title={node.label}
      subtitle={node.sub}
      placed={layout[node.id]}
      status={node.status ?? 'healthy'}
      statusLabel={node.statusLabel}
      alert={node.alert}
      selected={activeIds?.has(node.id)}
      compact
    >
      {node.stat ? <NodeStatRow label={node.stat[0]} value={node.stat[1]} /> : null}
    </ArchNode>
  ));

/**
 * A self-running architecture diagram: traffic flows along the edges on its own.
 * Used as the primary content of a concept page, so the first thing a learner
 * meets is a working system rather than a paragraph.
 *
 * With `walkthrough`, a spec that has `steps` is driven from one bar across the
 * top of the canvas: back, play/pause, next, the caption and one bar per step.
 * It opens on Live, the traffic; picking a step stops the traffic and walks one
 * request along that hop over the same diagram, so the Walkthrough is never a
 * second copy of the picture in another tab.
 */
export function FlowVisual({
  spec,
  className,
  grid = true,
  zoom,
  walkthrough = false,
}: {
  spec: VisualSpec;
  className?: string;
  grid?: boolean;
  /** Fixes the scale instead of fitting to the container width. */
  zoom?: number;
  /** Drives the spec's steps, if it has any, from a bar across the top. */
  walkthrough?: boolean;
}) {
  const steps = useMemo(() => (walkthrough ? (spec.steps ?? []) : []), [walkthrough, spec.steps]);
  // null is Live: free-flowing traffic. A number is the Walkthrough step on show.
  const [stepIndex, setStepIndex] = useState<WalkthroughPosition>(LIVE);
  const particles = useRef<Particle[]>([]);
  const carry = useRef<number[]>(spec.edges.map(() => 0));
  const rerender = useRerender(30);
  const autoplay = useAutoplay();
  // How far the stepped request is along its hop. A picked step parks it
  // mid-edge, where it is visible instead of hidden under the node card.
  const progress = useRef(0.5);

  const active = stepIndex === null ? undefined : steps[Math.min(stepIndex, steps.length - 1)];
  const activeFrom = active?.from;
  const activeTo = active?.to;
  const activeSkipped = active?.skipped ?? false;
  // Work inside one part: no wire is travelled, so every wire fades and only the part lights up.
  const activeInside = activeFrom !== undefined && activeFrom === activeTo;

  // Only the particles change from frame to frame. Keeping layout, edges and
  // node elements referentially stable lets DiagramCanvas reuse its curves and
  // lets React skip the node cards entirely, so a frame costs only the particle
  // layer. In a Walkthrough they change once per step, not once per frame.
  const layout = useMemo(() => toLayout(spec), [spec]);
  const wire = useMemo(
    () => (activeFrom && activeTo ? wireFor(spec.edges, activeFrom, activeTo) : undefined),
    [spec, activeFrom, activeTo],
  );
  const edges = useMemo(() => {
    const wiring: DiagramEdge[] = spec.edges.map((edge) => {
      const isActive = edge === wire?.edge;
      return {
        from: edge.from,
        to: edge.to,
        // A skipped hop stays neutral and dashed: pointed at, not travelled.
        tone: isActive && !activeSkipped ? 'brand' : (edge.tone ?? 'default'),
        label: edge.label,
        labelT: edge.labelT,
        dashed: edge.dashed || (isActive && activeSkipped),
        curvature: edge.curvature,
        // The marching ants run with the arrow, so they would contradict a reversed step.
        animated: isActive && !activeSkipped && !wire?.reversed,
        faded: activeFrom !== undefined && !isActive,
      };
    });
    // check:visuals keeps every step on a drawn edge; this only stops an
    // undrawn hop from showing nothing at all.
    if (activeFrom && activeTo && !wire && !activeInside) {
      wiring.push({ from: activeFrom, to: activeTo, tone: 'brand', animated: true });
    }
    return wiring;
  }, [spec, wire, activeFrom, activeTo, activeSkipped, activeInside]);
  const nodes = useMemo(
    () =>
      renderNodes(
        spec,
        layout,
        activeFrom && activeTo ? new Set([activeFrom, activeTo]) : undefined,
      ),
    [spec, layout, activeFrom, activeTo],
  );

  useTicker(autoplay.running, (dt) => {
    if (stepIndex !== null) {
      progress.current += dt * 0.85;
      if (progress.current >= STEP_HOLD) {
        progress.current = 0;
        setStepIndex((value) => playStep(value ?? 0, steps.length));
      }
      rerender();
      return;
    }

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

  // Which way the story moved, so the caption comes in from that side. Kept in a
  // ref next to the step it belongs to, so a second render of the same step
  // does not turn it round. Looping from the last step to the first is forward.
  const turn = useRef<{ index: number | null; dir: 'next' | 'prev' }>({ index: null, dir: 'next' });
  if (turn.current.index !== stepIndex) {
    const previous = turn.current.index;
    const forward =
      previous === null ||
      stepIndex === null ||
      stepIndex > previous ||
      (previous === steps.length - 1 && stepIndex === 0);
    turn.current = { index: stepIndex, dir: forward ? 'next' : 'prev' };
  }

  const stepT = Math.min(1, progress.current);
  const particleViews: ParticleView[] = active
    ? active.skipped || activeInside
      ? []
      : [
          {
            id: 1,
            from: wire?.edge.from ?? active.from,
            to: wire?.edge.to ?? active.to,
            t: wire?.reversed ? 1 - stepT : stepT,
            outcome: active.outcome ?? 'success',
          },
        ]
    : particles.current.map((particle) => ({
        id: particle.id,
        from: particle.route[0],
        to: particle.route[1],
        t: particle.t,
        outcome: particle.outcome ?? 'success',
      }));

  const showStep = (position: number) => {
    // The live traffic stops: one request on one hop is the whole point of a step.
    particles.current = [];
    progress.current = 0.5;
    setStepIndex(position);
    autoplay.setPlaying(false);
  };

  const showLive = () => {
    setStepIndex(LIVE);
    autoplay.setPlaying(!autoplay.reducedMotion);
  };

  const show = (position: WalkthroughPosition) => {
    if (position === stepIndex) return;
    if (position === null) showLive();
    else showStep(position);
  };

  const bars = useRef<HTMLDivElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);

  // Left and right walk Live and the steps like one control, wherever focus is in the bar.
  const onBarKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const target = event.key === 'ArrowRight' ? nextStep(stepIndex, steps.length) : previousStep(stepIndex);
    show(target);
    // Focus on a step bar follows the step, so the next arrow press starts from there.
    if (bars.current?.contains(document.activeElement)) {
      const bar = target === null ? undefined : bars.current.querySelectorAll('button')[target];
      (bar ?? nextButton.current)?.focus();
    }
  };

  const width = spec.width ?? 760;
  const height = spec.height ?? 320;
  const playing = autoplay.playing;
  const togglePlay = () => autoplay.setPlaying((value) => !value);

  return (
    <figure ref={autoplay.ref} className={cn('overflow-hidden rounded-2xl border border-line bg-canvas', className)}>
      {steps.length > 0 ? (
        // The Walkthrough bar sits above the canvas. The caption is not an edge label
        // (on a short edge it lands on a node) and not floated over the canvas (it
        // covered whichever node sat top-left). The bar is always there, so switching
        // between Live and a step never shifts the Diagram.
        // Narrow, it is two lines: the buttons and the step bars, then the caption.
        <div
          role="group"
          aria-label="Walkthrough (left and right arrows move between steps)"
          onKeyDown={onBarKey}
          className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line px-3 py-2 text-xs font-medium"
        >
          <div className="flex shrink-0 items-center gap-1">
            <BarButton
              label="Previous step"
              disabled={!canGoBack(stepIndex)}
              onClick={() => show(previousStep(stepIndex))}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </BarButton>
            <BarButton label={playing ? 'Pause' : 'Play'} onClick={togglePlay}>
              {playing ? <Pause className="h-3.5 w-3.5" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}
            </BarButton>
            <BarButton
              buttonRef={nextButton}
              label="Next step"
              disabled={!canGoNext(stepIndex, steps.length)}
              onClick={() => show(nextStep(stepIndex, steps.length))}
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </BarButton>
          </div>
          {/* A live region, so a screen reader hears the step caption, not only the button. */}
          <div
            aria-live="polite"
            className="order-last flex min-w-0 basis-full items-center gap-2 sm:order-none sm:flex-1 sm:basis-0"
          >
            {active && stepIndex !== null ? (
              <>
                <span className="shrink-0 font-mono text-faint">
                  {stepIndex + 1}/{steps.length}
                </span>
                <span
                  key={stepIndex}
                  className={cn('min-w-0 text-brand', turn.current.dir === 'next' ? 'step-in-next' : 'step-in-prev')}
                >
                  {active.label}
                </span>
              </>
            ) : (
              <span className="text-muted">Live traffic. Press next to follow one request.</span>
            )}
          </div>
          <StepBars
            barsRef={bars}
            steps={steps}
            position={stepIndex}
            // Playing, the current step fills up until the next one starts. Parked, it is full.
            fill={playing ? Math.min(1, progress.current / STEP_HOLD) : 1}
            onPick={showStep}
          />
        </div>
      ) : null}
      <DiagramCanvas
        layout={layout}
        edges={edges}
        particles={particleViews}
        width={width}
        height={height}
        grid={grid}
        fit={FLOW_FIT}
        zoom={zoom}
        focus={active ? [active.from, active.to] : undefined}
      >
        {nodes}
      </DiagramCanvas>
      {/* Anything under the canvas sits under it, not over it, so it can never cover a node. */}
      {spec.caption || steps.length === 0 ? (
        <div className="flex items-center gap-3 border-t border-line px-4 py-2">
          {/* 12px text wraps before 80 characters instead of running across a wide card. */}
          {spec.caption ? (
            <figcaption className="min-w-0 max-w-[31rem] flex-1 text-xs text-muted">{spec.caption}</figcaption>
          ) : null}
          {/* With a Walkthrough, play/pause lives in its bar at the top. */}
          {steps.length === 0 ? (
            <PlayPauseButton playing={playing} onToggle={togglePlay} className="ml-auto shrink-0" />
          ) : null}
        </div>
      ) : null}
    </figure>
  );
}

/** How long one Walkthrough step lasts in play, in units of one hop (the request travels 0 to 1, then waits). */
const STEP_HOLD = 1.25;

/**
 * One short bar per Walkthrough step: the steps already walked are full, the
 * current one fills while it plays, so the Learner sees how long the story is,
 * where they are in it and when the next step comes. Each bar is a button that
 * opens its step, and hovering it shows the caption.
 *
 * The bars stay small; on a touch screen the button around each grows to 44px
 * tall and up to 44px wide, sharing the row when many steps would not fit.
 * (`coarse:` sits before `sm:` in the CSS, so no property here sets both.)
 */
function StepBars({
  barsRef,
  steps,
  position,
  fill,
  onPick,
}: {
  barsRef: RefObject<HTMLDivElement>;
  steps: VisualStep[];
  position: WalkthroughPosition;
  fill: number;
  onPick: (position: number) => void;
}) {
  return (
    <div ref={barsRef} className="ml-auto flex min-w-0 max-w-max flex-1 basis-0 items-center justify-end">
      {steps.map((step, bar) => (
        <button
          key={`${step.from}-${step.to}-${bar}`}
          type="button"
          onClick={() => onPick(bar)}
          aria-label={`Step ${bar + 1}: ${step.label}`}
          aria-current={bar === position ? 'step' : undefined}
          title={step.label}
          className="group flex h-6 w-5 min-w-0 flex-auto items-center justify-center rounded coarse:min-h-11 coarse:min-w-0 coarse:w-11"
        >
          <span className="block h-1 w-2.5 overflow-hidden rounded-full bg-line transition-colors group-hover:bg-faint sm:w-4">
            <span
              className="block h-full w-full origin-left rounded-full bg-brand"
              style={{ transform: `scaleX(${barFill(bar, position, fill)})` }}
            />
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * A small icon button in the Walkthrough bar. Disabled is `aria-disabled`, not
 * `disabled`, so a button that stops applying (back, on reaching Live) keeps focus.
 */
function BarButton({
  buttonRef,
  label,
  disabled = false,
  onClick,
  children,
}: {
  buttonRef?: RefObject<HTMLButtonElement>;
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={label}
      title={label}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-lg border border-line text-muted transition-colors',
        disabled ? 'cursor-not-allowed opacity-40' : 'hover:border-brand hover:text-brand',
      )}
    >
      {children}
    </button>
  );
}
