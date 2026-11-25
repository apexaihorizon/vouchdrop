import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16">
      <section className="flex w-full flex-col items-center gap-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-8 text-center shadow-sm">
        <span className="rounded-full border border-zinc-700/80 bg-zinc-950 px-3 py-1 font-mono text-xs text-zinc-400">
          HTTP 404
        </span>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-100">404 — Room or page not found</h1>
        <p className="text-sm text-zinc-400">
          The transfer room may have expired or the link you followed does not exist.
        </p>
        <Link
          href="/"
          className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
        >
          Return to Courier
        </Link>
      </section>
    </main>
  );
}
