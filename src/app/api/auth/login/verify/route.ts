import { NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users, webauthnCredentials } from '@/db/schema';
import { withApiHandler } from '@/lib/api';
import { AppError } from '@/lib/errors';
import { logEvent } from '@/lib/logger';
import { getChallengeCookie, setSessionCookie } from '@/lib/session';
import { loginVerifySchema } from '@/lib/validators';

export const POST = withApiHandler('auth.login.verify', async (req) => {
  const challengeData = await getChallengeCookie();
  if (!challengeData?.challenge) {
    throw new AppError('AUTH_CANCELLED', 'Sign-in expired. Please try again.', 400);
  }

  const parsed = loginVerifySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    throw new AppError('AUTH_CANCELLED', 'Malformed passkey payload.', 400);
  }

  const cred = await db.query.webauthnCredentials.findFirst({
    where: eq(webauthnCredentials.id, parsed.data.id),
  });
  if (!cred) {
    throw new AppError('AUTH_CANCELLED', 'Passkey not recognized on this server.', 404);
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: parsed.data,
      expectedChallenge: challengeData.challenge,
      expectedOrigin: process.env.RP_ORIGIN!,
      expectedRPID: process.env.RP_ID!,
      credential: {
        id: cred.id,
        publicKey: new Uint8Array(Buffer.from(cred.publicKey, 'base64url')),
        counter: cred.counter,
        transports: cred.transports as never,
      },
    });
  } catch {
    throw new AppError('AUTH_CANCELLED', 'Passkey sign-in verification failed.', 400);
  }

  if (!verification.verified) {
    throw new AppError('AUTH_CANCELLED', 'Passkey sign-in verification failed.', 400);
  }

  await db
    .update(webauthnCredentials)
    .set({ counter: verification.authenticationInfo.newCounter })
    .where(eq(webauthnCredentials.id, cred.id));

  const user = await db.query.users.findFirst({
    where: eq(users.id, cred.userId),
  });
  if (!user) {
    throw new AppError('AUTH_CANCELLED', 'User account not found.', 404);
  }

  await setSessionCookie(user.id);
  logEvent('info', 'auth.login.verify', { userId: user.id });

  return NextResponse.json({ ok: true, user: { id: user.id, displayName: user.displayName } });
});
