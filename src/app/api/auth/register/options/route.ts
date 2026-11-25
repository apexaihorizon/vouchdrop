import { NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { setChallengeCookie } from '@/lib/session';
import { registerOptionsSchema } from '@/lib/validators';
import { AppError, withApiHandler } from '@/lib/api';
export const POST = withApiHandler('auth.register.options', async (req) => {
    const parsed = registerOptionsSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        throw new AppError('Invalid input please try again', 400);
    }

    const { displayName } = parsed.data;
    const options = await generateRegistrationOptions({
        rpName: 'VouchDrop',
        rpID: process.env.RP_ID!,
        userName: displayName,
        userDisplayName: displayName,
        authenticatorSelection: {
            residentKey: 'required',
            userVerification: 'required',
        },
    });

    await setChallengeCookie({ challenge: options.challenge, displayName });
    return NextResponse.json(options);
})