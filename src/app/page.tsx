
"use client";

import GoogleMapComponent from "@/components/google-map";
import { getCyclingRoutes, Coordinate, CyclingRoute } from "@/services/open-route-service";
import { useState, useEffect, useCallback } from "react";
import {
  collection,
  addDoc,
  Firestore,
  getFirestore,
  doc, // Import doc
  setDoc, // Import setDoc if you want to use custom IDs, or stick with addDoc for auto IDs
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
      // Ensure start point is included
      waypointsForGoogleMaps.push(route.coordinates[0]); 

      // Calculate intermediate points, ensuring we don't exceed MAX_GOOGLE_MAPS_WAYPOINTS (including start and end)
      const numIntermediatePoints = MAX_GOOGLE_MAPS_WAYPOINTS - 2; // -2 for start and end
      const totalRoutePoints = route.coordinates.length;
      // Ensure step is at least 1 and segments are meaningful
      const step = Math.floor((totalRoutePoints - 2) / (numIntermediatePoints > 0 ? numIntermediatePoints : 1));


      for (let i = 1; i <= numIntermediatePoints; i++) {
        const waypointIndex = i * step;
        // Ensure waypointIndex is within bounds and not the last point (which is added separately)
        if (waypointIndex > 0 && waypointIndex < totalRoutePoints - 1) { 
           waypointsForGoogleMaps.push(route.coordinates[waypointIndex]);
        }
      }
      // Ensure end point is included if it's not the same as start and list isn't full
      if (waypointsForGoogleMaps.length < MAX_GOOGLE_MAPS_WAYPOINTS) {
         waypointsForGoogleMaps.push(route.coordinates[totalRoutePoints - 1]); 
      }
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
    const db: Firestore = getFirestore(app);
    try {
      // Save under users/{userId}/savedRoutes/{autoId}
      const userSavedRoutesCollection = collection(db, "users", user.uid, "savedRoutes");
      const docRef = await addDoc(userSavedRoutesCollection, {
        // No need for userId field inside the document anymore, as it's part of the path.
        routeData: { 
          distance: route.distance,
          estimatedTime: route.estimatedTime,
          coordinates: route.coordinates,
          geometry: route.geometry, 
        },
        timestamp: new Date(),
      });
      toast({
        title: "Route Saved",
        description: `Route saved successfully.`, 
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
            Save this route
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
    <div className="flex flex-col min-h-screen bg-secondary p-4 sm:p-6 md:p-8 font-sans">
      <Toaster />
      <header className="w-full max-w-4xl mx-auto mb-8 text-center">
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
                onChange={(e) => setRadius(Math.max(1, Number(e.target.value)))} // Ensure radius is at least 1
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
                 <Button variant="outline" size="sm" className="mt-2 border-primary text-primary hover:bg-primary/10" onClick={() => setShowMapInput(true)}>Change Start Location</Button>
              </div>
            )}


            <Button
              onClick={handleGenerateRoutes}
              disabled={loading || !selectedLocation}
              className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold py-3 rounded-md text-base disabled:bg-muted disabled:text-muted-foreground"
            >
              {loading ? (
                <>
                  <Icons.spinner className="mr-2 h-5 w-5 animate-spin" />
                  Generating Routes...
                </>
              ) : (
                "Generate Routes"
              )}
            </Button>
          </CardContent>
        </Card>

        {loading && (
          <div className="grid gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="bg-card shadow-lg rounded-lg">
                <CardHeader>
                  <CardTitle>
                    <Skeleton className="h-6 w-48 bg-muted rounded" />
                  </CardTitle>
                  <CardDescription>
                    <Skeleton className="h-5 w-32 bg-muted rounded mt-1" />
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-[300px] w-full bg-muted rounded-md" />
                </CardContent>
                 <CardFooter className="flex flex-col sm:flex-row justify-between gap-2 pt-4">
                    <Skeleton className="h-10 w-full sm:w-40 bg-muted rounded-md" />
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Skeleton className="h-10 w-1/2 sm:w-24 bg-muted rounded-md" />
                        <Skeleton className="h-10 w-1/2 sm:w-32 bg-muted rounded-md" />
                    </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

         {!loading && routes && routes.length > 0 && (
          <div className="grid gap-6">
            <h2 className="text-2xl font-semibold text-primary mb-2">Generated Routes</h2>
            {routes.map((route, index) => (
              <RouteDisplay key={index} route={route} user={user} />
            ))}
          </div>
        )}
        {!loading && routes && routes.length === 0 && (
           <Card className="bg-card shadow-lg rounded-lg">
            <CardContent className="p-6">
              <div className="flex flex-col items-center justify-center text-center">
                <Icons.search className="w-16 h-16 text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-foreground">No Routes Found</p>
                <p className="text-muted-foreground">Try adjusting the radius or selecting a different starting location.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
       <footer className="w-full max-w-4xl mx-auto mt-12 text-center">
        <p className="text-sm text-muted-foreground">&copy; {new Date().getFullYear()} CycleZen. Happy Cycling!</p>
      </footer>
    </div>
  );
}

export default function WrappedHomePage() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    // Render nothing or a placeholder on the server to avoid hydration issues
    // with components that rely on window or other client-side APIs like Google Maps.
    return null; 
  }
  
  if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    return (
      <div className="flex justify-center items-center min-h-screen p-4 bg-secondary">
        <Card className="max-w-md w-full bg-card shadow-xl rounded-xl">
          <CardHeader>
            <CardTitle className="text-destructive text-2xl">Configuration Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground">The Google Maps API key is missing.</p>
            <p className="mt-2 text-sm text-muted-foreground">Please set the <code className="bg-muted px-1 py-0.5 rounded text-foreground">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> environment variable.</p>
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


    