import { useCallback, useMemo, useRef, useState } from 'react';
import { Check, ListChecks, Sliders } from 'lucide-react';
import { ArchNode, DiagramCanvas, NodeStatRow, ParticleLegend, type Layout, type ParticleView } from '@/components/architecture';
import { Insight, LabShell, MetricsPanel } from '@/components/learning';
import { Badge, SegmentedControl, Slider, Toggle } from '@/components/ui';
import { advanceParticles, nextParticleId, useEventLog, useTicker, type Particle } from '@/simulations/engine';
import { useRerender } from '@/hooks/useRerender';
import { sampleArrivals } from '@/utils/math';
import { cn } from '@/utils/cn';
import { formatCompact, formatNumber } from '@/utils/format';
import type { LabProps } from '@/types';
import { DAU, TRAFFIC, type Product } from './requirementsSizing';
import {
  DEFAULT_SETUP,
  FOCUS_SETUPS,
  HEIGHT,
  MID,
  NFRS,
  PART_ORDER,
  REGION2,
  REGION2_BOXES,
  REQUIREMENTS,
  ROW,
  SLOTS,
  architecture,
  chosenOf,
  consistencyApplies,
  edgesFor,
  implicationsFor,
  legendFor,
  routesFor,
  subtitleFor,
  switchProduct,
  valueOf,
  type Architecture,
  type Legend,
  type NfrId,
  type RouteVariant,
  type Setup,
  type WireKey,
} from './requirementsArchitecture';
import { formatCost, relativeCost } from './requirementsCost';

const PRODUCT_NAME: Record<Product, string> = { whatsapp: 'WhatsApp', instagram: 'Instagram', uber: 'Uber' };

const PRODUCTS = (Object.keys(PRODUCT_NAME) as Product[]).map((value) => ({ value, label: `Design ${PRODUCT_NAME[value]}` }));

function pick(variants: RouteVariant[]) {
  let roll = Math.random() * variants.reduce((sum, variant) => sum + variant.weight, 0);
  for (const variant of variants) {
    roll -= variant.weight;
    if (roll <= 0) return variant;
  }
  return variants[variants.length - 1];
}

const PARTICLE_BUDGET = 80;
/** Particles emitted per second: a sample that grows with the user count, not the real rate. */
const VISUAL_RATE = [5, 8, 12, 16];

interface State {
  particles: Particle[];
}

export function RequirementsLab({ focus }: LabProps<'requirements'>) {
  // The page keys this lab by Concept, so the focus never changes under a mounted lab.
  const start = focus ? FOCUS_SETUPS[focus] : DEFAULT_SETUP;
  // Every control lives in one object, so Reset cannot miss one.
  const [setup, setSetup] = useState<Setup>(start);
  const [running, setRunning] = useState(true);
  const state = useRef<State>({ particles: [] });
  const rerender = useRerender(30);
  const { events, log, clear } = useEventLog();

  const { product, selected, nfr, panel } = setup;
  const arch = useMemo(() => architecture(setup), [setup]);
  const edges = useMemo(() => edgesFor(arch), [arch]);
  const cost = useMemo(() => relativeCost(setup, arch), [setup, arch]);
  const legend = useMemo(() => legendFor(arch), [arch]);
  const implications = useMemo(() => implicationsFor(setup, arch), [setup, arch]);
  const variants = useMemo(() => arch.flows.map((flow) => routesFor(flow, arch)), [arch]);
  const layout = useMemo<Layout>(() => {
    const placed: Layout = {};
    for (const id of PART_ORDER) {
      if (!arch.parts[id] && !arch.notBuilt[id]) continue;
      if (id === 'region2') Object.assign(placed, REGION2_BOXES);
      else placed[id] = SLOTS[id];
    }
    return placed;
  }, [arch]);

  const options = REQUIREMENTS[product];
  const chosen = chosenOf(setup);
  const scopeCreep = chosen.filter((option) => !option.core).length;

  /** Applies a new setup and logs which parts the change added or removed. */
  const commit = (next: Setup) => {
    const before = architecture(setup);
    const after = architecture(next);
    for (const id of PART_ORDER) {
      const was = before.parts[id];
      const now = after.parts[id];
      if (!was && now) log(`Added ${now.title} - for ${now.reasons.join(', ')}`, 'ok');
      else if (was && !now) log(`Removed ${was.title} - no requirement needs it now`, 'warn');
      else if (was && now && was.title !== now.title) log(`${was.title} became ${now.title}`, 'info');
      else if (was && now && now.status && was.status !== now.status) log(`${now.title}: ${now.status}`, 'info');
    }
    if (before.zones !== after.zones && after.parts.api) log(`Region 1 now runs in ${after.zones === 1 ? 'one zone' : `${after.zones} zones`}`, 'info');
    // Name what the change cost (or saved), in the same units as the metric.
    const [costBefore, costAfter] = [relativeCost(setup, before), relativeCost(next, after)];
    if (costBefore > 0 && costAfter > 0 && formatCost(costBefore) !== formatCost(costAfter)) {
      log(`Monthly cost ${formatCost(costBefore)} -> ${formatCost(costAfter)}`, costAfter > costBefore ? 'warn' : 'info');
    }
    // Drop requests travelling through parts that just disappeared.
    const alive = new Set<string>(PART_ORDER.filter((id) => after.parts[id]));
    if (after.region2) Object.keys(REGION2_BOXES).forEach((id) => alive.add(id));
    state.current.particles = state.current.particles.filter((particle) => particle.route.every((id) => alive.has(id)));
    setSetup(next);
  };

  const reset = useCallback(() => {
    // Back to this Concept's starting setup, not the lab's global default.
    setSetup(start);
    state.current = { particles: [] };
    clear();
  }, [start, clear]);

  useTicker(running, (dt) => {
    const current = state.current;
    if (variants.length > 0) {
      const arrivals = sampleArrivals(VISUAL_RATE[nfr.users], dt);
      for (let index = 0; index < arrivals; index += 1) {
        const variant = pick(variants[Math.floor(Math.random() * variants.length)]);
        current.particles.push({
          id: nextParticleId(),
          route: variant.route,
          leg: 0,
          t: 0,
          speed: 1.2 + Math.random() * 0.3,
          outcome: variant.outcome,
        });
      }
    }
    // A stored write carries on to region 2 along its own route, so nothing is copied here.
    const { alive } = advanceParticles(current.particles, dt);
    current.particles = alive.length > PARTICLE_BUDGET ? alive.slice(-PARTICLE_BUDGET) : alive;
    rerender();
  });

  const complexity = Math.min(
    100,
    Math.round(implications.length * 4 + chosen.length * 3 + scopeCreep * 6 + nfr.availability * 8 + nfr.users * 6),
  );

  const partCount = PART_ORDER.filter((id) => id !== 'users' && arch.parts[id]).length;

  const particleViews: ParticleView[] = state.current.particles.map((particle) => ({
    id: particle.id,
    from: particle.route[particle.leg],
    to: particle.route[particle.leg + 1],
    t: particle.t,
    outcome: particle.outcome ?? 'success',
  }));

  const toggleFeature = (id: string) => commit({ ...setup, selected: { ...selected, [id]: !selected[id] } });
  const setTarget = (id: NfrId) => (value: number) => commit({ ...setup, nfr: { ...nfr, [id]: value } });

  return (
    <LabShell
      title="Requirements Lab"
      description="Pick what the system must do, then set how well it must do it - and watch each choice add the parts it forces to the diagram."
      running={running}
      onToggleRun={() => setRunning((value) => !value)}
      onReset={reset}
      actions={
        <SegmentedControl value={product} options={PRODUCTS} onChange={(value) => commit(switchProduct(setup, value))} />
      }
      legend={<RequirementsLegend legend={legend} />}
      events={events}
      insight={<Insight>{insightFor(setup, arch, implications.length, scopeCreep)}</Insight>}
      metrics={
        <>
          <MetricsPanel
            items={[
              { key: 'chosen', label: 'Requirements', value: chosen.length, hint: 'Features in scope.' },
              {
                key: 'parts',
                label: 'Parts on diagram',
                value: partCount,
                tone: 'brand',
                hint: 'Boxes the requirements forced, not counting the users or the grey not-built ones. Each one is built, paid for and operated.',
              },
              {
                key: 'cost',
                label: 'Monthly cost',
                value: chosen.length === 0 ? '-' : formatCost(cost),
                tone: chosen.length === 0 ? 'neutral' : cost >= 2 ? 'warn' : 'neutral',
                sub: 'Simplified model',
                hint: `x1 is the simplest ${PRODUCT_NAME[product]} design: its core features at the relaxed targets, one copy of each part. Every copy drawn is billed - app servers, database copies, the load balancer pair - plus the traffic between zones and a full copy in region 2. Round ratios (one app server = 1, a database copy = 3), not a price list.`,
                simulated: true,
              },
              {
                key: 'spof',
                label: 'Single points',
                value: chosen.length === 0 ? '-' : arch.singlePoints.length,
                tone: chosen.length === 0 ? 'neutral' : arch.singlePoints.length > 0 ? 'warn' : 'ok',
                hint:
                  arch.singlePoints.length > 0
                    ? `Parts with one copy, so their failure stops the system: ${arch.singlePoints.join(', ')}.`
                    : 'Parts with only one copy, so their failure stops the system.',
              },
              {
                key: 'creep',
                label: 'Beyond core',
                value: scopeCreep,
                tone: scopeCreep > 1 ? 'warn' : 'neutral',
                hint: 'Each of these is a subsystem with its own scaling story.',
              },
              {
                key: 'implications',
                label: 'Forced decisions',
                value: implications.length,
                tone: 'brand',
                hint: 'Architecture consequences implied by your quality targets.',
              },
              {
                key: 'complexity',
                label: 'Complexity score',
                // With no functional requirement there is nothing to design, so no score.
                value: chosen.length === 0 ? '-' : complexity,
                tone: chosen.length === 0 ? 'neutral' : complexity > 70 ? 'danger' : complexity > 40 ? 'warn' : 'ok',
                hint: 'An educational heuristic, not an engineering measurement.',
              },
              {
                key: 'peak',
                label: 'Peak traffic',
                value: formatNumber(arch.sizing.peakQps),
                unit: 'req/s',
                hint: `${valueOf('users', nfr.users)} daily users x ${formatNumber(arch.sizing.requestsPerUser)} requests each, spread over a day, times ${TRAFFIC[product].peakFactor} for the peak. The Capacity Lab gives the same servers for the same numbers.`,
                simulated: true,
              },
              {
                key: 'writes',
                label: 'Peak writes',
                value: formatNumber(arch.sizing.peakWriteQps),
                unit: '/s',
                hint:
                  arch.sizing.index.peakWriteQps > 0
                    ? `Most of these are driver locations into the geo index; the database takes ${formatNumber(arch.sizing.database.peakWriteQps)}/s. One primary absorbs about 10,000/s.`
                    : 'Every write goes to the database primary, which absorbs about 10,000/s before the writes must be partitioned.',
                simulated: true,
              },
              {
                key: 'users',
                label: 'Target scale',
                value: valueOf('users', nfr.users),
                hint: 'Daily active users you are designing for.',
              },
            ]}
          />

          <div className="card p-4">
            <p className="label mb-3 flex items-center gap-2">
              <Sliders className="h-3.5 w-3.5" /> Architecture consequences
            </p>
            {implications.length === 0 ? (
              <p className="text-sm text-muted">
                {chosen.length === 0
                  ? 'Tick a requirement first: with nothing to build, no target forces anything.'
                  : 'Move a slider to see what it implies.'}
              </p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {implications.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-ok" />
                    {item}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-faint">
              Every line here costs money and operational effort. That is the point of naming the target first: it makes
              the price visible before anyone builds.
            </p>
          </div>

          <div className="card p-4">
            <p className="label mb-2">Scope summary</p>
            <p className="text-sm text-muted">
              {chosen.length === 0
                ? 'Nothing selected - with no functional requirements there is nothing to design.'
                : `Designing for ${chosen.length} requirement${chosen.length > 1 ? 's' : ''} at ${valueOf('users', nfr.users)} daily active users (about ${formatCompact(
                    DAU[nfr.users] * arch.sizing.requestsPerUser,
                  )} requests/day at ${formatNumber(arch.sizing.requestsPerUser)} requests per user, ${Math.round(
                    arch.sizing.writeShare * 100,
                  )}% of them writes).`}
            </p>
          </div>
        </>
      }
      controls={
        <>
          <SegmentedControl
            size="sm"
            className="w-full"
            value={panel}
            options={[
              { value: 'features', label: 'What it must do' },
              { value: 'targets', label: 'How well' },
            ]}
            onChange={(value) => setSetup((current) => ({ ...current, panel: value }))}
          />

          {panel === 'features' ? (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-xs font-medium text-muted">
                <ListChecks className="h-3.5 w-3.5 text-brand" /> Functional requirements
              </p>
              {options.map((option) => (
                <Toggle
                  key={option.id}
                  checked={Boolean(selected[option.id])}
                  onChange={() => toggleFeature(option.id)}
                  label={
                    <>
                      <span className="text-ink">{option.label}</span>
                      {option.core ? <Badge tone="ok">core</Badge> : <Badge>extra</Badge>}
                    </>
                  }
                  description={option.implication}
                />
              ))}
            </div>
          ) : (
            <>
              <p className="text-xs font-medium text-muted">Non-functional targets</p>
              {NFRS.map((spec) => (
                <Slider
                  key={spec.id}
                  label={spec.label}
                  value={nfr[spec.id]}
                  min={0}
                  max={spec.values.length - 1}
                  onChange={setTarget(spec.id)}
                  format={(value) => spec.values[value]}
                  scale={[spec.values[0], spec.values[spec.values.length - 1]]}
                  tone={nfr[spec.id] >= spec.values.length - 1 ? 'danger' : 'brand'}
                  disabled={spec.id === 'consistency' && !consistencyApplies(arch)}
                  hint={
                    spec.id === 'consistency' && !consistencyApplies(arch)
                      ? 'Needs a second database copy. With one copy, every read already sees the latest write.'
                      : undefined
                  }
                />
              ))}
              <div className="rounded-xl border border-line bg-elevated p-3 text-[11px] text-muted">
                <p className="label mb-2">Availability in practice</p>
                <ul className="space-y-0.5 font-mono">
                  <li>99% {'->'} 3.65 days down/year</li>
                  <li>99.9% {'->'} 8.8 hours</li>
                  <li>99.99% {'->'} 52 minutes</li>
                  <li>99.999% {'->'} 5.3 minutes</li>
                </ul>
              </div>
            </>
          )}
        </>
      }
    >
      <DiagramCanvas
        layout={layout}
        edges={edges}
        particles={particleViews}
        height={HEIGHT}
        className="bg-canvas"
        underlay={<Zones zones={arch.zones} region2={arch.region2} empty={chosen.length === 0} />}
      >
        {arch.parts.region2 ? (
          <ArchNode
            key="region2"
            kind="server"
            title="Region 2"
            subtitle={subtitleFor(arch.parts.region2, arch)}
            placed={REGION2}
            compact
          />
        ) : null}
        {PART_ORDER.filter((id) => id !== 'region2').map((id) => {
          const part = arch.parts[id];
          const cut = arch.notBuilt[id];
          if (cut) {
            // Greyed out like the not-built part of the Diagram: named by the feature left out.
            return (
              <ArchNode
                key={id}
                kind={cut.kind}
                status="down"
                statusLabel="Not built"
                title={cut.title}
                subtitle={subtitleFor(cut, arch)}
                placed={SLOTS[id]}
                compact
              />
            );
          }
          if (!part) return null;
          return (
            <ArchNode
              key={id}
              kind={part.kind}
              statusLabel={part.status}
              title={part.title}
              subtitle={subtitleFor(part, arch)}
              placed={SLOTS[id]}
              compact
            >
              {part.stat ? <NodeStatRow label={part.stat.label} value={part.stat.value} tone={part.stat.tone} /> : null}
            </ArchNode>
          );
        })}
      </DiagramCanvas>
    </LabShell>
  );
}

/** The swatch drawn beside each wire legend line: the wire colour, or a dashed line. */
const WIRE_SWATCH: Partial<Record<WireKey, string>> = {
  brand: 'bg-brand',
  violet: 'bg-violet',
  info: 'bg-info',
  ok: 'bg-ok',
  warn: 'bg-warn',
  dashed: 'border-t-2 border-dashed border-faint',
  'not-built': 'border-t-2 border-dashed border-faint/40',
};

/** Only what is on screen: the wire tones drawn and the particle shapes that travel. */
function RequirementsLegend({ legend }: { legend: Legend }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      <ParticleLegend outcomes={legend.outcomes}>
        {legend.wires.map((wire) => (
          <span key={wire.tone} className="flex items-center gap-1.5 text-[11px] text-muted">
            <span aria-hidden className={cn('inline-block w-4', wire.tone === 'dashed' || wire.tone === 'not-built' ? '' : 'h-0.5 rounded', WIRE_SWATCH[wire.tone])} />
            {wire.label}
          </span>
        ))}
      </ParticleLegend>
      <span className="text-[11px] text-faint">
        Server counts use the Capacity Lab model (1,000 req/s per server, 50% headroom); they and the hit rates are a
        simplified model.
      </span>
    </div>
  );
}

/** The data center or zones everything runs in, drawn under the wiring. */
function Zones({ zones, region2, empty }: { zones: number; region2: boolean; empty: boolean }) {
  if (empty) {
    return (
      <text x={560} y={MID + 50} textAnchor="middle" className="fill-faint" style={{ fontSize: 13 }}>
        Nothing is required yet, so nothing is built. Tick a requirement.
      </text>
    );
  }
  return (
    <g>
      <rect x={8} y={96} width={944} height={HEIGHT - 104} rx={14} className="fill-info/5 stroke-line" strokeDasharray="4 4" />
      <text x={24} y={ROW[0] + 16} className="fill-faint font-mono" style={{ fontSize: 11 }}>
        {region2 ? 'REGION 1' : 'ONE REGION'}
      </text>
      <text x={24} y={ROW[0] + 30} className="fill-faint font-mono" style={{ fontSize: 11 }}>
        {zones > 1 ? `${zones} ZONES` : 'ONE ZONE'}
      </text>
    </g>
  );
}

function insightFor(setup: Setup, arch: Architecture, forced: number, scopeCreep: number) {
  const chosen = chosenOf(setup);
  if (chosen.length === 0) {
    return <>No requirement, no system: the diagram holds only the users. Tick a feature to see the first parts appear.</>;
  }
  const parts = PART_ORDER.filter((id) => id !== 'users' && arch.parts[id]).length;
  return (
    <>
      Functional requirements decide <strong className="text-ink">what the system does</strong>, and each one pulls in
      the parts its traffic needs - every box names the requirement that forced it. Non-functional requirements decide{' '}
      <strong className="text-ink">how well</strong>: they add copies, caches and regions. Right now {chosen.length}{' '}
      requirement{chosen.length > 1 ? 's' : ''} and your quality targets force {parts} part{parts === 1 ? '' : 's'} and{' '}
      {forced} structural decision{forced === 1 ? '' : 's'}.
      {arch.singlePoints.length > 0 ? (
        <> Still one copy of: {arch.singlePoints.join(', ')} - fine at 99%, not above it.</>
      ) : null}
      {Object.keys(arch.notBuilt).length > 0 ? (
        <>
          {' '}
          The grey boxes are what the unticked features would need: saying no to them keeps those parts off the
          bill.
        </>
      ) : null}
      {scopeCreep > 0 ? (
        <>
          {' '}
          You have also included {scopeCreep} non-core feature{scopeCreep > 1 ? 's' : ''} - each one is a separate
          subsystem, not a checkbox.
        </>
      ) : null}
    </>
  );
}

export default RequirementsLab;
