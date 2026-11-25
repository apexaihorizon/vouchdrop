import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const APP_TITLE = 'VouchDrop — Direct Encrypted Work-Document Courier';
const APP_DESCRIPTION =
  'Zero-storage, peer-to-peer WebRTC file transfer for PDF, DOCX, PPTX, CSV, and FIG documents. Protected by WebAuthn Passkeys, closed contact allowlists, and SHA-256 verification.';

export const metadata: Metadata = {
  title: {
    default: APP_TITLE,
    template: '%s | VouchDrop',
  },
  description: APP_DESCRIPTION,
  applicationName: 'VouchDrop',
  manifest: '/manifest.json',
  openGraph: {
    title: APP_TITLE,
    description: APP_DESCRIPTION,
    type: 'website',
    siteName: 'VouchDrop',
  },
  twitter: {
    card: 'summary',
    title: APP_TITLE,
    description: APP_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: '#09090b',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full dark`}>
      <body className="flex min-h-screen flex-col bg-zinc-950 font-sans text-zinc-100 antialiased selection:bg-emerald-500/20 selection:text-emerald-200">
        <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
          <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5">
            <Link href="/" className="group flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 transition-colors group-hover:border-emerald-400/50 group-hover:bg-emerald-500/15">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                  <path d="m9 12 3-3 3 3" />
                  <path d="M12 9v6" />
                </svg>
              </span>
              <span className="text-sm font-semibold tracking-tight text-zinc-100 group-hover:text-white">
                VouchDrop
              </span>
              <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                P2P
              </span>
            </Link>

            <div className="flex items-center gap-1 sm:gap-2">
              <Link
                href="/"
                className="inline-flex min-h-[44px] items-center rounded-lg px-3 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
              >
                Courier
              </Link>
              <Link
                href="/about"
                className="inline-flex min-h-[44px] items-center rounded-lg px-3 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
              >
                Security
              </Link>
            </div>
          </nav>
        </header>

        <div className="flex flex-1 flex-col">{children}</div>

        <footer className="mt-auto border-t border-zinc-900">
          <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-6 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
            <p>Zero-storage WebRTC courier · Files never touch a server · SHA-256 verified</p>
            <p className="font-mono text-[11px] text-zinc-400">PDF · DOCX · PPTX · CSV · FIG (≤ 2 GB)</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
