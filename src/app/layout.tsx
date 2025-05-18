
import type {Metadata, Viewport} from 'next';
import {Geist, Geist_Mono} from 'next/font/google';
import './globals.css';
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
    statusBarStyle: "default",
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
        <link rel="preconnect" href="https://maps.googleapis.com" />
        <link rel="preconnect" href="https://maps.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-secondary text-foreground`}>
        <PWALoader />
        <PWAInstallPrompt />
        {children}
      </body>
    </html>
  );
}
