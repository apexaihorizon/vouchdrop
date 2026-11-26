'use client';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { toUserErrorMessage } from '@/lib/errors';

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16">
      <Card padding="lg" className="flex w-full flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Badge tone="amber" className="w-fit uppercase tracking-wider">
            Unexpected Error
          </Badge>
          <h1 className="text-lg font-semibold text-zinc-100">Something interrupted VouchDrop</h1>
          <p className="text-sm text-zinc-400">{toUserErrorMessage(error)}</p>
        </div>

        {error.digest && (
          <div className="rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-canvas)] px-3 py-2">
            <p className="text-[11px] text-zinc-500">Error Digest</p>
            <p className="font-mono text-xs text-zinc-300">{error.digest}</p>
          </div>
        )}

        <Button variant="primary" className="w-full" onClick={reset}>
          Try Again
        </Button>
      </Card>
    </main>
  );
}
