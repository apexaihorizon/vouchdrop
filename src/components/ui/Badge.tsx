import type { HTMLAttributes } from 'react';

export type BadgeTone = 'neutral' | 'emerald' | 'amber' | 'rose';

export type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  mono?: boolean;
};

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral:
    'border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] text-zinc-300',
  emerald:
    'border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 text-emerald-300',
  amber:
    'border-[var(--color-warning)]/35 bg-[var(--color-warning)]/10 text-amber-300',
  rose:
    'border-[var(--color-danger)]/35 bg-[var(--color-danger)]/10 text-rose-300',
};

export function Badge({
  tone = 'neutral',
  mono = true,
  className = '',
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border px-2.5 py-0.5 text-[11px] font-medium ${
        mono ? 'font-mono' : ''
      } ${TONE_CLASSES[tone]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
