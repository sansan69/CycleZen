"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import type { User } from "firebase/auth";
import {
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  GoogleMap,
  Polyline,
  Marker,
} from "@react-google-maps/api";

import { db } from "@/lib/firebase";
import {
  Coordinate,
  CyclingRoute,
} from "@/features/route-generation/services/open-route-service";
import { downloadGpx } from "@/features/route-generation/services/gpx-service";
import { detectSurfaceType } from "@/features/route-generation/services/surface-service";
import { formatDuration, estimateCalories, classifyDifficulty } from "@/shared/lib/utils";
import { useGoogleMaps } from "@/features/map/hooks/useGoogleMaps";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Icons } from "@/components/icons";
import { useToast } from "@/hooks/use-toast";

interface RouteCardProps {
  route: CyclingRoute;
  user: User | null;
  selectedLocationForRouteName: Coordinate | null;
  routeIndex: number;
}

export const RouteCard = React.memo(function RouteCard({
  route,
  user,
  selectedLocationForRouteName,
  routeIndex,
}: RouteCardProps) {
  const { toast } = useToast();
  const { googleMapsApiKey } = useGoogleMaps();
  const mapRef = useRef<google.maps.Map | null>(null);
  const rideSummaryContentRef = useRef<HTMLDivElement>(null);

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
    estimatedCalories: number;
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
          waypointsForGoogleMaps[waypointsForGoogleMaps.length - 1].lat !== endPoint.lat &&
          waypointsForGoogleMaps[waypointsForGoogleMaps.length - 1].lng !== endPoint.lng)) {

        if (waypointsForGoogleMaps.length === MAX_GOOGLE_MAPS_WAYPOINTS) {
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
      const end = waypointsForGoogleMaps[waypointsForGoogleMaps.length - 1];
      const intermediate = waypointsForGoogleMaps.slice(1, -1);
      const trimmedIntermediate = intermediate.filter((_, idx) => idx % (Math.floor(intermediate.length / (MAX_GOOGLE_MAPS_WAYPOINTS - 2)) || 1) === 0).slice(0, MAX_GOOGLE_MAPS_WAYPOINTS - 2);
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
          toast({ title: "Location Error", description: "Could not track your location.", variant: "destructive" });
          setUserLocationMarker(null);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
    } else {
      toast({ title: "Location Services", description: "Geolocation is not supported by your browser.", variant: "destructive" });
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
      estimatedCalories: estimateCalories(actualDistanceCoveredKm ?? route.distance)
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
          <p>Difficulty: {classifyDifficulty(route.ascent ?? 0, route.distance)}</p>
          {route.steps && (
            <p>Route Type: {detectSurfaceType(route.ascent ?? 0, route.distance, route.steps.length)}</p>
          )}
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
              <p className="text-xl font-bold text-foreground">{formatDuration(elapsedTime)}</p>
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
          <Button onClick={() => downloadGpx(route.coordinates, `Route ${routeIndex + 1}`, route.ascent)} variant="outline" size="sm">
            <Icons.download className="mr-1 h-4 w-4" /> GPX
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
              This is a basic visual guide; for full voice navigation, use &quot;Open in Google Maps&quot;.
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
            <div ref={rideSummaryContentRef} className="space-y-4 my-4 p-4 bg-background rounded border border-border">
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
                  <p className="text-2xl font-bold text-primary">{formatDuration(rideSummaryData.elapsedTime)}</p>
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
                    {rideSummaryData.estimatedCalories.toLocaleString()}
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
              Done (Don&apos;t Save)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
});
