
import type {Metadata, Viewport} from 'next';
import {Geist, Geist_Mono} from 'next/font/google';
import { Suspense } from 'react';
import './globals.css';
import { Providers } from '@/shared/components/Providers';
import PWALoader from '@/components/pwa-loader';
import PWAInstallPrompt from '@/components/pwa-install-prompt';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'CycleZen - Your Cycling Companion',
  description: 'Discover amazing cycling routes with CycleZen. Find, save, and share your next ride.',
  manifest: '/manifest.json', 
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CycleZen",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#008080', 
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="preconnect" href="https://maps.googleapis.com" />
        <link rel="preconnect" href="https://maps.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-secondary text-foreground`}>
        <Providers>
          <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen bg-secondary">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          }>
            <PWALoader />
            <PWAInstallPrompt />
            {children}
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}
