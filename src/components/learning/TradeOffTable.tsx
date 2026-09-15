import { Minus, Plus } from 'lucide-react';
import type { TradeOff } from '@/types';

/**
 * Trade-offs are rendered as gains versus costs side by side, never as a
 * winner/loser table - the whole point is that both columns are real.
 */
export function TradeOffTable({ tradeoffs }: { tradeoffs: TradeOff[] }) {
  return (
    <div className="space-y-3">
      {tradeoffs.map((tradeoff) => (
        <div key={tradeoff.approach} className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="border-b border-line bg-elevated px-4 py-2.5">
            <h4 className="text-sm font-semibold text-ink">{tradeoff.approach}</h4>
          </div>
          <div className="grid gap-px bg-line sm:grid-cols-2">
            <div className="bg-surface p-4">
              <p className="label mb-2 text-ok">What you gain</p>
              <ul className="space-y-1.5">
                {tradeoff.gains.map((gain) => (
                  <li key={gain} className="flex gap-2 text-sm text-muted">
                    <Plus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok" aria-hidden />
                    <span>{gain}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-surface p-4">
              <p className="label mb-2 text-danger">What it costs</p>
              <ul className="space-y-1.5">
                {tradeoff.costs.map((cost) => (
                  <li key={cost} className="flex gap-2 text-sm text-muted">
                    <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" aria-hidden />
                    <span>{cost}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ))}
      <p className="px-1 text-xs text-faint">
        There is rarely a universally correct architecture. Which column matters more depends on your requirements
        and constraints.
      </p>
    </div>
  );
}
