import { NextResponse } from 'next/server';
import { AppError, withApiHandler } from '@/lib/api';
import { mintSignalingTicket, requireUserId } from '@/lib/session';
import { acceptKnockSchema } from '@/lib/validators';

export const POST = withApiHandler('transfer.join', async (req) => {
  const userId = await requireUserId();
  const parsed = acceptKnockSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    throw new AppError('Invalid room ID', 400);
  }

  const ticket = await mintSignalingTicket({
    roomId: parsed.data.roomId,
    userId,
    role: 'receiver',
  });

  return NextResponse.json({ ok: true, ticket });
});