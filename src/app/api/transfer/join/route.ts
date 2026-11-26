import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/api';
import { AppError } from '@/lib/errors';
import { logEvent } from '@/lib/logger';
import { mintSignalingTicket, requireUserId } from '@/lib/session';
import { acceptKnockSchema } from '@/lib/validators';

export const POST = withApiHandler('transfer.join', async (req) => {
  const userId = await requireUserId();
  const parsed = acceptKnockSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    throw new AppError('NOT_PAIRED', 'Invalid room ID.', 400);
  }

  const ticket = await mintSignalingTicket({
    roomId: parsed.data.roomId,
    userId,
    role: 'receiver',
  });

  logEvent('info', 'transfer.join', { userId, roomId: parsed.data.roomId });
  return NextResponse.json({ ok: true, ticket });
});
