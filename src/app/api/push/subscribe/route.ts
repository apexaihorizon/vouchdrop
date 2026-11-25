import { NextResponse } from 'next/server';
import { db } from '@/db';
import { pushSubscriptions } from '@/db/schema';
import { AppError, withApiHandler } from '@/lib/api';
import { requireUserId } from '@/lib/session';
import { pushSubscribeSchema } from '@/lib/validators';

export const POST = withApiHandler('push.subscribe', async (req) => {
  const userId = await requireUserId();
  const parsed = pushSubscribeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    throw new AppError('Invalid push subscription payload', 400);
  }

  await db
    .insert(pushSubscriptions)
    .values({
      endpoint: parsed.data.endpoint,
      userId,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId, p256dh: parsed.data.keys.p256dh, auth: parsed.data.keys.auth },
    });

  return NextResponse.json({ ok: true });
});