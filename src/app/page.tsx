"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Coordinate, getCyclingRoutes } from "@/services/open-route-service";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/toaster";
import { Icons } from "@/components/icons";
import { useToast } from "@/hooks/use-toast";
import GoogleMapComponent from "@/components/google-map";

export default function Home() {
  const [radius, setRadius] = useState<number>(5);
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const { toast } = useToast();
  const [selectedLocation, setSelectedLocation] = useState<Coordinate | null>(
    null
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
      setRoutes(generatedRoutes);
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
  };

  return (
    <div className="flex flex-col min-h-screen bg-secondary p-4">
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

            <GoogleMapComponent onLocationSelected={handleLocationSelected} />

            <Button onClick={handleGenerateRoutes} disabled={loading}>
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

        {!loading && routes.length > 0 && (
          <div className="grid gap-4">
            {routes.map((route, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle>Route {index + 1}</CardTitle>
                  <CardDescription>
                    Distance: {route.distance} km
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Placeholder for map preview */}
                  <div>Map Preview</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
