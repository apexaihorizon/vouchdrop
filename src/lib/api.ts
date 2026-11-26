import { NextResponse } from 'next/server';
import { AppError } from '@/lib/errors';
import { logEvent } from '@/lib/logger';

export { AppError };

type RouteHandler = (req: Request) => Promise<NextResponse>;

export function withApiHandler(routeName: string, handler: RouteHandler): RouteHandler {
  return async (req: Request) => {
    try {
      return await handler(req);
    } catch (err) {
      if (err instanceof AppError) {
        logEvent('warn', routeName, { code: err.code, status: err.httpStatus });
        return NextResponse.json(
          { ok: false, code: err.code, error: err.userMessage },
          { status: err.httpStatus }
        );
      }

      logEvent('error', routeName, { code: 'INTERNAL_ERROR', status: 500 });
      return NextResponse.json(
        { ok: false, code: 'INTERNAL_ERROR', error: 'Something went wrong. Please try again.' },
        { status: 500 }
      );
    }
  };
}
