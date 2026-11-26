import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';

const CAPABILITIES = [
  {
    title: 'Direct P2P Stream',
    description:
      'Files stream browser-to-browser over encrypted WebRTC DataChannels up to 2 GB. Zero cloud buckets, zero server storage, zero relay retention.',
    icon: (
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
        <path d="M5 12h14" />
        <path d="m13 5 7 7-7 7" />
        <circle cx="5" cy="12" r="2" />
      </svg>
    ),
  },
  {
    title: 'Hardware Passkeys',
    description:
      'Phishing-resistant WebAuthn Passkey authentication paired with a closed contact allowlist using short-lived 6-character pairing codes.',
    icon: (
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
        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
  {
    title: 'SHA-256 & Magic-Byte Verified',
    description:
      'Every transfer validates document headers (PDF, XLSX, DOCX, PPTX, ODS, ODT, ODP, CSV, TSV, FIG) before streaming and computes an incremental SHA-256 receipt on both peers.',
    icon: (
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
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
] as const;

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-12 bg-[var(--color-canvas)] px-4 py-14 sm:py-20">
      <section className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
        <Badge tone="emerald" className="px-3 py-1 uppercase tracking-wider">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent-hover)]" aria-hidden="true" />
          Zero-Storage WebRTC Courier
        </Badge>

        <h1 className="text-balance text-4xl font-semibold tracking-tight text-zinc-50 sm:text-5xl">
          Zero-storage encrypted document courier.
        </h1>

        <p className="max-w-xl text-pretty text-sm leading-relaxed text-zinc-400 sm:text-base">
          Stream sensitive work documents directly between browsers over WebRTC DataChannels. Protected by hardware
          WebAuthn passkeys, closed 6-character contact allowlists, and incremental SHA-256 verification.
        </p>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/app"
            className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-accent)] px-6 py-2.5 text-sm font-semibold text-zinc-950 shadow-sm transition-colors hover:bg-[var(--color-accent-hover)]"
          >
            Use App
          </Link>
          <Link
            href="/about"
            className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-5 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-elevated)] hover:text-white"
          >
            Security Architecture
          </Link>
        </div>
      </section>

      <section aria-label="Core capabilities" className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {CAPABILITIES.map((item) => (
          <Card
            key={item.title}
            padding="md"
            className="flex flex-col gap-3 transition-colors hover:border-[var(--color-border-strong)]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-[var(--color-accent-hover)]">
              {item.icon}
            </div>
            <h2 className="text-sm font-semibold tracking-tight text-zinc-100">{item.title}</h2>
            <p className="text-xs leading-relaxed text-zinc-400">{item.description}</p>
          </Card>
        ))}
      </section>
    </main>
  );
}
