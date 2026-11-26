export type LogLevel = 'info' | 'warn' | 'error';
export type LogMeta = Record<string, string | number | boolean>;

export function logEvent(level: LogLevel, event: string, meta?: LogMeta): void {
  const payload = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...(meta ?? {}),
  });

  if (level === 'error') {
    console.error(payload);
  } else if (level === 'warn') {
    console.warn(payload);
  } else {
    console.info(payload);
  }
}
