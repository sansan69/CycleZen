"use client";

import { useState, useCallback, useRef } from "react";
import { GoogleMap, Marker, Polyline } from "@react-google-maps/api";
import type { Coordinate } from "@/features/route-generation/services/open-route-service";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/icons";
import { useToast } from "@/hooks/use-toast";

interface ManualRoutePlannerProps {
  googleMapsApiKey: string;
  isLoaded: boolean;
  loadError?: Error | null;
  initialLocation?: Coordinate | null;
  onRouteGenerated: (waypoints: Coordinate[]) => void;
  loading: boolean;
}

const defaultCenter: Coordinate = { lat: 34.052235, lng: -118.243683 };

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  gestureHandling: "cooperative",
  clickableIcons: false,
};

export const ManualRoutePlanner: React.FC<ManualRoutePlannerProps> = ({
  googleMapsApiKey,
  isLoaded,
  loadError,
  initialLocation,
  onRouteGenerated,
  loading,
}) => {
  const [waypoints, setWaypoints] = useState<Coordinate[]>([]);
  const mapRef = useRef<google.maps.Map | null>(null);
  const { toast } = useToast();

  const mapCenter = initialLocation || defaultCenter;

  const onMapLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      if (initialLocation) {
        map.setCenter(initialLocation);
        map.setZoom(14);
      } else {
        map.setCenter(defaultCenter);
        map.setZoom(10);
      }
    },
    [initialLocation],
  );

  const handleMapClick = useCallback(
    (event: google.maps.MapMouseEvent) => {
      if (!event.latLng) return;
      const newPoint: Coordinate = {
        lat: event.latLng.lat(),
        lng: event.latLng.lng(),
      };
      setWaypoints((prev) => [...prev, newPoint]);
    },
    [],
  );

  const handleUndoLast = useCallback(() => {
    setWaypoints((prev) => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setWaypoints([]);
  }, []);

  const handleGetRoute = useCallback(() => {
    if (waypoints.length < 2) {
      toast({
        title: "Need More Waypoints",
        description: "Click on the map to place at least 2 points for a route.",
        variant: "destructive",
      });
      return;
    }
    onRouteGenerated(waypoints);
  }, [waypoints, onRouteGenerated, toast]);

  if (loadError || (!isLoaded && !googleMapsApiKey)) {
    let errorMsg = "Map could not be loaded.";
    if (loadError) errorMsg = `Error loading Google Maps API: ${loadError.message}`;
    if (!googleMapsApiKey) errorMsg = "Google Maps API key missing.";
    return (
      <div className="flex flex-col items-center justify-center h-[400px] w-full bg-muted/50 rounded-md text-center p-4 border border-destructive text-destructive">
        <Icons.alertTriangle className="h-8 w-8 mb-2" />
        <p className="font-semibold">{errorMsg}</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] w-full bg-muted/50 rounded-md text-center p-4">
        <Icons.spinner className="mr-2 h-6 w-6 animate-spin text-primary" />
        <p className="text-foreground">Map is initializing...</p>
      </div>
    );
  }

  const polylinePath = waypoints.map((wp) => ({ lat: wp.lat, lng: wp.lng }));

  return (
    <div className="space-y-4">
      {/* Map */}
      <div className="relative h-[400px] w-full rounded-md overflow-hidden shadow-md border border-border">
        <GoogleMap
          mapContainerStyle={{ width: "100%", height: "100%" }}
          center={mapCenter}
          options={mapOptions}
          onLoad={onMapLoad}
          onClick={handleMapClick}
        >
          {/* Waypoint markers with numbers */}
          {waypoints.map((wp, idx) => (
            <Marker
              key={`wp-${idx}`}
              position={{ lat: wp.lat, lng: wp.lng }}
              label={{
                text: String(idx + 1),
                color: "#ffffff",
                fontSize: "13px",
                fontWeight: "bold",
              }}
              icon={{
                url: "data:image/svg+xml;charset=UTF-8," +
                  encodeURIComponent(
                    `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`
                  ),
                scaledSize: new google.maps.Size(28, 28),
                anchor: new google.maps.Point(14, 28),
              }}
            />
          ))}

          {/* Preview polyline between waypoints */}
          {waypoints.length > 1 && (
            <Polyline
              path={polylinePath}
              options={{
                strokeColor: "hsl(var(--accent))",
                strokeOpacity: 0.7,
                strokeWeight: 3,
                geodesic: true,
              }}
            />
          )}
        </GoogleMap>

        {/* Map overlay: waypoint count */}
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-background/80 backdrop-blur-sm p-2 rounded-md shadow-lg text-xs text-foreground text-center">
          {waypoints.length === 0
            ? "Click anywhere to place waypoints"
            : `${waypoints.length} waypoint${waypoints.length > 1 ? "s" : ""} placed — click to add more`}
        </div>
      </div>

      {/* Waypoint list */}
      {waypoints.length > 0 && (
        <div className="bg-muted/50 rounded-md p-3 border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">
              Waypoints ({waypoints.length})
            </span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleUndoLast}
                disabled={waypoints.length === 0}
                className="h-7 text-xs"
              >
                <Icons.arrowLeft className="mr-1 h-3 w-3" /> Undo
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                disabled={waypoints.length === 0}
                className="h-7 text-xs text-destructive"
              >
                <Icons.close className="mr-1 h-3 w-3" /> Clear
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {waypoints.map((wp, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 bg-background border border-border rounded-full px-2 py-0.5 text-xs text-muted-foreground"
              >
                <span className="font-semibold text-primary">{idx + 1}.</span>
                {wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Get Route button */}
      <Button
        onClick={handleGetRoute}
        disabled={loading || waypoints.length < 2}
        variant="accent"
        className="w-full"
      >
        {loading ? (
          <>
            <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
            Getting Route...
          </>
        ) : (
          <>
            <Icons.route className="mr-2 h-4 w-4" />
            Get Route ({waypoints.length < 2 ? "≥2 pts needed" : `${waypoints.length} points`})
          </>
        )}
      </Button>
    </div>
  );
};

export default ManualRoutePlanner;
