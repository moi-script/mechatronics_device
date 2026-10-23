import type { Metadata, Viewport } from 'next';
import { Archivo, Archivo_Narrow, JetBrains_Mono } from 'next/font/google';
import { PrefsSync } from '@/components/PrefsSync';
import './globals.css';

// Archivo for the panel's voice, its Narrow cut for engraved labels, a code mono for addresses.
const sans = Archivo({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-sans' });
const cond = Archivo_Narrow({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-cond' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'Mechatronic',
  description: 'Wire and simulate the mechatronics lab trainer board in the browser.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#dde3ea' },
    { media: '(prefers-color-scheme: dark)', color: '#0c1117' },
  ],
};

// Runs before first paint so the panel never flashes the wrong theme.
const THEME_BOOT = `(function(){try{var c=localStorage.getItem('mech-theme')||'dark';var d=c==='dark'||(c==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){document.documentElement.dataset.theme='dark';}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${cond.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="h-full antialiased">
        <PrefsSync />
        {children}
      </body>
    </html>
  );
}
