import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Navbar } from '@/components/Navbar';
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
      <body className="flex min-h-screen flex-col bg-[var(--color-canvas)] font-sans text-zinc-100 antialiased selection:bg-[var(--color-accent)]/20 selection:text-emerald-200">
        <Navbar />

        <div className="flex flex-1 flex-col">{children}</div>

        <footer className="mt-auto border-t border-[var(--color-border-subtle)]">
          <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-6 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
            <p>Zero-storage WebRTC courier · Files never touch a server · SHA-256 verified</p>
            <p className="font-mono text-[11px] text-zinc-400">
              PDF · XLSX · DOCX · PPTX · ODS · ODT · ODP · CSV · TSV · FIG (≤ 2 GB)
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
