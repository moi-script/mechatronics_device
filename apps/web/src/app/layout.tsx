import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mechatronic Trainer',
  description: 'Wire and simulate the mechatronics lab trainer board in the browser.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="h-full antialiased">{children}</body>
    </html>
  );
}
