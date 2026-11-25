import { NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { db } from '@/db';
import { users, webauthnCredentials } from '@/db/schema';
import { AppError, withApiHandler } from '@/lib/api';
import { getChallengeCookie, setSessionCookie } from '@/lib/session';
import { registerVerifySchema } from '@/lib/validators';

export const POST = withApiHandler('auth.register.verify', async (req) => {
    const challengeData = await getChallengeCookie();
    if (!challengeData?.challenge || !challengeData.displayName) {
        throw new AppError('Registration expired, please try again', 400);
    }

    const parsed = registerVerifySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        throw new AppError('Malformed passkey payload', 400);
    }

    let verification;
    try {
        verification = await verifyRegistrationResponse({
            response: parsed.data,
            expectedChallenge: challengeData.challenge,
            expectedOrigin: process.env.RP_ORIGIN!,
            expectedRPID: process.env.RP_ID!,
        });
    } catch (err) {
        throw new AppError(err instanceof Error ? err.message : 'Passkey verification failed', 400);
    }

    if (!verification.verified || !verification.registrationInfo) {
        throw new AppError('Passkey verification failed', 400);
    }

    const { credential } = verification.registrationInfo;

    const [newUser] = await db
        .insert(users)
        .values({ displayName: challengeData.displayName })
        .returning();

    await db.insert(webauthnCredentials).values({
        id: credential.id,
        userId: newUser.id,
        publicKey: Buffer.from(credential.publicKey).toString('base64url'),
        counter: credential.counter,
        transports: credential.transports ?? [],
    });

    await setSessionCookie(newUser.id);
    console.info(JSON.stringify({ level: 'info', route: 'auth.register.verify', userId: newUser.id }));

    return NextResponse.json({ ok: true, user: { id: newUser.id, displayName: newUser.displayName } });
});