import { NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { withApiHandler } from '@/lib/api';
import { AppError } from '@/lib/errors';
import { setChallengeCookie } from '@/lib/session';
import { DISPLAY_NAME_ERROR, registerOptionsSchema } from '@/lib/validators';

export const POST = withApiHandler('auth.register.options', async (req) => {
  const parsed = registerOptionsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    throw new AppError('AUTH_CANCELLED', parsed.error.issues[0]?.message ?? DISPLAY_NAME_ERROR, 400);
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
});
