import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Sans_Condensed } from 'next/font/google';
import './globals.css';

// Plex was drawn for an engineering identity, which is the register this panel wants.
const sans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-sans' });
const cond = IBM_Plex_Sans_Condensed({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-cond',
});
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'Mechatronic Trainer',
  description: 'Wire and simulate the mechatronics lab trainer board in the browser.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#dde3ea',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${cond.variable} ${mono.variable}`}>
      <body className="h-full antialiased">{children}</body>
    </html>
  );
}
