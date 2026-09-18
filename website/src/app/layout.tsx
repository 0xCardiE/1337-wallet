import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { SITE } from '@/lib/site';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.origin),
  title: {
    default: `${SITE.name}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  icons: {
    icon: '/icon-128.png',
    apple: '/icon-128.png',
  },
  openGraph: {
    title: SITE.name,
    description: SITE.description,
    url: '/',
    siteName: SITE.name,
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/og.jpg',
        width: 1200,
        height: 630,
        alt: '1337 Wallet — an EVM wallet for hackers',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@1337wallet',
    creator: '@1337wallet',
    title: SITE.name,
    description: SITE.description,
    images: ['/og.jpg'],
  },
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
