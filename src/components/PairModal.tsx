'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { AppError, toUserErrorMessage } from '@/lib/errors';
import {
  apiFailureSchema,
  contactsListResponseSchema,
  INVITE_CODE_ERROR,
  inviteResponseSchema,
  redeemCodeSchema,
  redeemResponseSchema,
} from '@/lib/validators';
import type { InvitePayload } from '@/types/vouchdrop';

type PairModalProps = {
  open: boolean;
  onClose: () => void;
};

type ActiveTab = 'share' | 'redeem';

function formatCountdown(msRemaining: number): string {
  const totalSeconds = Math.max(0, Math.ceil(msRemaining / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function PairModal({ open, onClose }: PairModalProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>('share');
  const [invite, setInvite] = useState<InvitePayload | null>(null);
  const [remainingMs, setRemainingMs] = useState<number>(0);
  const [redeemInput, setRedeemInput] = useState('');
  const [feedback, setFeedback] = useState<{ text: string; tone: 'neutral' | 'success' | 'error' } | null>(null);
  const [busy, setBusy] = useState(false);

  const baselineContactsRef = useRef<number | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isRedeemValid = redeemCodeSchema.safeParse({ code: redeemInput }).success;

  // Reset transient state when modal closes
  useEffect(() => {
    if (!open) {
      setInvite(null);
      setRemainingMs(0);
      setRedeemInput('');
      setFeedback(null);
      setBusy(false);
      baselineContactsRef.current = null;
      if (closeTimeoutRef.current !== null) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    }
  }, [open]);

  // Live mm:ss countdown while an invite is active
  useEffect(() => {
    if (!open || !invite) return;

    const expiresAtMs = new Date(invite.expiresAt).getTime();
    const tick = () => {
      const diff = expiresAtMs - Date.now();
      if (diff <= 0) {
        setRemainingMs(0);
        setInvite(null);
        setFeedback({ text: 'Invite code expired. Generate a new code to pair.', tone: 'neutral' });
      } else {
        setRemainingMs(diff);
      }
    };

    tick();
    const intervalId = setInterval(tick, 1000);
    return () => clearInterval(intervalId);
  }, [open, invite]);

  // Poll GET /api/contacts every 3s while an invite is active; auto-clear & close on pair
  useEffect(() => {
    if (!open || !invite) return;

    let cancelled = false;

    const pollContacts = async () => {
      try {
        const res = await fetch('/api/contacts', { cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const parsed = contactsListResponseSchema.safeParse(await res.json().catch(() => null));
        if (!parsed.success || cancelled) return;

        const currentCount = parsed.data.contacts.length;
        if (baselineContactsRef.current === null) {
          baselineContactsRef.current = currentCount;
          return;
        }

        if (currentCount > baselineContactsRef.current) {
          setInvite(null);
          setRemainingMs(0);
          setFeedback({ text: 'Paired!', tone: 'success' });
          router.refresh();
          closeTimeoutRef.current = setTimeout(() => {
            onClose();
          }, 900);
        }
      } catch {
        // Ignore transient polling hiccups
      }
    };

    const intervalId = setInterval(() => {
      void pollContacts();
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [open, invite, router, onClose]);

  async function handleGenerateInvite() {
    setBusy(true);
    setFeedback(null);
    try {
      // Snapshot current contact count before issuing the code
      const contactsRes = await fetch('/api/contacts', { cache: 'no-store' });
      if (contactsRes.ok) {
        const parsedContacts = contactsListResponseSchema.safeParse(await contactsRes.json().catch(() => null));
        if (parsedContacts.success) {
          baselineContactsRef.current = parsedContacts.data.contacts.length;
        }
      }

      const res = await fetch('/api/contacts/invite', { method: 'POST' });
      const raw: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const failure = apiFailureSchema.safeParse(raw);
        throw new AppError(
          'INTERNAL_ERROR',
          failure.success ? failure.data.error : 'Failed to generate invite code.',
          res.status
        );
      }

      const parsed = inviteResponseSchema.safeParse(raw);
      if (!parsed.success) {
        throw new AppError('INTERNAL_ERROR', 'Failed to generate invite code.', 500);
      }

      setInvite({ code: parsed.data.code, expiresAt: parsed.data.expiresAt });
      setRemainingMs(Math.max(0, new Date(parsed.data.expiresAt).getTime() - Date.now()));
      setFeedback({ text: 'Share this code with your partner. It clears automatically once paired.', tone: 'success' });
    } catch (err) {
      setFeedback({ text: toUserErrorMessage(err), tone: 'error' });
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

  async function handleRedeemCode() {
    const validated = redeemCodeSchema.safeParse({ code: redeemInput });
    if (!validated.success) {
      setFeedback({ text: INVITE_CODE_ERROR, tone: 'error' });
      return;
    }

    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/contacts/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated.data),
      });
      const raw: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const failure = apiFailureSchema.safeParse(raw);
        throw new AppError(
          'INVITE_INVALID',
          failure.success ? failure.data.error : 'Failed to redeem invite code.',
          res.status
        );
      }

      const parsed = redeemResponseSchema.safeParse(raw);
      if (!parsed.success) {
        throw new AppError('INTERNAL_ERROR', 'Failed to redeem invite code.', 500);
      }

      setRedeemInput('');
      setFeedback({ text: `Paired with ${parsed.data.contact.displayName}!`, tone: 'success' });
      router.refresh();
      closeTimeoutRef.current = setTimeout(() => {
        onClose();
      }, 700);
    } catch (err) {
      setFeedback({ text: toUserErrorMessage(err), tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Pair Trusted Contact"
      subtitle="Closed allowlist · Mutual pairing required"
    >
      <div className="flex flex-col gap-4">
        {/* Tab switcher */}
        <div className="grid grid-cols-2 gap-1.5 rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-canvas)] p-1">
          <Button
            variant={activeTab === 'share' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => {
              setActiveTab('share');
              setFeedback(null);
            }}
          >
            Share Invite
          </Button>
          <Button
            variant={activeTab === 'redeem' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => {
              setActiveTab('redeem');
              setFeedback(null);
            }}
          >
            Enter Partner Code
          </Button>
        </div>

        {activeTab === 'share' ? (
          <div className="flex flex-col gap-3">
            <Button
              variant="primary"
              size="md"
              className="w-full"
              loading={busy}
              onClick={() => void handleGenerateInvite()}
            >
              {busy ? 'Generating...' : invite ? 'Generate New Code' : 'Generate 6-Char Code'}
            </Button>

            {invite && (
              <div className="flex flex-col gap-3 rounded-[var(--radius-control)] border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-2xl font-semibold tracking-[0.25em] text-[var(--color-accent-hover)]">
                    {invite.code}
                  </span>
                  <Badge tone="emerald">{formatCountdown(remainingMs)}</Badge>
                </div>

                <Button variant="secondary" size="sm" className="w-full" onClick={() => void handleCopyCode()}>
                  Copy Code
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <input
                className="min-h-[44px] flex-1 rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-canvas)] px-3.5 font-mono text-sm uppercase tracking-[0.2em] text-zinc-100 placeholder:tracking-normal placeholder:text-zinc-500 focus:border-[var(--color-accent)] focus:outline-none"
                maxLength={6}
                placeholder="6-CHAR CODE"
                value={redeemInput}
                onChange={(e) => {
                  const sanitized = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
                  setRedeemInput(sanitized);
                  if (feedback) setFeedback(null);
                }}
                disabled={busy}
              />
              <Button
                variant="primary"
                size="sm"
                loading={busy}
                disabled={!isRedeemValid}
                onClick={() => void handleRedeemCode()}
              >
                Pair
              </Button>
            </div>
            <p className="text-[11px] text-zinc-500">Ask your partner to generate a 6-character invite code.</p>
          </div>
        )}

        {feedback && (
          <p
            className={`rounded-[var(--radius-control)] border px-3.5 py-2.5 text-xs ${
              feedback.tone === 'error'
                ? 'border-[var(--color-danger)]/35 bg-[var(--color-danger)]/10 text-rose-300'
                : feedback.tone === 'success'
                  ? 'border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 text-emerald-300'
                  : 'border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] text-zinc-300'
            }`}
          >
            {feedback.text}
          </p>
        )}
      </div>
    </Modal>
  );
}
