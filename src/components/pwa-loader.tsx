
'use client';

import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

const PWALoader = () => {
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && window.workbox !== undefined) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(registration => {
          console.log('Service Worker registered with scope:', registration.scope);
          
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    // New content is available and will be used when all
                    // tabs for this page are closed.
                    console.log('New PWA content is available; please refresh.');
                    toast({
                      title: 'Update Available',
                      description: 'A new version of CycleZen is available. Close all app tabs and reopen to update.',
                      duration: 10000,
                    });
                  } else {
                    // Content is cached for offline use.
                    console.log('Content is cached for offline use.');
                    toast({
                      title: 'App Ready Offline',
                      description: 'CycleZen is now available for offline use.',
                      duration: 5000,
                    });
                  }
                }
              };
            }
          };
        })
        .catch(error => {
          console.error('Service Worker registration failed:', error);
          toast({
            title: 'Offline Features Error',
            description: 'Could not set up offline features for the app.',
            variant: 'destructive',
          });
        });
    }
  }, [toast]);

  return null; // This component does not render anything visible
};

export default PWALoader;
