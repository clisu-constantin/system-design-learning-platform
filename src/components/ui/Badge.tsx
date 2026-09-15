import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export type Tone = 'neutral' | 'brand' | 'ok' | 'warn' | 'danger' | 'info' | 'violet';

const tones: Record<Tone, string> = {
  neutral: 'border-line bg-elevated text-muted',
  brand: 'border-brand/30 bg-brand/10 text-brand',
  ok: 'border-ok/30 bg-ok/10 text-ok',
  warn: 'border-warn/30 bg-warn/10 text-warn',
  danger: 'border-danger/30 bg-danger/10 text-danger',
  info: 'border-info/30 bg-info/10 text-info',
  violet: 'border-violet/30 bg-violet/10 text-violet',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return <span className={cn('chip', tones[tone], className)}>{children}</span>;
}

export const difficultyTone = (difficulty: string): Tone =>
  difficulty === 'Beginner' ? 'ok' : difficulty === 'Intermediate' ? 'warn' : 'danger';
