'use client';

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16">
      <section className="flex w-full flex-col gap-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-6 shadow-sm">
        <div className="flex flex-col gap-1.5">
          <p className="font-mono text-xs uppercase tracking-wider text-amber-400">Unexpected Error</p>
          <h1 className="text-lg font-semibold text-zinc-100">Something interrupted VouchDrop</h1>
          <p className="text-sm text-zinc-400">
            {error.message || 'An unexpected error occurred while loading your courier workspace.'}
          </p>
        </div>

        {error.digest && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-2">
            <p className="text-[11px] text-zinc-500">Error Digest</p>
            <p className="font-mono text-xs text-zinc-300">{error.digest}</p>
          </div>
        )}

        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
        >
          Try Again
        </button>
      </section>
    </main>
  );
}
