'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import type { SessionUser } from '@/types/vouchdrop';

type AuthGateProps = {
  initialRoomId: string | null;
};

type ApiErrorResponse = {
  error?: string;
};

type VerifyAuthResponse = {
  user?: SessionUser;
  error?: string;
};

export function AuthGate({ initialRoomId }: AuthGateProps) {
  const router = useRouter();
  const [showRegister, setShowRegister] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleLogin() {
    setBusy(true);
    setIsError(false);
    setStatus('Waiting for your passkey...');
    try {
      const optRes = await fetch('/api/auth/login/options', { method: 'POST' });
      const options = (await optRes.json()) as PublicKeyCredentialRequestOptionsJSON & ApiErrorResponse;
      if (!optRes.ok) {
        setIsError(true);
        setStatus(options.error ?? 'Failed to start sign-in');
        return;
      }

      const assertion = await startAuthentication({ optionsJSON: options });
      const verRes = await fetch('/api/auth/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assertion),
      });
      const result = (await verRes.json()) as VerifyAuthResponse;
      if (!verRes.ok || !result.user) {
        setIsError(true);
        setStatus(result.error ?? 'Sign-in verification failed');
        return;
      }

      setStatus(`Signed in as ${result.user.displayName}`);
      router.refresh();
    } catch (err) {
      setIsError(true);
      setStatus(err instanceof Error ? err.message : 'Passkey sign-in cancelled');
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister() {
    if (!displayName.trim()) {
      setIsError(true);
      setStatus('Please enter a display name first.');
      return;
    }
    setBusy(true);
    setIsError(false);
    setStatus('Creating hardware-backed passkey...');
    try {
      const optRes = await fetch('/api/auth/register/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: displayName.trim() }),
      });
      const options = (await optRes.json()) as PublicKeyCredentialCreationOptionsJSON & ApiErrorResponse;
      if (!optRes.ok) {
        setIsError(true);
        setStatus(options.error ?? 'Failed to start registration');
        return;
      }

      const attestation = await startRegistration({ optionsJSON: options });
      const verRes = await fetch('/api/auth/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attestation),
      });
      const result = (await verRes.json()) as VerifyAuthResponse;
      if (!verRes.ok || !result.user) {
        setIsError(true);
        setStatus(result.error ?? 'Registration verification failed');
        return;
      }

      setStatus(`Registered & signed in as ${result.user.displayName}`);
      router.refresh();
    } catch (err) {
      setIsError(true);
      setStatus(err instanceof Error ? err.message : 'Passkey registration cancelled');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <section className="flex flex-col gap-6 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-2">
          <span className="w-fit rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] font-medium text-emerald-300">
            Zero-Storage Courier
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
            Direct encrypted document handoff.
          </h1>
          <p className="text-sm leading-relaxed text-zinc-400">
            Send PDF, Office, CSV, and Figma files directly between browsers over WebRTC—verified with SHA-256 and
            locked to your trusted contacts.
          </p>
        </div>

        {initialRoomId && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 px-4 py-3 text-xs text-amber-200">
            Incoming transfer waiting in room{' '}
            <span className="font-mono font-semibold text-amber-300">{initialRoomId}</span>. Sign in to inspect and
            accept.
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={handleLogin}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:opacity-50"
          >
            {busy ? 'Authenticating...' : 'Sign in with Passkey'}
          </button>

          <button
            type="button"
            onClick={() => setShowRegister((prev) => !prev)}
            aria-expanded={showRegister}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100"
          >
            {showRegister ? 'Hide new device setup' : 'First time? Create a Passkey'}
          </button>
        </div>

        {showRegister && (
          <div className="flex flex-col gap-3 rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
            <label className="flex flex-col gap-1.5 text-xs font-medium text-zinc-300">
              <span>Display name</span>
              <input
                className="min-h-[44px] rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500/60 focus:outline-none"
                placeholder="e.g. Alex Rivera"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={busy}
              />
            </label>
            <button
              type="button"
              disabled={busy || !displayName.trim()}
              onClick={handleRegister}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-white disabled:opacity-40"
            >
              Create Passkey &amp; Continue
            </button>
          </div>
        )}

        {status && (
          <p
            className={`rounded-xl border px-3.5 py-2.5 text-xs ${
              isError
                ? 'border-red-500/30 bg-red-950/20 text-red-300'
                : 'border-zinc-800 bg-zinc-950/60 text-zinc-300'
            }`}
          >
            {status}
          </p>
        )}

        <div className="grid grid-cols-3 gap-2 border-t border-zinc-800/80 pt-5 text-center">
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/50 px-2 py-2.5">
            <p className="text-[11px] font-medium text-zinc-200">Hardware Passkeys</p>
          </div>
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/50 px-2 py-2.5">
            <p className="text-[11px] font-medium text-zinc-200">Closed Allowlist</p>
          </div>
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/50 px-2 py-2.5">
            <p className="text-[11px] font-medium text-zinc-200">Zero Cloud Storage</p>
          </div>
        </div>
      </section>
    </main>
  );
}
