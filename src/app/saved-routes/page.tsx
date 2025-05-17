
"use client";

import { useState, useEffect } from "react";
import type { User } from "firebase/auth";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import Link from "next/link";

import { db } from "@/lib/firebase";
import { onAuthUserChanged } from "@/lib/firebaseAuthService";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Icons } from "@/components/icons";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";

interface SavedRouteDoc {
  id: string;
  routeData: {
    distance: number;
    estimatedTime: number;
    // coordinates are not typically displayed on this summary page but are available
  };
  timestamp: Timestamp; // Firestore Timestamp
  routeName: string;
  sharedUrl: string;
}

const SavedRoutesPage = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [savedRoutes, setSavedRoutes] = useState<SavedRouteDoc[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState<boolean>(true);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthUserChanged((user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (currentUser && db) {
      setLoadingRoutes(true);
      const routesCollection = collection(
        db,
        "users",
        currentUser.uid,
        "savedRoutes"
      );
      const q = query(routesCollection, orderBy("timestamp", "desc"));

      getDocs(q)
        .then((querySnapshot) => {
          const routes: SavedRouteDoc[] = [];
          querySnapshot.forEach((doc) => {
            routes.push({ id: doc.id, ...doc.data() } as SavedRouteDoc);
          });
          setSavedRoutes(routes);
          setLoadingRoutes(false);
        })
        .catch((error) => {
          console.error("Error fetching saved routes:", error);
          toast({
            title: "Error",
            description: "Could not fetch saved routes.",
            variant: "destructive",
          });
          setLoadingRoutes(false);
        });
    } else if (!currentUser && !authLoading) {
      // If not logged in and auth check is complete, stop loading routes
      setLoadingRoutes(false);
    }
  }, [currentUser, authLoading, toast]);

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-secondary p-8">
        <Icons.spinner className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Loading authentication...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-secondary p-8 text-center">
        <Icons.user className="h-16 w-16 text-primary mb-4" />
        <h1 className="text-3xl font-bold text-primary mb-2">Access Denied</h1>
        <p className="text-lg text-muted-foreground mb-6">
          Please log in to view your saved routes.
        </p>
        <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Link href="/">Return to Home & Login</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-secondary p-4 sm:p-6 md:p-8 font-sans">
      <Toaster />
      <header className="w-full max-w-4xl mx-auto mb-8">
        <div className="flex items-center justify-between">
            <h1 className="text-4xl font-bold text-primary">My Saved Routes</h1>
            <Button asChild variant="outline">
              <Link href="/"><Icons.arrowLeft className="mr-2 h-4 w-4" /> Back to Home</Link>
            </Button>
        </div>
      </header>

      <div className="container mx-auto max-w-2xl">
        {loadingRoutes && (
          <div className="space-y-4">
            <Skeleton className="h-[150px] w-full rounded-lg" />
            <Skeleton className="h-[150px] w-full rounded-lg" />
            <Skeleton className="h-[150px] w-full rounded-lg" />
          </div>
        )}

        {!loadingRoutes && savedRoutes.length === 0 && (
          <div className="text-center py-10">
            <Icons.list className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-xl text-muted-foreground">
              No saved routes yet.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Go back to the homepage to generate and save new routes!
            </p>
          </div>
        )}

        {!loadingRoutes && savedRoutes.length > 0 && (
          <div className="space-y-6">
            {savedRoutes.map((route) => (
              <Card key={route.id} className="bg-card shadow-lg rounded-lg">
                <CardHeader>
                  <CardTitle className="text-primary">{route.routeName}</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Saved on: {new Date(route.timestamp.toDate()).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-foreground">
                    Distance: {route.routeData.distance.toFixed(2)} km
                  </p>
                  <p className="text-sm text-foreground">
                    Estimated Duration: {route.routeData.estimatedTime.toFixed(0)} min
                  </p>
                </CardContent>
                <CardFooter>
                  <Button asChild variant="outline" className="border-accent text-accent hover:bg-accent/10">
                    <a href={route.sharedUrl} target="_blank" rel="noopener noreferrer">
                      <Icons.externalLink className="mr-2 h-4 w-4" /> Open in Google Maps
                    </a>
                  </Button>
                  {/* TODO: Add Delete button later */}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SavedRoutesPage;
