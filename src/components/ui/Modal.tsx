'use client';

import { useEffect, useId, type ReactNode } from 'react';

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  preventClose?: boolean;
  children: ReactNode;
};

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  preventClose = false,
  children,
}: ModalProps) {
  const titleId = useId();
  const subtitleId = useId();

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !preventClose) {
        event.preventDefault();
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose, preventClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={() => {
        if (!preventClose) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={subtitle ? subtitleId : undefined}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-[var(--radius-card)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-6 shadow-2xl"
      >
        {(title || subtitle || !preventClose) && (
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              {title && (
                <h2 id={titleId} className="text-lg font-semibold tracking-tight text-zinc-100">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p id={subtitleId} className="text-xs leading-relaxed text-zinc-400">
                  {subtitle}
                </p>
              )}
            </div>
            {!preventClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] text-base text-zinc-400 transition-colors hover:border-[var(--color-border-strong)] hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              >
                ×
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
