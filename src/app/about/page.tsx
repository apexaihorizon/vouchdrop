import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';

export const metadata: Metadata = {
  title: 'How It Works & Security',
};

export default function AboutPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-12">
      <section className="flex flex-col gap-3">
        <Badge tone="emerald" className="w-fit uppercase tracking-wider">
          Zero-Storage Architecture
        </Badge>
        <h1 className="text-2xl font-semibold tracking-tight text-white">How VouchDrop Keeps Work Documents Private</h1>
        <p className="text-sm leading-relaxed text-zinc-400">
          VouchDrop is a direct, encrypted work-document courier built for teams that need to move sensitive files
          without uploading them to third-party cloud storage or relay buckets.
        </p>
      </section>

      <section className="grid gap-4">
        <Card padding="md" title="1. Direct Browser-to-Browser WebRTC DataChannels">
          <p className="text-sm leading-relaxed text-zinc-400">
            Files stream directly from sender to recipient over an encrypted peer-to-peer WebRTC DataChannel. Documents
            never touch a cloud bucket, object store, or relay database—our signaling server only brokers the initial
            WebRTC handshake.
          </p>
        </Card>

        <Card padding="md" title="2. Hardware-Backed WebAuthn Passkeys & Closed Allowlist">
          <p className="text-sm leading-relaxed text-zinc-400">
            Accounts are authenticated with phishing-resistant WebAuthn Passkeys instead of passwords. You can only
            exchange files with trusted contacts you explicitly pair with using short-lived 6-character invite codes.
          </p>
        </Card>

        <Card padding="md" title="3. Structural Archive & Magic-Byte Allowlisting + SHA-256 Receipts">
          <p className="text-sm leading-relaxed text-zinc-400">
            Before a transfer begins, VouchDrop inspects file headers and archive directories to allow only verified
            work documents (
            <code className="font-mono text-xs text-zinc-200">
              PDF, XLSX, DOCX, PPTX, ODS, ODT, ODP, CSV, TSV, FIG
            </code>{' '}
            up to 2 GB). Both peers compute an incremental SHA-256 hash as chunks stream to disk, producing a
            cryptographic receipt upon completion.
          </p>
        </Card>
      </section>

      <div>
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center rounded-[var(--radius-control)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-2 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:text-white"
        >
          ← Back to VouchDrop
        </Link>
      </div>
    </main>
  );
}
