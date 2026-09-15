import { useCallback, useState } from 'react';
import { formatClock } from '@/utils/format';

export type EventTone = 'info' | 'ok' | 'warn' | 'danger';

export interface SimEvent {
  id: number;
  time: string;
  message: string;
  tone: EventTone;
}

let sequence = 0;

/** Timestamped event feed - the "10:42:03 CPU > 70%" style log used by labs. */
export function useEventLog(limit = 40) {
  const [events, setEvents] = useState<SimEvent[]>([]);

  const log = useCallback(
    (message: string, tone: EventTone = 'info') => {
      sequence += 1;
      const event: SimEvent = { id: sequence, time: formatClock(), message, tone };
      setEvents((previous) => [event, ...previous].slice(0, limit));
    },
    [limit],
  );

  const clear = useCallback(() => setEvents([]), []);

  return { events, log, clear };
}
