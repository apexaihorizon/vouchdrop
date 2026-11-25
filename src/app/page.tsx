'use client';

import { useState } from 'react';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';

export default function Home() {
  const [name, setName] = useState('');
  const [status, setStatus] = useState('Idle');

  async function handleRegister() {
    setStatus('Requesting registration options...');
    const optRes = await fetch('/api/auth/register/options', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: name }),
    });
    const options = await optRes.json();
    if (!optRes.ok) return setStatus(`Error: ${options.error}`);

    const attestation = await startRegistration({ optionsJSON: options });

    const verRes = await fetch('/api/auth/register/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(attestation),
    });
    const result = await verRes.json();
    setStatus(verRes.ok ? `Registered & signed in as ${result.user.displayName}` : `Error: ${result.error}`);
  }

  async function handleLogin() {
    setStatus('Requesting login challenge...');
    const optRes = await fetch('/api/auth/login/options', { method: 'POST' });
    const options = await optRes.json();
    if (!optRes.ok) return setStatus(`Error: ${options.error}`);

    const assertion = await startAuthentication({ optionsJSON: options });

    const verRes = await fetch('/api/auth/login/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assertion),
    });
    const result = await verRes.json();
    setStatus(verRes.ok ? `Logged back in as ${result.user.displayName}` : `Error: ${result.error}`);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold">VouchDrop — Step 2 Passkey Test</h1>
      <input
        className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
        placeholder="Display name (e.g. Prithviraj)"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="flex gap-3">
        <button onClick={handleRegister} className="rounded bg-white px-4 py-2 text-sm font-medium text-black">
          Register Passkey
        </button>
        <button onClick={handleLogin} className="rounded border border-zinc-600 px-4 py-2 text-sm">
          Sign In with Passkey
        </button>
      </div>
      <p className="text-xs text-zinc-400">{status}</p>
    </main>
  );
}