import type { HTMLAttributes, ReactNode } from 'react';

export type CardPadding = 'sm' | 'md' | 'lg';

export type CardProps = Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  padding?: CardPadding;
};

const PADDING_CLASSES: Record<CardPadding, string> = {
  sm: 'p-4',
  md: 'p-5 sm:p-6',
  lg: 'p-6 sm:p-8',
};

export function Card({
  title,
  subtitle,
  action,
  padding = 'md',
  className = '',
  children,
  ...props
}: CardProps) {
  const hasHeader = Boolean(title || subtitle || action);

  return (
    <section
      className={`rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] shadow-sm ${PADDING_CLASSES[padding]} ${className}`}
      {...props}
    >
      {hasHeader && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            {title && <h2 className="text-base font-semibold tracking-tight text-zinc-100">{title}</h2>}
            {subtitle && <p className="text-xs leading-relaxed text-zinc-400">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
