"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useState, useEffect, useCallback, useRef, ChangeEvent } from "react";
import type { User } from "firebase/auth";
import {
  collection,
  addDoc,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import {
  GoogleMap,
  Marker,
  Autocomplete,
  Circle,
} from "@react-google-maps/api";
import { db } from "@/lib/firebase";
import {
  signInWithGoogle,
  signOutUser,
  onAuthUserChanged
} from "@/features/auth/services/auth-service";
import { getCyclingRoutes, Coordinate, CyclingRoute, RouteStep } from "@/features/route-generation/services/open-route-service";
const WeatherWidget = dynamic(
  () => import("@/features/weather").then(mod => ({ default: mod.WeatherWidget })),
  { ssr: false }
);
import { useGoogleMaps } from "@/features/map/hooks/useGoogleMaps";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Toaster } from "@/components/ui/toaster";
import { Icons } from "@/components/icons";
import { useToast } from "@/hooks/use-toast";
const GoogleMapComponent = dynamic(
  () => import("@/components/google-map"),
  {
    loading: () => (
      <div className="flex items-center justify-center h-[400px] w-full bg-muted/50 rounded-md">
        <Icons.spinner className="h-8 w-8 animate-spin text-primary" />
      </div>
    ),
    ssr: false,
  });

import { useAppStore } from "@/stores";
import { RouteCard } from "@/features/route-generation/components/RouteCard";


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

  const { isLoaded, loadError, googleMapsApiKey } = useGoogleMaps();
  const { isDarkMode, toggleDarkMode } = useAppStore();

  const capitalizeName = (name: string | null | undefined): string => {
    if (!name) return "";
    return name
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };


  useEffect(() => {
    const envApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    const envProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const envAuthDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;

    if (!envApiKey || !envProjectId || !envAuthDomain) {
        const missingVars: string[] = [];
        if (!envApiKey) missingVars.push("API Key");
        if (!envProjectId) missingVars.push("Project ID");
        if (!envAuthDomain) missingVars.push("Auth Domain");

        const message = `CRITICAL: Firebase config missing from client environment: ${missingVars.join(", ")}. Authentication will be unavailable. Check .env.local and restart the server.`;
        toast({ title: "Configuration Error", description: message, variant: "destructive", duration: Infinity });
        console.error(message);
        setAuthLoading(false); 
        return;
    }
    console.log("--- Firebase Config from Client Environment ---");
    console.log("NEXT_PUBLIC_FIREBASE_API_KEY:", envApiKey ? "Present" : "MISSING or Empty");
    console.log("NEXT_PUBLIC_FIREBASE_PROJECT_ID:", envProjectId ? "Present" : "MISSING or Empty");
    console.log("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:", envAuthDomain ? "Present" : "MISSING or Empty");
    console.log("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:", process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ? "Present" : "Not Set (Optional)");
    console.log("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:", process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ? "Present" : "Not Set (Optional)");
    console.log("NEXT_PUBLIC_FIREBASE_APP_ID:", process.env.NEXT_PUBLIC_FIREBASE_APP_ID ? "Present" : "Not Set (Optional)");
    console.log("----------------------------------------------");

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
    setAuthLoading(true);
    try {
      const user = await signInWithGoogle();
      if (user) {
        console.log(`[handleGoogleSignIn] User signed in: ${user.uid}. Checking Firestore for profile.`);
        if (db) {
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
            toast({ title: "Signed In", description: `Welcome back, ${capitalizeName(userData.username || user.displayName || user.email)}!`});
          }
        } else {
          console.warn("[handleGoogleSignIn] User signed in, but DB instance was not available for profile check.");
          toast({ title: "Signed In", description: `Welcome, ${capitalizeName(user.displayName || user.email)}!`});
        }
      } else {
         console.warn("[handleGoogleSignIn] signInWithGoogle service returned null. This might indicate the popup was closed by the user or an issue in the service layer.");
         setAuthLoading(false); 
      }
    } catch (error: any) {
      console.error("[handleGoogleSignIn] Error from signInWithGoogle service or subsequent logic:", error);
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'unknown';
      let hostnameToAdd = 'localhost'; 
       try {
          if (typeof window !== 'undefined') {
            const url = new URL(currentOrigin);
            hostnameToAdd = url.hostname;
          }
        } catch(e) {
          console.warn("Could not parse hostname from currentOrigin", currentOrigin);
          hostnameToAdd = currentOrigin; 
        }

      if (error.code === 'auth/popup-closed-by-user') {
        toast({
          title: "Sign-in Cancelled",
          description: "The Google login window was closed before sign-in could complete.",
          variant: "default",
          duration: 5000
        });
      } else if (error.code === 'auth/unauthorized-domain') {
         const unauthorizedDomainDescription = `Error: Your app's current domain (${currentOrigin}, hostname: '${hostnameToAdd}') is not authorized for Google Sign-In.
        Configured Firebase Auth Domain: ${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'Not Set'}.
        Project ID: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'Not Set'}.
        Troubleshooting:
        1. In Firebase console > Project '${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'UNKNOWN'}' > Authentication > Settings > Authorized domains: Ensure '${hostnameToAdd}' is listed.
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
    setAuthLoading(true);
    try {
      await signOutUser();
      toast({ title: "Signed Out", description: "Successfully signed out." });
    } catch (error: any) {
      console.error("[handleSignOut] Error from signOutUser service:", error);
      toast({ title: "Sign-Out Error", description: error.message || "Failed to sign out.", variant: "destructive" });
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
        description: "Please select a starting point before generating routes.",
        variant: "destructive",
      });
      return;
    }

    if (!isRadiusValid(radius)) { 
       toast({
        title: "Invalid Target Distance",
        description: "Please enter a target loop distance between 5 and 100 km.",
        variant: "destructive",
      });
      return;
    }
    const numericRadius = parseInt(radius, 10); 

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
          description: "Could not find any cycling routes for the selected criteria. Try adjusting the distance or location.",
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
          description: `New starting point selected: ${selectedLocation.lat.toFixed(4)}, ${selectedLocation.lng.toFixed(4)}`,
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


  console.log("[HomePage Render] authLoading:", authLoading, "currentUser:", !!currentUser, currentUser);

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
           <div className="flex justify-between items-center w-full">
             <div className="w-10 sm:w-12"> {/* Invisible placeholder */} </div>

             <div className="flex-grow text-center">
                <span className="text-lg font-semibold text-primary">
                   Hi, {capitalizeName(currentUser.displayName || currentUser.email)}
                </span>
             </div>

             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Icons.menu className="h-5 w-5" />
                    <span className="sr-only">Open user menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="cursor-pointer">
                      <Icons.userCog className="mr-2 h-4 w-4" />
                      <span>View Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/saved-routes" className="cursor-pointer">
                      <Icons.list className="mr-2 h-4 w-4" />
                      <span>My Saved Routes</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard" className="cursor-pointer">
                      <Icons.dashboard className="mr-2 h-4 w-4" />
                      <span>Dashboard</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive">
                    <Icons.user className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="ghost" size="sm" onClick={toggleDarkMode} className="p-2 ml-1">
                {isDarkMode ? <Icons.moon className="h-4 w-4" /> : <Icons.light className="h-4 w-4" />}
              </Button>
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
              Select a starting point and target distance to find your next ride.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            {isLoaded && (
              <div className="grid gap-2">
                 <Label
                    htmlFor="location-search"
                    className="text-sm font-medium leading-none text-foreground"
                  >
                    Search for starting location
                  </Label>
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
              <Label
                htmlFor="radius"
                className="text-sm font-medium leading-none text-foreground"
              >
                Define Search Radius (km)
              </Label>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <Input
                  type="text" 
                  id="radius"
                  value={radius}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
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
                      toast({ title: "Invalid Distance", description: "Distance must be between 5 and 100 km.", variant: "destructive"});
                    } else {
                      setRadius(String(num)); 
                    }
                  }}
                  placeholder="5 - 100"
                  className="w-full sm:w-24 bg-background border-input focus:ring-primary focus:border-primary rounded-md"
                />
                <Slider
                  value={[isNaN(currentRadiusValue) || radius === "" || !isRadiusValid(radius) ? 5 : Math.max(5, Math.min(100, currentRadiusValue))]}
                  min={5}
                  max={100}
                  step={1}
                  onValueChange={(newValue) => setRadius(String(newValue[0]))}
                  className="w-full sm:flex-1"
                  aria-label="Search radius for loop routes"
                />
                <span className="text-sm font-medium text-foreground w-full sm:w-12 text-center sm:text-right mt-2 sm:mt-0">
                  {isRadiusValid(radius) ? `${radius} km` : (radius === "" ? "" : "")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                 This radius defines the search area on the map. Generated loop routes will have a target distance based on this value (5-100 km).
              </p>
            </div>
            
            {showMapInput && (
             <div className="rounded-lg overflow-hidden shadow-md border border-border">
                <GoogleMapComponent
                  onLocationSelected={handleLocationSelected}
                  searchRadiusKm={numericRadiusForMap}
                  isLoaded={isLoaded}
                  loadError={loadError}
                  initialLocation={selectedLocation}
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

            {selectedLocation && (
              <WeatherWidget location={selectedLocation} />
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
              <RouteCard key={index} route={route} user={currentUser} selectedLocationForRouteName={selectedLocation} routeIndex={index}/>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default HomePage;
