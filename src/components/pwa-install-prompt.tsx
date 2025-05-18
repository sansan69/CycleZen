
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/icons";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"; // Import Card components
import { useToast } from "@/hooks/use-toast";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsStandalone(window.matchMedia("(display-mode: standalone)").matches);

      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        if (!window.matchMedia("(display-mode: standalone)").matches) {
          setIsVisible(true); 
        }
      };

      window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

      const handleAppInstalled = () => {
        console.log("CycleZen PWA installed");
        setIsVisible(false); // Hide prompt after installation
        setDeferredPrompt(null); // Clear the prompt
        toast({
            title: "App Installed!",
            description: "CycleZen has been added to your home screen.",
        });
      };

      window.addEventListener("appinstalled", handleAppInstalled);

      return () => {
        window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
        window.removeEventListener("appinstalled", handleAppInstalled);
      };
    }
  }, [toast]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }
    // Hide our custom UI first
    setIsVisible(false);
    // Show the browser install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to A2HS prompt: ${outcome}`);
    // We've used the prompt, and can't use it again, discard it
    if (outcome === 'accepted') {
        // The appinstalled event will handle the toast
    } else {
        toast({
            title: "Installation Cancelled",
            description: "You can install CycleZen anytime from the browser menu.",
            variant: "default"
        });
    }
    setDeferredPrompt(null);
  };

  const handleCloseClick = () => {
    setIsVisible(false);
    toast({
        title: "Install Later",
        description: "You can add CycleZen to your home screen later if you change your mind!",
        duration: 5000,
    });
  };

  if (!isVisible || !deferredPrompt || isStandalone) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-2 sm:p-4 flex justify-center animate-in fade-in slide-in-from-bottom-5 duration-500">
      <Card className="w-full max-w-md shadow-2xl bg-card border-border">
        <CardHeader className="pb-3 pt-4 px-4 sm:px-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-primary">Install CycleZen</CardTitle>
            <Button variant="ghost" size="sm" onClick={handleCloseClick} className="p-1 h-auto text-muted-foreground hover:text-foreground">
              <Icons.close className="h-4 w-4" />
              <span className="sr-only">Close install prompt</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-4 sm:px-5 pb-4">
          <CardDescription className="text-sm text-muted-foreground mb-3">
            Add CycleZen to your home screen for a better experience and quick access!
          </CardDescription>
          <Button onClick={handleInstallClick} variant="accent" className="w-full">
            <Icons.download className="mr-2 h-4 w-4" />
            Install App
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PWAInstallPrompt;
