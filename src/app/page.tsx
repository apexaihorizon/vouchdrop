import Link from 'next/link';

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
      'Every transfer validates document headers (PDF, DOCX, PPTX, CSV, FIG) before streaming and computes an incremental SHA-256 receipt on both peers.',
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
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-12 bg-zinc-950 px-4 py-14 sm:py-20">
      <section className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-wider text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
          Zero-Storage WebRTC Courier
        </span>

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
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-zinc-950 shadow-sm transition-colors hover:bg-emerald-400"
          >
            Use App
          </Link>
          <Link
            href="/about"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/60 px-5 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-700 hover:bg-zinc-900 hover:text-white"
          >
            Security Architecture
          </Link>
        </div>
      </section>

      <section aria-label="Core capabilities" className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {CAPABILITIES.map((item) => (
          <article
            key={item.title}
            className="flex flex-col gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-6 transition-colors hover:border-zinc-700/80"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-400">
              {item.icon}
            </div>
            <h2 className="text-sm font-semibold tracking-tight text-zinc-100">{item.title}</h2>
            <p className="text-xs leading-relaxed text-zinc-400">{item.description}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
