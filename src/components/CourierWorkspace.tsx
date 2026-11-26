'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { DocumentStage } from '@/components/DocumentStage';
import { PairModal } from '@/components/PairModal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { usePeerTransfer } from '@/hooks/usePeerTransfer';
import { AppError, toUserErrorMessage } from '@/lib/errors';
import { incomingKnockSchema, pushSubscribeSchema, uuidSchema } from '@/lib/validators';
import type { SessionUser } from '@/types/vouchdrop';

type CourierWorkspaceProps = {
  user: SessionUser;
  initialRoomId: string | null;
  contactsSlot: ReactNode;
};

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function CourierWorkspace({ user, initialRoomId, contactsSlot }: CourierWorkspaceProps) {
  const router = useRouter();
  const transfer = usePeerTransfer();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sendingRecipientId, setSendingRecipientId] = useState<string | null>(null);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | null>(null);
  const [pushNotice, setPushNotice] = useState<string | null>(null);
  const [pairModalOpen, setPairModalOpen] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const joinedRoomRef = useRef(false);

  // Register SW, consume initial ?room= once & strip URL, and listen for reload-free INCOMING_KNOCK
  useEffect(() => {
    if ('Notification' in window) {
      setPushPermission(Notification.permission);
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    const urlRoom = initialRoomId ?? new URLSearchParams(window.location.search).get('room');
    if (urlRoom && !joinedRoomRef.current) {
      joinedRoomRef.current = true;
      window.history.replaceState({}, '', '/app');
      void transfer.joinIncomingRoom(urlRoom);
    }

    if (!('serviceWorker' in navigator)) return;

    const handleServiceWorkerMessage = (event: MessageEvent<unknown>) => {
      if (typeof event.data !== 'object' || event.data === null) return;
      const payload = event.data as { type?: unknown; knock?: unknown; roomId?: unknown };
      if (payload.type !== 'INCOMING_KNOCK') return;

      const parsedKnock = incomingKnockSchema.safeParse(payload.knock);
      if (parsedKnock.success) {
        transfer.presentIncomingKnock(parsedKnock.data);
        return;
      }

      if (typeof payload.roomId === 'string') {
        const validRoom = uuidSchema.safeParse(payload.roomId);
        if (validRoom.success) {
          void transfer.joinIncomingRoom(validRoom.data);
        }
      }
    };

    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, [initialRoomId, transfer.joinIncomingRoom, transfer.presentIncomingKnock]);

  const transferBusy =
    transfer.state === 'knocking' ||
    transfer.state === 'connecting' ||
    transfer.state === 'transferring' ||
    transfer.state === 'verifying';

  const activeRecipientId = transferBusy ? sendingRecipientId : null;
  const showActiveStage =
    transfer.state === 'knocking' ||
    transfer.state === 'connecting' ||
    transfer.state === 'transferring' ||
    transfer.state === 'verifying' ||
    transfer.state === 'completed' ||
    transfer.state === 'timeout' ||
    transfer.state === 'error';

  async function handleEnablePush() {
    setPushNotice(null);
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setPushNotice('Push notifications are not supported in this browser.');
        return;
      }
      const perm = await Notification.requestPermission();
      setPushPermission(perm);
      if (perm !== 'granted') {
        setPushNotice('Notification permission was not granted.');
        return;
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        setPushNotice('Push notifications are not configured on this server.');
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const parsedSub = pushSubscribeSchema.safeParse(sub.toJSON());
      if (!parsedSub.success) {
        throw new AppError('INTERNAL_ERROR', 'Unable to validate browser push subscription.', 400);
      }

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsedSub.data),
      });
      if (!res.ok) {
        throw new AppError('INTERNAL_ERROR', 'Failed to save push subscription.', res.status);
      }

      setPushNotice('Web Push notifications active.');
    } catch (err) {
      setPushNotice(toUserErrorMessage(err));
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await transfer.cancelTransfer().catch(() => {});
      await fetch('/api/auth/logout', { method: 'POST' });
      router.replace('/');
      router.refresh();
    } catch (err) {
      setPushNotice(toUserErrorMessage(err));
      setSigningOut(false);
    }
  }

  function handleSend(recipientId: string, file: File) {
    setSendingRecipientId(recipientId);
    void transfer.startSend(recipientId, file);
  }

  async function handleCopyReceipt() {
    if (!transfer.sha256Receipt) return;
    try {
      await navigator.clipboard.writeText(transfer.sha256Receipt);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    } catch {
      // Clipboard unavailable
    }
  }

  async function handleDoneReset() {
    setSelectedFile(null);
    setSendingRecipientId(null);
    setCopiedHash(false);
    await transfer.resetTransfer();
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6 sm:py-8">
      {/* Compact Identity Strip */}
      <Card padding="sm" className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 text-sm font-semibold text-emerald-300">
            {user.displayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-zinc-400">Signed in as</p>
            <h1 className="truncate text-sm font-semibold tracking-tight text-zinc-100">{user.displayName}</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {pushPermission === 'granted' ? (
            <Badge tone="emerald" mono={false} className="min-h-[44px] px-3 text-xs">
              <span className="h-2 w-2 rounded-full bg-[var(--color-accent)]" aria-hidden="true" />
              Push Active
            </Badge>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => void handleEnablePush()}>
              Enable Push
            </Button>
          )}

          <Button variant="secondary" size="sm" onClick={() => setPairModalOpen(true)}>
            + Add Contact
          </Button>

          <Button variant="ghost" size="sm" loading={signingOut} onClick={() => void handleSignOut()}>
            Sign Out
          </Button>
        </div>
      </Card>

      {pushNotice && (
        <p className="rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-4 py-2.5 text-xs text-zinc-300">
          {pushNotice}
        </p>
      )}

      {/* Unified Center Courier Stage */}
      {!showActiveStage ? (
        <DocumentStage
          selectedFile={selectedFile}
          onFileSelect={setSelectedFile}
          onSend={handleSend}
          onRefreshContacts={() => router.refresh()}
          onOpenPairModal={() => setPairModalOpen(true)}
          busy={transferBusy}
          sendingRecipientId={activeRecipientId}
          contactsSlot={contactsSlot}
        />
      ) : (
        <Card
          padding="lg"
          title={
            transfer.state === 'completed'
              ? 'Transfer Verified'
              : transfer.state === 'timeout'
                ? 'Partner Did Not Respond'
                : transfer.state === 'error'
                  ? 'Transfer Interrupted'
                  : 'Direct P2P Transfer'
          }
          action={
            <Badge
              tone={
                transfer.state === 'error'
                  ? 'rose'
                  : transfer.state === 'timeout'
                    ? 'amber'
                    : 'emerald'
              }
              className="uppercase tracking-wider"
            >
              {transfer.state.replace('_', ' ')}
            </Badge>
          }
          className="flex flex-col gap-5"
        >
          {/* Active Progress: knocking / connecting / transferring / verifying */}
          {transferBusy && (
            <div className="flex flex-col gap-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-zinc-200">
                  {transfer.state === 'knocking'
                    ? 'Knocking on partner...'
                    : transfer.state === 'connecting'
                      ? 'Establishing encrypted WebRTC channel...'
                      : transfer.state === 'verifying'
                        ? 'Verifying recipient SHA-256...'
                        : 'Streaming directly to disk...'}
                </p>
                <span className="font-mono text-base font-semibold text-[var(--color-accent-hover)]">
                  {transfer.progress}%
                </span>
              </div>

              <div className="h-3 w-full overflow-hidden rounded-[var(--radius-pill)] bg-[var(--color-surface-elevated)]">
                <div
                  className="h-full rounded-[var(--radius-pill)] bg-[var(--color-accent)] transition-all duration-200 ease-out"
                  style={{ width: `${Math.min(100, Math.max(0, transfer.progress))}%` }}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <p className="text-xs text-zinc-400">
                  {transfer.message || 'Keep screen open until transfer completes.'}
                </p>
                <Button variant="danger" size="sm" onClick={() => void transfer.cancelTransfer()}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Completed + SHA-256 Receipt */}
          {transfer.state === 'completed' && (
            <div className="flex flex-col gap-4">
              <p className="text-sm font-medium text-emerald-300">
                {transfer.message || 'Transfer completed & verified.'}
              </p>

              {transfer.sha256Receipt && (
                <div className="flex flex-col gap-2.5 rounded-[var(--radius-control)] border border-[var(--color-accent)]/35 bg-[var(--color-canvas)]/70 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--color-accent-hover)]">
                      SHA-256 Receipt
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => void handleCopyReceipt()}>
                      {copiedHash ? 'Copied!' : 'Copy Hash'}
                    </Button>
                  </div>
                  <p className="break-all font-mono text-xs leading-relaxed text-zinc-300">
                    {transfer.sha256Receipt}
                  </p>
                </div>
              )}

              <Button variant="primary" className="w-full" onClick={() => void handleDoneReset()}>
                Done
              </Button>
            </div>
          )}

          {/* Timeout */}
          {transfer.state === 'timeout' && (
            <div className="flex flex-col gap-4">
              <div className="rounded-[var(--radius-control)] border border-[var(--color-warning)]/35 bg-[var(--color-warning)]/10 p-4 text-xs leading-relaxed text-amber-200">
                {transfer.message ||
                  "Partner didn't pick up in 15s — ping them to open VouchDrop, then retry."}
              </div>
              <Button variant="secondary" className="w-full" onClick={() => void handleDoneReset()}>
                Done
              </Button>
            </div>
          )}

          {/* Error (including 12s NAT_TIMEOUT watchdog) */}
          {transfer.state === 'error' && (
            <div className="flex flex-col gap-4">
              <div className="rounded-[var(--radius-control)] border border-[var(--color-danger)]/35 bg-[var(--color-danger)]/10 p-4 text-xs leading-relaxed text-rose-200">
                {transfer.message || 'Transfer could not be completed. Please try again.'}
              </div>
              <Button variant="secondary" className="w-full" onClick={() => void handleDoneReset()}>
                Done
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* High-Visibility Incoming Offer Modal */}
      <Modal
        open={transfer.state === 'incoming_offer' && Boolean(transfer.incomingMeta)}
        onClose={() => void transfer.declineIncoming()}
        preventClose
        title="Incoming Work Document"
        subtitle={
          transfer.incomingMeta?.senderName
            ? `${transfer.incomingMeta.senderName} wants to stream this document directly to your disk.`
            : 'A paired contact wants to stream this document directly to your disk.'
        }
      >
        {transfer.incomingMeta && (
          <div className="flex flex-col gap-5">
            <div className="rounded-[var(--radius-control)] border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 p-4">
              <div className="flex items-center justify-between gap-2">
                <Badge tone="amber">{transfer.incomingMeta.docType}</Badge>
                <span className="font-mono text-xs text-zinc-300">
                  {formatFileSize(transfer.incomingMeta.fileSize)}
                </span>
              </div>
              <p className="mt-2.5 break-all text-sm font-semibold text-zinc-100">
                {transfer.incomingMeta.fileName}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <Button variant="primary" onClick={() => void transfer.acceptIncoming()}>
                Accept &amp; Save
              </Button>
              <Button variant="secondary" onClick={() => void transfer.declineIncoming()}>
                Decline
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Contact Pairing Modal */}
      <PairModal open={pairModalOpen} onClose={() => setPairModalOpen(false)} />
    </main>
  );
}
