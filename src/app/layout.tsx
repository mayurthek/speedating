import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Speedating — meet someone new, briefly',
  description: 'A nostalgic web-based speed-dating utility. Instant 3-minute video conversations.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
