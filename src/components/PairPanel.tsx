'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { InvitePayload } from '@/types/vouchdrop';

type InviteResponse = {
  code?: string;
  expiresAt?: string;
  error?: string;
};

type RedeemResponse = {
  contact?: { id: string; displayName: string };
  error?: string;
};

type ActiveTab = 'share' | 'redeem';

export function PairPanel() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>('share');
  const [invite, setInvite] = useState<InvitePayload | null>(null);
  const [redeemInput, setRedeemInput] = useState('');
  const [feedback, setFeedback] = useState<{ text: string; tone: 'neutral' | 'success' | 'error' } | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleGenerateInvite() {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/contacts/invite', { method: 'POST' });
      const data = (await res.json()) as InviteResponse;
      if (!res.ok || !data.code || !data.expiresAt) {
        setFeedback({ text: data.error ?? 'Failed to generate invite code', tone: 'error' });
        return;
      }
      setInvite({ code: data.code, expiresAt: data.expiresAt });
      setFeedback({ text: 'One-time code ready to share.', tone: 'success' });
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyCode() {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.code);
      setFeedback({ text: `Copied ${invite.code} to clipboard.`, tone: 'success' });
    } catch {
      setFeedback({ text: 'Clipboard unavailable — copy the code manually.', tone: 'neutral' });
    }
  }

  async function handleShareCode() {
    if (!invite) return;
    const shareText = `Pair with me on VouchDrop using code: ${invite.code}`;
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title: 'VouchDrop Pair Code', text: shareText });
        return;
      } catch {
        // Fall back to clipboard if user dismissed share sheet
      }
    }
    await handleCopyCode();
  }

  async function handleRedeemCode() {
    const cleaned = redeemInput.trim().toUpperCase();
    if (!cleaned) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/contacts/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cleaned }),
      });
      const data = (await res.json()) as RedeemResponse;
      if (!res.ok || !data.contact) {
        setFeedback({ text: data.error ?? 'Failed to redeem invite code', tone: 'error' });
        return;
      }
      setRedeemInput('');
      setFeedback({ text: `Paired with ${data.contact.displayName}!`, tone: 'success' });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">Pair Trusted Contact</h2>
          <p className="text-xs text-zinc-400">Closed allowlist · Mutual pairing required</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950/70 p-1">
        <button
          type="button"
          onClick={() => setActiveTab('share')}
          className={`min-h-[44px] rounded-lg px-3 text-xs font-medium transition-colors ${
            activeTab === 'share'
              ? 'bg-zinc-800 text-zinc-100 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Share Invite
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('redeem')}
          className={`min-h-[44px] rounded-lg px-3 text-xs font-medium transition-colors ${
            activeTab === 'redeem'
              ? 'bg-zinc-800 text-zinc-100 shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Enter Partner Code
        </button>
      </div>

      {activeTab === 'share' ? (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={handleGenerateInvite}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-zinc-100 px-4 text-xs font-semibold text-zinc-950 transition-colors hover:bg-white disabled:opacity-50"
          >
            {busy ? 'Generating...' : 'Generate 6-Char Code'}
          </button>

          {invite && (
            <div className="flex flex-col gap-3 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-2xl font-semibold tracking-[0.25em] text-emerald-400">
                  {invite.code}
                </span>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[10px] font-medium text-emerald-300">
                  Expires in 5m
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-zinc-700 bg-zinc-950/70 px-3 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:text-white"
                >
                  Copy Code
                </button>
                <button
                  type="button"
                  onClick={handleShareCode}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-emerald-500 px-3 text-xs font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
                >
                  Share
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              className="min-h-[44px] flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 font-mono text-sm uppercase tracking-[0.2em] text-zinc-100 placeholder:tracking-normal placeholder:text-zinc-500 focus:border-emerald-500/60 focus:outline-none"
              maxLength={6}
              placeholder="6-CHAR CODE"
              value={redeemInput}
              onChange={(e) => setRedeemInput(e.target.value.toUpperCase())}
              disabled={busy}
            />
            <button
              type="button"
              disabled={busy || redeemInput.trim().length < 6}
              onClick={handleRedeemCode}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-emerald-500 px-5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:opacity-40"
            >
              Pair
            </button>
          </div>
          <p className="text-[11px] text-zinc-500">Ask your partner to generate a 6-character invite code.</p>
        </div>
      )}

      {feedback && (
        <p
          className={`rounded-xl border px-3.5 py-2 text-xs ${
            feedback.tone === 'error'
              ? 'border-red-500/30 bg-red-950/20 text-red-300'
              : feedback.tone === 'success'
                ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300'
                : 'border-zinc-800 bg-zinc-950/60 text-zinc-300'
          }`}
        >
          {feedback.text}
        </p>
      )}
    </section>
  );
}
