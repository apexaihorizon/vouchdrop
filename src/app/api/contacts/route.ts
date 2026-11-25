import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users, userContacts } from '@/db/schema';
import { withApiHandler } from '@/lib/api';
import { requireUserId } from '@/lib/session';

export const GET = withApiHandler('contacts.list', async () => {
  const userId = await requireUserId();

  const rows = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      connectedAt: userContacts.createdAt,
    })
    .from(userContacts)
    .innerJoin(users, eq(userContacts.contactId, users.id))
    .where(eq(userContacts.userId, userId));

  return NextResponse.json({ ok: true, contacts: rows });
});