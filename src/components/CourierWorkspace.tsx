'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { DocumentStage } from '@/components/DocumentStage';
import { PairPanel } from '@/components/PairPanel';
import { TransferStatusCard } from '@/components/TransferStatusCard';
import { usePeerTransfer } from '@/hooks/usePeerTransfer';
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

export function CourierWorkspace({ user, initialRoomId, contactsSlot }: CourierWorkspaceProps) {
  const router = useRouter();
  const transfer = usePeerTransfer();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sendingRecipientId, setSendingRecipientId] = useState<string | null>(null);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | null>(null);
  const [pushNotice, setPushNotice] = useState<string | null>(null);
  const joinedRoomRef = useRef(false);

  useEffect(() => {
    if ('Notification' in window) {
      setPushPermission(Notification.permission);
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    if (initialRoomId && !joinedRoomRef.current) {
      joinedRoomRef.current = true;
      void transfer.joinIncomingRoom(initialRoomId);
    }
  }, [initialRoomId, transfer.joinIncomingRoom]);

  const transferBusy =
    transfer.state === 'knocking' || transfer.state === 'connecting' || transfer.state === 'transferring';

  const activeRecipientId = transferBusy ? sendingRecipientId : null;

  async function handleEnablePush() {
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
      setPushNotice('Missing VAPID public key configuration.');
      return;
    }

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub.toJSON()),
    });
    setPushNotice(res.ok ? 'Web Push notifications active.' : 'Failed to save push subscription.');
  }

  async function handleSignOut() {
    await transfer.cancelTransfer().catch(() => {});
    await fetch('/api/auth/logout', { method: 'POST' });
    router.refresh();
  }

  function handleSend(recipientId: string, file: File) {
    setSendingRecipientId(recipientId);
    void transfer.startSend(recipientId, file);
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:py-8">
      {/* Top Identity Bar */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 px-5 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-sm font-semibold text-emerald-300">
            {user.displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-xs text-zinc-400">Signed in as</p>
            <h1 className="text-base font-semibold tracking-tight text-zinc-100">{user.displayName}</h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {pushPermission === 'granted' ? (
            <span className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 text-xs font-medium text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />
              Push Active
            </span>
          ) : (
            <button
              type="button"
              onClick={handleEnablePush}
              className="inline-flex min-h-[44px] items-center rounded-xl border border-zinc-700 bg-zinc-950/70 px-3.5 text-xs font-medium text-zinc-200 transition-colors hover:border-emerald-500/50 hover:text-white"
            >
              Enable Push
            </button>
          )}

          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex min-h-[44px] items-center rounded-xl border border-zinc-800 px-3.5 text-xs font-medium text-zinc-400 transition-colors hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-200"
          >
            Sign Out
          </button>
        </div>
      </section>

      {pushNotice && (
        <p className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 px-4 py-2.5 text-xs text-zinc-300">
          {pushNotice}
        </p>
      )}

      {/* Responsive 12-Column Desktop Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <DocumentStage
            selectedFile={selectedFile}
            onFileSelect={setSelectedFile}
            onSend={handleSend}
            onRefreshContacts={() => router.refresh()}
            busy={transferBusy}
            sendingRecipientId={activeRecipientId}
            contactsSlot={contactsSlot}
          />
        </div>

        <div className="flex flex-col gap-6 lg:col-span-5">
          <TransferStatusCard
            state={transfer.state}
            progress={transfer.progress}
            message={transfer.message}
            sha256Receipt={transfer.sha256Receipt}
            incomingMeta={transfer.incomingMeta}
            onAccept={transfer.acceptTransfer}
            onDecline={transfer.declineTransfer}
            onCancel={transfer.cancelTransfer}
            onJoinManualRoom={(roomId) => void transfer.joinIncomingRoom(roomId)}
          />
          <PairPanel />
        </div>
      </div>
    </main>
  );
}
