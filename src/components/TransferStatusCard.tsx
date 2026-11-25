'use client';

import { useState } from 'react';
import type { IncomingMeta, TransferState } from '@/lib/webrtcEngine';

type TransferStatusCardProps = {
  state: TransferState;
  progress: number;
  message: string;
  sha256Receipt: string | null;
  incomingMeta: IncomingMeta | null;
  onAccept: () => void;
  onDecline: () => void;
  onCancel: () => void;
  onJoinManualRoom: (roomId: string) => void;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function TransferStatusCard({
  state,
  progress,
  message,
  sha256Receipt,
  incomingMeta,
  onAccept,
  onDecline,
  onCancel,
  onJoinManualRoom,
}: TransferStatusCardProps) {
  const [showManualJoin, setShowManualJoin] = useState(false);
  const [manualRoomId, setManualRoomId] = useState('');
  const [copiedHash, setCopiedHash] = useState(false);

  async function handleCopyHash() {
    if (!sha256Receipt) return;
    try {
      await navigator.clipboard.writeText(sha256Receipt);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    } catch {
      // Clipboard unavailable
    }
  }

  const cardSurface =
    state === 'incoming_offer'
      ? 'border-amber-500/50 bg-amber-950/20'
      : state === 'completed'
        ? 'border-emerald-500/40 bg-emerald-950/15'
        : state === 'timeout'
          ? 'border-amber-500/40 bg-amber-950/15'
          : state === 'error'
            ? 'border-red-500/40 bg-red-950/15'
            : 'border-zinc-800/80 bg-zinc-900/60';

  return (
    <section className={`flex flex-col gap-4 rounded-2xl border p-5 shadow-sm transition-colors sm:p-6 ${cardSurface}`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-zinc-100">Transfer Channel</h2>
        <span
          className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${
            state === 'completed'
              ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
              : state === 'incoming_offer' || state === 'timeout'
                ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                : state === 'error'
                  ? 'border-red-500/40 bg-red-500/15 text-red-300'
                  : state === 'transferring' || state === 'connecting' || state === 'knocking'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-400'
          }`}
        >
          {state.replace('_', ' ')}
        </span>
      </div>

      {/* INCOMING OFFER */}
      {state === 'incoming_offer' && incomingMeta && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-amber-500/30 bg-zinc-950/60 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-300">
                {incomingMeta.docType}
              </span>
              <span className="font-mono text-xs text-zinc-400">{formatFileSize(incomingMeta.fileSize)}</span>
            </div>
            <p className="mt-2 break-all text-sm font-semibold text-zinc-100">{incomingMeta.fileName}</p>
            <p className="mt-1 text-xs text-amber-200/80">
              A paired contact wants to stream this document directly to your disk.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onAccept}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-emerald-500 px-4 text-xs font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
            >
              Accept &amp; Save
            </button>
            <button
              type="button"
              onClick={onDecline}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-zinc-700 bg-zinc-950/60 px-4 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:text-white"
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {/* ACTIVE TRANSFER: KNOCKING / CONNECTING / TRANSFERRING */}
      {(state === 'knocking' || state === 'connecting' || state === 'transferring') && (
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs font-medium text-zinc-200">
              {state === 'knocking'
                ? 'Knocking on partner...'
                : state === 'connecting'
                  ? 'Establishing encrypted WebRTC channel...'
                  : 'Streaming directly to disk...'}
            </p>
            <span className="font-mono text-sm font-semibold text-emerald-400">{progress}%</span>
          </div>

          <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-200 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <p className="text-xs text-zinc-400">Keep screen open until transfer completes.</p>
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex min-h-[44px] items-center rounded-xl border border-red-500/30 bg-red-950/30 px-3.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-950/60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* TIMEOUT */}
      {state === 'timeout' && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 p-4 text-xs leading-relaxed text-amber-200">
          Partner didn&apos;t pick up in 15s — ping them to open VouchDrop, then retry.
        </div>
      )}

      {/* COMPLETED */}
      {state === 'completed' && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-medium text-emerald-300">{message || 'Transfer completed & verified.'}</p>
          {sha256Receipt && (
            <div className="flex flex-col gap-2.5 rounded-xl border border-emerald-500/30 bg-zinc-950/70 p-3.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400">
                  SHA-256 Receipt
                </span>
                <button
                  type="button"
                  onClick={handleCopyHash}
                  className="inline-flex min-h-[44px] items-center rounded-lg px-2.5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-500/10 hover:text-emerald-200"
                >
                  {copiedHash ? 'Copied!' : 'Copy Hash'}
                </button>
              </div>
              <p className="break-all font-mono text-[11px] leading-relaxed text-zinc-300">{sha256Receipt}</p>
            </div>
          )}
        </div>
      )}

      {/* ERROR */}
      {state === 'error' && (
        <div className="rounded-xl border border-red-500/30 bg-red-950/30 p-3.5 text-xs text-red-200">
          {message || 'Transfer encountered an error.'}
        </div>
      )}

      {/* IDLE */}
      {state === 'idle' && (
        <p className="text-xs leading-relaxed text-zinc-400">
          {message || 'Ready. Stage a document on the left or wait for an incoming knock.'}
        </p>
      )}

      {/* Collapsible Manual Room ID disclosure (for idle / error / completed / timeout) */}
      {(state === 'idle' || state === 'error' || state === 'completed' || state === 'timeout') && (
        <div className="border-t border-zinc-800/80 pt-3">
          <button
            type="button"
            onClick={() => setShowManualJoin((prev) => !prev)}
            aria-expanded={showManualJoin}
            className="inline-flex min-h-[44px] w-full items-center justify-between rounded-xl px-2 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-950/50 hover:text-zinc-200"
          >
            <span>Join via Room ID</span>
            <span className="font-mono text-[11px]">{showManualJoin ? '−' : '+'}</span>
          </button>

          {showManualJoin && (
            <div className="mt-2 flex gap-2">
              <input
                className="min-h-[44px] flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 font-mono text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500/60 focus:outline-none"
                placeholder="Enter room ID..."
                value={manualRoomId}
                onChange={(e) => setManualRoomId(e.target.value)}
              />
              <button
                type="button"
                disabled={!manualRoomId.trim()}
                onClick={() => {
                  if (manualRoomId.trim()) {
                    onJoinManualRoom(manualRoomId.trim());
                    setManualRoomId('');
                    setShowManualJoin(false);
                  }
                }}
                className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:text-white disabled:opacity-40"
              >
                Join
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
