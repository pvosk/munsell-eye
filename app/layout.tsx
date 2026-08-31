import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://munsell-eye-color-training.pet-ty.chatgpt.site'),
  title: 'Munsell Eye — Color Perception Training',
  description: 'Train your eye to identify Munsell value, hue, and chroma.',
  applicationName: 'Munsell Eye',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Munsell Eye',
  },
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-192.png',
  },
  openGraph: {
    type: 'website',
    title: 'Munsell Eye',
    description: 'Train value, hue & chroma.',
    images: [{ url: '/og.png', width: 1200, height: 675, alt: 'Munsell Eye color-training app' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Munsell Eye',
    description: 'Train value, hue & chroma.',
    images: ['/og.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#eeede8',
  viewportFit: 'cover',
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
