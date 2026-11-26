import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get('vd_session')?.value;
  const rawSecret = process.env.SESSION_SECRET;
  if (!token || !rawSecret) {
    return false;
  }

  try {
    const secret = new TextEncoder().encode(rawSecret);
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    return typeof payload.userId === 'string' && payload.userId.length > 0;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const room = searchParams.get('room');
  const roomQuery = room ? `?room=${encodeURIComponent(room)}` : '';
  const authenticated = await hasValidSession(request);

  if (pathname.startsWith('/app') && !authenticated) {
    return NextResponse.redirect(new URL(`/auth${roomQuery}`, request.url));
  }

  if (pathname.startsWith('/auth') && authenticated) {
    return NextResponse.redirect(new URL(`/app${roomQuery}`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/app/:path*', '/auth/:path*'],
};
