import { NextResponse } from 'next/server';
import { and, eq, lt } from 'drizzle-orm';
import { db } from '@/db';
import { inviteCodes } from '@/db/schema';
import { withApiHandler } from '@/lib/api';
import { requireUserId } from '@/lib/session';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No 0, O, 1, I

function generateSixCharCode(): string {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

export const POST = withApiHandler('contacts.invite', async () => {
    const userId = await requireUserId();
    const now = new Date();

    // Purge this user's expired codes lazily
    await db
        .delete(inviteCodes)
        .where(and(eq(inviteCodes.creatorId, userId), lt(inviteCodes.expiresAt, now)));

    const code = generateSixCharCode();
    const [created] = await db
        .insert(inviteCodes)
        .values({ code, creatorId: userId })
        .returning({ code: inviteCodes.code, expiresAt: inviteCodes.expiresAt });

    return NextResponse.json({ ok: true, code: created.code, expiresAt: created.expiresAt.toISOString() });
});