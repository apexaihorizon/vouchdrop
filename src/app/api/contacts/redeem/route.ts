import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { inviteCodes, users, userContacts } from '@/db/schema';
import { AppError, withApiHandler } from '@/lib/api';
import { requireUserId } from '@/lib/session';
import { redeemCodeSchema } from '@/lib/validators';

export const POST = withApiHandler('contacts.redeem', async (req) => {
    const userId = await requireUserId();

    const parsed = redeemCodeSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        throw new AppError(parsed.error.issues[0]?.message ?? 'Invalid code', 400);
    }

    const [invite] = await db
        .select({
            code: inviteCodes.code,
            creatorId: inviteCodes.creatorId,
            expiresAt: inviteCodes.expiresAt,
            creatorName: users.displayName,
        })
        .from(inviteCodes)
        .innerJoin(users, eq(inviteCodes.creatorId, users.id))
        .where(eq(inviteCodes.code, parsed.data.code))
        .limit(1);

    if (!invite) {
        throw new AppError('Invalid or already used invite code', 404);
    }
    if (invite.expiresAt < new Date()) {
        await db.delete(inviteCodes).where(eq(inviteCodes.code, invite.code));
        throw new AppError('This invite code has expired', 410);
    }
    if (invite.creatorId === userId) {
        throw new AppError('You cannot pair with your own invite code', 400);
    }

    const existing = await db.query.userContacts.findFirst({
        where: and(eq(userContacts.userId, userId), eq(userContacts.contactId, invite.creatorId)),
    });
    if (existing) {
        await db.delete(inviteCodes).where(eq(inviteCodes.code, invite.code));
        throw new AppError('You are already connected with this person', 409);
    }

    await db.batch([
        db.delete(inviteCodes).where(eq(inviteCodes.code, invite.code)),
        db.insert(userContacts).values([
            { userId, contactId: invite.creatorId },
            { userId: invite.creatorId, contactId: userId },
        ]),
    ]);


    console.info(JSON.stringify({ level: 'info', route: 'contacts.redeem', userId, partnerId: invite.creatorId }));
    return NextResponse.json({
        ok: true,
        contact: { id: invite.creatorId, displayName: invite.creatorName },
    });
});