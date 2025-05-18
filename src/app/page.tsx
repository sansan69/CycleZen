
"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
} from "firebase/firestore";
import {
  GoogleMap,
  Polyline,
  Marker,
  Autocomplete,
  useJsApiLoader,
  Circle,
} from "@react-google-maps/api";


import { db } from "@/lib/firebase";
import {
  signInWithGoogle,
  signOutUser,
  onAuthUserChanged
} from "@/lib/firebaseAuthService";
import { getCyclingRoutes, Coordinate, CyclingRoute, RouteStep } from "@/services/open-route-service";

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import GoogleMapComponent from "@/components/google-map";


const GOOGLE_MAPS_LIBRARIES = ['places', 'geometry'] as ('places' | 'geometry')[];
const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

const formatTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [
    h > 0 ? h.toString().padStart(2, '0') : null,
    m.toString().padStart(2, '0'),
    s.toString().padStart(2, '0'),
  ].filter(Boolean).join(':');
};

const estimateCaloriesBurned = (distanceKm: number | undefined): string => {
  if (typeof distanceKm !== 'number' || !isFinite(distanceKm) || distanceKm <= 0) {
    return 'N/A';
  }
  // Very rough estimate: ~60 calories per km for moderate cycling.
  // This can vary wildly based on intensity, rider weight, terrain, etc.
  const calories = Math.round(distanceKm * 60);
  return calories.toLocaleString();
};


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
  const mapRef = useRef<google.maps.Map | null>(null);

  // Ride Mode State
  const [isRideModeActive, setIsRideModeActive] = useState(false);
  const [isRidePaused, setIsRidePaused] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0); // in seconds
  const rideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const rideStartTimeRef = useRef<number | null>(null);
  const [userLocationMarker, setUserLocationMarker] = useState<Coordinate | null>(null);
  const locationWatcherIdRef = useRef<number | null>(null);
  const [showStartRideDialog, setShowStartRideDialog] = useState(false);
  const [rideStartActualLocation, setRideStartActualLocation] = useState<Coordinate | null>(null);


  // Ride Summary State
  const [showRideSummaryDialog, setShowRideSummaryDialog] = useState(false);
  const [rideSummaryData, setRideSummaryData] = useState<{
    elapsedTime: number;
    route: CyclingRoute;
    actualDistanceCoveredKm?: number;
    estimatedCalories: string;
  } | null>(null);
  const mapRefSummary = useRef<google.maps.Map | null>(null);


  const mapStyles = {
    height: "300px",
    width: "100%",
  };
  
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

  const onMapLoadSummary = useCallback((map: google.maps.Map, currentRoute: CyclingRoute) => {
    mapRefSummary.current = map; 
    if (currentRoute.coordinates && currentRoute.coordinates.length > 0 && google.maps.LatLngBounds) {
      const bounds = new google.maps.LatLngBounds();
      currentRoute.coordinates.forEach(coord => {
        bounds.extend(new google.maps.LatLng(coord.lat, coord.lng));
      });
      map.fitBounds(bounds);
    }
  }, []);


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
      
      const routeDataToSave: any = {
        distance: route.distance,
        estimatedTime: route.estimatedTime,
        coordinates: route.coordinates, 
        steps: route.steps || [],
      };
      
      if (route.ascent !== undefined && isFinite(route.ascent)) {
        routeDataToSave.ascent = route.ascent;
      }      

      await addDoc(userSavedRoutesCollection, {
        routeData: routeDataToSave,
        timestamp: serverTimestamp(),
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
      } else if (error.message && error.message.toLowerCase().includes("unsupported field value: undefined")) {
         description = "Failed to save route: The route data contains an undefined value that cannot be stored.";
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

  const startRide = () => {
    setIsRideModeActive(true);
    setIsRidePaused(false);
    rideStartTimeRef.current = Date.now() - elapsedTime * 1000; 
    setElapsedTime(0); 
    
    if (userLocationMarker) { 
        setRideStartActualLocation(userLocationMarker);
    } else {
        setRideStartActualLocation(null); 
    }


    if (rideTimerRef.current) clearInterval(rideTimerRef.current);
    rideTimerRef.current = setInterval(() => {
      if (rideStartTimeRef.current && !isRidePaused) { 
        setElapsedTime(Math.floor((Date.now() - rideStartTimeRef.current) / 1000));
      }
    }, 1000);

    if (navigator.geolocation) {
      locationWatcherIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          setUserLocationMarker({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error("Error watching location:", error);
          toast({ title: "Location Error", description: "Could not track your location.", variant: "destructive"});
          setUserLocationMarker(null);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
    } else {
      toast({ title: "Location Services", description: "Geolocation is not supported by your browser.", variant: "destructive"});
    }
    setShowStartRideDialog(false);
  };
  
  useEffect(() => {
    if (isRideModeActive && !isRidePaused && rideStartTimeRef.current) {
        if (rideTimerRef.current) clearInterval(rideTimerRef.current); 
        rideTimerRef.current = setInterval(() => {
            setElapsedTime(Math.floor((Date.now() - (rideStartTimeRef.current ?? Date.now())) / 1000));
        }, 1000);
    } else if (rideTimerRef.current) {
        clearInterval(rideTimerRef.current);
    }

    return () => { 
        if (rideTimerRef.current) clearInterval(rideTimerRef.current);
        if (locationWatcherIdRef.current) {
            navigator.geolocation.clearWatch(locationWatcherIdRef.current);
        }
    };
  }, [isRideModeActive, isRidePaused]); 

  const handlePauseResumeRide = () => {
    setIsRidePaused(prev => {
      const newPausedState = !prev;
      if (newPausedState) { 
        if (rideTimerRef.current) clearInterval(rideTimerRef.current);
      } else { 
        rideStartTimeRef.current = Date.now() - elapsedTime * 1000; 
      }
      return newPausedState;
    });
  };

  const handleStopRide = () => {
    let actualDistanceCoveredKm: number | undefined = undefined;

    if (rideStartActualLocation && userLocationMarker && window.google && window.google.maps && window.google.maps.geometry && window.google.maps.geometry.spherical) {
        const startLatLng = new google.maps.LatLng(rideStartActualLocation.lat, rideStartActualLocation.lng);
        const endLatLng = new google.maps.LatLng(userLocationMarker.lat, userLocationMarker.lng);
        const distanceMeters = google.maps.geometry.spherical.computeDistanceBetween(startLatLng, endLatLng);
        actualDistanceCoveredKm = distanceMeters / 1000;
    }

    setIsRideModeActive(false);
    setIsRidePaused(false);
    if (rideTimerRef.current) clearInterval(rideTimerRef.current);
    if (locationWatcherIdRef.current) navigator.geolocation.clearWatch(locationWatcherIdRef.current);
    locationWatcherIdRef.current = null;
    
    setRideSummaryData({ 
        elapsedTime, 
        route,
        actualDistanceCoveredKm,
        estimatedCalories: estimateCaloriesBurned(actualDistanceCoveredKm ?? route.distance)
    });
    setShowRideSummaryDialog(true);
  };

  const handleSaveCompletedRide = async () => {
    if (!user || !user.uid || !rideSummaryData) {
      toast({
        title: "Error",
        description: "User not logged in or no ride data to save.",
        variant: "destructive",
      });
      return;
    }
    if (!db) {
      toast({ title: "Database Error", description: "Firestore not available.", variant: "destructive" });
      return;
    }

    try {
      const completedRidesCollection = collection(db, "users", user.uid, "completedRides");
      const rideDataToSave: any = {
        routeName: `Ride near ${selectedLocationForRouteName ? `${selectedLocationForRouteName.lat.toFixed(2)}, ${selectedLocationForRouteName.lng.toFixed(2)}` : 'selected area'} on ${new Date().toLocaleDateString()}`,
        completedAt: serverTimestamp(),
        actualDurationSeconds: rideSummaryData.elapsedTime,
        plannedDistanceKm: rideSummaryData.route.distance,
        estimatedCalories: rideSummaryData.estimatedCalories,
        routeCoordinates: rideSummaryData.route.coordinates,
        steps: rideSummaryData.route.steps || [],
      };

      if (rideSummaryData.actualDistanceCoveredKm !== undefined && isFinite(rideSummaryData.actualDistanceCoveredKm)) {
        rideDataToSave.actualDistanceCoveredKm = rideSummaryData.actualDistanceCoveredKm;
      }
      if (rideSummaryData.route.ascent !== undefined && isFinite(rideSummaryData.route.ascent)) {
        rideDataToSave.ascent = rideSummaryData.route.ascent;
      }
      
      await addDoc(completedRidesCollection, rideDataToSave);
      toast({ title: "Ride Saved", description: "Your completed ride has been saved to your dashboard." });
    } catch (error: any) {
      console.error("Error saving completed ride:", error);
      toast({ title: "Save Error", description: "Failed to save completed ride.", variant: "destructive" });
    }
  };

  const mapInitialCenter = (route.coordinates && route.coordinates.length > 0 ? route.coordinates[0] : { lat: 0, lng: 0 });

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
              <p className="font-semibold text-lg">{route.ascent !== undefined && isFinite(route.ascent) ? route.ascent.toFixed(0) : 'N/A'} m</p>
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
        {googleMapsApiKey ? (
          <div className="rounded-md overflow-hidden border border-border">
            <GoogleMap
              mapContainerStyle={mapStyles}
              center={mapInitialCenter}
              options={{
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: true,
                gestureHandling: 'cooperative'
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
              {isRideModeActive && userLocationMarker && (
                 <Marker
                    position={userLocationMarker}
                    icon={{
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 7,
                        fillColor: "hsl(var(--accent))",
                        fillOpacity: 1,
                        strokeWeight: 2,
                        strokeColor: "white",
                    }}
                    title="Your Location"
                 />
              )}
            </GoogleMap>
          </div>
        ) : (
          <Skeleton className="h-[300px] w-full bg-muted" />
        )}

        {isRideModeActive && (
            <div className="mt-4 p-3 bg-muted rounded-md border border-border">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-semibold text-primary">Ride Active</h3>
                    <p className="text-xl font-bold text-foreground">{formatTime(elapsedTime)}</p>
                </div>
                <div className="flex gap-2 mt-2">
                    <Button onClick={handlePauseResumeRide} variant="outline" className="flex-1">
                        {isRidePaused ? <Icons.play className="mr-2 h-4 w-4" /> : <Icons.pause className="mr-2 h-4 w-4" />}
                        {isRidePaused ? "Resume" : "Pause"}
                    </Button>
                    <Button onClick={handleStopRide} variant="destructive" className="flex-1">
                        <Icons.stop className="mr-2 h-4 w-4" /> Stop Ride
                    </Button>
                </div>
            </div>
        )}

        {isRideModeActive && route.steps && route.steps.length > 0 && (
          <div className="mt-4">
            <h4 className="text-md font-semibold text-foreground mb-2">Turn Instructions:</h4>
            <ScrollArea className="h-[200px] w-full rounded-md border p-3 bg-background">
              <ol className="list-decimal list-inside space-y-1.5 text-sm">
                {route.steps.map((step, idx) => (
                  <li key={idx}>
                    {step.instruction} ({step.distance.toFixed(0)}m)
                  </li>
                ))}
              </ol>
            </ScrollArea>
          </div>
        )}

      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row justify-between gap-2 pt-4">
        <div className="flex gap-2 flex-wrap justify-center sm:justify-start">
          {!isRideModeActive && (
            <Button onClick={() => setShowStartRideDialog(true)} variant="accent">
              <Icons.play className="mr-2 h-4 w-4" /> Start Ride
            </Button>
          )}
           <Button asChild variant="outline" className="border-accent text-accent hover:bg-accent/10">
            <a href={routeUrl} target='_blank' rel="noopener noreferrer">Open in Google Maps</a>
          </Button>
        </div>
        
        <div className="flex gap-2 flex-wrap justify-center sm:justify-end">
          <Button onClick={handleShareRoute} variant="outline" className="hover:bg-secondary/80">
            <Icons.share className="mr-2 h-4 w-4" /> Share
          </Button>
          <Button
            onClick={handleSaveRoute}
            disabled={!user || !user.uid || isRideModeActive}
            className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
          >
            <Icons.bookmark className="mr-2 h-4 w-4" /> Save this route
          </Button>
        </div>
      </CardFooter>
       <AlertDialog open={showStartRideDialog} onOpenChange={setShowStartRideDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start Navigation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will start tracking your location and a timer for your ride. Ensure location permissions are enabled.
              This is a basic visual guide; for full voice navigation, use "Open in Google Maps".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={startRide}>Start Ride</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showRideSummaryDialog} onOpenChange={setShowRideSummaryDialog}>
        <AlertDialogContent className="max-w-lg w-full">
          <AlertDialogHeader>
            <AlertDialogTitle>Ride Summary</AlertDialogTitle>
            <AlertDialogDescription>
              Here&apos;s a summary of your completed ride.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {rideSummaryData && (
            <div className="space-y-4 my-4 p-4 bg-background rounded border border-border">
              <div className="h-64 w-full rounded-md overflow-hidden border border-border">
                {googleMapsApiKey ? (
                  <GoogleMap
                    mapContainerStyle={{ height: "100%", width: "100%" }}
                    options={{
                      streetViewControl: false,
                      mapTypeControl: false,
                      fullscreenControl: false, 
                      gestureHandling: 'cooperative'
                    }}
                    onLoad={(map) => onMapLoadSummary(map, rideSummaryData.route)}
                  >
                    {rideSummaryData.route.coordinates && rideSummaryData.route.coordinates.length > 0 && (
                      <>
                        <Polyline
                          path={rideSummaryData.route.coordinates}
                          options={{
                            strokeColor: "hsl(var(--primary))",
                            strokeWeight: 3,
                            strokeOpacity: 0.8
                          }}
                        />
                        <Marker position={rideSummaryData.route.coordinates[0]} />
                      </>
                    )}
                  </GoogleMap>
                ) : (
                  <Skeleton className="h-full w-full bg-muted" />
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 text-center pt-2">
                <div>
                  <p className="text-2xl font-bold text-primary">{formatTime(rideSummaryData.elapsedTime)}</p>
                  <p className="text-sm text-muted-foreground">Duration</p>
                </div>
                
                {rideSummaryData.actualDistanceCoveredKm !== undefined ? (
                    <div>
                      <p className="text-2xl font-bold text-primary">{rideSummaryData.actualDistanceCoveredKm.toFixed(1)} km</p>
                      <p className="text-sm text-muted-foreground">Actual Distance Covered</p>
                    </div>
                ) : (
                    <div>
                        <p className="text-2xl font-bold text-primary">N/A</p>
                        <p className="text-sm text-muted-foreground">Actual Distance Covered</p>
                    </div>
                )}

                <div>
                  <p className="text-2xl font-bold text-primary">
                    {rideSummaryData.estimatedCalories}
                  </p>
                  <p className="text-sm text-muted-foreground">Est. Calories</p>
                </div>

                {(rideSummaryData.actualDistanceCoveredKm === undefined || rideSummaryData.actualDistanceCoveredKm.toFixed(1) !== rideSummaryData.route.distance.toFixed(1)) && (
                     <div className="mt-1">
                        <p className="text-base font-semibold text-primary">{rideSummaryData.route.distance.toFixed(1)} km</p>
                        <p className="text-xs text-muted-foreground">Total Planned Route Distance</p>
                    </div>
                )}
              </div>
            </div>
          )}
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button 
              variant="outline" 
              onClick={() => {
                handleSaveCompletedRide();
                setShowRideSummaryDialog(false);
                setRideSummaryData(null); 
                setElapsedTime(0); 
                setRideStartActualLocation(null); 
              }}
              disabled={!user || !rideSummaryData}
              className="w-full sm:w-auto"
            >
              Save Ride & Done
            </Button>
            <AlertDialogAction onClick={() => {
              setShowRideSummaryDialog(false);
              setRideSummaryData(null); 
              setElapsedTime(0); 
              setRideStartActualLocation(null); 
            }}
            className="w-full sm:w-auto"
            >
              Done (Don't Save)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

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
                Target Loop Distance (approx. km)
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
                  aria-label="Target loop distance slider"
                />
                <span className="text-sm font-medium text-foreground w-full sm:w-12 text-center sm:text-right mt-2 sm:mt-0">
                  {isRadiusValid(radius) ? `${radius} km` : (radius === "" ? "" : "")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Enter a target distance between 5 and 100 km for your loop ride.
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
