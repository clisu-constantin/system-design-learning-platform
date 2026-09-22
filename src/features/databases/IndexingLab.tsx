import { useCallback, useMemo, useRef, useState } from 'react';
import { Database, Search, Trash2, Zap } from 'lucide-react';
import { Insight, LabShell, MetricsPanel } from '@/components/learning';
import { Button, Meter, Select, Slider } from '@/components/ui';
import { useTicker } from '@/simulations/engine';
import { computeLoad } from '@/simulations/models/load';
import { useRerender } from '@/hooks/useRerender';
import { mulberry32 } from '@/utils/math';
import { formatLatency, formatNumber } from '@/utils/format';
import { cn } from '@/utils/cn';

interface Row {
  id: number;
  name: string;
  email: string;
  country: string;
  createdAt: string;
}

const FIRST = ['ada', 'grace', 'linus', 'barbara', 'alan', 'edsger', 'katherine', 'john', 'radia', 'leslie'];
const LAST = ['lovelace', 'hopper', 'torvalds', 'liskov', 'turing', 'dijkstra', 'johnson', 'backus', 'perlman', 'lamport'];
const COUNTRIES = ['DE', 'US', 'RO', 'JP', 'BR', 'IN', 'FR', 'NG'];

/** Deterministic table so the row numbers quoted in the UI stay stable. */
function buildTable(size: number): Row[] {
  const random = mulberry32(20260915);
  return Array.from({ length: size }, (_, index) => {
    const first = FIRST[Math.floor(random() * FIRST.length)];
    const last = LAST[Math.floor(random() * LAST.length)];
    return {
      id: index + 1,
      name: `${first} ${last}`,
      email: `${first}.${last}${index + 1}@example.com`,
      country: COUNTRIES[Math.floor(random() * COUNTRIES.length)],
      createdAt: `2026-${String(1 + Math.floor(random() * 9)).padStart(2, '0')}-${String(
        1 + Math.floor(random() * 28),
      ).padStart(2, '0')}`,
    };
  });
}

/**
 * Cost model: a sequential scan reads rows one at a time; the index lookup is
 * modelled as a binary search, log2(n) steps. Simplified on purpose: a real
 * B-tree node holds hundreds of keys, so 50,000 rows sit about 3 levels deep.
 * The O(log n) shape is the lesson, and halving is easier to follow.
 */
const SCAN_MS_PER_1000_ROWS = 42;
const BTREE_MS_PER_LEVEL = 0.28;

type Result = {
  mode: 'scan' | 'index';
  rowsInspected: number;
  timeMs: number;
  found: Row | null;
};

/** Structure updates per second one machine sustains before writes queue. */
const WRITE_CAPACITY = 3000;

export function IndexingLab() {
  const [tableSize, setTableSize] = useState(8000);
  const [hasIndex, setHasIndex] = useState(false);
  const [target, setTarget] = useState('');
  // One result per mode, so the scan and the index lookup stay side by side
  // until the table size or the target changes. lastMode picks which one the
  // metrics strip and the insight describe.
  const [results, setResults] = useState<{ scan: Result | null; index: Result | null }>({ scan: null, index: null });
  const [lastMode, setLastMode] = useState<Result['mode'] | null>(null);
  const result = lastMode ? results[lastMode] : null;
  const clearResults = () => {
    setResults({ scan: null, index: null });
    setLastMode(null);
  };
  const [writeRate, setWriteRate] = useState(200);

  const scan = useRef<{ position: number; total: number; targetIndex: number } | null>(null);
  const rerender = useRerender(30);

  const rows = useMemo(() => buildTable(tableSize), [tableSize]);
  const sample = rows[Math.floor(tableSize * 0.78)];
  const email = target || sample.email;

  const runQuery = useCallback(
    (mode: 'scan' | 'index') => {
      const index = rows.findIndex((row) => row.email === email);
      const found = index >= 0 ? rows[index] : null;
      const rowsInspected = mode === 'scan' ? (index >= 0 ? index + 1 : rows.length) : Math.ceil(Math.log2(rows.length));
      const timeMs =
        mode === 'scan'
          ? (rowsInspected / 1000) * SCAN_MS_PER_1000_ROWS
          : rowsInspected * BTREE_MS_PER_LEVEL + 1.4;

      scan.current =
        mode === 'scan' ? { position: 0, total: index >= 0 ? index + 1 : rows.length, targetIndex: index } : null;

      setResults((previous) => ({
        ...previous,
        [mode]: { mode, rowsInspected, timeMs, found },
      }));
      setLastMode(mode);
      rerender();
    },
    [email, rows, rerender],
  );

  const scanning = scan.current !== null && scan.current.position < scan.current.total;
  const scanPosition = scan.current?.position ?? 0;

  // Animate the scanned-row counter so the cost of a full scan is felt, not just read.
  useTicker(scanning, (dt) => {
    const current = scan.current;
    if (!current) return;
    const step = Math.max(1, Math.round(current.total * dt * 0.9));
    current.position = Math.min(current.total, current.position + step);
    rerender();
  });

  const btreeLevels = Math.ceil(Math.log2(Math.max(2, tableSize)));
  // Derived from the same model as the write-path meter: each write touches
  // the table plus one structure per index. A fixed +35% here contradicted the
  // meter, which showed the index doubling the structures updated.
  const structuresPerWrite = hasIndex ? 2 : 1;
  const writeOverhead = structuresPerWrite - 1;
  const indexStorageMb = (tableSize * 40) / 1_000_000;

  // The write-rate slider has to cost something, or the trade-off this lab
  // teaches is only a sentence. Every write updates the table and each index,
  // so the index doubles the structures touched and halves the write headroom.
  const structuresPerSecond = writeRate * structuresPerWrite;
  const writeLoad = computeLoad(structuresPerSecond, WRITE_CAPACITY, { baseLatencyMs: 4, kneeAt: 0.65 });

  const visibleRows = useMemo(() => {
    if (scanning) {
      const start = Math.max(0, scanPosition - 6);
      return rows.slice(start, start + 12);
    }
    return rows.slice(0, 12);
  }, [rows, scanning, scanPosition]);

  return (
    <LabShell
      title="Database Indexing Lab"
      description={`A users table with ${formatNumber(tableSize)} rows. Find one row with and without an index, and see what the index costs on writes.`}
      onReset={() => {
        clearResults();
        scan.current = null;
        setHasIndex(false);
        rerender();
      }}
      actions={
        <>
          <Button variant="secondary" onClick={() => runQuery('scan')}>
            <Search className="h-4 w-4" />
            Run without index
          </Button>
          <Button
            variant={hasIndex ? 'primary' : 'secondary'}
            onClick={() => {
              if (!hasIndex) setHasIndex(true);
              runQuery('index');
            }}
          >
            <Zap className="h-4 w-4" />
            {hasIndex ? 'Run with index' : 'Create index on email'}
          </Button>
          {hasIndex ? (
            <Button
              variant="danger"
              onClick={() => {
                setHasIndex(false);
                // The index is gone, so its result no longer describes anything.
                // The scan result still does, and stays.
                setResults((previous) => ({ ...previous, index: null }));
                setLastMode((mode) => (mode === 'index' ? (results.scan ? 'scan' : null) : mode));
              }}
            >
              <Trash2 className="h-4 w-4" />
              Drop index
            </Button>
          ) : null}
        </>
      }
      insight={
        <Insight>
          {result?.mode === 'index' ? (
            <>
              The index lookup inspected about {result.rowsInspected} nodes instead of {formatNumber(rows.length)}{' '}
              rows - each step discards half the remaining candidates (a binary search, simplified - a real B-tree
              packs hundreds of keys per node and is only 2-3 levels deep here). The cost is on the other side: every
              INSERT, UPDATE and DELETE must now also maintain this index, and it occupies roughly{' '}
              {indexStorageMb.toFixed(1)} MB.
            </>
          ) : result?.mode === 'scan' ? (
            <>
              A sequential scan read {formatNumber(result.rowsInspected)} rows to find one. Doubling the table doubles
              the work - this is O(n). An index turns it into O(log n), which is {btreeLevels} steps at this size.
            </>
          ) : (
            <>
              Run the query both ways. The interesting number is not the milliseconds but the growth rate: a scan is
              linear in table size, a B-tree lookup grows logarithmically.
            </>
          )}
        </Insight>
      }
      metrics={
        <>
          <MetricsPanel
            items={[
              {
                key: 'rowsScanned',
                label: 'Rows inspected',
                value: result ? formatNumber(scanning ? scanPosition : result.rowsInspected) : '-',
                tone: result?.mode === 'index' ? 'ok' : result ? 'danger' : 'neutral',
              },
              {
                key: 'queryTime',
                label: 'Query time',
                value: result ? formatLatency(result.timeMs) : '-',
                tone: result?.mode === 'index' ? 'ok' : result ? 'danger' : 'neutral',
                hint: 'Estimated from rows read - the shape of the curve is what matters.',
              },
              { key: 'tableSize', label: 'Table rows', value: formatNumber(tableSize), hint: 'Rows in the users table.' },
              {
                key: 'btree',
                label: 'Lookup steps',
                value: hasIndex ? btreeLevels : '-',
                hint: 'log2(rows), a binary search. Simplified - a real B-tree has hundreds of keys per node, so it is much shallower (about 3 levels for 50,000 rows).',
              },
              {
                key: 'writeCost',
                label: 'Write overhead',
                value: hasIndex ? `+${Math.round(writeOverhead * 100)}%` : '0%',
                tone: hasIndex ? 'warn' : 'ok',
                hint: 'Extra structures updated per INSERT/UPDATE/DELETE: the table, plus one per index. Simplified model.',
              },
              {
                key: 'writeLatency',
                label: 'Write latency',
                value: formatLatency(writeLoad.latencyMs),
                tone: writeLoad.saturated ? 'danger' : writeLoad.cpu > 0.7 ? 'warn' : 'ok',
                hint: 'Time per INSERT at the current write rate. An index is paid for here. Simulated by a simplified queueing model, not measured.',
              },
              {
                key: 'storage',
                label: 'Index storage',
                value: hasIndex ? `${indexStorageMb.toFixed(1)} MB` : '0 MB',
                tone: hasIndex ? 'warn' : 'neutral',
                hint: 'Indexes are additional data that must fit in memory to stay fast.',
              },
            ]}
          />

          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <p className="label">users table</p>
              <p className="font-mono text-[11px] text-faint">
                {scanning ? `scanning row ${formatNumber(scanPosition)} / ${formatNumber(scan.current?.total ?? 0)}` : 'idle'}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left font-mono text-[11px]">
                <thead className="bg-elevated text-faint">
                  <tr>
                    <th className="px-4 py-2 font-medium">id</th>
                    <th className="px-4 py-2 font-medium">name</th>
                    <th className="px-4 py-2 font-medium">email</th>
                    <th className="px-4 py-2 font-medium">country</th>
                    <th className="px-4 py-2 font-medium">created_at</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => {
                    const isTarget = row.email === email;
                    const isCurrent = scanning && row.id === scanPosition;
                    return (
                      <tr
                        key={row.id}
                        className={cn(
                          'border-t border-line',
                          isCurrent && 'bg-warn/15',
                          isTarget && result && !scanning && 'bg-ok/15',
                        )}
                      >
                        <td className="px-4 py-1.5 text-faint">{row.id}</td>
                        <td className="px-4 py-1.5 text-muted">{row.name}</td>
                        <td className={cn('px-4 py-1.5', isTarget ? 'text-ok' : 'text-ink')}>{row.email}</td>
                        <td className="px-4 py-1.5 text-muted">{row.country}</td>
                        <td className="px-4 py-1.5 text-faint">{row.createdAt}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {hasIndex ? (
            <div className="card p-4">
              <p className="label mb-3">Index on users(email), drawn as a binary search</p>
              <BTreeView levels={Math.min(4, btreeLevels)} email={email} />
              <p className="mt-3 text-xs text-faint">
                Each level halves the search space. {formatNumber(tableSize)} rows need {btreeLevels} levels, so a
                lookup reads about {btreeLevels} nodes instead of {formatNumber(tableSize)} rows. Simplified: a real
                B-tree node holds hundreds of keys, so the same table is only 2-3 levels deep.
              </p>
            </div>
          ) : null}
        </>
      }
      controls={
        <>
          <Slider
            label="Table size"
            value={tableSize}
            min={1000}
            max={50000}
            step={1000}
            onChange={(value) => {
              setTableSize(value);
              // The chosen email encodes a row number, so it may not exist in
              // the resized table - the Select would show another option while
              // the query silently searched for a row that is gone.
              setTarget('');
              clearResults();
              scan.current = null;
            }}
            format={(value) => `${formatNumber(value)} rows`}
            hint="Scan cost grows with this number. Index cost barely moves."
          />
          <Select
            label="Search for"
            value={email}
            options={[
              { value: sample.email, label: `${sample.email} (row ${sample.id})` },
              { value: rows[Math.floor(tableSize * 0.15)].email, label: 'an early row' },
              { value: rows[tableSize - 1].email, label: 'the last row (worst case)' },
              { value: 'missing@example.com', label: 'a row that does not exist' },
            ]}
            onChange={(value) => {
              setTarget(value);
              clearResults();
              scan.current = null;
            }}
            hint="A missing row forces a full scan - there is nothing to stop early at."
          />
          <Slider
            label="Write rate"
            value={writeRate}
            min={0}
            max={2000}
            step={50}
            onChange={setWriteRate}
            format={(value) => `${formatNumber(value)} writes/sec`}
            hint="Every write must update every index on the table."
          />
          <div className="rounded-xl border border-line bg-elevated p-3">
            <p className="label mb-2">Write path cost</p>
            <Meter
              value={writeLoad.cpu}
              tone={writeLoad.saturated ? 'danger' : hasIndex ? 'warn' : 'ok'}
              label={hasIndex ? 'table + 1 index' : 'table only'}
            />
            <p className="mt-2 font-mono text-[11px] text-muted">
              {formatNumber(writeRate)} writes/sec {'->'} {formatNumber(structuresPerSecond)} structures updated/sec of{' '}
              {formatNumber(WRITE_CAPACITY)}
            </p>
            {writeLoad.saturated ? (
              <p className="mt-1 text-[11px] text-danger">
                Over write capacity. Dropping the index would bring this back under the line - that is the trade the
                query time above is buying.
              </p>
            ) : null}
          </div>
          <div className="flex items-start gap-2 rounded-xl border border-line bg-elevated p-3 text-[11px] text-muted">
            <Database className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint" />
            <span>
              An index on a low-selectivity column (a boolean, a status with three values) usually will not be used -
              the planner correctly decides a scan is cheaper.
            </span>
          </div>
        </>
      }
    >
      <div className="grid gap-4 p-5 lg:grid-cols-2">
        <QueryPanel
          title="Without index"
          subtitle="Sequential scan"
          sql={`SELECT * FROM users\nWHERE email = '${email}';`}
          plan={`Seq Scan on users\n  Filter: (email = '...')\n  Rows Removed by Filter: ${formatNumber(
            results.scan
              ? Math.max(0, results.scan.rowsInspected - (results.scan.found ? 1 : 0))
              : Math.max(0, tableSize - 1),
          )}`}
          rows={results.scan ? (scanning ? scanPosition : results.scan.rowsInspected) : null}
          time={results.scan ? results.scan.timeMs : null}
          tone="danger"
        />
        <QueryPanel
          title="With index"
          subtitle={hasIndex ? 'Index scan on users(email)' : 'No index created yet'}
          sql={`CREATE INDEX idx_users_email\n  ON users (email);\n\nSELECT * FROM users\nWHERE email = '${email}';`}
          plan={
            hasIndex
              ? `Index Scan using idx_users_email\n  Index Cond: (email = '...')\n  Heap Fetches: 1`
              : 'Create the index to see the plan change.'
          }
          rows={results.index ? results.index.rowsInspected : null}
          time={results.index ? results.index.timeMs : null}
          tone="ok"
        />
      </div>
    </LabShell>
  );
}

function QueryPanel({
  title,
  subtitle,
  sql,
  plan,
  rows,
  time,
  tone,
}: {
  title: string;
  subtitle: string;
  sql: string;
  plan: string;
  rows: number | null;
  time: number | null;
  tone: 'ok' | 'danger';
}) {
  return (
    <div className={cn('rounded-2xl border p-4', tone === 'ok' ? 'border-ok/30' : 'border-danger/30')}>
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <span className="text-[11px] text-faint">{subtitle}</span>
      </div>
      <pre className="ascii mt-3">{sql}</pre>
      <pre className="ascii mt-2 text-[10px]">{plan}</pre>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-line bg-elevated px-3 py-2">
          <p className="label">Rows inspected</p>
          <p className={cn('font-mono text-lg font-semibold', tone === 'ok' ? 'text-ok' : 'text-danger')}>
            {rows === null ? '-' : formatNumber(rows)}
          </p>
        </div>
        <div className="rounded-lg border border-line bg-elevated px-3 py-2">
          <p className="label">Query time</p>
          <p className={cn('font-mono text-lg font-semibold', tone === 'ok' ? 'text-ok' : 'text-danger')}>
            {time === null ? '-' : formatLatency(time)}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Binary-search drawing of the index - enough to show that each level halves the range. A real B-tree is far wider and shallower. */
function BTreeView({ levels, email }: { levels: number; email: string }) {
  const letter = email.charAt(0).toLowerCase();
  return (
    <div className="space-y-2 overflow-x-auto">
      {Array.from({ length: levels }, (_, level) => {
        const nodes = 2 ** level;
        return (
          <div key={level} className="flex min-w-max justify-center gap-2">
            {Array.from({ length: Math.min(nodes, 8) }, (_, node) => {
              const onPath = node === Math.min(nodes - 1, Math.floor((letter.charCodeAt(0) - 97) / (26 / nodes)));
              return (
                <span
                  key={node}
                  className={cn(
                    'rounded-md border px-2.5 py-1 font-mono text-[10px]',
                    onPath ? 'border-brand bg-brand/10 text-brand' : 'border-line text-faint',
                  )}
                >
                  {level === levels - 1 ? (onPath ? email.slice(0, 12) : 'leaf') : `node ${node + 1}`}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export default IndexingLab;
