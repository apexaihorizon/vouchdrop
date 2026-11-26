'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { DISPLAY_NAME_ERROR, DISPLAY_NAME_REGEX, normalizeDisplayName } from '@/lib/validators';
import type { SessionUser } from '@/types/vouchdrop';

type AuthFlowProps = {
  initialRoomId: string | null;
};

type AuthMode = 'choose' | 'login' | 'signup';

type VerifyAuthResponse = {
  user?: SessionUser;
};

const GENERIC_AUTH_ERROR = 'Authentication could not be completed. Please try again.';

function mapAuthError(err: unknown): string {
  if (err instanceof Error) {
    switch (err.name) {
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
  return GENERIC_AUTH_ERROR;
}

function isValidDisplayName(raw: string): boolean {
  const normalized = normalizeDisplayName(raw);
  return normalized.length >= 2 && normalized.length <= 32 && DISPLAY_NAME_REGEX.test(normalized);
}

export function AuthFlow({ initialRoomId }: AuthFlowProps) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('choose');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const attemptRef = useRef(0);

  const destination = initialRoomId ? `/app?room=${encodeURIComponent(initialRoomId)}` : '/app';
  const displayNameValid = isValidDisplayName(displayName);

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
        setError(GENERIC_AUTH_ERROR);
        return;
      }

      const options = (await optRes.json()) as PublicKeyCredentialRequestOptionsJSON;
      if (attemptRef.current !== attemptId) return;

      const assertion = await startAuthentication({ optionsJSON: options });
      if (attemptRef.current !== attemptId) return;

      const verRes = await fetch('/api/auth/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assertion),
      });
      if (attemptRef.current !== attemptId) return;
      if (!verRes.ok) {
        setError(GENERIC_AUTH_ERROR);
        return;
      }

      const result = (await verRes.json()) as VerifyAuthResponse;
      if (attemptRef.current !== attemptId) return;
      if (!result.user) {
        setError(GENERIC_AUTH_ERROR);
        return;
      }

      router.replace(destination);
      router.refresh();
    } catch (err) {
      if (attemptRef.current !== attemptId) return;
      setError(mapAuthError(err));
    } finally {
      if (attemptRef.current === attemptId) {
        setBusy(false);
      }
    }
  }

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeDisplayName(displayName);
    if (!isValidDisplayName(normalized)) {
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
        body: JSON.stringify({ displayName: normalized }),
      });
      if (attemptRef.current !== attemptId) return;
      if (!optRes.ok) {
        setError(optRes.status === 400 ? DISPLAY_NAME_ERROR : GENERIC_AUTH_ERROR);
        return;
      }

      const options = (await optRes.json()) as PublicKeyCredentialCreationOptionsJSON;
      if (attemptRef.current !== attemptId) return;

      const attestation = await startRegistration({ optionsJSON: options });
      if (attemptRef.current !== attemptId) return;

      const verRes = await fetch('/api/auth/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attestation),
      });
      if (attemptRef.current !== attemptId) return;
      if (!verRes.ok) {
        setError(GENERIC_AUTH_ERROR);
        return;
      }

      const result = (await verRes.json()) as VerifyAuthResponse;
      if (attemptRef.current !== attemptId) return;
      if (!result.user) {
        setError(GENERIC_AUTH_ERROR);
        return;
      }

      router.replace(destination);
      router.refresh();
    } catch (err) {
      if (attemptRef.current !== attemptId) return;
      setError(mapAuthError(err));
    } finally {
      if (attemptRef.current === attemptId) {
        setBusy(false);
      }
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <section className="flex flex-col gap-6 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-6 shadow-sm sm:p-8">
        {initialRoomId && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 px-4 py-3 text-xs text-amber-200">
            Incoming transfer waiting in room{' '}
            <span className="font-mono font-semibold text-amber-300">{initialRoomId}</span>. Authenticate to inspect
            and accept.
          </div>
        )}

        {mode === 'choose' && (
          <>
            <div className="flex flex-col gap-2">
              <span className="w-fit rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] font-medium text-emerald-300">
                WebAuthn Passkeys
              </span>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Authenticate to VouchDrop</h1>
              <p className="text-sm leading-relaxed text-zinc-400">
                Sign in with an existing device passkey or create a new hardware-backed identity.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => void handleLogin()}
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
              >
                Sign In
              </button>

              <button
                type="button"
                onClick={() => switchMode('signup')}
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-zinc-700 bg-zinc-950/60 px-4 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-600 hover:bg-zinc-900 hover:text-white"
              >
                Create Account
              </button>
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
              <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-xs text-zinc-300">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" aria-hidden="true" />
                <span>Waiting for device passkey...</span>
              </div>
            )}

            {error && (
              <div className="flex flex-col gap-3">
                <p className="rounded-xl border border-red-500/30 bg-red-950/20 px-3.5 py-2.5 text-xs text-red-300">
                  {error}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleLogin()}
                  className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:opacity-50"
                >
                  Try Again
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => switchMode('choose')}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100"
            >
              ← Back
            </button>
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
                className="min-h-[44px] rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500/60 focus:outline-none"
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
              <p className="rounded-xl border border-red-500/30 bg-red-950/20 px-3.5 py-2.5 text-xs text-red-300">
                {error}
              </p>
            )}

            <div className="flex flex-col gap-2.5">
              <button
                type="submit"
                disabled={busy || !displayNameValid}
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:opacity-40"
              >
                {busy ? 'Creating Passkey...' : 'Create Passkey'}
              </button>

              <button
                type="button"
                onClick={() => switchMode('choose')}
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100"
              >
                ← Back
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
