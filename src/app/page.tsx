
"use client";

import GoogleMapComponent from "@/components/google-map";
import { getCyclingRoutes, Coordinate, CyclingRoute } from "@/services/open-route-service";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  collection,
  addDoc,
} from "firebase/firestore";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";

import { app, db, auth as firebaseAuth } from "@/lib/firebase.ts";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/toaster";
import { Icons } from "@/components/icons";
import { useToast } from "@/hooks/use-toast";

import {
  GoogleMap,
  Polyline,
} from "@react-google-maps/api";


const RouteDisplay = ({
  route,
  user,
}: {
  route: CyclingRoute;
  user: User | null;
}) => {
  const { toast } = useToast();
  const [center, setCenter] = useState<Coordinate | null>(null);
  const mapStyles = {
    height: "300px",
    width: "100%",
  };

  useEffect(() => {
    if (route.coordinates && route.coordinates.length > 0) {
      const latitudes = route.coordinates.map(p => p.lat);
      const longitudes = route.coordinates.map(p => p.lng);
      const minLat = Math.min(...latitudes);
      const maxLat = Math.max(...latitudes);
      const minLng = Math.min(...longitudes);
      const maxLng = Math.max(...longitudes);
      setCenter({
        lat: (minLat + maxLat) / 2,
        lng: (minLng + maxLng) / 2,
      });
    } else {
      setCenter({ lat: 0, lng: 0 }); // Fallback center
    }
  }, [route]);

  const MAX_GOOGLE_MAPS_WAYPOINTS = 10;

  let waypointsForGoogleMaps: Coordinate[] = [];
  if (route.coordinates && route.coordinates.length > 0) {
    waypointsForGoogleMaps.push(route.coordinates[0]); 

    if (route.coordinates.length > 2 && route.coordinates.length > MAX_GOOGLE_MAPS_WAYPOINTS) {
        const numIntermediatePoints = MAX_GOOGLE_MAPS_WAYPOINTS - 2;
        const totalRoutePoints = route.coordinates.length;
        const step = Math.max(1, Math.floor((totalRoutePoints - 2) / (numIntermediatePoints > 0 ? numIntermediatePoints : 1)));

        for (let i = 1; i <= numIntermediatePoints; i++) {
            const waypointIndex = i * step;
            if (waypointIndex > 0 && waypointIndex < totalRoutePoints - 1) {
                waypointsForGoogleMaps.push(route.coordinates[waypointIndex]);
            }
        }
    }
    
    if (route.coordinates.length > 1) {
        const endPoint = route.coordinates[route.coordinates.length - 1];
        if (waypointsForGoogleMaps.length < MAX_GOOGLE_MAPS_WAYPOINTS || 
            (waypointsForGoogleMaps.length === MAX_GOOGLE_MAPS_WAYPOINTS && 
             waypointsForGoogleMaps[waypointsForGoogleMaps.length-1].lat !== endPoint.lat &&
             waypointsForGoogleMaps[waypointsForGoogleMaps.length-1].lng !== endPoint.lng)) {
            
            if(waypointsForGoogleMaps.length === MAX_GOOGLE_MAPS_WAYPOINTS) {
                 waypointsForGoogleMaps.pop(); 
            }
            waypointsForGoogleMaps.push(endPoint);
        }
    }
   
     waypointsForGoogleMaps = waypointsForGoogleMaps.filter((point, index, self) =>
        index === self.findIndex((p) => p.lat === point.lat && p.lng === point.lng)
    );

    if (waypointsForGoogleMaps.length > MAX_GOOGLE_MAPS_WAYPOINTS) {
        const start = waypointsForGoogleMaps[0];
        const end = waypointsForGoogleMaps[waypointsForGoogleMaps.length-1];
        const intermediate = waypointsForGoogleMaps.slice(1, -1);
        const trimmedIntermediate = intermediate.filter((_,idx) => idx % (Math.floor(intermediate.length / (MAX_GOOGLE_MAPS_WAYPOINTS -2)) || 1) === 0).slice(0,MAX_GOOGLE_MAPS_WAYPOINTS-2);
        waypointsForGoogleMaps = [start, ...trimmedIntermediate, end];
    }
  }


  const origin = waypointsForGoogleMaps.length > 0 ? `${waypointsForGoogleMaps[0].lat},${waypointsForGoogleMaps[0].lng}` : "";
  const destination = waypointsForGoogleMaps.length > 1 ? `${waypointsForGoogleMaps[waypointsForGoogleMaps.length - 1].lat},${waypointsForGoogleMaps[waypointsForGoogleMaps.length - 1].lng}` : origin;

  const googleMapsWaypointsString = waypointsForGoogleMaps.length > 2
    ? waypointsForGoogleMaps.slice(1, -1).map(coord => `${coord.lat},${coord.lng}`).join('|')
    : "";

  const routeUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${googleMapsWaypointsString}&travelmode=cycling`;


  const handleSaveRoute = async () => {
    if (!user || !user.uid) {
      toast({
        title: "Authentication Required",
        description: "Please log in to save routes.",
        variant: "destructive",
      });
      return;
    }
    if (!db) {
      toast({
        title: "Database Error",
        description: "Firestore database is not available. Cannot save route.",
        variant: "destructive",
      });
      return;
    }
    try {
      const userSavedRoutesCollection = collection(db, "users", user.uid, "savedRoutes");
      await addDoc(userSavedRoutesCollection, {
        routeData: {
          distance: route.distance,
          estimatedTime: route.estimatedTime,
          coordinates: route.coordinates, 
          geometry: route.geometry,
        },
        timestamp: new Date(),
        routeName: `Route near ${user.displayName || 'selected location'} on ${new Date().toLocaleDateString()}`,
        sharedUrl: routeUrl,
      });
      toast({
        title: "Route Saved",
        description: `Route saved to your profile.`,
      });
    } catch (error) {
      console.error("Error saving route:", error);
      toast({
        title: "Save Error",
        description: "Failed to save route. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleShareRoute = async () => {
    try {
      await navigator.clipboard.writeText(routeUrl);
      toast({
        title: "Link Copied!",
        description: "Route link copied to clipboard.",
      });
    } catch (err) {
      console.error("Failed to copy link: ", err);
      toast({
        title: "Copy Error",
        description: "Could not copy link to clipboard.",
        variant: "destructive",
      });
    }
  };


  if (!center) {
    return <Skeleton className="h-[400px] w-full" />;
  }

  return (
    <Card className="bg-card shadow-lg rounded-lg">
      <CardHeader>
        <CardTitle className="text-primary">Route Option</CardTitle>
        <CardDescription className="text-muted-foreground">
          Distance: {route.distance.toFixed(2)} km, Duration:{" "}
          {route.estimatedTime.toFixed(0)} min
        </CardDescription>
      </CardHeader>
      <CardContent>
        {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && center ? (
          <div className="rounded-md overflow-hidden border border-border">
            <GoogleMap mapContainerStyle={mapStyles} zoom={12} center={center} options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}>
              <Polyline path={route.coordinates} options={{ strokeColor: "hsl(var(--primary))", strokeWeight: 3, strokeOpacity: 0.8 }} />
            </GoogleMap>
          </div>
        ) : (
          <Skeleton className="h-[300px] w-full bg-muted" />
        )}
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row justify-between gap-2 pt-4">
        <Button asChild variant="outline" className="border-accent text-accent hover:bg-accent/10">
          <a href={routeUrl} target='_blank' rel="noopener noreferrer">Open in Google Maps</a>
        </Button>
        <div className="flex gap-2">
          <Button onClick={handleShareRoute} variant="outline" className="hover:bg-secondary/80">
            <Icons.share className="mr-2 h-4 w-4" /> Share
          </Button>
          <Button
            onClick={handleSaveRoute}
            disabled={!user || !user.uid} 
            className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
          >
            <Icons.plusCircle className="mr-2 h-4 w-4" /> Save this route
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

const HomePage = () => {
  const [radius, setRadius] = useState<number>(5);
  const [showMapInput, setShowMapInput] = useState<boolean>(true);
  const [routes, setRoutes] = useState<CyclingRoute[] | null>(null);
  const [loadingRoutes, setLoadingRoutes] = useState<boolean>(false);
  const { toast } = useToast();
  const [selectedLocation, setSelectedLocation] = useState<Coordinate | null>(null);
  const previousSelectedLocationRef = useRef<Coordinate | null>(null);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true); 

  useEffect(() => {
    const apiKeyMissing = !process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY.trim() === '';
    const projectIdMissing = !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID.trim() === '';

    if (apiKeyMissing || projectIdMissing) {
      let missing = [];
      if (apiKeyMissing) missing.push("API Key (NEXT_PUBLIC_FIREBASE_API_KEY)");
      if (projectIdMissing) missing.push("Project ID (NEXT_PUBLIC_FIREBASE_PROJECT_ID)");
      const message = `${missing.join(" and ")} is missing or empty. Authentication is unavailable.`;
      toast({ title: "Configuration Error", description: `${message} Please check your .env file and restart the server.`, variant: "destructive" });
      console.error(`CRITICAL: ${message}`);
      // authLoading remains true to disable auth buttons
      return;
    }

    if (!firebaseAuth) {
      toast({ title: "Authentication Error", description: "Firebase Auth service (firebaseAuth) is undefined. This could be due to an initialization error in firebase.ts. Check console for logs from firebase.ts.", variant: "destructive" });
      console.error("CRITICAL: firebaseAuth is undefined. Firebase Auth failed to initialize. Check firebase.ts logs. Imported firebaseAuth:", firebaseAuth);
      // authLoading remains true
      return;
    }

    if (typeof firebaseAuth.onAuthStateChanged !== 'function' || !firebaseAuth.app) {
      toast({ title: "Authentication Error", description: "Firebase Auth service is not a valid Auth instance (onAuthStateChanged or .app missing). Check Firebase initialization in firebase.ts.", variant: "destructive" });
      console.error("CRITICAL: firebaseAuth is not a valid Auth instance (onAuthStateChanged or .app missing). Imported firebaseAuth:", firebaseAuth, "App options:", firebaseAuth?.app?.options, "typeof .onAuthStateChanged:", typeof firebaseAuth.onAuthStateChanged);
       // authLoading remains true
      return;
    }
    
    console.log('Firebase SDK appears initialized. Project ID used by client:', firebaseAuth.app.options?.projectId);
    console.log('page.tsx useEffect: firebaseAuth type is', typeof firebaseAuth, 'typeof firebaseAuth.signInWithPopup is', typeof firebaseAuth.signInWithPopup);

    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false); 
      if (user) {
        console.log("User signed in:", user.uid);
      } else {
        console.log("User signed out.");
      }
    }, (error) => {
        console.error("CRITICAL: Error in onAuthStateChanged listener:", error);
        toast({ title: "Authentication State Error", description: "Could not determine authentication state. Please refresh.", variant: "destructive" });
        setAuthLoading(false); 
    });

    return () => unsubscribe();
  }, [toast]);


  const handleGoogleSignIn = async () => {
    console.log("[handleGoogleSignIn] Attempting Google Sign-In.");
    console.log("[handleGoogleSignIn] firebaseAuth object:", firebaseAuth);
    if (firebaseAuth && firebaseAuth.signInWithPopup) {
      console.log("[handleGoogleSignIn] typeof firebaseAuth.signInWithPopup:", typeof firebaseAuth.signInWithPopup);
    } else {
      console.log("[handleGoogleSignIn] firebaseAuth is falsy or firebaseAuth.signInWithPopup is not present.");
    }

    if (!firebaseAuth || typeof firebaseAuth.signInWithPopup !== 'function') {
      toast({ title: "Authentication Error", description: "Firebase Auth not properly initialized. Cannot sign in. Check console for 'CRITICAL' messages.", variant: "destructive" });
      console.error("handleGoogleSignIn: firebaseAuth not properly initialized or is not a valid Auth instance. typeof .signInWithPopup:", typeof firebaseAuth?.signInWithPopup, "firebaseAuth object:", firebaseAuth);
      return;
    }
    const provider = new GoogleAuthProvider();
    try {
      setAuthLoading(true);
      await signInWithPopup(firebaseAuth, provider);
      toast({ title: "Signed In", description: "Successfully signed in with Google." });
    } catch (error: any) {
      console.error("Error signing in with Google:", error);
      toast({ title: "Sign-in Error", description: `Code: ${error.code}\nMessage: ${error.message}`, variant: "destructive" });
      setAuthLoading(false); 
    } 
  };

  const handleSignOut = async () => {
    console.log("[handleSignOut] Attempting Sign-Out.");
    console.log("[handleSignOut] firebaseAuth object:", firebaseAuth);
    if (firebaseAuth && firebaseAuth.signOut) {
      console.log("[handleSignOut] typeof firebaseAuth.signOut:", typeof firebaseAuth.signOut);
    } else {
      console.log("[handleSignOut] firebaseAuth is falsy or firebaseAuth.signOut is not present.");
    }

    if (!firebaseAuth || typeof firebaseAuth.signOut !== 'function') {
      toast({ title: "Authentication Error", description: "Firebase Auth not properly initialized. Cannot sign out. Check console for 'CRITICAL' messages.", variant: "destructive" });
      console.error("handleSignOut: firebaseAuth not properly initialized or is not a valid Auth instance. typeof .signOut:", typeof firebaseAuth?.signOut, "firebaseAuth object:", firebaseAuth);
      return;
    }
    try {
      setAuthLoading(true);
      await signOut(firebaseAuth);
      toast({ title: "Signed Out", description: "Successfully signed out." });
    } catch (error: any) {
      console.error("Error signing out:", error);
      toast({ title: "Sign-out Error", description: error.message || "Failed to sign out.", variant: "destructive" });
      setAuthLoading(false); 
    }
  };


  const handleGenerateRoutes = useCallback(async () => {
    if (!selectedLocation) {
      toast({
        title: "Location Required",
        description: "Please select a location before generating routes.",
        variant: "destructive",
      });
      return;
    }

    setLoadingRoutes(true);
    setRoutes(null); 
    try {
      const apiKey = process.env.NEXT_PUBLIC_OPEN_ROUTE_SERVICE_API_KEY;
      if (!apiKey) {
        toast({
          title: "API Key Missing",
          description: "OpenRouteService API key is missing. Please configure it to generate routes.",
          variant: "destructive",
        });
        setLoadingRoutes(false);
        return;
      }
      const generatedRoutes = await getCyclingRoutes(selectedLocation, radius, 3);
      setRoutes(generatedRoutes);
      if (generatedRoutes && generatedRoutes.length > 0) {
        setShowMapInput(false); 
         toast({
          title: "Routes Generated",
          description: `${generatedRoutes.length} cycling routes found.`,
        });
      } else {
        toast({
          title: "No Routes Found",
          description: "Could not find any cycling routes for the selected criteria. Try adjusting the radius or location.",
          variant: "default", 
        });
      }
    } catch (error: any) {
      console.error("Error generating routes:", error);
      toast({
        title: "Route Generation Error",
        description: error.message || "Failed to generate routes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingRoutes(false);
    }
  }, [selectedLocation, radius, toast]);

  const handleLocationSelected = useCallback((location: Coordinate) => {
    setSelectedLocation(location);
  }, []); 

  useEffect(() => {
    if (selectedLocation) {
      // Only toast if it's not the very first location set or if it's genuinely different
      if (previousSelectedLocationRef.current &&
          (previousSelectedLocationRef.current.lat !== selectedLocation.lat ||
           previousSelectedLocationRef.current.lng !== selectedLocation.lng)) {
        toast({
          title: 'Location Updated',
          description: `New location selected: ${selectedLocation.lat.toFixed(4)}, ${selectedLocation.lng.toFixed(4)}`,
        });
      }
      previousSelectedLocationRef.current = selectedLocation;
    }
  }, [selectedLocation, toast]);

  return (
    <div className="flex flex-col min-h-screen bg-secondary p-4 sm:p-6 md:p-8 font-sans">
      <Toaster />
      <header className="w-full max-w-4xl mx-auto mb-6 text-center">
        <div className="flex justify-end items-center mb-4">
          {authLoading ? (
            <Button variant="outline" disabled>
              <Icons.spinner className="mr-2 h-4 w-4 animate-spin" /> Loading Auth...
            </Button>
          ) : currentUser ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-foreground">Hi, {currentUser.displayName || currentUser.email}</span>
              <Button variant="outline" onClick={handleSignOut}>
                <Icons.user className="mr-2 h-4 w-4" /> Logout
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={handleGoogleSignIn}>
               <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 381.5 512 244 512 110.3 512 0 399.4 0 258.9 0 123.4 104.8 0 241.3 0c65.9 0 120.6 23.8 163.2 64.8l-66.6 52.9C285.5 91.7 257.9 80.5 230.2 80.5c-70.1 0-121.1 55.4-121.1 124.9s50.9 124.9 121.1 124.9c79.9 0 112.9-56.6 116.2-84H229.6v-64.9h153.3c2.7 14.5 5.1 30.4 5.1 46.5z"></path></svg>
              Login with Google
            </Button>
          )}
        </div>
        <h1 className="text-4xl font-bold text-primary">CycleZen</h1>
        <p className="text-lg text-muted-foreground">Your companion for discovering amazing cycling routes.</p>
      </header>
      <div className="container mx-auto max-w-2xl">
        <Card className="mb-6 bg-card shadow-xl rounded-xl">
          <CardHeader>
            <CardTitle className="text-2xl text-primary">Route Generation</CardTitle>
            <CardDescription className="text-muted-foreground">
              Select a starting point and radius to find your next ride.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="grid gap-2">
              <label
                htmlFor="radius"
                className="text-sm font-medium leading-none text-foreground"
              >
                Radius for route length (km)
              </label>
              <Input
                type="number"
                id="radius"
                value={radius}
                onChange={(e) => setRadius(Math.max(1, Number(e.target.value)))}
                placeholder="Enter radius in km"
                className="bg-background border-input focus:ring-primary focus:border-primary rounded-md"
                min="1"
              />
            </div>

            {showMapInput && (
             <div className="rounded-lg overflow-hidden shadow-md border border-border">
                <GoogleMapComponent
                  onLocationSelected={handleLocationSelected}
                  googleMapsApiKey={googleMapsApiKey}
                />
              </div>
            )}
            {!showMapInput && selectedLocation && (
              <div className="text-sm p-3 bg-muted rounded-md border border-border">
                <p className="font-semibold text-foreground">Starting Location:</p>
                <p className="text-muted-foreground">Lat: {selectedLocation.lat.toFixed(4)}, Lng: {selectedLocation.lng.toFixed(4)}</p>
                <Button onClick={() => { setShowMapInput(true); setRoutes(null); }} variant="link" className="p-0 h-auto text-accent mt-1">
                  Change location
                </Button>
              </div>
            )}
          </CardContent>
          <CardFooter className="pt-6">
            <Button onClick={handleGenerateRoutes} disabled={loadingRoutes || !selectedLocation} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
              {loadingRoutes ? (
                <><Icons.spinner className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
              ) : "Generate Routes"}
            </Button>
          </CardFooter>
        </Card>

        {loadingRoutes && (
          <div className="space-y-4">
            <Skeleton className="h-[200px] w-full rounded-lg" />
            <Skeleton className="h-[200px] w-full rounded-lg" />
            <Skeleton className="h-[200px] w-full rounded-lg" />
          </div>
        )}

        {routes && !loadingRoutes && (
          <div className="space-y-6">
             <Button onClick={() => { setShowMapInput(true); setRoutes(null); }} variant="outline" className="mb-4 flex items-center">
              <Icons.arrowLeft className="mr-2 h-4 w-4" /> Back to Location Select
            </Button>
            {routes.map((route, index) => (
              <RouteDisplay key={index} route={route} user={currentUser} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;
