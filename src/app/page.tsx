
"use client";

import GoogleMapComponent from "@/components/google-map";
import { getCyclingRoutes, Coordinate, CyclingRoute } from "@/services/open-route-service";
import { useState, useEffect, useCallback } from "react";
import {
  collection,
  addDoc,
  // Firestore, // Not directly used, db is imported
  // getFirestore, // Not directly used, db is imported
} from "firebase/firestore";
import {
  // getAuth, // Not directly used, firebaseAuth is imported
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";

import { app, db, auth as firebaseAuth } from "@/lib/firebase.ts"; // Renamed auth import
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
  // LoadScript // Not used anymore
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
    if (route.coordinates.length <= MAX_GOOGLE_MAPS_WAYPOINTS) {
      waypointsForGoogleMaps = route.coordinates;
    } else {
      waypointsForGoogleMaps.push(route.coordinates[0]); // Start point
      const numIntermediatePoints = MAX_GOOGLE_MAPS_WAYPOINTS - 2; // -2 for start and end
      const totalRoutePoints = route.coordinates.length;
      const step = Math.floor((totalRoutePoints - 2) / (numIntermediatePoints > 0 ? numIntermediatePoints : 1));

      for (let i = 1; i <= numIntermediatePoints; i++) {
        const waypointIndex = i * step;
        if (waypointIndex > 0 && waypointIndex < totalRoutePoints - 1) { // Ensure intermediate points are not start/end
           waypointsForGoogleMaps.push(route.coordinates[waypointIndex]);
        }
      }
      // Add end point, ensure it's not a duplicate if only one intermediate point was pushed close to end
      if (waypointsForGoogleMaps.length < MAX_GOOGLE_MAPS_WAYPOINTS && totalRoutePoints > 1) {
         const lastPoint = route.coordinates[totalRoutePoints - 1];
         if (!waypointsForGoogleMaps.find(wp => wp.lat === lastPoint.lat && wp.lng === lastPoint.lng)) {
            waypointsForGoogleMaps.push(lastPoint);
         }
      }
       // If due to short routes or step calculation, we have less than max but more than 1 point, ensure end point is last.
      if (waypointsForGoogleMaps.length > 1 && waypointsForGoogleMaps[waypointsForGoogleMaps.length-1] !== route.coordinates[totalRoutePoints-1]){
        //This logic might be complex, for now, ensure start and end are distinct and present.
        // The goal is: Start, Intermediate1, ..., IntermediateN, End
      }
    }
     // Ensure start and end are always present if coordinates exist
    if(route.coordinates.length > 0 && !waypointsForGoogleMaps.includes(route.coordinates[0])) {
        waypointsForGoogleMaps.unshift(route.coordinates[0]);
    }
    if(route.coordinates.length > 1 && !waypointsForGoogleMaps.includes(route.coordinates[route.coordinates.length -1])) {
        // if the last point isn't already there (e.g. was an intermediate point or list too short)
        if(waypointsForGoogleMaps.length >= MAX_GOOGLE_MAPS_WAYPOINTS) waypointsForGoogleMaps.pop(); // make space if full
        waypointsForGoogleMaps.push(route.coordinates[route.coordinates.length -1]);
    }
    // Remove duplicates just in case (e.g. start=end for very short routes / single point routes)
    waypointsForGoogleMaps = waypointsForGoogleMaps.filter((point, index, self) =>
      index === self.findIndex((p) => p.lat === point.lat && p.lng === point.lng)
    );

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
    try {
      const userSavedRoutesCollection = collection(db, "users", user.uid, "savedRoutes");
      await addDoc(userSavedRoutesCollection, {
        routeData: {
          distance: route.distance,
          estimatedTime: route.estimatedTime,
          coordinates: route.coordinates, // Save the full original coordinates
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
            disabled={!user || !user.uid} // Disable if no user
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

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  useEffect(() => {
    // Ensure firebaseAuth is initialized before using it
    if (firebaseAuth && Object.keys(firebaseAuth).length > 0) {
      const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
        setCurrentUser(user);
        setAuthLoading(false);
      });
      return () => unsubscribe();
    } else {
      // Handle the case where firebaseAuth might not be fully initialized
      // This might happen if API keys are missing or there's an initialization error in firebase.ts
      setAuthLoading(false);
      if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
         toast({ title: "Authentication Error", description: "Firebase API Key is missing. Authentication will be unavailable.", variant: "destructive" });
      } else {
         toast({ title: "Authentication Error", description: "Firebase Auth service is not available. Please check configuration.", variant: "destructive" });
      }
    }
  }, [toast]);


  const handleGoogleSignIn = async () => {
    if (!firebaseAuth || Object.keys(firebaseAuth).length === 0) {
      toast({ title: "Authentication Error", description: "Firebase Auth not initialized.", variant: "destructive" });
      return;
    }
    const provider = new GoogleAuthProvider();
    try {
      setAuthLoading(true);
      await signInWithPopup(firebaseAuth, provider);
      toast({ title: "Signed In", description: "Successfully signed in with Google." });
    } catch (error: any) {
      console.error("Error signing in with Google:", error);
      toast({ title: "Sign-in Error", description: error.message || "Failed to sign in.", variant: "destructive" });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (!firebaseAuth || Object.keys(firebaseAuth).length === 0) {
      toast({ title: "Authentication Error", description: "Firebase Auth not initialized.", variant: "destructive" });
      return;
    }
    try {
      setAuthLoading(true);
      await signOut(firebaseAuth);
      toast({ title: "Signed Out", description: "Successfully signed out." });
      setCurrentUser(null); // Explicitly set user to null
    } catch (error: any) {
      console.error("Error signing out:", error);
      toast({ title: "Sign-out Error", description: error.message || "Failed to sign out.", variant: "destructive" });
    } finally {
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
    setRoutes(null); // Clear previous routes
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
        setShowMapInput(false); // Hide map input and show routes
         toast({
          title: "Routes Generated",
          description: `${generatedRoutes.length} cycling routes found.`,
        });
      } else {
        toast({
          title: "No Routes Found",
          description: "Could not find any cycling routes for the selected criteria. Try adjusting the radius or location.",
          variant: "default", // Changed from destructive
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
    // Toasting here can be very noisy if the map updates frequently.
    // Consider if this toast is essential or if visual feedback from map marker is enough.
    // For now, let's keep it but be mindful.
    toast({
      title: 'Location Updated',
      description: `New location selected: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`,
    });
  }, [toast]); // Dependency array includes toast

  return (
    <div className="flex flex-col min-h-screen bg-secondary p-4 sm:p-6 md:p-8 font-sans">
      <Toaster />
      <header className="w-full max-w-4xl mx-auto mb-6 text-center">
        <div className="flex justify-end items-center mb-4">
          {authLoading ? (
            <Button variant="outline" disabled>
              <Icons.spinner className="mr-2 h-4 w-4 animate-spin" /> Loading...
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

// export default function Home() {
//   // For now, Home can just directly render HomePage or wrap it with providers if needed later
//   return <HomePage />;
// }
// Removing the redundant Home component wrapper, HomePage can be the default export directly.

    