
import type {Metadata, Viewport} from 'next';
import {Geist, Geist_Mono} from 'next/font/google';
import './globals.css';
import PWALoader from '@/components/pwa-loader'; // Import the PWA loader

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
  manifest: '/manifest.json', // Link to the manifest file
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CycleZen",
    // startUpImage: [], // You can add startup images here
  },
  formatDetection: {
    telephone: false,
  },
  // Open Graph and Twitter Card meta tags can be added here for better sharing
};

export const viewport: Viewport = {
  themeColor: '#008080', // Matches primary color and manifest theme_color
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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-secondary text-foreground`}>
        <PWALoader />
        {children}
      </body>
    </html>
  );
}
