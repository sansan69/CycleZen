"use client";

import GoogleMapComponent from "@/components/google-map";
import { getCyclingRoutes, Coordinate } from "@/services/open-route-service";
import { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  Firestore,
  doc,
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
  LoadScript,
  Polyline,
  Marker,
} from "@react-google-maps/api";


interface RouteData {
  geometry: string;
  distance: number;
  duration: number;
  segments: {
    distance: number;
    duration: number;
    steps: {
      distance: number;
      duration: number;
      type: number;
      instruction: string;
      name: string;
      way_points: number[];
      exit_number: string;
    }[];
  }[];
}


const RouteDisplay = ({
  route,
  user,
}: {
  route: RouteData;
  user: any;
}) => {
  const routeUrl = `https://www.google.com/maps/dir/?api=1&travelmode=walking&dir_action=navigate&waypoints=${route.geometry.split(' ').join('|')}`
  const { toast } = useToast();
  const [center, setCenter] = useState({
    lat: 0,
    lng: 0,
  });
  const mapStyles = {
    height: "300px",
    width: "100%",
  };

  useEffect(() => {
    const routePoints = route.geometry;
    const points = routePoints.split(" ").map((point) => {
      const [lng, lat] = point.split(",");
      return { lat: parseFloat(lat), lng: parseFloat(lng) };
    });

    setCenter(points[Math.floor(points.length / 2)]);
  }, [route]);

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
        routeData: route,
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Route</CardTitle>
        <CardDescription>
          Distance: {(route.distance / 1000).toFixed(2)} km, Duration:{" "}
          {(route.duration / 60).toFixed(0)} min
        </CardDescription>
      </CardHeader>
      <CardContent>
        <GoogleMap mapContainerStyle={mapStyles} zoom={10} center={center} >
          <Polyline path={route.geometry.split(" ").map((point) => { 
            const [lng, lat] = point.split(",");
            return { lat: parseFloat(lat), lng: parseFloat(lng) };
          })} />
        </GoogleMap>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button><a href={routeUrl} target='_blank'>Open in Google Maps</a></Button>
        <UiButton onClick={handleSaveRoute}>Save this route</UiButton>
      </CardFooter> 
    </Card>
  );
};

export default function Home() {
  const [radius, setRadius] = useState<number>(5);
  const [showMap, setShowMap] = useState<boolean>(true);
  const [route, setRoute] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const { toast } = useToast();
  const [selectedLocation, setSelectedLocation] = useState<Coordinate | null>(   
    null,
  );

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
    try {
      const generatedRoutes = await getCyclingRoutes(selectedLocation, radius);
      setRoute(generatedRoutes);
      setShowMap(false);
    } catch (error) {
      console.error("Error generating routes:", error);
      toast({
        title: "Route Generation Error",
        description: "Failed to generate routes. Please try again.",
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

  const user = null;

  return (
    <div className="flex flex-col min-h-screen bg-secondary p-4">
      <LoadScript googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''} />

      <Toaster />
      <div className="container mx-auto max-w-2xl">
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>CycleZen</CardTitle>
            <CardDescription>
              Find your perfect cycling route.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <label
                htmlFor="radius"
                className="text-sm font-medium leading-none"
              >
                Radius (km)
              </label>
              <Input
                type="number"
                id="radius"
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                placeholder="Enter radius"
              />
            </div>

            {showMap && (
             <GoogleMapComponent onLocationSelected={handleLocationSelected} />
            )}

            <UiButton onClick={handleGenerateRoutes} disabled={loading}>
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
              <Card key={i}>
                <CardHeader>
                  <CardTitle>
                    <Skeleton className="h-5 w-40" />
                  </CardTitle>
                  <CardDescription>
                    <Skeleton className="h-4 w-24" />
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-32 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

         {!loading && route && (
          <div className="grid gap-4">
            
            {route && <RouteDisplay route={route} user={user} />}
          </div>
        )}
      </div>
    </div>
  );
}
