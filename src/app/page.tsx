
"use client";

import GoogleMapComponent from "@/components/google-map";
import { getCyclingRoutes, Coordinate, CyclingRoute } from "@/services/open-route-service"; // Updated import
import { useState, useEffect } from "react";
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
import { Button as UiButton, Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/toaster";
import { Icons } from "@/components/icons";
import { useToast } from "@/hooks/use-toast";

import {
  GoogleMap,
  Polyline,
  Marker,
} from "@react-google-maps/api";

import { LoadScript } from "@react-google-maps/api";

// RouteData interface is removed as we'll use CyclingRoute directly

const RouteDisplay = ({
  route,
  user,
}: {
  route: CyclingRoute; // Changed to CyclingRoute
  user: any;
}) => {
  const { toast } = useToast();
  const [center, setCenter] = useState<Coordinate | null>(null);
  const mapStyles = {
    height: "300px",
    width: "100%",
  };

  useEffect(() => {
    if (route.coordinates && route.coordinates.length > 0) {
      // Calculate center of the route
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
      // Fallback center if coordinates are not available (should not happen for a valid route)
      setCenter({ lat: 0, lng: 0 });
    }
  }, [route]);

  const waypointsString = route.coordinates.map(coord => `${coord.lat},${coord.lng}`).join('|');
  const routeUrl = `https://www.google.com/maps/dir/?api=1&travelmode=cycling&dir_action=navigate&waypoints=${waypointsString}`;

  const handleSaveRoute = async () => {
    if (!user) {
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
        routeData: route, // Saves the CyclingRoute object
        timestamp: new Date(),
      });
      toast({
        title: "Route Saved",
        description: `Route saved successfully with ID: ${docRef.id}`,
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

  if (!center) {
    return <Skeleton className="h-[400px] w-full" />; // Or some loading state for the map
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
        <GoogleMap mapContainerStyle={mapStyles} zoom={10} center={center} >
          <Polyline path={route.coordinates} options={{ strokeColor: "#FF0000", strokeWeight: 2 }} />
        </GoogleMap>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button asChild>
          <a href={routeUrl} target='_blank' rel="noopener noreferrer">Open in Google Maps</a>
        </Button>
        <UiButton onClick={handleSaveRoute}>Save this route</UiButton>
      </CardFooter> 
    </Card>
  );
};

const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

const HomePage = () => {
  const [radius, setRadius] = useState<number>(5);
  const [showMapInput, setShowMapInput] = useState<boolean>(true); // Renamed for clarity
  const [routes, setRoutes] = useState<CyclingRoute[] | null>(null); // Changed to routes: CyclingRoute[]
  const [loading, setLoading] = useState<boolean>(false);
  const { toast } = useToast();
  const [selectedLocation, setSelectedLocation] = useState<Coordinate | null>(null);

  const handleGenerateRoutes = async () => {
    if (!selectedLocation) {
      toast({
        title: "Location Required",
        description: "Please select a location before generating routes.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setRoutes(null); // Clear previous routes
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
      // Fetch 3 routes by default as per PRD (3-10)
      const generatedRoutes = await getCyclingRoutes(selectedLocation, radius, 3); 
      setRoutes(generatedRoutes);
      if (generatedRoutes && generatedRoutes.length > 0) {
        setShowMapInput(false); // Hide map input if routes are generated
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
  };

  const handleLocationSelected = (location: Coordinate) => {
    setSelectedLocation(location);
    toast({
      title: 'Location Updated',
      description: `New location selected: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`,
    });
  };

  const user = null; // Placeholder for user authentication

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
              />
            </div>

            {showMapInput && (
             <GoogleMapComponent 
               onLocationSelected={handleLocationSelected} 
               googleMapsApiKey={googleMapsApiKey}
             />
            )}
            {!showMapInput && selectedLocation && (
              <Button variant="outline" onClick={() => setShowMapInput(true)}>Change Start Location</Button>
            )}


            <UiButton 
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
            </UiButton>
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
                  <Skeleton className="h-32 w-full bg-muted" />
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
  if (!googleMapsApiKey) {
    return (
      <div className="flex justify-center items-center min-h-screen p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-destructive">Configuration Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive-foreground">Google Maps API key is missing. Please set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your environment variables.</p>
            <p className="mt-2 text-sm text-muted-foreground">The map functionality cannot be loaded without this key.</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  return (
    <LoadScript googleMapsApiKey={googleMapsApiKey} libraries={['places']}>
      <HomePage />
    </LoadScript>
  );
}

    