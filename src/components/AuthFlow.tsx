'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { AppError, toUserErrorMessage } from '@/lib/errors';
import {
  authVerifyResponseSchema,
  DISPLAY_NAME_ERROR,
  displayNameSchema,
} from '@/lib/validators';

type AuthFlowProps = {
  initialRoomId: string | null;
};

type AuthMode = 'choose' | 'login' | 'signup';

const GENERIC_AUTH_ERROR = 'Authentication could not be completed. Please try again.';

export function AuthFlow({ initialRoomId }: AuthFlowProps) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('choose');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const attemptRef = useRef(0);

  const destination = initialRoomId ? `/app?room=${encodeURIComponent(initialRoomId)}` : '/app';
  const displayNameValid = displayNameSchema.safeParse(displayName).success;

  function switchMode(nextMode: AuthMode) {
    attemptRef.current += 1;
    setBusy(false);
    setError(null);
    setMode(nextMode);
  }

  async function handleLogin() {
    const attemptId = ++attemptRef.current;
    setMode('login');
    setBusy(true);
    setError(null);

    try {
      const optRes = await fetch('/api/auth/login/options', { method: 'POST' });
      if (attemptRef.current !== attemptId) return;
      if (!optRes.ok) {
        throw new AppError('AUTH_CANCELLED', GENERIC_AUTH_ERROR, optRes.status);
      }

      const options = (await optRes.json().catch(() => null)) as PublicKeyCredentialRequestOptionsJSON | null;
      if (attemptRef.current !== attemptId) return;
      if (!options || typeof options.challenge !== 'string') {
        throw new AppError('AUTH_CANCELLED', GENERIC_AUTH_ERROR, 500);
      }

      const assertion = await startAuthentication({ optionsJSON: options });
      if (attemptRef.current !== attemptId) return;

      const verRes = await fetch('/api/auth/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assertion),
      });
      if (attemptRef.current !== attemptId) return;
      if (!verRes.ok) {
        throw new AppError('AUTH_CANCELLED', GENERIC_AUTH_ERROR, verRes.status);
      }

      const parsed = authVerifyResponseSchema.safeParse(await verRes.json().catch(() => null));
      if (attemptRef.current !== attemptId) return;
      if (!parsed.success) {
        throw new AppError('AUTH_CANCELLED', GENERIC_AUTH_ERROR, 500);
      }

      router.replace(destination);
      router.refresh();
    } catch (err) {
      if (attemptRef.current !== attemptId) return;
      setError(toUserErrorMessage(err));
    } finally {
      if (attemptRef.current === attemptId) {
        setBusy(false);
      }
    }
  }

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedName = displayNameSchema.safeParse(displayName);
    if (!parsedName.success) {
      setError(DISPLAY_NAME_ERROR);
      return;
    }

    const attemptId = ++attemptRef.current;
    setBusy(true);
    setError(null);

    try {
      const optRes = await fetch('/api/auth/register/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: parsedName.data }),
      });
      if (attemptRef.current !== attemptId) return;
      if (!optRes.ok) {
        throw new AppError(
          'AUTH_CANCELLED',
          optRes.status === 400 ? DISPLAY_NAME_ERROR : GENERIC_AUTH_ERROR,
          optRes.status
        );
      }

      const options = (await optRes.json().catch(() => null)) as PublicKeyCredentialCreationOptionsJSON | null;
      if (attemptRef.current !== attemptId) return;
      if (!options || typeof options.challenge !== 'string') {
        throw new AppError('AUTH_CANCELLED', GENERIC_AUTH_ERROR, 500);
      }

      const attestation = await startRegistration({ optionsJSON: options });
      if (attemptRef.current !== attemptId) return;

      const verRes = await fetch('/api/auth/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attestation),
      });
      if (attemptRef.current !== attemptId) return;
      if (!verRes.ok) {
        throw new AppError('AUTH_CANCELLED', GENERIC_AUTH_ERROR, verRes.status);
      }

      const parsed = authVerifyResponseSchema.safeParse(await verRes.json().catch(() => null));
      if (attemptRef.current !== attemptId) return;
      if (!parsed.success) {
        throw new AppError('AUTH_CANCELLED', GENERIC_AUTH_ERROR, 500);
      }

      router.replace(destination);
      router.refresh();
    } catch (err) {
      if (attemptRef.current !== attemptId) return;
      setError(toUserErrorMessage(err));
    } finally {
      if (attemptRef.current === attemptId) {
        setBusy(false);
      }
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <Card padding="lg" className="flex flex-col gap-6">
        {initialRoomId && (
          <div className="rounded-[var(--radius-control)] border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 px-4 py-3 text-xs text-amber-200">
            Incoming transfer waiting in room{' '}
            <span className="font-mono font-semibold text-amber-300">{initialRoomId}</span>. Authenticate to inspect
            and accept.
          </div>
        )}

        {mode === 'choose' && (
          <>
            <div className="flex flex-col gap-2">
              <Badge tone="emerald" className="w-fit">
                WebAuthn Passkeys
              </Badge>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Authenticate to VouchDrop</h1>
              <p className="text-sm leading-relaxed text-zinc-400">
                Sign in with an existing device passkey or create a new hardware-backed identity.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button variant="primary" className="w-full" onClick={() => void handleLogin()}>
                Sign In
              </Button>
              <Button variant="secondary" className="w-full" onClick={() => switchMode('signup')}>
                Create Account
              </Button>
            </div>
          </>
        )}

        {mode === 'login' && (
          <>
            <div className="flex flex-col gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-zinc-100">Sign In</h1>
              <p className="text-sm text-zinc-400">
                {busy ? 'Waiting for device passkey...' : 'Confirm your passkey prompt to continue.'}
              </p>
            </div>

            {busy && (
              <div className="flex items-center gap-3 rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-4 py-3 text-xs text-zinc-300">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--color-accent)]" aria-hidden="true" />
                <span>Waiting for device passkey...</span>
              </div>
            )}

            {error && (
              <div className="flex flex-col gap-3">
                <p className="rounded-[var(--radius-control)] border border-[var(--color-danger)]/35 bg-[var(--color-danger)]/10 px-3.5 py-2.5 text-xs text-rose-300">
                  {error}
                </p>
                <Button variant="primary" className="w-full" loading={busy} onClick={() => void handleLogin()}>
                  Try Again
                </Button>
              </div>
            )}

            <Button variant="ghost" size="sm" className="w-full" onClick={() => switchMode('choose')}>
              ← Back
            </Button>
          </>
        )}

        {mode === 'signup' && (
          <form onSubmit={handleSignup} className="flex flex-col gap-5" noValidate>
            <div className="flex flex-col gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-zinc-100">Create Account</h1>
              <p className="text-sm text-zinc-400">
                Choose the display name your trusted contacts will see during transfers.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="display-name-input" className="text-xs font-medium text-zinc-300">
                Display Name
              </label>
              <input
                id="display-name-input"
                type="text"
                autoFocus
                maxLength={32}
                aria-describedby="display-name-hint"
                className="min-h-[44px] rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-canvas)] px-3.5 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-[var(--color-accent)] focus:outline-none"
                placeholder="e.g. Alex Rivera"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  if (error) setError(null);
                }}
                disabled={busy}
              />
              <p id="display-name-hint" className="text-[11px] text-zinc-500">
                2–32 chars · letters, numbers, spaces, . _ -
              </p>
            </div>

            {error && (
              <p className="rounded-[var(--radius-control)] border border-[var(--color-danger)]/35 bg-[var(--color-danger)]/10 px-3.5 py-2.5 text-xs text-rose-300">
                {error}
              </p>
            )}

            <div className="flex flex-col gap-2.5">
              <Button type="submit" variant="primary" className="w-full" loading={busy} disabled={!displayNameValid}>
                {busy ? 'Creating Passkey...' : 'Create Passkey'}
              </Button>
              <Button variant="ghost" size="sm" className="w-full" onClick={() => switchMode('choose')}>
                ← Back
              </Button>
            </div>
          </form>
        )}
      </Card>
    </main>
  );
}
