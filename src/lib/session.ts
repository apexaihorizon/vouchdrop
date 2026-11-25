import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const secret = new TextEncoder().encode(process.env.SESSION_SECRET!);

export async function setChallengeCookie(payload: { challenge: string; displayName?: string }) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('60s')
    .sign(secret);

  (await cookies()).set('vd_challenge', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60,
    path: '/',
  });
}

export async function getChallengeCookie() {
  const token = (await cookies()).get('vd_challenge')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as { challenge: string; displayName?: string };
  } catch {
    return null;
  }
}

export async function setSessionCookie(userId: string) {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(secret);

  const jar = await cookies();
  jar.delete('vd_challenge');
  jar.set('vd_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
}

export async function getSessionUserId(): Promise<string | null> {
  const token = (await cookies()).get('vd_session')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return (payload.userId as string) ?? null;
  } catch {
    return null;
  }
}