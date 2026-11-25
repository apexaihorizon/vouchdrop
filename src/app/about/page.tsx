import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'How It Works & Security',
};

export default function AboutPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-12">
      <section className="flex flex-col gap-3">
        <p className="font-mono text-xs uppercase tracking-wider text-emerald-400">Zero-Storage Architecture</p>
        <h1 className="text-2xl font-semibold tracking-tight text-white">How VouchDrop Keeps Work Documents Private</h1>
        <p className="text-sm leading-relaxed text-zinc-400">
          VouchDrop is a direct, encrypted work-document courier built for teams that need to move sensitive files
          without uploading them to third-party cloud storage or relay buckets.
        </p>
      </section>

      <section className="grid gap-4">
        <article className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
          <h2 className="text-sm font-semibold text-zinc-100">1. Direct Browser-to-Browser WebRTC DataChannels</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Files stream directly from sender to recipient over an encrypted peer-to-peer WebRTC DataChannel. Documents
            never touch a cloud bucket, object store, or relay database—our signaling server only brokers the initial
            WebRTC handshake.
          </p>
        </article>

        <article className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
          <h2 className="text-sm font-semibold text-zinc-100">2. Hardware-Backed WebAuthn Passkeys &amp; Closed Allowlist</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Accounts are authenticated with phishing-resistant WebAuthn Passkeys instead of passwords. You can only
            exchange files with trusted contacts you explicitly pair with using short-lived 6-character invite codes.
          </p>
        </article>

        <article className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
          <h2 className="text-sm font-semibold text-zinc-100">3. Magic-Byte Allowlisting &amp; SHA-256 Receipts</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Before a transfer begins, VouchDrop inspects file headers to allow only verified work documents (
            <code className="font-mono text-xs text-zinc-200">PDF</code>,{' '}
            <code className="font-mono text-xs text-zinc-200">DOCX</code>,{' '}
            <code className="font-mono text-xs text-zinc-200">PPTX</code>,{' '}
            <code className="font-mono text-xs text-zinc-200">CSV</code>, and{' '}
            <code className="font-mono text-xs text-zinc-200">FIG</code> up to 2 GB). Both peers compute an incremental
            SHA-256 hash as chunks stream to disk, producing a cryptographic receipt upon completion.
          </p>
        </article>
      </section>

      <div>
        <Link
          href="/"
          className="inline-flex items-center rounded border border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-200 transition-colors hover:border-zinc-500 hover:text-white"
        >
          ← Back to VouchDrop
        </Link>
      </div>
    </main>
  );
}
