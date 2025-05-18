
'use client';

import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

const PWALoader = () => {
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) { // Removed window.workbox check as we are not using Workbox directly
      navigator.serviceWorker
        .register('/sw.js') // Ensure this path is correct
        .then(registration => {
          console.log('[PWALoader] Service Worker registered with scope:', registration.scope);
          
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    // New content is available and will be used when all
                    // tabs for this page are closed.
                    console.log('[PWALoader] New PWA content is available; please refresh.');
                    toast({
                      title: 'Update Available',
                      description: 'A new version of CycleZen is available. Close all app tabs and reopen to update.',
                      duration: 10000, // Keep it longer for user to see
                      variant: 'default',
                    });
                  } else {
                    // Content is cached for offline use.
                    console.log('[PWALoader] Content is cached for offline use.');
                    toast({
                      title: 'App Ready Offline',
                      description: 'CycleZen is now available for basic offline use. Saved route data may require an internet connection to be up-to-date.',
                      duration: 7000,
                      variant: 'default',
                    });
                  }
                }
              };
            }
          };
        })
        .catch(error => {
          console.error('[PWALoader] Service Worker registration failed:', error);
          toast({
            title: 'Offline Features Error',
            description: 'Could not set up offline features for the app. Please try refreshing.',
            variant: 'destructive',
            duration: 7000,
          });
        });
    }
  }, [toast]);

  return null; // This component does not render anything visible
};

export default PWALoader;
