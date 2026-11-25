import { NextResponse } from 'next/server';

export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly status: number = 400
  ) {
    super(message);
  }
}

type RouteHandler = (req: Request) => Promise<NextResponse>;

export function withApiHandler(routeName: string, handler: RouteHandler): RouteHandler {
  return async (req: Request) => {
    try {
      return await handler(req);
    } catch (err) {
      if (err instanceof AppError) {
        console.warn(JSON.stringify({ level: 'warn', route: routeName, status: err.status, error: err.message }));
        return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
      }

      console.error(
        JSON.stringify({
          level: 'error',
          route: routeName,
          status: 500,
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      );
      return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
    }
  };
}