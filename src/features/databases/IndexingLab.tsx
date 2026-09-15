import { useCallback, useMemo, useRef, useState } from 'react';
import { Database, Search, Trash2, Zap } from 'lucide-react';
import { Insight, LabShell, MetricsPanel } from '@/components/learning';
import { Button, Meter, Select, Slider } from '@/components/ui';
import { useTicker } from '@/simulations/engine';
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

/** Cost model: sequential scan reads rows one at a time; a B-tree is log2(n). */
const SCAN_MS_PER_1000_ROWS = 42;
const BTREE_MS_PER_LEVEL = 0.28;

type Result = {
  mode: 'scan' | 'index';
  rowsInspected: number;
  timeMs: number;
  found: Row | null;
  writeCost: number;
};

export function IndexingLab() {
  const [tableSize, setTableSize] = useState(8000);
  const [hasIndex, setHasIndex] = useState(false);
  const [target, setTarget] = useState('');
  const [result, setResult] = useState<Result | null>(null);
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

      setResult({
        mode,
        rowsInspected,
        timeMs,
        found,
        writeCost: mode === 'index' ? 1.35 : 1,
      });
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
  const writeOverhead = hasIndex ? 0.35 : 0;
  const indexStorageMb = (tableSize * 40) / 1_000_000;

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
        setResult(null);
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
                setResult(null);
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
              The B-tree inspected about {result.rowsInspected} nodes instead of {formatNumber(rows.length)} rows -
              each level of the tree discards half the remaining candidates. The cost is on the other side: every
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
                label: 'B-tree depth',
                value: hasIndex ? btreeLevels : '-',
                hint: 'log2(rows): the number of nodes a lookup touches.',
              },
              {
                key: 'writeCost',
                label: 'Write overhead',
                value: hasIndex ? `+${Math.round(writeOverhead * 100)}%` : '0%',
                tone: hasIndex ? 'warn' : 'ok',
                hint: 'Extra work per INSERT/UPDATE/DELETE to maintain the index.',
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
              <p className="label mb-3">B-tree on users(email)</p>
              <BTreeView levels={Math.min(4, btreeLevels)} email={email} />
              <p className="mt-3 text-xs text-faint">
                Each level halves the search space. {formatNumber(tableSize)} rows need {btreeLevels} levels, so a
                lookup reads about {btreeLevels} nodes instead of {formatNumber(tableSize)} rows.
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
              setResult(null);
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
              setResult(null);
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
              value={hasIndex ? 0.9 : 0.6}
              tone={hasIndex ? 'warn' : 'ok'}
              label={hasIndex ? 'table + 1 index' : 'table only'}
              showValue={false}
            />
            <p className="mt-2 font-mono text-[11px] text-muted">
              {formatNumber(writeRate)} writes/sec {'->'} {formatNumber(writeRate * (hasIndex ? 2 : 1))} structures
              updated/sec
            </p>
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
            Math.max(0, (result?.mode === 'scan' ? result.rowsInspected : tableSize) - 1),
          )}`}
          rows={result?.mode === 'scan' ? (scanning ? scanPosition : result.rowsInspected) : null}
          time={result?.mode === 'scan' ? result.timeMs : null}
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
          rows={result?.mode === 'index' ? result.rowsInspected : null}
          time={result?.mode === 'index' ? result.timeMs : null}
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

/** Simplified B-tree drawing - enough to show that each level halves the range. */
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
