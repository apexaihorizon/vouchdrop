import { Suspense } from 'react';
import { eq } from 'drizzle-orm';
import { AuthGate } from '@/components/AuthGate';
import { CourierWorkspace } from '@/components/CourierWorkspace';
import { TrustedContactsList } from '@/components/DocumentStage';
import { db } from '@/db';
import { userContacts, users } from '@/db/schema';
import { getSessionUserId } from '@/lib/session';
import type { SessionUser, TrustedContact } from '@/types/vouchdrop';

type HomePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function ContactsSkeleton() {
  return (
    <div className="flex flex-col gap-2.5" aria-busy="true" aria-label="Loading trusted contacts">
      <div className="flex items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-900/80 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 animate-pulse rounded-full bg-zinc-800" />
          <div className="h-4 w-28 animate-pulse rounded bg-zinc-800" />
        </div>
        <div className="h-11 w-24 animate-pulse rounded-xl bg-zinc-800" />
      </div>
      <div className="flex items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-900/80 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 animate-pulse rounded-full bg-zinc-800" />
          <div className="h-4 w-36 animate-pulse rounded bg-zinc-800" />
        </div>
        <div className="h-11 w-24 animate-pulse rounded-xl bg-zinc-800" />
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

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const roomId = typeof params.room === 'string' ? params.room : null;

  const userId = await getSessionUserId();
  if (!userId) {
    return <AuthGate initialRoomId={roomId} />;
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
    return <AuthGate initialRoomId={roomId} />;
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
