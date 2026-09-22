import { useMemo, useState } from 'react';
import { Check, ListChecks, Sliders } from 'lucide-react';
import { Insight, LabShell, MetricsPanel } from '@/components/learning';
import { Badge, SegmentedControl, Slider } from '@/components/ui';
import { cn } from '@/utils/cn';
import { formatCompact } from '@/utils/format';

type Product = 'whatsapp' | 'instagram' | 'uber';

const PRODUCTS: { value: Product; label: string }[] = [
  { value: 'whatsapp', label: 'Design WhatsApp' },
  { value: 'instagram', label: 'Design Instagram' },
  { value: 'uber', label: 'Design Uber' },
];

interface RequirementOption {
  id: string;
  label: string;
  core: boolean;
  /** What including this requirement forces into the architecture. */
  implication: string;
}

const REQUIREMENTS: Record<Product, RequirementOption[]> = {
  whatsapp: [
    { id: 'send', label: 'Send messages', core: true, implication: 'Durable message store plus an ordered write path per conversation' },
    { id: 'receive', label: 'Receive messages in real time', core: true, implication: 'Persistent connections (WebSocket) and a connection registry' },
    { id: 'groups', label: 'Group conversations', core: true, implication: 'Fan-out on write or read, plus per-group rate limits' },
    { id: 'receipts', label: 'Delivery and read receipts', core: true, implication: 'A second message class and per-device state' },
    { id: 'images', label: 'Send images', core: false, implication: 'Object storage, a CDN and a transcoding pipeline' },
    { id: 'calls', label: 'Voice and video calls', core: false, implication: 'Media servers, TURN/STUN, a completely different system' },
    { id: 'stories', label: 'Stories', core: false, implication: 'Ephemeral storage with TTL and a separate read path' },
  ],
  instagram: [
    { id: 'upload', label: 'Upload a photo', core: true, implication: 'Presigned uploads to object storage plus async thumbnailing' },
    { id: 'feed', label: 'View a home feed', core: true, implication: 'Precomputed timelines - a join at read time will not hold up' },
    { id: 'follow', label: 'Follow accounts', core: true, implication: 'A social graph, and the celebrity problem it brings' },
    { id: 'like', label: 'Like and comment', core: true, implication: 'Denormalised counters updated asynchronously' },
    { id: 'search', label: 'Search users and tags', core: false, implication: 'A separate search index kept in sync via events' },
    { id: 'dm', label: 'Direct messages', core: false, implication: 'A chat system - see the WhatsApp design' },
    { id: 'reels', label: 'Short video', core: false, implication: 'Video transcoding, adaptive bitrate, far more bandwidth' },
  ],
  uber: [
    { id: 'location', label: 'Drivers publish location', core: true, implication: 'Very high write rate into an in-memory geospatial index' },
    { id: 'request', label: 'Request a ride', core: true, implication: 'A trip state machine with strong consistency' },
    { id: 'match', label: 'Match rider to driver', core: true, implication: 'Cell-based proximity search, sharded by city' },
    { id: 'track', label: 'Track the trip live', core: true, implication: 'Streaming updates to the rider app' },
    { id: 'pay', label: 'Automatic payment', core: true, implication: 'Idempotent charges and a saga with compensation' },
    { id: 'pool', label: 'Ride pooling', core: false, implication: 'A much harder optimisation problem and shared trip state' },
    { id: 'schedule', label: 'Scheduled rides', core: false, implication: 'A scheduler plus capacity forecasting' },
  ],
};

interface NfrSpec {
  id: string;
  label: string;
  values: string[];
  /**
   * Implications per index. Levels 1+ accumulate; level 0 is the relaxed
   * baseline and is dropped as soon as the target is raised.
   */
  implications: string[][];
}

const NFRS: NfrSpec[] = [
  {
    id: 'availability',
    label: 'Availability',
    values: ['99%', '99.9%', '99.99%', '99.999%'],
    implications: [
      ['Single instance is acceptable', 'Manual recovery is fine'],
      ['Redundant instances behind a load balancer', 'Health checks and automated restarts'],
      ['Multi-zone deployment', 'Automated database failover', 'Replicated storage', 'On-call rotation with runbooks'],
      ['Multi-region active-active', 'Automated failover measured in seconds', 'No manual step in any recovery path', 'Usually requires weaker consistency'],
    ],
  },
  {
    id: 'latency',
    label: 'P95 latency',
    values: ['500 ms', '200 ms', '100 ms', '20 ms'],
    implications: [
      ['A straightforward database query per request is fine'],
      ['Indexes on every query path', 'Connection pooling'],
      ['Caching layer for hot reads', 'Denormalised read models', 'CDN for static content'],
      ['In-memory data for the hot path', 'Edge compute close to users', 'Precomputed answers - no joins at read time'],
    ],
  },
  {
    id: 'users',
    label: 'Daily active users',
    values: ['1k', '100k', '10M', '100M'],
    implications: [
      ['One server and one database'],
      ['Horizontal app tier', 'Read replicas'],
      ['Caching, sharding or a partitioned store', 'Async processing for anything slow', 'Capacity planning and autoscaling'],
      ['Multi-region', 'Sharded data with a routing layer', 'Dedicated platform and SRE investment'],
    ],
  },
  {
    id: 'consistency',
    label: 'Consistency',
    values: ['Eventual', 'Read-your-writes', 'Strong'],
    implications: [
      ['Replicas can serve all reads', 'Conflict resolution must be designed'],
      ['Route a user to the primary briefly after a write', 'Session-aware routing'],
      ['Quorum or leader reads', 'Higher write latency', 'Reduced availability during partitions (CP)'],
    ],
  },
  {
    id: 'durability',
    label: 'Durability',
    values: ['Best effort', 'Normal', 'Critical'],
    implications: [
      ['In-memory storage acceptable for some data'],
      ['Replicated storage', 'Daily backups'],
      ['Synchronous replication', 'Point-in-time recovery', 'Cross-region backups with tested restores'],
    ],
  },
];

export function RequirementsLab() {
  const [product, setProduct] = useState<Product>('whatsapp');
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(REQUIREMENTS.whatsapp.filter((item) => item.core).map((item) => [item.id, true])),
  );
  const [nfr, setNfr] = useState<Record<string, number>>({
    availability: 1,
    latency: 1,
    users: 1,
    consistency: 0,
    durability: 1,
  });

  const options = REQUIREMENTS[product];
  const chosen = options.filter((option) => selected[option.id]);
  const scopeCreep = chosen.filter((option) => !option.core).length;

  const implications = useMemo(() => {
    const set = new Set<string>();
    for (const spec of NFRS) {
      const level = nfr[spec.id] ?? 0;
      // Index 0 is the relaxed baseline ("single instance is acceptable"). It only
      // holds while the target stays at that level; stricter targets replace it.
      for (let index = level === 0 ? 0 : 1; index <= level; index += 1) {
        for (const item of spec.implications[index] ?? []) set.add(item);
      }
    }
    return [...set];
  }, [nfr]);

  const complexity = Math.min(
    100,
    Math.round(
      implications.length * 4 +
        chosen.length * 3 +
        scopeCreep * 6 +
        (nfr.availability ?? 0) * 8 +
        (nfr.users ?? 0) * 6,
    ),
  );

  return (
    <LabShell
      title="Requirements Lab"
      description="Pick what the system must do, then set how well it must do it - and watch the architecture the second choice forces on you."
      onReset={() => {
        setSelected(Object.fromEntries(options.filter((item) => item.core).map((item) => [item.id, true])));
        setNfr({ availability: 1, latency: 1, users: 1, consistency: 0, durability: 1 });
      }}
      actions={
        <SegmentedControl
          value={product}
          options={PRODUCTS}
          onChange={(value) => {
            setProduct(value);
            setSelected(Object.fromEntries(REQUIREMENTS[value].filter((item) => item.core).map((item) => [item.id, true])));
          }}
        />
      }
      insight={
        <Insight>
          Functional requirements define <strong className="text-ink">what the system does</strong>; non-functional
          requirements define <strong className="text-ink">how well</strong>, and they are what actually forces
          architecture. Right now your quality targets imply {implications.length} structural decisions.
          {scopeCreep > 0 ? (
            <>
              {' '}
              You have also included {scopeCreep} non-core feature{scopeCreep > 1 ? 's' : ''} - each one is a separate
              subsystem, not a checkbox.
            </>
          ) : null}
        </Insight>
      }
      metrics={
        <>
          <MetricsPanel
            items={[
              { key: 'chosen', label: 'Requirements', value: chosen.length, hint: 'Features in scope.' },
              { key: 'core', label: 'Core flows', value: chosen.filter((item) => item.core).length, tone: 'ok', hint: 'The flows that drive the architecture.' },
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
                value: complexity,
                tone: complexity > 70 ? 'danger' : complexity > 40 ? 'warn' : 'ok',
                hint: 'An educational heuristic, not an engineering measurement.',
              },
              {
                key: 'users',
                label: 'Target scale',
                value: NFRS[2].values[nfr.users ?? 0],
                hint: 'Daily active users you are designing for.',
              },
            ]}
          />

          <div className="card p-4">
            <p className="label mb-3 flex items-center gap-2">
              <Sliders className="h-3.5 w-3.5" /> Architecture consequences
            </p>
            {implications.length === 0 ? (
              <p className="text-sm text-muted">Move a slider to see what it implies.</p>
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
        </>
      }
      controls={
        <>
          <p className="text-xs font-medium text-muted">Non-functional targets</p>
          {NFRS.map((spec) => (
            <Slider
              key={spec.id}
              label={spec.label}
              value={nfr[spec.id] ?? 0}
              min={0}
              max={spec.values.length - 1}
              onChange={(value) => setNfr((current) => ({ ...current, [spec.id]: value }))}
              format={(value) => spec.values[value]}
              scale={[spec.values[0], spec.values[spec.values.length - 1]]}
              tone={(nfr[spec.id] ?? 0) >= spec.values.length - 1 ? 'danger' : 'brand'}
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
      }
    >
      <div className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-brand" />
          <h3 className="text-sm font-semibold text-ink">What must the system DO?</h3>
          <span className="text-xs text-faint">{PRODUCTS.find((item) => item.value === product)?.label}</span>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          {options.map((option) => {
            const checked = Boolean(selected[option.id]);
            return (
              <button
                key={option.id}
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => setSelected((current) => ({ ...current, [option.id]: !checked }))}
                className={cn(
                  'flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                  checked ? 'border-brand bg-brand/5' : 'border-line hover:border-brand/40',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                    checked ? 'border-brand bg-brand text-white' : 'border-line',
                  )}
                >
                  {checked ? <Check className="h-3 w-3" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ink">{option.label}</span>
                    {option.core ? <Badge tone="ok">core</Badge> : <Badge>extra</Badge>}
                  </span>
                  <span className={cn('mt-1 block text-xs', checked ? 'text-muted' : 'text-faint')}>
                    {option.implication}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 rounded-xl border border-line bg-elevated p-4">
          <p className="label mb-2">Scope summary</p>
          <p className="text-sm text-muted">
            {chosen.length === 0
              ? 'Nothing selected - with no functional requirements there is nothing to design.'
              : `Designing for ${chosen.length} requirement${chosen.length > 1 ? 's' : ''} at ${
                  NFRS[2].values[nfr.users ?? 0]
                } daily active users (about ${formatCompact(
                  [1000, 100000, 10_000_000, 100_000_000][nfr.users ?? 0] * 20,
                )} requests/day at 20 requests per user).`}
          </p>
        </div>
      </div>
    </LabShell>
  );
}

export default RequirementsLab;
