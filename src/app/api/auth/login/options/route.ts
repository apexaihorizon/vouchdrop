import { NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { withApiHandler } from '@/lib/api';
import { setChallengeCookie } from '@/lib/session';

export const POST = withApiHandler('auth.login.options', async () => {
  const options = await generateAuthenticationOptions({
    rpID: process.env.RP_ID!,
    userVerification: 'required',
  });

  await setChallengeCookie({ challenge: options.challenge });
  return NextResponse.json(options);
});