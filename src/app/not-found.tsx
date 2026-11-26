import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16">
      <Card padding="lg" className="flex w-full flex-col items-center gap-4 text-center">
        <Badge tone="neutral">HTTP 404</Badge>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-100">404 — Room or page not found</h1>
        <p className="text-sm text-zinc-400">
          The transfer room may have expired or the link you followed does not exist.
        </p>
        <Link
          href="/"
          className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-[var(--color-accent-hover)]"
        >
          Return to VouchDrop
        </Link>
      </Card>
    </main>
  );
}
