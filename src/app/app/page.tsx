import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { CourierWorkspace } from '@/components/CourierWorkspace';
import { TrustedContactsList } from '@/components/DocumentStage';
import { db } from '@/db';
import { userContacts, users } from '@/db/schema';
import { getSessionUserId } from '@/lib/session';
import type { SessionUser, TrustedContact } from '@/types/vouchdrop';

type AppPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function WorkspaceSkeleton() {
  return (
    <main
      className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6 sm:py-8"
      aria-busy="true"
      aria-label="Loading courier workspace"
    >
      {/* Compact Identity Strip Skeleton */}
      <div className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-4 py-3.5 sm:px-5">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 animate-pulse rounded-full bg-[var(--color-surface-elevated)]" />
          <div className="flex flex-col gap-1.5">
            <div className="h-3 w-16 animate-pulse rounded bg-[var(--color-surface-elevated)]" />
            <div className="h-4 w-28 animate-pulse rounded bg-[var(--color-surface-elevated)]" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-11 w-24 animate-pulse rounded-[var(--radius-control)] bg-[var(--color-surface-elevated)]" />
          <div className="h-11 w-28 animate-pulse rounded-[var(--radius-control)] bg-[var(--color-surface-elevated)]" />
        </div>
      </div>

      {/* Center Courier Stage Skeleton */}
      <div className="flex flex-col gap-6 rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5 sm:p-6">
        <div className="flex flex-col gap-2">
          <div className="h-5 w-44 animate-pulse rounded bg-[var(--color-surface-elevated)]" />
          <div className="h-3.5 w-72 max-w-full animate-pulse rounded bg-[var(--color-surface-elevated)]" />
        </div>

        <div className="h-44 w-full animate-pulse rounded-[var(--radius-control)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]/50" />

        <div className="flex flex-col gap-2.5 border-t border-[var(--color-border-subtle)] pt-5">
          <div className="h-4 w-32 animate-pulse rounded bg-[var(--color-surface-elevated)]" />
          <div className="h-16 w-full animate-pulse rounded-[var(--radius-control)] bg-[var(--color-surface-elevated)]" />
        </div>
      </div>
    </main>
  );
}

function ContactsSkeleton() {
  return (
    <div className="flex flex-col gap-2.5" aria-busy="true" aria-label="Loading trusted contacts">
      <div className="flex items-center justify-between rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]/70 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 animate-pulse rounded-full bg-[var(--color-surface)]" />
          <div className="h-4 w-28 animate-pulse rounded bg-[var(--color-surface)]" />
        </div>
        <div className="h-11 w-24 animate-pulse rounded-[var(--radius-control)] bg-[var(--color-surface)]" />
      </div>
      <div className="flex items-center justify-between rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]/70 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 animate-pulse rounded-full bg-[var(--color-surface)]" />
          <div className="h-4 w-36 animate-pulse rounded bg-[var(--color-surface)]" />
        </div>
        <div className="h-11 w-24 animate-pulse rounded-[var(--radius-control)] bg-[var(--color-surface)]" />
      </div>
    </div>
  );
}

async function ContactsLoader({ userId }: { userId: string }) {
  const contactRows = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      connectedAt: userContacts.createdAt,
    })
    .from(userContacts)
    .innerJoin(users, eq(userContacts.contactId, users.id))
    .where(eq(userContacts.userId, userId));

  const contacts: TrustedContact[] = contactRows.map((row) => ({
    id: row.id,
    displayName: row.displayName,
    connectedAt: row.connectedAt.toISOString(),
  }));

  return <TrustedContactsList contacts={contacts} />;
}

async function AuthenticatedWorkspace({ searchParams }: AppPageProps) {
  const params = await searchParams;
  const roomId = typeof params.room === 'string' ? params.room : null;
  const authRedirect = roomId ? `/auth?room=${encodeURIComponent(roomId)}` : '/auth';

  const userId = await getSessionUserId();
  if (!userId) {
    redirect(authRedirect);
  }

  const [userRow] = await db
    .select({
      id: users.id,
      displayName: users.displayName,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!userRow) {
    redirect(authRedirect);
  }

  const user: SessionUser = {
    id: userRow.id,
    displayName: userRow.displayName,
  };

  return (
    <CourierWorkspace
      user={user}
      initialRoomId={roomId}
      contactsSlot={
        <Suspense fallback={<ContactsSkeleton />}>
          <ContactsLoader userId={user.id} />
        </Suspense>
      }
    />
  );
}

export default function AppPage({ searchParams }: AppPageProps) {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <AuthenticatedWorkspace searchParams={searchParams} />
    </Suspense>
  );
}
