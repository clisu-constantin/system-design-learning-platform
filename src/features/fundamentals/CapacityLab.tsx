import { useMemo, useState } from 'react';
import { Calculator } from 'lucide-react';
import { Insight, LabShell, MetricsPanel } from '@/components/learning';
import { Slider } from '@/components/ui';
import { formatBytes, formatCompact, formatNumber } from '@/utils/format';

const SECONDS_PER_DAY = 86_400;

/** Rates below 10/sec keep two decimals, so a tiny product does not read as "0 req/sec". */
const formatRate = (value: number) => (value < 10 ? value.toFixed(2) : formatNumber(value));

const formatCopies = (count: number) => `${count} ${count > 1 ? 'copies' : 'copy'}`;

interface Step {
  label: string;
  formula: string;
  result: string;
  emphasis?: boolean;
}

export function CapacityLab() {
  const [dau, setDau] = useState(10_000_000);
  const [requestsPerUser, setRequestsPerUser] = useState(20);
  const [writeShare, setWriteShare] = useState(0.1);
  const [objectSizeKb, setObjectSizeKb] = useState(2);
  const [peakFactor, setPeakFactor] = useState(5);
  const [retentionYears, setRetentionYears] = useState(5);
  const [replicationFactor, setReplicationFactor] = useState(3);

  const derived = useMemo(() => {
    const requestsPerDay = dau * requestsPerUser;
    const avgQps = requestsPerDay / SECONDS_PER_DAY;
    const peakQps = avgQps * peakFactor;
    const writesPerDay = requestsPerDay * writeShare;
    const readsPerDay = requestsPerDay - writesPerDay;
    const writeQps = writesPerDay / SECONDS_PER_DAY;
    const peakWriteQps = writeQps * peakFactor;
    const dailyBytes = writesPerDay * objectSizeKb * 1024;
    const yearlyBytes = dailyBytes * 365;
    const retainedBytes = yearlyBytes * retentionYears;
    const storedWithReplication = retainedBytes * replicationFactor;
    const bandwidthBytesPerSec = peakQps * objectSizeKb * 1024;

    return {
      requestsPerDay,
      avgQps,
      peakQps,
      writesPerDay,
      readsPerDay,
      writeQps,
      peakWriteQps,
      dailyBytes,
      yearlyBytes,
      retainedBytes,
      storedWithReplication,
      bandwidthBytesPerSec,
      readWriteRatio: writeShare > 0 ? readsPerDay / writesPerDay : Infinity,
    };
  }, [dau, requestsPerUser, writeShare, objectSizeKb, peakFactor, retentionYears, replicationFactor]);

  const steps: Step[] = [
    {
      label: 'Requests per day',
      formula: `${formatCompact(dau)} DAU x ${requestsPerUser} requests/user/day`,
      result: `${formatCompact(derived.requestsPerDay)} requests/day`,
    },
    {
      label: 'Average requests per second',
      formula: `${formatCompact(derived.requestsPerDay)} / 86,400 seconds`,
      result: `${formatRate(derived.avgQps)} req/sec`,
      emphasis: true,
    },
    {
      label: 'Peak requests per second',
      formula: `${formatRate(derived.avgQps)} x ${peakFactor} peak factor`,
      result: `${formatRate(derived.peakQps)} req/sec`,
      emphasis: true,
    },
    {
      label: 'Write rate',
      formula: `${formatRate(derived.avgQps)} req/sec x ${Math.round(writeShare * 100)}% writes`,
      result: `${formatRate(derived.writeQps)} writes/sec`,
    },
    {
      label: 'Daily storage growth',
      formula: `${formatCompact(derived.writesPerDay)} writes/day x ${objectSizeKb} KB`,
      result: formatBytes(derived.dailyBytes),
    },
    {
      label: 'Annual storage growth',
      formula: `${formatBytes(derived.dailyBytes)} x 365 days`,
      result: formatBytes(derived.yearlyBytes),
      emphasis: true,
    },
    {
      label: `Storage after ${retentionYears} year${retentionYears > 1 ? 's' : ''}`,
      formula: `${formatBytes(derived.yearlyBytes)} x ${retentionYears}`,
      result: formatBytes(derived.retainedBytes),
    },
    {
      label: 'With replication',
      formula: `${formatBytes(derived.retainedBytes)} x ${replicationFactor} copies`,
      result: formatBytes(derived.storedWithReplication),
      emphasis: true,
    },
    {
      label: 'Peak bandwidth',
      formula: `${formatRate(derived.peakQps)} req/sec x ${objectSizeKb} KB`,
      result: `${formatBytes(derived.bandwidthBytesPerSec)}/sec`,
    },
  ];

  const serversNeeded = Math.ceil(derived.peakQps / 1000);

  return (
    <LabShell
      title="Capacity Estimation Playground"
      description="Turn product numbers into infrastructure numbers, one visible step at a time."
      onReset={() => {
        setDau(10_000_000);
        setRequestsPerUser(20);
        setWriteShare(0.1);
        setObjectSizeKb(2);
        setPeakFactor(5);
        setRetentionYears(5);
        setReplicationFactor(3);
      }}
      insight={
        <Insight>
          At {formatRate(derived.peakQps)} peak requests/sec you need roughly {serversNeeded} application server
          {serversNeeded > 1 ? 's' : ''} at 1,000 req/sec each - plus headroom, so call it {Math.ceil(serversNeeded * 1.5)}.
          Storage grows to {formatBytes(derived.storedWithReplication)} including replication.{' '}
          {derived.peakWriteQps > 10000
            ? `At ${formatRate(derived.peakWriteQps)} peak writes/sec a single database primary will not absorb the writes - plan for partitioning early.`
            : `Peak writes of ${formatRate(derived.peakWriteQps)}/sec fit on one primary database; reads scale out with replicas and caching.`}{' '}
          Round aggressively: the decisions that follow from 11,575 req/sec and "about 10k" are identical.
        </Insight>
      }
      metrics={
        <MetricsPanel
          items={[
            { key: 'avgQps', label: 'Average QPS', value: formatRate(derived.avgQps), tone: 'brand', hint: 'Requests per second averaged over 24 hours.' },
            { key: 'peakQps', label: 'Peak QPS', value: formatRate(derived.peakQps), tone: 'warn', hint: 'What you must actually provision for.' },
            { key: 'writeQps', label: 'Writes/sec', value: formatRate(derived.writeQps), hint: 'Writes are usually the hard constraint.' },
            {
              key: 'ratio',
              label: 'Read:write',
              value: Number.isFinite(derived.readWriteRatio) ? `${Math.round(derived.readWriteRatio)}:1` : 'writes only',
              hint: 'A high ratio means caching and replicas will help a lot.',
            },
            { key: 'yearly', label: 'Storage/year', value: formatBytes(derived.yearlyBytes), hint: 'Before replication.' },
            { key: 'bandwidth', label: 'Peak bandwidth', value: `${formatBytes(derived.bandwidthBytesPerSec)}/s`, tone: 'violet' },
          ]}
        />
      }
      controls={
        <>
          <Slider
            label="Daily active users"
            value={Math.log10(dau)}
            min={3}
            max={9}
            step={0.1}
            onChange={(value) => setDau(Math.round(10 ** value))}
            format={() => formatCompact(dau)}
            scale={['1k', '1B']}
            hint="Logarithmic - system design decisions change per order of magnitude."
          />
          <Slider
            label="Requests per user per day"
            value={requestsPerUser}
            min={1}
            max={200}
            onChange={setRequestsPerUser}
            format={(value) => `${value}`}
          />
          <Slider
            label="Write share"
            value={writeShare}
            min={0.01}
            max={1}
            step={0.01}
            onChange={setWriteShare}
            format={(value) => `${Math.round(value * 100)}% writes`}
            hint="Most consumer products are read-heavy - often 10:1 or more."
          />
          <Slider
            label="Average object size"
            value={objectSizeKb}
            min={0.1}
            max={2000}
            step={0.1}
            onChange={setObjectSizeKb}
            format={(value) => (value < 1024 ? `${value.toFixed(1)} KB` : `${(value / 1024).toFixed(1)} MB`)}
          />
          <Slider
            label="Peak factor"
            value={peakFactor}
            min={1}
            max={20}
            onChange={setPeakFactor}
            format={(value) => `${value}x average`}
            tone="warn"
            hint="Traffic is never flat. 2-10x is typical depending on the product."
          />
          <Slider
            label="Retention"
            value={retentionYears}
            min={1}
            max={10}
            onChange={setRetentionYears}
            format={(value) => `${value} year${value > 1 ? 's' : ''}`}
          />
          <Slider
            label="Replication factor"
            value={replicationFactor}
            min={1}
            max={5}
            onChange={setReplicationFactor}
            format={formatCopies}
            hint="Durability costs storage: three copies means three times the bill."
          />
        </>
      }
    >
      <div className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Calculator className="h-4 w-4 text-brand" />
          <h3 className="text-sm font-semibold text-ink">Step by step</h3>
        </div>
        <ol className="space-y-2">
          {steps.map((step, index) => (
            <li
              key={step.label}
              className={`grid gap-2 rounded-xl border px-4 py-3 sm:grid-cols-[180px_1fr_auto] sm:items-center ${
                step.emphasis ? 'border-brand/40 bg-brand/5' : 'border-line'
              }`}
            >
              <span className="flex items-center gap-2 text-xs font-medium text-ink">
                <span className="font-mono text-[10px] text-faint">{index + 1}</span>
                {step.label}
              </span>
              <span className="font-mono text-[11px] text-muted">{step.formula}</span>
              <span className={`font-mono text-sm font-semibold ${step.emphasis ? 'text-brand' : 'text-ink'}`}>
                = {step.result}
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-line bg-elevated p-4">
            <p className="label">App servers needed</p>
            <p className="metric-value mt-1 text-ink">{Math.ceil(serversNeeded * 1.5)}</p>
            <p className="mt-1 text-[11px] text-faint">at 1,000 req/sec each, with 50% headroom</p>
          </div>
          <div className="rounded-xl border border-line bg-elevated p-4">
            <p className="label">Cache memory (20% hot)</p>
            <p className="metric-value mt-1 text-ink">{formatBytes(derived.dailyBytes * 0.2)}</p>
            <p className="mt-1 text-[11px] text-faint">one day of hot objects</p>
          </div>
          <div className="rounded-xl border border-line bg-elevated p-4">
            <p className="label">{retentionYears}-year storage</p>
            <p className="metric-value mt-1 text-ink">{formatBytes(derived.storedWithReplication)}</p>
            <p className="mt-1 text-[11px] text-faint">including replication ({formatCopies(replicationFactor)})</p>
          </div>
        </div>
      </div>
    </LabShell>
  );
}

export default CapacityLab;
