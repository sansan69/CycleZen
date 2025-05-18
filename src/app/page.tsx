
"use client";

import GoogleMapComponent from "@/components/google-map";
import { getCyclingRoutes, Coordinate, CyclingRoute } from "@/services/open-route-service";
import { useState, useEffect, useCallback, useRef } from "react";
import type { User } from "firebase/auth";
import {
  collection,
  addDoc,
  doc, 
  getDoc,
} from "firebase/firestore";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";


import { db } from "@/lib/firebase"; 
import { 
  signInWithGoogle, 
  signOutUser, 
  onAuthUserChanged 
} from "@/lib/firebaseAuthService";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
import { Slider } from "@/components/ui/slider"; 
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/toaster";
import { Icons } from "@/components/icons";
import { useToast } from "@/hooks/use-toast";

import {
  GoogleMap,
  Polyline,
  Autocomplete,
  useJsApiLoader,
  Marker,
} from "@react-google-maps/api";

const GOOGLE_MAPS_LIBRARIES = ['places', 'geometry'] as ('places' | 'geometry')[];

const RouteDisplay = ({
  route,
  user,
  selectedLocationForRouteName,
  routeIndex
}: {
  route: CyclingRoute;
  user: User | null;
  selectedLocationForRouteName: Coordinate | null; 
  routeIndex: number;
}) => {
  const { toast } = useToast();
  const [center, setCenter] = useState<Coordinate | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null); 

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
      setCenter({ lat: 0, lng: 0 }); 
    }
  }, [route]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    if (route.coordinates && route.coordinates.length > 0 && google.maps.LatLngBounds) {
      const bounds = new google.maps.LatLngBounds();
      route.coordinates.forEach(coord => {
        bounds.extend(new google.maps.LatLng(coord.lat, coord.lng));
      });
      map.fitBounds(bounds);
    }
  }, [route.coordinates]);

  useEffect(() => {
    if (mapRef.current && route.coordinates && route.coordinates.length > 0 && google.maps.LatLngBounds) {
      const bounds = new google.maps.LatLngBounds();
      route.coordinates.forEach(coord => {
        bounds.extend(new google.maps.LatLng(coord.lat, coord.lng));
      });
      mapRef.current.fitBounds(bounds);
    }
  }, [route.coordinates]);


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
        const end = waypointsForGoogleMaps[waypointsForGoogleMaps.length -1];
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
      // Exclude geometry from being saved
      const { geometry, ...routeDataToSave } = route; 

      await addDoc(userSavedRoutesCollection, {
        routeData: routeDataToSave, 
        timestamp: new Date(),
        routeName: `Route Option ${routeIndex + 1} near ${selectedLocationForRouteName ? `${selectedLocationForRouteName.lat.toFixed(2)}, ${selectedLocationForRouteName.lng.toFixed(2)}` : 'selected location'} on ${new Date().toLocaleDateString()}`,
        sharedUrl: routeUrl,
      });
      toast({
        title: "Route Saved",
        description: `Route Option ${routeIndex + 1} saved to your profile.`,
      });
    } catch (error: any) {
      console.error("Error saving route:", error);
      let description = "Failed to save route. Please try again.";
      if (error.message && error.message.toLowerCase().includes("nested arrays are not supported")) {
        description = "Failed to save route: The route data contains a structure not supported by the database (nested arrays).";
      } else if (error.message) {
        description = error.message;
      }
      toast({
        title: "Save Error",
        description: description,
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


  if (!center && !(route.coordinates && route.coordinates.length > 0)) { 
    return <Skeleton className="h-[400px] w-full" />;
  }

  const mapInitialCenter = center || (route.coordinates && route.coordinates.length > 0 ? route.coordinates[0] : { lat: 0, lng: 0 });


  return (
    <Card className="bg-card shadow-lg rounded-lg">
      <CardHeader>
        <CardTitle className="text-primary">Route Option {routeIndex + 1}</CardTitle>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-y-3 gap-x-2 text-sm">
          <div className="flex items-center">
            <Icons.route className="mr-2 h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="font-semibold text-lg">{route.distance.toFixed(1)} km</p>
              <p className="text-xs text-muted-foreground">Distance</p>
            </div>
          </div>
          <div className="flex items-center">
            <Icons.clock className="mr-2 h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="font-semibold text-lg">{route.estimatedTime.toFixed(0)} min</p>
              <p className="text-xs text-muted-foreground">Duration</p>
            </div>
          </div>
          <div className="flex items-center">
            <Icons.mountain className="mr-2 h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div>
              <p className="font-semibold text-lg">{route.ascent !== undefined ? route.ascent.toFixed(0) : 'N/A'} m</p>
              <p className="text-xs text-muted-foreground">Elevation</p>
            </div>
          </div>
        </div>
        <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
          <p>Difficulty: Moderate (est.)</p>
          <p>Route Type: Primarily Road</p>
        </div>
      </CardHeader>
      <CardContent>
        {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? (
          <div className="rounded-md overflow-hidden border border-border">
            <GoogleMap 
              mapContainerStyle={mapStyles} 
              center={mapInitialCenter} 
              options={{ 
                streetViewControl: false, 
                mapTypeControl: false, 
                fullscreenControl: true 
              }}
              onLoad={onMapLoad} 
            >
              {route.coordinates && route.coordinates.length > 0 && (
                <>
                  <Polyline 
                    path={route.coordinates} 
                    options={{ 
                      strokeColor: "hsl(var(--primary))", 
                      strokeWeight: 3, 
                      strokeOpacity: 0.8 
                    }} 
                  />
                  <Marker position={route.coordinates[0]} /> 
                </>
              )}
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
            <Icons.bookmark className="mr-2 h-4 w-4" /> Save this route
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

const HomePage = () => {
  const [radius, setRadius] = useState<string>("5"); 
  const [showMapInput, setShowMapInput] = useState<boolean>(true);
  const [routes, setRoutes] = useState<CyclingRoute[] | null>(null);
  const [loadingRoutes, setLoadingRoutes] = useState<boolean>(false);
  const { toast } = useToast();
  const [selectedLocation, setSelectedLocation] = useState<Coordinate | null>(null);
  const previousSelectedLocationRef = useRef<Coordinate | null>(null);
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const router = useRouter();

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: googleMapsApiKey,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  useEffect(() => {
    const envApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    const envProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const envAuthDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
    const envStorageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    const envMessagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
    const envAppId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

    console.log("--- Firebase Config from Client Environment ---");
    console.log("NEXT_PUBLIC_FIREBASE_API_KEY:", envApiKey ? "Present" : "MISSING or Empty");
    console.log("NEXT_PUBLIC_FIREBASE_PROJECT_ID:", envProjectId ? "Present" : "MISSING or Empty");
    console.log("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:", envAuthDomain ? "Present" : "MISSING or Empty");
    console.log("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:", envStorageBucket ? "Present" : "Not Set (Optional)");
    console.log("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:", envMessagingSenderId ? "Present" : "Not Set (Optional)");
    console.log("NEXT_PUBLIC_FIREBASE_APP_ID:", envAppId ? "Present" : "Not Set (Optional)");
    console.log("----------------------------------------------");
    
    let missingVars: string[] = [];
    if (!envApiKey) missingVars.push("API Key");
    if (!envProjectId) missingVars.push("Project ID");
    if (!envAuthDomain) missingVars.push("Auth Domain");

    if (missingVars.length > 0) {
        const message = `Critical Firebase config missing: ${missingVars.join(", ")}. Authentication will be unavailable. Please check your .env.local file and restart the server.`;
        toast({ title: "Configuration Error", description: message, variant: "destructive", duration: Infinity });
        console.error(`CRITICAL from page.tsx: ${message}`);
        setAuthLoading(false);
        return; 
    }
    
    console.log('page.tsx useEffect: Project ID from env is:', envProjectId);
    console.log('page.tsx useEffect: Auth Domain from env is:', envAuthDomain);

    const unsubscribe = onAuthUserChanged((user) => {
      setCurrentUser(user);
      setAuthLoading(false); 
      if (user) {
        console.log("page.tsx onAuthUserChanged: User signed in:", user.uid);
      } else {
        console.log("page.tsx onAuthUserChanged: User signed out or auth not initialized properly by service.");
      }
    });

    return () => unsubscribe();
  }, [toast]); 


  const handleGoogleSignIn = async () => {
    console.log("[handleGoogleSignIn] Attempting Google Sign-In via service.");
    setAuthLoading(true); 
    try {
      const user = await signInWithGoogle(); 
      console.log("[handleGoogleSignIn] signInWithGoogle service call completed. User from service:", user);
      
      if (user && db) {
        const userDocRef = doc(db, "users", user.uid);
        console.log(`[handleGoogleSignIn] Checking Firestore for user: ${user.uid}`);
        const docSnap = await getDoc(userDocRef);
        const userData = docSnap.data();
        console.log(`[handleGoogleSignIn] Firestore docSnap.exists(): ${docSnap.exists()}, userData:`, userData);

        if (!docSnap.exists() || !userData?.username) {
          console.log(`[handleGoogleSignIn] New user or profile incomplete. Redirecting to /profile.`);
          toast({ title: "Welcome!", description: "Please complete your profile." });
          router.push('/profile');
        } else {
          console.log(`[handleGoogleSignIn] Existing user with profile. No redirect needed from here.`);
          toast({ title: "Signed In", description: "Successfully signed in with Google." });
        }
      } else if (user) {
        console.warn("[handleGoogleSignIn] User signed in, but DB instance was not available OR user object was incomplete for profile check.");
        toast({ title: "Signed In", description: "Successfully signed in with Google." });
      }
      // onAuthUserChanged will set authLoading to false after currentUser is set.
    } catch (error: any) {
      console.error("[handleGoogleSignIn] Error from signInWithGoogle service or subsequent logic:", error);
      
      if (error.code === 'auth/popup-closed-by-user') {
        toast({
          title: "Sign-in Cancelled",
          description: "The Google login window was closed before sign-in could complete.",
          variant: "default", 
          duration: 5000
        });
      } else if (error.code === 'auth/unauthorized-domain') {
        const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'unknown';
        let hostnameToAdd = 'localhost'; 
        try {
          hostnameToAdd = new URL(currentOrigin).hostname;
        } catch(e) {
          console.warn("Could not parse hostname from currentOrigin", currentOrigin);
          hostnameToAdd = currentOrigin; 
        }
        const unauthorizedDomainDescription = `Error: Your app's current domain ('${hostnameToAdd}') is not authorized for Google Sign-In. 
        Current Origin: ${currentOrigin}. Configured Firebase Auth Domain: ${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'Not Set'}.
        Project ID: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'Not Set'}.
        Troubleshooting:
        1. In Firebase console > Project '${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'UNKNOWN'}' > Authentication > Settings > Authorized domains: Ensure '${hostnameToAdd}' (and 'localhost' if developing locally) is listed.
        2. Verify NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN in your .env.local file matches your Firebase project's Auth Domain.
        3. Verify all NEXT_PUBLIC_FIREBASE_* vars in .env.local are correct for the project.
        4. Restart your Next.js dev server after .env.local changes.`;
        toast({ title: "Sign-in Error: Unauthorized Domain", description: unauthorizedDomainDescription, variant: "destructive", duration: 15000 });
      } else {
        toast({ title: "Sign-in Error", description: `Code: ${error.code || 'N/A'}. Message: ${error.message || 'Failed to sign in.'}`, variant: "destructive", duration: 10000 });
      }
      setAuthLoading(false); 
    }
  };

  const handleSignOut = async () => {
    console.log("[handleSignOut] Attempting Sign-Out via service.");
    setAuthLoading(true);
    try {
      await signOutUser();
      toast({ title: "Signed Out", description: "Successfully signed out." });
    } catch (error: any) {      
      console.error("[handleSignOut] Error from signOutUser service:", error);
      toast({ title: "Sign-Out Error", description: error.message || "Failed to sign out.", variant: "destructive" });
      setAuthLoading(false); 
    }
  };

  const isRadiusValid = (r: string): boolean => {
    if (r === "") return false; 
    const num = parseInt(r, 10);
    return !isNaN(num) && num >= 5 && num <= 100;
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

    const numericRadius = parseInt(radius, 10);
    if (!isRadiusValid(radius)) {
       toast({
        title: "Invalid Radius",
        description: "Please enter a radius between 5 and 100 km.",
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
      const generatedRoutes = await getCyclingRoutes(selectedLocation, numericRadius, 3);
      setRoutes(generatedRoutes);
      if (generatedRoutes && generatedRoutes.length > 0) {
        setShowMapInput(false); 
        if (searchInputRef.current) {
          searchInputRef.current.value = ''; 
        }
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
    } catch (error: any)      {
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
  
  const handleLocationSelected = useCallback((locationFromMap: Coordinate) => {
    setSelectedLocation(locationFromMap);
  }, []); 

  useEffect(() => {
    if (selectedLocation && previousSelectedLocationRef.current) { 
      if (previousSelectedLocationRef.current.lat !== selectedLocation.lat ||
          previousSelectedLocationRef.current.lng !== selectedLocation.lng) {
        toast({
          title: 'Location Updated',
          description: `New location selected: ${selectedLocation.lat.toFixed(4)}, ${selectedLocation.lng.toFixed(4)}`,
        });
      }
    }
    previousSelectedLocationRef.current = selectedLocation; 
  }, [selectedLocation, toast]); 

  const currentRadiusValue = parseInt(radius, 10);
  const displayRadius = !isNaN(currentRadiusValue) && currentRadiusValue >=5 && currentRadiusValue <=100 ? currentRadiusValue : (radius === "" ? "" : 5);
  const numericRadiusForMap = isRadiusValid(radius) ? parseInt(radius, 10) : null;

  const onLoadAutocomplete = (autocompleteInstance: google.maps.places.Autocomplete) => {
    setAutocomplete(autocompleteInstance);
  };

  const onPlaceChanged = () => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace();
      if (place.geometry && place.geometry.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        if (lat && lng) {
          setSelectedLocation({ lat, lng });
           if (searchInputRef.current) {
            searchInputRef.current.value = place.formatted_address || '';
          }
        } else {
            toast({
                title: "Invalid Location Data",
                description: "The selected place did not provide valid coordinates.",
                variant: "destructive",
            });
        }
      } else {
        toast({
          title: "Location Not Found",
          description: "Could not find the selected location's details. Please try again.",
          variant: "destructive",
        });
      }
    } else {
      console.log('Autocomplete is not loaded yet for onPlaceChanged!');
    }
  };
  
  const capitalizeName = (name: string | null | undefined): string => {
    if (!name) return "";
    return name
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  console.log("[HomePage Render] authLoading:", authLoading, "currentUser:", !!currentUser);

  return (
    <div className="flex flex-col min-h-screen bg-secondary font-sans">
      <Toaster />
      
      <div className="relative w-full h-52 sm:h-64 md:h-80 group shadow-lg">
        <Image
          src="https://img.redbull.com/images/c_crop,w_4927,h_2464,x_0,y_632/c_auto,w_1200,h_600/f_auto,q_auto/redbullcom/2016/02/16/1331777047411_1/a-pair-of-mountain-bikers-riding-in-the-dolomites-range-in-noertheastern-italy"
          alt="Cyclist riding on a scenic route at sunset"
          fill
          style={{ objectFit: 'cover' }}
          priority
          data-ai-hint="cycle background"
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-primary/80 p-4">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white text-center leading-tight">
            CycleZen
          </h1>
          <p className="text-md sm:text-lg text-gray-200 mt-2 text-center max-w-xl">
            Your companion for discovering and sharing amazing cycling routes.
          </p>
        </div>
      </div>

      <header className="w-full max-w-2xl mx-auto py-4 px-4 sm:px-6 md:px-8">
        {authLoading ? (
          <div className="flex justify-center items-center py-2">
            <Button variant="outline" disabled className="w-full sm:w-auto">
              <Icons.spinner className="mr-2 h-4 w-4 animate-spin" /> Loading Auth...
            </Button>
          </div>
        ) : currentUser ? (
           <div className="flex flex-col sm:grid sm:grid-cols-[auto_1fr_auto] items-center gap-3 w-full">
            <div className="w-full sm:w-auto order-2 sm:order-1 sm:justify-self-start">
              <Link href="/saved-routes" passHref>
                <Button variant="outline" className="w-full">
                  <Icons.list className="mr-2 h-4 w-4" /> My Saved Routes
                </Button>
              </Link>
            </div>
            <div className="text-sm text-foreground text-center order-1 sm:order-2 py-1 sm:py-0">
              <Link href="/profile" passHref>
                <span className="cursor-pointer hover:underline hover:text-primary">
                  Hi, {capitalizeName(currentUser.displayName || currentUser.email)}
                </span>
              </Link>
            </div>
            <div className="w-full sm:w-auto order-3 sm:order-3 sm:justify-self-end">
              <Button variant="outline" onClick={handleSignOut} className="w-full">
                <Icons.user className="mr-2 h-4 w-4" /> Logout
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-center items-center py-2">
            <Button variant="outline" onClick={handleGoogleSignIn} className="w-full sm:w-auto">
               <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 381.5 512 244 512 110.3 512 0 399.4 0 258.9 0 123.4 104.8 0 241.3 0c65.9 0 120.6 23.8 163.2 64.8l-66.6 52.9C285.5 91.7 257.9 80.5 230.2 80.5c-70.1 0-121.1 55.4-121.1 124.9s50.9 124.9 121.1 124.9c79.9 0 112.9-56.6 116.2-84H229.6v-64.9h153.3c2.7 14.5 5.1 30.4 5.1 46.5z"></path></svg>
              Login with Google
            </Button>
          </div>
        )}
      </header>
      
      <main className="container mx-auto max-w-2xl p-4 sm:p-6 md:p-8">
        <Card className="mb-6 bg-card shadow-xl rounded-xl">
          <CardHeader>
            <CardTitle className="text-2xl text-primary">Route Generation</CardTitle>
            <CardDescription className="text-muted-foreground">
              Select a starting point and radius to find your next ride.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            {isLoaded && (
              <div className="grid gap-2">
                 <label
                    htmlFor="location-search"
                    className="text-sm font-medium leading-none text-foreground"
                  >
                    Search for starting location
                  </label>
                <Autocomplete
                  onLoad={onLoadAutocomplete}
                  onPlaceChanged={onPlaceChanged}
                  options={{ types: ['geocode', 'establishment'] }}
                >
                  <Input
                    type="text"
                    id="location-search"
                    placeholder="Enter a location or address"
                    ref={searchInputRef}
                    className="bg-background border-input focus:ring-primary focus:border-primary rounded-md"
                  />
                </Autocomplete>
              </div>
            )}
            {!isLoaded && !loadError && (
                 <Skeleton className="h-10 w-full" />
            )}
            {loadError && (
                <p className="text-sm text-destructive">Could not load Google Maps search. Please check your API key and internet connection.</p>
            )}

            <div className="grid gap-2">
              <label
                htmlFor="radius"
                className="text-sm font-medium leading-none text-foreground"
              >
                Radius for route length (km)
              </label>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <Input
                  type="text" 
                  id="radius"
                  value={radius}
                   onChange={(e) => {
                    const value = e.target.value;
                    if (value === "" || /^\d*$/.test(value)) {
                      setRadius(value);
                    }
                  }}
                  onBlur={() => {
                    if (radius === "") return; 
                    const num = parseInt(radius, 10);
                    if (isNaN(num) || num < 5 || num > 100) {
                      setRadius(""); 
                    } else {
                      setRadius(String(num)); 
                    }
                  }}
                  placeholder="5 - 100"
                  className="w-full sm:w-24 bg-background border-input focus:ring-primary focus:border-primary rounded-md"
                />
                <Slider
                  value={[isNaN(currentRadiusValue) || radius === "" ? 5 : Math.max(5, Math.min(100, currentRadiusValue))]}
                  min={5}
                  max={100}
                  step={1}
                  onValueChange={(newValue) => setRadius(String(newValue[0]))}
                  className="w-full sm:flex-1"
                  aria-label="Radius slider"
                />
                <span className="text-sm font-medium text-foreground w-full sm:w-12 text-center sm:text-right mt-2 sm:mt-0">
                  {displayRadius}{radius !== "" && isRadiusValid(radius) ? " km" : ""}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Enter a radius between 5 and 100 km.
              </p>
            </div>

            {showMapInput && (
             <div className="rounded-lg overflow-hidden shadow-md border border-border">
                <GoogleMapComponent
                  onLocationSelected={handleLocationSelected}
                  googleMapsApiKey={googleMapsApiKey}
                  searchRadiusKm={numericRadiusForMap}
                  isLoaded={isLoaded}
                  loadError={loadError}
                  initialLocation={selectedLocation}
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
            <Button 
              onClick={handleGenerateRoutes} 
              disabled={loadingRoutes || !selectedLocation || !isRadiusValid(radius)} 
              variant="accent"
              className="w-full"
            >
              {loadingRoutes ? (
                <><Icons.bike className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
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
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-5 duration-500">
             <Button onClick={() => { setShowMapInput(true); setRoutes(null); }} variant="outline" className="mb-4 flex items-center">
              <Icons.arrowLeft className="mr-2 h-4 w-4" /> Back to Location Select
            </Button>
            {routes.map((route, index) => (
              <RouteDisplay key={index} route={route} user={currentUser} selectedLocationForRouteName={selectedLocation} routeIndex={index}/>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default HomePage;
    
