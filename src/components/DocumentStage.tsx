'use client';

import {
  createContext,
  useContext,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from 'react';
import type { TrustedContact } from '@/types/vouchdrop';

type DocumentStageContextValue = {
  selectedFile: File | null;
  onSend: (recipientId: string, file: File) => void;
  onRefreshContacts: () => void;
  busy: boolean;
  sendingRecipientId: string | null;
};

const DocumentStageContext = createContext<DocumentStageContextValue | null>(null);

type DocumentStageProps = {
  selectedFile: File | null;
  onFileSelect: (file: File | null) => void;
  onSend: (recipientId: string, file: File) => void;
  onRefreshContacts: () => void;
  busy?: boolean;
  sendingRecipientId?: string | null;
  contactsSlot: ReactNode;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function getFormatBadge(fileName: string): string {
  const ext = fileName.split('.').pop()?.toUpperCase();
  if (!ext || ext.length > 5) return 'DOC';
  return ext;
}

export function DocumentStage({
  selectedFile,
  onFileSelect,
  onSend,
  onRefreshContacts,
  busy = false,
  sendingRecipientId = null,
  contactsSlot,
}: DocumentStageProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!isDragging) setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      onFileSelect(dropped);
    }
  }

  function handleClearFile() {
    onFileSelect(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  return (
    <DocumentStageContext.Provider
      value={{
        selectedFile,
        onSend,
        onRefreshContacts,
        busy,
        sendingRecipientId,
      }}
    >
      <section className="flex flex-col gap-6 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 shadow-sm sm:p-6">
        {/* Dropzone Header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Document Stage</h2>
            <p className="text-xs text-zinc-400">Stage a verified work document to stream directly to a partner.</p>
          </div>
          <span className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-2.5 py-1 font-mono text-[11px] text-zinc-400">
            PDF · DOCX · PPTX · CSV · FIG
          </span>
        </div>

        {/* Hidden native file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.pptx,.csv,.fig"
          onChange={(e) => onFileSelect(e.target.files?.[0] ?? null)}
          className="sr-only"
          aria-label="Choose work document"
        />

        {/* Drag-and-Drop Zone or Staged File Card */}
        {!selectedFile ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex min-h-[168px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
              isDragging
                ? 'border-emerald-400 bg-emerald-500/10'
                : 'border-zinc-700 bg-zinc-950/50 hover:border-emerald-500/60 hover:bg-zinc-950/80'
            }`}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-emerald-400">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" x2="12" y1="3" y2="15" />
              </svg>
            </span>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-zinc-100">
                Drop a work document here, or <span className="text-emerald-400 underline">browse</span>
              </p>
              <p className="font-mono text-xs text-zinc-500">Magic-byte verified · Up to 2 GB · Direct P2P</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-950/15 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 shrink-0 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 font-mono text-xs font-semibold text-emerald-300">
                {getFormatBadge(selectedFile.name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-100">{selectedFile.name}</p>
                <p className="font-mono text-xs text-zinc-400">{formatFileSize(selectedFile.size)}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClearFile}
              disabled={busy}
              aria-label="Clear selected file"
              title="Clear selected file"
              className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950/60 text-base text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100 disabled:opacity-40"
            >
              ×
            </button>
          </div>
        )}

        {/* Streamed Trusted Contacts List */}
        <div className="flex flex-col gap-3 border-t border-zinc-800/80 pt-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-200">Trusted Contacts</h3>
            <button
              type="button"
              onClick={onRefreshContacts}
              className="inline-flex min-h-[44px] items-center rounded-lg px-2 text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-100"
            >
              Refresh
            </button>
          </div>

          {contactsSlot}
        </div>
      </section>
    </DocumentStageContext.Provider>
  );
}

type TrustedContactsListProps = {
  contacts: TrustedContact[];
};

export function TrustedContactsList({ contacts }: TrustedContactsListProps) {
  const ctx = useContext(DocumentStageContext);

  if (contacts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/50 p-5 text-center">
        <p className="text-sm font-medium text-zinc-200">No paired contacts yet</p>
        <p className="mt-1 text-xs text-zinc-400">
          Use the <strong className="text-zinc-200">Pair Trusted Contact</strong> card to generate or redeem a
          6-character invite code.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {contacts.map((contact) => {
        const hasFile = Boolean(ctx?.selectedFile);
        const isSendingThis = Boolean(ctx?.busy && ctx.sendingRecipientId === contact.id);
        const isDisabled = !hasFile || Boolean(ctx?.busy);
        const initial = contact.displayName.trim().charAt(0).toUpperCase() || '?';

        return (
          <div
            key={contact.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800/80 bg-zinc-950/60 px-4 py-3 transition-colors hover:border-zinc-700/80"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-xs font-semibold text-zinc-200">
                {initial}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-100">{contact.displayName}</p>
                <p className="font-mono text-[11px] text-zinc-500">Trusted peer</p>
              </div>
            </div>

            <button
              type="button"
              disabled={isDisabled}
              title={!hasFile ? 'Select a file first' : `Send ${ctx?.selectedFile?.name} to ${contact.displayName}`}
              onClick={() => ctx?.selectedFile && ctx.onSend(contact.id, ctx.selectedFile)}
              className={`inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 text-xs font-semibold transition-colors ${
                isSendingThis
                  ? 'animate-pulse bg-emerald-500/80 text-zinc-950'
                  : hasFile && !ctx?.busy
                    ? 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400'
                    : 'border border-zinc-800 bg-zinc-900 text-zinc-500'
              }`}
            >
              {isSendingThis ? 'Sending...' : hasFile ? 'Send' : 'Select a file first'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
