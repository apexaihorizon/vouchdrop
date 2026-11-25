import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/api';

export const POST = withApiHandler('auth.logout', async () => {
  (await cookies()).delete('vd_session');
  return NextResponse.json({ ok: true });
});
