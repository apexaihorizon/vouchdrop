import { NextResponse } from 'next/server';
import * as webpush from 'web-push'
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { pushSubscriptions, users, userContacts } from '@/db/schema';
import { AppError, withApiHandler } from '@/lib/api';
import { mintSignalingTicket, requireUserId } from '@/lib/session';
import { knockRequestSchema } from '@/lib/validators';

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export const POST = withApiHandler('transfer.knock', async (req) => {
  const userId = await requireUserId();
  const parsed = knockRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    throw new AppError('Invalid knock request', 400);
  }

  const { recipientId, fileName, fileSize } = parsed.data;

  // Enforce closed contact allowlist
  const allowed = await db.query.userContacts.findFirst({
    where: and(eq(userContacts.userId, userId), eq(userContacts.contactId, recipientId)),
  });
  if (!allowed) {
    throw new AppError('Recipient is not in your trusted contacts', 403);
  }

  const sender = await db.query.users.findFirst({ where: eq(users.id, userId) });
  const roomId = crypto.randomUUID();
  const ticket = await mintSignalingTicket({ roomId, userId, role: 'sender' });

  // Fire high-priority 15s Web Push to all registered devices of recipient
  const subs = await db.query.pushSubscriptions.findMany({
    where: eq(pushSubscriptions.userId, recipientId),
  });

  const payload = JSON.stringify({
    roomId,
    senderId: userId,
    senderName: sender?.displayName ?? 'Trusted Contact',
    fileName,
    fileSize,
  });

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { TTL: 15, urgency: 'high' }
        );
      } catch (err: unknown) {
        // Remove stale/revoked browser push endpoints automatically
        if (typeof err === 'object' && err !== null && 'statusCode' in err && (err as { statusCode: number }).statusCode === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, sub.endpoint));
        }
      }
    })
  );

  console.info(JSON.stringify({ level: 'info', route: 'transfer.knock', userId, recipientId, roomId }));
  return NextResponse.json({ ok: true, roomId, ticket });
});