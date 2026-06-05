import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Stray — Feed the cats your city forgot',
  description:
    'Community-powered smart feeders for stray cats. Scan any station, pay NT$15, watch a cat eat live. A network run with city governments across Taiwan.',
  openGraph: {
    title: 'Stray — Feed the cats your city forgot',
    description: 'Smart feeders for stray cats, crowdfunded by neighbours.',
    siteName: 'Stray',
    locale: 'zh_TW',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body>{children}</body>
    </html>
  );
}
