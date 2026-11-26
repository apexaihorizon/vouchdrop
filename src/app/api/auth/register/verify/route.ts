import { NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { db } from '@/db';
import { users, webauthnCredentials } from '@/db/schema';
import { withApiHandler } from '@/lib/api';
import { AppError } from '@/lib/errors';
import { logEvent } from '@/lib/logger';
import { getChallengeCookie, setSessionCookie } from '@/lib/session';
import { DISPLAY_NAME_ERROR, displayNameSchema, registerVerifySchema } from '@/lib/validators';

export const POST = withApiHandler('auth.register.verify', async (req) => {
  const challengeData = await getChallengeCookie();
  if (!challengeData?.challenge || !challengeData.displayName) {
    throw new AppError('AUTH_CANCELLED', 'Registration expired. Please try again.', 400);
  }

  const validatedName = displayNameSchema.safeParse(challengeData.displayName);
  if (!validatedName.success) {
    throw new AppError('AUTH_CANCELLED', validatedName.error.issues[0]?.message ?? DISPLAY_NAME_ERROR, 400);
  }

  const parsed = registerVerifySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    throw new AppError('AUTH_CANCELLED', 'Malformed passkey payload.', 400);
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: parsed.data,
      expectedChallenge: challengeData.challenge,
      expectedOrigin: process.env.RP_ORIGIN!,
      expectedRPID: process.env.RP_ID!,
    });
  } catch {
    throw new AppError('AUTH_CANCELLED', 'Passkey verification failed.', 400);
  }

  if (!verification.verified || !verification.registrationInfo) {
    throw new AppError('AUTH_CANCELLED', 'Passkey verification failed.', 400);
  }

  const { credential } = verification.registrationInfo;

  const [newUser] = await db
    .insert(users)
    .values({ displayName: validatedName.data })
    .returning();

  await db.insert(webauthnCredentials).values({
    id: credential.id,
    userId: newUser.id,
    publicKey: Buffer.from(credential.publicKey).toString('base64url'),
    counter: credential.counter,
    transports: credential.transports ?? [],
  });

  await setSessionCookie(newUser.id);
  logEvent('info', 'auth.register.verify', { userId: newUser.id });

  return NextResponse.json({ ok: true, user: { id: newUser.id, displayName: newUser.displayName } });
});
