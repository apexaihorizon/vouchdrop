import { NextResponse } from 'next/server';
import * as webpush from 'web-push';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { pushSubscriptions, users, userContacts } from '@/db/schema';
import { withApiHandler } from '@/lib/api';
import { AppError } from '@/lib/errors';
import { logEvent } from '@/lib/logger';
import { mintSignalingTicket, requireUserId } from '@/lib/session';
import { knockRequestSchema } from '@/lib/validators';

const DEAD_PUSH_STATUS_CODES = new Set([401, 403, 404, 410]);

export const POST = withApiHandler('transfer.knock', async (req) => {
  const userId = await requireUserId();

  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:security@vouchdrop.app';

  if (!vapidPublicKey || !vapidPrivateKey) {
    logEvent('error', 'vapid_missing');
    throw new AppError('INTERNAL_ERROR', 'Server push configuration is incomplete.', 500);
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const parsed = knockRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    throw new AppError('INVALID_FILE_TYPE', 'Invalid transfer request.', 400);
  }

  const { recipientId, fileName, fileSize, fileType } = parsed.data;

  // Enforce closed contact allowlist
  const allowed = await db.query.userContacts.findFirst({
    where: and(eq(userContacts.userId, userId), eq(userContacts.contactId, recipientId)),
  });
  if (!allowed) {
    throw new AppError('NOT_PAIRED', 'Recipient is not in your trusted contacts.', 403);
  }

  // Verify recipient has at least one registered push subscription before creating room
  const subs = await db.query.pushSubscriptions.findMany({
    where: eq(pushSubscriptions.userId, recipientId),
  });
  if (subs.length === 0) {
    logEvent('warn', 'recipient_no_push_sub', { recipientId });
    throw new AppError(
      'NOT_PAIRED',
      'Partner has not registered push notifications yet. Ask them to tap Enable Push on their device.',
      409
    );
  }

  const sender = await db.query.users.findFirst({ where: eq(users.id, userId) });
  const roomId = crypto.randomUUID();
  const ticket = await mintSignalingTicket({ roomId, userId, role: 'sender' });

  const payload = JSON.stringify({
    roomId,
    senderName: sender?.displayName ?? 'Trusted Contact',
    fileName,
    fileSize,
    fileType,
    url: `/app?room=${encodeURIComponent(roomId)}`,
  });

  let deliveredCount = 0;

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { TTL: 15, urgency: 'high' }
        );
        deliveredCount += 1;
      } catch (err: unknown) {
        const statusCode =
          typeof err === 'object' && err !== null && 'statusCode' in err
            ? Number((err as { statusCode: unknown }).statusCode)
            : 0;
        if (DEAD_PUSH_STATUS_CODES.has(statusCode)) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, sub.endpoint));
        }
      }
    })
  );

  if (deliveredCount === 0) {
    logEvent('warn', 'push_all_endpoints_failed', { recipientId, attempted: subs.length });
    throw new AppError(
      'INTERNAL_ERROR',
      'Partner push endpoint expired. Ask them to refresh VouchDrop and re-enable Push.',
      502
    );
  }

  logEvent('info', 'transfer.knock', { userId, recipientId, roomId, deliveredCount });
  return NextResponse.json({ ok: true, roomId, ticket });
});
