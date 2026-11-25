import { NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { setChallengeCookie } from '@/lib/session';

export async function POST(req: Request) {
  const { displayName } = await req.json();
  if (!displayName || typeof displayName !== 'string' || displayName.trim().length < 2) {
    return NextResponse.json({ error: 'Display name must be at least 2 characters' }, { status: 400 });
  }

  const cleanName = displayName.trim().slice(0, 40);
  const options = await generateRegistrationOptions({
    rpName: 'VouchDrop',
    rpID: process.env.RP_ID!,
    userName: cleanName,
    userDisplayName: cleanName,
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'required',
    },
  });

  await setChallengeCookie({ challenge: options.challenge, displayName: cleanName });
  return NextResponse.json(options);
}