export default function Loading() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      {/* Top identity bar skeleton */}
      <div className="flex items-center justify-between rounded-2xl border border-zinc-800/80 bg-zinc-900/60 px-5 py-4">
        <div className="flex flex-col gap-2">
          <div className="h-3 w-20 animate-pulse rounded bg-zinc-800" />
          <div className="h-5 w-36 animate-pulse rounded bg-zinc-800" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-11 w-28 animate-pulse rounded-xl bg-zinc-800" />
          <div className="h-11 w-20 animate-pulse rounded-xl bg-zinc-800" />
        </div>
      </div>

      {/* 12-column workspace skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Document stage & contacts */}
        <div className="flex flex-col gap-6 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-6 lg:col-span-7">
          <div className="h-5 w-40 animate-pulse rounded bg-zinc-800" />
          <div className="h-44 w-full animate-pulse rounded-xl border border-dashed border-zinc-800 bg-zinc-900" />
          <div className="flex flex-col gap-3 pt-2">
            <div className="h-4 w-32 animate-pulse rounded bg-zinc-800" />
            <div className="h-16 w-full animate-pulse rounded-xl bg-zinc-900" />
            <div className="h-16 w-full animate-pulse rounded-xl bg-zinc-900" />
            <div className="h-16 w-full animate-pulse rounded-xl bg-zinc-900" />
          </div>
        </div>

        {/* Right: Transfer status & Pair panel */}
        <div className="flex flex-col gap-6 lg:col-span-5">
          <div className="flex flex-col gap-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-6">
            <div className="h-5 w-32 animate-pulse rounded bg-zinc-800" />
            <div className="h-20 w-full animate-pulse rounded-xl bg-zinc-900" />
          </div>
          <div className="flex flex-col gap-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-6">
            <div className="h-5 w-36 animate-pulse rounded bg-zinc-800" />
            <div className="h-11 w-full animate-pulse rounded-xl bg-zinc-900" />
            <div className="h-24 w-full animate-pulse rounded-xl bg-zinc-900" />
          </div>
        </div>
      </div>
    </main>
  );
}
