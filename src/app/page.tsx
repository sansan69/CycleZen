
"use client";

import GoogleMapComponent from "@/components/google-map";
import { getCyclingRoutes, Coordinate, CyclingRoute } from "@/services/open-route-service";
import { useState, useEffect, useCallback } from "react";
import {
  collection,
  addDoc,
  Firestore,
  getFirestore,
} from "firebase/firestore";

import { app } from "@/lib/firebase.ts";
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
  LoadScript
} from "@react-google-maps/api";


const RouteDisplay = ({
  route,
  user,
}: {
  route: CyclingRoute;
  user: any; // This will eventually be a Firebase User object or similar
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
      waypointsForGoogleMaps.push(route.coordinates[0]); 

      const numIntermediatePoints = MAX_GOOGLE_MAPS_WAYPOINTS - 2;
      const totalRoutePoints = route.coordinates.length;
      const step = Math.floor((totalRoutePoints - 1) / (numIntermediatePoints + 1));

      for (let i = 1; i <= numIntermediatePoints; i++) {
        const waypointIndex = i * step;
        if (waypointIndex < totalRoutePoints -1) { 
           waypointsForGoogleMaps.push(route.coordinates[waypointIndex]);
        }
      }
      waypointsForGoogleMaps.push(route.coordinates[totalRoutePoints - 1]); 
    }
  }
  
  const origin = waypointsForGoogleMaps.length > 0 ? `${waypointsForGoogleMaps[0].lat},${waypointsForGoogleMaps[0].lng}` : "";
  const destination = waypointsForGoogleMaps.length > 1 ? `${waypointsForGoogleMaps[waypointsForGoogleMaps.length - 1].lat},${waypointsForGoogleMaps[waypointsForGoogleMaps.length - 1].lng}` : origin;
  
  const googleMapsWaypointsString = waypointsForGoogleMaps.length > 2 
    ? waypointsForGoogleMaps.slice(1, -1).map(coord => `${coord.lat},${coord.lng}`).join('|')
    : "";

  const routeUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${googleMapsWaypointsString}&travelmode=cycling`;


  const handleSaveRoute = async () => {
    if (!user || !user.uid) { // Check for user and user.uid
      toast({
        title: "Authentication Required",
        description: "Please log in to save routes.",
        variant: "destructive",
      });
      return;
    }
    const db: Firestore = getFirestore(app);
    try {
      const docRef = await addDoc(collection(db, "routes"), {
        userId: user.uid,
        routeData: { // Storing the structured route data
          distance: route.distance,
          estimatedTime: route.estimatedTime,
          coordinates: route.coordinates,
          geometry: route.geometry, // Save geometry if available
        },
        timestamp: new Date(),
      });
      toast({
        title: "Route Saved",
        description: `Route saved successfully.`, // Simplified message
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
    <Card>
      <CardHeader>
        <CardTitle>Route Option</CardTitle>
        <CardDescription>
          Distance: {route.distance.toFixed(2)} km, Duration:{" "}
          {route.estimatedTime.toFixed(0)} min
        </CardDescription>
      </CardHeader>
      <CardContent>
        {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && center ? (
          <GoogleMap mapContainerStyle={mapStyles} zoom={10} center={center} >
            <Polyline path={route.coordinates} options={{ strokeColor: "#FF0000", strokeWeight: 2 }} />
          </GoogleMap>
        ) : (
          <Skeleton className="h-[300px] w-full" />
        )}
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row justify-between gap-2">
        <Button asChild variant="outline">
          <a href={routeUrl} target='_blank' rel="noopener noreferrer">Open in Google Maps</a>
        </Button>
        <div className="flex gap-2">
          <Button onClick={handleShareRoute} variant="outline">
            <Icons.share className="mr-2 h-4 w-4" /> Share
          </Button>
          <Button onClick={handleSaveRoute} disabled={!user || !user.uid}>Save this route</Button>
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
  const [loading, setLoading] = useState<boolean>(false);
  const { toast } = useToast();
  const [selectedLocation, setSelectedLocation] = useState<Coordinate | null>(null);

  // TODO: Replace with actual Firebase authentication state
  const user = null; // Placeholder: Implement Firebase Auth to get the logged-in user
                     // Example: const { user } = useAuth(); (if using a custom auth hook)

  const handleGenerateRoutes = useCallback(async () => {
    if (!selectedLocation) {
      toast({
        title: "Location Required",
        description: "Please select a location before generating routes.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setRoutes(null);
    try {
      const apiKey = process.env.NEXT_PUBLIC_OPEN_ROUTE_SERVICE_API_KEY;
      if (!apiKey) {
        toast({
          title: "API Key Missing",
          description: "OpenRouteService API key is missing. Please configure it to generate routes.",
          variant: "destructive",
        });
        setLoading(false);
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
      setLoading(false);
    }
  }, [selectedLocation, radius, toast]);

  const handleLocationSelected = useCallback((location: Coordinate) => {
    setSelectedLocation(location);
    toast({
      title: 'Location Updated',
      description: `New location selected: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`,
    });
  }, [toast]);

  return (
    <div className="flex flex-col min-h-screen bg-secondary p-4">
      <Toaster />
      <div className="container mx-auto max-w-2xl">
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-primary">CycleZen</CardTitle>
            <CardDescription>
              Find your perfect cycling route.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
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
                onChange={(e) => setRadius(Number(e.target.value))}
                placeholder="Enter radius in km"
                className="bg-background border-input"
                min="1" 
              />
            </div>

            {showMapInput && (
             <GoogleMapComponent
               onLocationSelected={handleLocationSelected}
               googleMapsApiKey={googleMapsApiKey}
             />
            )}
            {!showMapInput && selectedLocation && (
              <div className="text-sm p-2 bg-muted rounded-md">
                <p className="font-semibold">Starting Location:</p>
                <p>Lat: {selectedLocation.lat.toFixed(4)}, Lng: {selectedLocation.lng.toFixed(4)}</p>
                 <Button variant="outline" size="sm" className="mt-2" onClick={() => setShowMapInput(true)}>Change Start Location</Button>
              </div>
            )}


            <Button
              onClick={handleGenerateRoutes}
              disabled={loading || !selectedLocation}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {loading ? (
                <>
                  <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Routes"
              )}
            </Button>
          </CardContent>
        </Card>

        {loading && (
          <div className="grid gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="bg-card">
                <CardHeader>
                  <CardTitle>
                    <Skeleton className="h-5 w-40 bg-muted" />
                  </CardTitle>
                  <CardDescription>
                    <Skeleton className="h-4 w-24 bg-muted" />
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-[300px] w-full bg-muted" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

         {!loading && routes && routes.length > 0 && (
          <div className="grid gap-4">
            {routes.map((route, index) => (
              <RouteDisplay key={index} route={route} user={user} />
            ))}
          </div>
        )}
        {!loading && routes && routes.length === 0 && (
           <Card className="bg-card">
            <CardContent className="p-6">
              <p className="text-muted-foreground">No routes found for the current selection. Try changing the location or radius.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function WrappedHomePage() {
  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    return (
      <div className="flex justify-center items-center min-h-screen p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-destructive">Configuration Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Google Maps API key is missing. Please set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your environment variables.</p>
            <p className="mt-2 text-sm text-muted-foreground">The map functionality cannot be loaded without this key.</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  return (
    <LoadScript googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY} libraries={['places']}>
      <HomePage />
    </LoadScript>
  );
}
