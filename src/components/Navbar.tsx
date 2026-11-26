'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Navbar() {
  const pathname = usePathname();
  const showUseApp = pathname !== '/app';

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 transition-colors group-hover:border-emerald-400/50 group-hover:bg-emerald-500/15">
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
          <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-zinc-400">
            P2P
          </span>
        </Link>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <Link
            href="/about"
            className="inline-flex min-h-[44px] items-center rounded-lg px-3 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
          >
            Security
          </Link>
          {showUseApp && (
            <Link
              href="/app"
              className="inline-flex min-h-[44px] items-center rounded-xl bg-emerald-500 px-3.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
            >
              Use App
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
