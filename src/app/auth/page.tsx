import { Suspense } from 'react';
import { AuthFlow } from '@/components/AuthFlow';

type AuthPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function AuthSkeleton() {
  return (
    <main
      className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12"
      aria-busy="true"
      aria-label="Loading authentication"
    >
      <div className="flex flex-col gap-6 rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-6 sm:p-8">
        <div className="flex flex-col gap-2.5">
          <div className="h-5 w-32 animate-pulse rounded-full bg-[var(--color-surface-elevated)]" />
          <div className="h-7 w-56 animate-pulse rounded bg-[var(--color-surface-elevated)]" />
          <div className="h-4 w-full animate-pulse rounded bg-[var(--color-surface-elevated)]" />
        </div>
        <div className="flex flex-col gap-3">
          <div className="h-11 w-full animate-pulse rounded-[var(--radius-control)] bg-[var(--color-surface-elevated)]" />
          <div className="h-11 w-full animate-pulse rounded-[var(--radius-control)] bg-[var(--color-surface-elevated)]" />
        </div>
      </div>
    </main>
  );
}

async function AuthRouteContent({ searchParams }: AuthPageProps) {
  const params = await searchParams;
  const roomId = typeof params.room === 'string' ? params.room : null;

  return <AuthFlow initialRoomId={roomId} />;
}

export default function AuthPage({ searchParams }: AuthPageProps) {
  return (
    <Suspense fallback={<AuthSkeleton />}>
      <AuthRouteContent searchParams={searchParams} />
    </Suspense>
  );
}
