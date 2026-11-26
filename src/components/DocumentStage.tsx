'use client';

import {
  createContext,
  useContext,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from 'react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { toUserErrorMessage } from '@/lib/errors';
import { validateWorkDocument } from '@/lib/fileGuard';
import {
  ALL_ALLOWED_DOC_TYPES,
  ALLOWED_FILE_ACCEPT,
  type AllowedDocType,
  type TrustedContact,
} from '@/types/vouchdrop';

type DocumentStageContextValue = {
  selectedFile: File | null;
  onSend: (recipientId: string, file: File) => void;
  onRefreshContacts: () => void;
  onOpenPairModal: () => void;
  busy: boolean;
  sendingRecipientId: string | null;
};

const DocumentStageContext = createContext<DocumentStageContextValue | null>(null);

type DocumentStageProps = {
  selectedFile: File | null;
  onFileSelect: (file: File | null) => void;
  onSend: (recipientId: string, file: File) => void;
  onRefreshContacts: () => void;
  onOpenPairModal: () => void;
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
  onOpenPairModal,
  busy = false,
  sendingRecipientId = null,
  contactsSlot,
}: DocumentStageProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [verifiedType, setVerifiedType] = useState<AllowedDocType | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);

  async function inspectAndSelect(file: File | null) {
    setValidationError(null);
    setVerifiedType(null);

    if (!file) {
      onFileSelect(null);
      return;
    }

    setValidating(true);
    try {
      const result = await validateWorkDocument(file);
      setVerifiedType(result.docType);
      onFileSelect(file);
    } catch (err) {
      onFileSelect(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setValidationError(toUserErrorMessage(err));
    } finally {
      setValidating(false);
    }
  }

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
      void inspectAndSelect(dropped);
    }
  }

  function handleClearFile() {
    setValidationError(null);
    setVerifiedType(null);
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
        onOpenPairModal,
        busy: busy || validating,
        sendingRecipientId,
      }}
    >
      <Card
        title="Send a Work Document"
        subtitle="Drop a verified document below, then choose a trusted contact to stream directly over WebRTC."
        className="flex flex-col gap-6"
      >
        {/* Allowlist badges */}
        <div className="flex flex-wrap gap-1.5" aria-label="Supported document formats">
          {ALL_ALLOWED_DOC_TYPES.map((type) => (
            <Badge key={type} tone="neutral">
              {type}
            </Badge>
          ))}
        </div>

        {/* Hidden native file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_FILE_ACCEPT}
          onChange={(e) => void inspectAndSelect(e.target.files?.[0] ?? null)}
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
            className={`flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-3 rounded-[var(--radius-control)] border-2 border-dashed px-6 py-8 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
              isDragging
                ? 'border-[var(--color-accent-hover)] bg-[var(--color-accent)]/10'
                : 'border-[var(--color-border-strong)] bg-[var(--color-canvas)]/60 hover:border-[var(--color-accent)]/60 hover:bg-[var(--color-surface-elevated)]/60'
            }`}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] text-[var(--color-accent)]">
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
                {validating ? (
                  'Inspecting document signature...'
                ) : (
                  <>
                    Drop a work document here, or <span className="text-[var(--color-accent-hover)] underline">browse</span>
                  </>
                )}
              </p>
              <p className="font-mono text-xs text-zinc-500">Magic-byte &amp; archive verified · Up to 2 GB · Direct P2P</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <Badge tone="emerald" className="h-11 shrink-0 rounded-[var(--radius-control)] px-2.5 text-xs font-semibold">
                {verifiedType ?? getFormatBadge(selectedFile.name)}
              </Badge>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-100">{selectedFile.name}</p>
                <p className="font-mono text-xs text-zinc-400">{formatFileSize(selectedFile.size)}</p>
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleClearFile}
              disabled={busy}
              aria-label="Clear selected file"
              title="Clear selected file"
              className="min-w-[44px] shrink-0 px-0 text-base"
            >
              ×
            </Button>
          </div>
        )}

        {validationError && (
          <p className="rounded-[var(--radius-control)] border border-[var(--color-danger)]/35 bg-[var(--color-danger)]/10 px-3.5 py-2.5 text-xs text-rose-300">
            {validationError}
          </p>
        )}

        {/* Streamed Trusted Contacts List */}
        <div className="flex flex-col gap-3 border-t border-[var(--color-border-subtle)] pt-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-200">Trusted Contacts</h3>
            <Button variant="ghost" size="sm" onClick={onRefreshContacts}>
              Refresh
            </Button>
          </div>

          {contactsSlot}
        </div>
      </Card>
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
      <div className="flex flex-col items-center gap-3 rounded-[var(--radius-control)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-canvas)]/50 p-6 text-center">
        <div>
          <p className="text-sm font-medium text-zinc-200">No paired contacts yet</p>
          <p className="mt-1 text-xs text-zinc-400">
            Pair with a colleague using a short-lived 6-character invite code to start streaming documents.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => ctx?.onOpenPairModal()}>
          + Add Contact
        </Button>
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
            className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]/70 px-4 py-3 transition-colors hover:border-[var(--color-border-strong)]"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface)] text-xs font-semibold text-zinc-200">
                {initial}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-100">{contact.displayName}</p>
                <p className="font-mono text-[11px] text-zinc-500">Trusted peer</p>
              </div>
            </div>

            <Button
              variant={hasFile && !ctx?.busy ? 'primary' : 'secondary'}
              size="sm"
              loading={isSendingThis}
              disabled={isDisabled}
              title={!hasFile ? 'Select a file first' : `Send ${ctx?.selectedFile?.name} to ${contact.displayName}`}
              onClick={() => ctx?.selectedFile && ctx.onSend(contact.id, ctx.selectedFile)}
            >
              {isSendingThis ? 'Sending...' : hasFile ? 'Send' : 'Select a file first'}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
