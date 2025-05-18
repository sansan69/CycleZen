
'use client';

import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

const PWALoader = () => {
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) { 
      navigator.serviceWorker
        .register('/sw.js') 
        .then(registration => {
          console.log('[PWALoader] Service Worker registered with scope:', registration.scope);
          
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    console.log('[PWALoader] New PWA content is available; please refresh.');
                    toast({
                      title: 'Update Available',
                      description: 'A new version of CycleZen is available. Close all app tabs and reopen to update.',
                      duration: 10000, 
                      variant: 'default',
                    });
                  } else {
                    console.log('[PWALoader] PWA features initialized.');
                    toast({
                      title: 'PWA Ready',
                      description: 'PWA features initialized. App updates will now reflect more quickly.',
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
            title: 'PWA Initialization Error',
            description: 'Could not set up PWA features. Some functionalities might be limited.',
            variant: 'destructive',
            duration: 7000,
          });
        });
    }
  }, [toast]);

  return null; 
};

export default PWALoader;
