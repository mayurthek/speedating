import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Speedating — meet someone new in three minutes',
  description:
    'Three-minute one-to-one video dates. Get matched with someone new, answer the same question together, then keep talking or move on.',
};

export const viewport: Viewport = {
  themeColor: '#FDF7EF',
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
