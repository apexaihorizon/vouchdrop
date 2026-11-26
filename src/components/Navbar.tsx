'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';

export function Navbar() {
  const pathname = usePathname();
  const showUseApp = pathname !== '/app';

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border-subtle)] bg-[var(--color-canvas)]/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 text-[var(--color-accent-hover)] transition-colors group-hover:border-[var(--color-accent-hover)]/50 group-hover:bg-[var(--color-accent)]/15">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
              <path d="m9 12 3-3 3 3" />
              <path d="M12 9v6" />
            </svg>
          </span>
          <span className="text-sm font-semibold tracking-tight text-zinc-100 group-hover:text-white">
            VouchDrop
          </span>
          <Badge tone="neutral" className="text-[10px] uppercase tracking-wider">
            P2P
          </Badge>
        </Link>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <Link
            href="/about"
            className="inline-flex min-h-[44px] items-center rounded-[var(--radius-control)] px-3 text-xs font-medium text-zinc-400 transition-colors hover:bg-[var(--color-surface-elevated)] hover:text-zinc-100"
          >
            Security
          </Link>
          {showUseApp && (
            <Link
              href="/app"
              className="inline-flex min-h-[44px] items-center rounded-[var(--radius-control)] bg-[var(--color-accent)] px-3.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-[var(--color-accent-hover)]"
            >
              Use App
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
