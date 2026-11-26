export type AppErrorCode =
  | 'INVALID_FILE_TYPE'
  | 'FILE_TOO_LARGE'
  | 'CORRUPT_ARCHIVE'
  | 'NOT_PAIRED'
  | 'INVITE_INVALID'
  | 'INVITE_EXPIRED'
  | 'RATE_LIMITED'
  | 'NAT_TIMEOUT'
  | 'HASH_MISMATCH'
  | 'AUTH_CANCELLED'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  public readonly code: AppErrorCode;
  public readonly httpStatus: number;
  public readonly userMessage: string;

  constructor(code: AppErrorCode, userMessage: string, httpStatus = 400) {
    super(userMessage);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.userMessage = userMessage;
  }
}

export function toUserErrorMessage(err: unknown): string {
  if (err instanceof AppError) {
    return err.userMessage;
  }

  if (err instanceof Error || (typeof err === 'object' && err !== null && 'name' in err)) {
    const name = String((err as { name: unknown }).name);
    switch (name) {
      case 'NotAllowedError':
        return 'Passkey prompt was cancelled or timed out. Click below to try again.';
      case 'SecurityError':
        return 'Passkeys require a secure HTTPS connection.';
      case 'InvalidStateError':
        return 'This device already has a passkey registered for this account.';
      case 'NotSupportedError':
        return 'Passkeys are not supported on this browser or device.';
    }
  }

  return 'Something went wrong. Please try again.';
}
