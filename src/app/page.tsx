'use client';

import { useEffect, useRef, useState } from 'react';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { usePeerTransfer } from '@/hooks/usePeerTransfer';

type Contact = { id: string; displayName: string };

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export default function Home() {
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [redeemInput, setRedeemInput] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [manualRoomId, setManualRoomId] = useState('');
  const [status, setStatus] = useState('Idle');

  const transfer = usePeerTransfer();

  async function refreshContacts() {
    const res = await fetch('/api/contacts');
    const data = await res.json();
    if (res.ok) setContacts(data.contacts);
  }

  // Register Service Worker & auto-join if opened from Web Push ?room=<id>
  const joinedRef = useRef(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room && !joinedRef.current) {
      joinedRef.current = true;
      transfer.joinIncomingRoom(room);
    }
  }, []);
  async function handleEnablePush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return setStatus('Push notifications not supported in this browser');
    }
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return setStatus('Notification permission denied');

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
    });

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub.toJSON()),
    });
    setStatus(res.ok ? 'Web Push enabled for this browser!' : 'Failed to save push subscription');
  }

  async function handleRegister() {
    setStatus('Registering passkey...');
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
    if (!verRes.ok) return setStatus(`Error: ${result.error}`);

    setStatus(`Registered & signed in as ${result.user.displayName}`);
    await refreshContacts();
  }

  async function handleLogin() {
    setStatus('Signing in...');
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
    if (!verRes.ok) return setStatus(`Error: ${result.error}`);

    setStatus(`Logged in as ${result.user.displayName}`);
    await refreshContacts();
  }

  async function handleGenerateInvite() {
    const res = await fetch('/api/contacts/invite', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) return setStatus(`Error: ${data.error}`);
    setInviteCode(data.code);
    setStatus(`Code generated (5m TTL): ${data.code}`);
  }

  async function handleRedeemCode() {
    const res = await fetch('/api/contacts/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: redeemInput }),
    });
    const data = await res.json();
    if (!res.ok) return setStatus(`Error: ${data.error}`);
    setRedeemInput('');
    setStatus(`Paired with ${data.contact.displayName}!`);
    await refreshContacts();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-5 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">VouchDrop — End-to-End Test</h1>
        <button onClick={handleEnablePush} className="rounded border border-zinc-600 px-3 py-1 text-xs">
          Enable Push
        </button>
      </div>

      {/* Auth */}
      <section className="flex flex-col gap-2 border-b border-zinc-800 pb-4">
        <input
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
          placeholder="Display name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex gap-3">
          <button onClick={handleRegister} className="rounded bg-white px-4 py-2 text-sm font-medium text-black">
            Register Passkey
          </button>
          <button onClick={handleLogin} className="rounded border border-zinc-600 px-4 py-2 text-sm">
            Sign In
          </button>
        </div>
      </section>

      {/* Pairing */}
      <section className="flex flex-wrap items-center gap-2 border-b border-zinc-800 pb-4">
        <button onClick={handleGenerateInvite} className="rounded bg-zinc-800 px-3 py-2 text-sm">
          Generate Code
        </button>
        {inviteCode && <span className="font-mono text-sm text-emerald-400">{inviteCode}</span>}
        <input
          className="w-28 rounded border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm uppercase"
          maxLength={6}
          placeholder="CODE"
          value={redeemInput}
          onChange={(e) => setRedeemInput(e.target.value.toUpperCase())}
        />
        <button onClick={handleRedeemCode} className="rounded bg-white px-3 py-2 text-sm font-medium text-black">
          Pair
        </button>
      </section>

      {/* File Picker & Contacts */}
      <section className="flex flex-col gap-3 border-b border-zinc-800 pb-4">
        <input
          type="file"
          accept=".pdf,.docx,.pptx,.csv,.fig"
          onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
          className="text-xs text-zinc-300"
        />

        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-300">Trusted Contacts ({contacts.length})</h2>
          <button onClick={refreshContacts} className="text-xs text-zinc-400 underline">
            Refresh
          </button>
        </div>

        {contacts.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded border border-zinc-800 px-3 py-2 text-sm">
            <span>{c.displayName}</span>
            <button
              disabled={!selectedFile}
              onClick={() => selectedFile && transfer.startSend(c.id, selectedFile)}
              className="rounded bg-emerald-500 px-3 py-1 text-xs font-medium text-black disabled:opacity-40"
            >
              Send File
            </button>
          </div>
        ))}
      </section>

      {/* Receiver Controls & Transfer Status */}
      <section className="flex flex-col gap-2 rounded border border-zinc-800 bg-zinc-900/50 p-4 text-xs">
        <div className="flex gap-2">
          <input
            className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono"
            placeholder="Manual Room ID (if testing without Push)"
            value={manualRoomId}
            onChange={(e) => setManualRoomId(e.target.value)}
          />
          <button
            onClick={() => manualRoomId && transfer.joinIncomingRoom(manualRoomId)}
            className="rounded border border-zinc-600 px-3 py-1"
          >
            Join Room
          </button>
        </div>

        {transfer.state === 'incoming_offer' && transfer.incomingMeta && (
          <div className="mt-2 flex items-center justify-between rounded border border-amber-500/40 bg-amber-950/30 p-3">
            <span>
              Accept <strong>{transfer.incomingMeta.fileName}</strong>?
            </span>
            <div className="flex gap-2">
              <button onClick={transfer.acceptTransfer} className="rounded bg-emerald-500 px-3 py-1 font-medium text-black">
                Accept & Save
              </button>
              <button onClick={transfer.declineTransfer} className="rounded border border-zinc-600 px-3 py-1">
                Decline
              </button>
            </div>
          </div>
        )}

        {(transfer.state === 'knocking' || transfer.state === 'transferring') && (
          <div className="mt-2 flex items-center justify-between">
            <span>Progress: {transfer.progress}%</span>
            <button onClick={transfer.cancelTransfer} className="text-red-400 underline">
              Cancel
            </button>
          </div>
        )}

        {transfer.sha256Receipt && (
          <p className="break-all font-mono text-[11px] text-emerald-400">SHA-256: {transfer.sha256Receipt}</p>
        )}

        <p className="text-zinc-300">Transfer: {transfer.message || transfer.state}</p>
        <p className="text-zinc-500">Auth/Pairing: {status}</p>
      </section>
    </main>
  );
}