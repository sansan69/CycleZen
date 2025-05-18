
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleMap, Marker, Circle } from '@react-google-maps/api';
import type { Coordinate } from '@/services/open-route-service';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { useToast } from '@/hooks/use-toast';

interface GoogleMapComponentProps {
  onLocationSelected: (location: Coordinate) => void;
  googleMapsApiKey: string;
  searchRadiusKm?: number | null;
  isLoaded: boolean;
  loadError?: Error | null;
  initialLocation?: Coordinate | null;
}

const defaultCenter: Coordinate = {
  lat: 34.052235, // Los Angeles
  lng: -118.243683,
};

const GOOGLE_MAPS_LIBRARIES = ['places', 'geometry'] as ('places' | 'geometry')[];

const GoogleMapComponent: React.FC<GoogleMapComponentProps> = ({
  onLocationSelected,
  googleMapsApiKey,
  searchRadiusKm,
  isLoaded,
  loadError,
  initialLocation,
}) => {
  const [mapCenter, setMapCenter] = useState<Coordinate | null>(initialLocation || null);
  const [markerPosition, setMarkerPosition] = useState<Coordinate | null>(initialLocation || null);
  const [internalLoading, setInternalLoading] = useState<boolean>(true);
  const [internalError, setInternalError] = useState<string | null>(null);
  const { toast } = useToast();
  const mapRef = useRef<google.maps.Map | null>(null);

  const mapOptions = {
    disableDefaultUI: true,
    zoomControl: true,
  };

  const circleOptions = {
    strokeColor: "hsl(var(--accent))",
    strokeOpacity: 0.8,
    strokeWeight: 2,
    fillColor: "hsl(var(--accent))",
    fillOpacity: 0.20,
    clickable: false,
    draggable: false,
    editable: false,
    visible: true,
    zIndex: 1,
  };

  const getLocation = useCallback(async (triggeredByButton = false) => {
    setInternalLoading(true);
    setInternalError(null);

    if (!googleMapsApiKey) {
      setInternalError('Google Maps API key is missing.');
      if (triggeredByButton) toast({ title: "API Key Missing", description: "Google Maps API key is missing.", variant: "destructive" });
      setMapCenter(defaultCenter);
      if (!markerPosition) setMarkerPosition(defaultCenter); // Only set if not already set by prop
      setInternalLoading(false);
      return;
    }
    if (!isLoaded) {
      if (triggeredByButton && !loadError) console.warn("getLocation called before Google Maps API is loaded or while there's a load error.");
      setInternalLoading(false);
      return;
    }
    if (loadError) {
      setInternalError(`Failed to load Google Maps script: ${loadError.message}`);
      if (triggeredByButton) toast({ title: "Map Load Error", description: `Google Maps script failed: ${loadError.message}.`, variant: "destructive" });
      setMapCenter(defaultCenter);
      if (!markerPosition) setMarkerPosition(defaultCenter);
      setInternalLoading(false);
      return;
    }
    if (!navigator.geolocation) {
      setInternalError('Geolocation is not supported by your browser.');
      if (triggeredByButton) toast({ title: "Geolocation Error", description: "Geolocation not supported.", variant: "destructive" });
      setMapCenter(defaultCenter);
      if (!markerPosition) setMarkerPosition(defaultCenter);
      setInternalLoading(false);
      return;
    }

    if (navigator.permissions && navigator.permissions.query) {
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
        if (permissionStatus.state === 'denied') {
          setInternalError('Location permission denied by user or policy.');
          if (triggeredByButton) toast({ title: "Location Permission Denied", description: "Please enable location permission in browser/OS settings.", variant: "destructive" });
          setMapCenter(defaultCenter);
          if (!markerPosition) setMarkerPosition(defaultCenter);
          setInternalLoading(false);
          return;
        } else if (permissionStatus.state === 'prompt' && triggeredByButton) {
          toast({ title: "Location Access", description: "Please grant permission when prompted.", duration: 7000 });
        }
      } catch (permError: any) {
        console.warn("Could not query geolocation permission status:", permError.message);
      }
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
      });
      const { latitude, longitude } = position.coords;
      const fetchedLocation = { lat: latitude, lng: longitude };
      
      setMapCenter(fetchedLocation);
      setMarkerPosition(fetchedLocation);

      // Only call onLocationSelected if triggered by button,
      // or if there was no initialLocation from parent (meaning map is self-initializing)
      if (triggeredByButton || !initialLocation) {
        onLocationSelected(fetchedLocation);
      }
    } catch (err: any) {
      console.error('Error getting location (getCurrentPosition):', err.message);
      setInternalError(err.message);
      let toastTitle = "Location Error";
      let toastDescription = "Could not retrieve your location. Please select manually.";
      if (err.code === 1) { toastTitle = "Location Access Denied"; toastDescription = "Please enable location permission in browser/OS settings."; }
      else if (err.code === 2) { toastTitle = "Location Services Off?"; toastDescription = "Please ensure device GPS/location services are on."; }
      else if (err.code === 3) { toastTitle = "Location Timeout"; toastDescription = "Ensure GPS/location services are on and try again."; }
      else if (err.message?.toLowerCase().includes("permissions policy")) { toastTitle = "Location Permission Blocked"; toastDescription = "Geolocation disabled by permissions policy. Check browser/OS settings.";}

      if (triggeredByButton) toast({ title: toastTitle, description: toastDescription, variant: "destructive" });
      
      // Fallback if everything fails and no marker is set
      if (!markerPosition) setMarkerPosition(defaultCenter);
      if (!mapCenter) setMapCenter(defaultCenter);
    } finally {
      setInternalLoading(false);
    }
  }, [toast, googleMapsApiKey, isLoaded, loadError, onLocationSelected, initialLocation, markerPosition, mapCenter]); // markerPosition, mapCenter added to deps

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const handleMapClick = useCallback((event: google.maps.MapMouseEvent) => {
    if (event.latLng) {
      const newPos = { lat: event.latLng.lat(), lng: event.latLng.lng() };
      setMarkerPosition(newPos);
      onLocationSelected(newPos); // User interaction
    }
  }, [onLocationSelected]);

  const handleMarkerDragEnd = useCallback((event: google.maps.MapMouseEvent) => {
    if (event.latLng) {
      const newPos = { lat: event.latLng.lat(), lng: event.latLng.lng() };
      setMarkerPosition(newPos);
      onLocationSelected(newPos); // User interaction
    }
  }, [onLocationSelected]);

  // Effect to sync markerPosition and mapCenter with initialLocation from parent
  useEffect(() => {
    if (initialLocation) {
      // Sync internal markerPosition if different from prop
      if (!markerPosition || initialLocation.lat !== markerPosition.lat || initialLocation.lng !== markerPosition.lng) {
        setMarkerPosition(initialLocation);
      }
      // Sync internal mapCenter if different from prop
      if (!mapCenter || initialLocation.lat !== mapCenter.lat || initialLocation.lng !== mapCenter.lng) {
        setMapCenter(initialLocation);
      }
      setInternalLoading(false);
    }
  }, [initialLocation, markerPosition, mapCenter]);

  // Effect for initial location fetching if no initialLocation prop is provided
  useEffect(() => {
    if (!initialLocation && isLoaded && !loadError && !mapCenter && !markerPosition) {
      getLocation(false); // Auto-fetch, don't show process messages for this one
    } else if (loadError && !mapCenter && !markerPosition) {
      setInternalError(`Failed to load Google Maps script: ${loadError.message}`);
      setMapCenter(defaultCenter);
      setMarkerPosition(defaultCenter);
      setInternalLoading(false);
    } else if (!initialLocation && !mapCenter && !markerPosition) {
      // If not loaded yet, but no initial location, set loading true
      setInternalLoading(true);
    } else if (mapCenter && markerPosition && internalLoading) {
      // If we have positions and were loading, set loading to false
      setInternalLoading(false);
    }
  }, [isLoaded, loadError, initialLocation, getLocation, mapCenter, markerPosition, internalLoading]);

  // Effect to fit map bounds to circle or pan to location
  useEffect(() => {
    if (!isLoaded || !mapRef.current || loadError || !mapCenter) return;
    const map = mapRef.current;

    if (markerPosition && searchRadiusKm && searchRadiusKm > 0 && google.maps.geometry) {
      const centerLatLng = new google.maps.LatLng(markerPosition.lat, markerPosition.lng);
      const radiusInMeters = searchRadiusKm * 1000;
      try {
        const neBoundPoint = google.maps.geometry.spherical.computeOffset(centerLatLng, radiusInMeters * Math.sqrt(2), 45);
        const swBoundPoint = google.maps.geometry.spherical.computeOffset(centerLatLng, radiusInMeters * Math.sqrt(2), 225);
        if (neBoundPoint && swBoundPoint) {
          const bounds = new google.maps.LatLngBounds();
          bounds.extend(neBoundPoint);
          bounds.extend(swBoundPoint);
          map.fitBounds(bounds);
        } else {
          map.panTo(mapCenter);
          if ((map.getZoom() ?? 0) < 10 || (map.getZoom() ?? 0) > 15) map.setZoom(13);
        }
      } catch (e) {
        console.error("Error calculating map bounds with geometry library:", e);
        map.panTo(mapCenter);
        if ((map.getZoom() ?? 0) < 10 || (map.getZoom() ?? 0) > 15) map.setZoom(13);
      }
    } else { // Handles both markerPosition without radius, and just mapCenter if markerPosition is null
      map.panTo(markerPosition || mapCenter); // Prefer markerPosition if available, else mapCenter
      if ((map.getZoom() ?? 0) < 10 || (map.getZoom() ?? 0) > 15) map.setZoom(13);
    }
  }, [markerPosition, searchRadiusKm, isLoaded, loadError, mapCenter]);


  if (loadError) {
    return (
      <div className="text-destructive p-4 border border-destructive rounded-md bg-destructive/10 h-[400px] w-full flex flex-col items-center justify-center text-center">
        <p className="font-semibold">Error loading Google Maps API: {loadError.message}</p>
        {!googleMapsApiKey && <p className="text-destructive text-sm mt-1">Google Maps API key is missing.</p>}
      </div>
    );
  }

  if (internalLoading && !markerPosition && !internalError) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] w-full bg-muted/50 rounded-md">
        <Icons.spinner className="mr-2 h-6 w-6 animate-spin text-primary" />
        <p className="text-foreground">Detecting location and initializing map...</p>
      </div>
    );
  }
  
  if (!isLoaded && !loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] w-full bg-muted/50 rounded-md text-center p-4">
        <Icons.spinner className="mr-2 h-6 w-6 animate-spin text-primary" />
        <p className="text-foreground">Map is initializing...</p>
        {internalError && <p className="text-sm text-destructive mt-2">{internalError}</p>}
        {!googleMapsApiKey && <p className="text-destructive text-sm mt-1">Google Maps API key missing.</p>}
      </div>
    );
  }

  const displayCenter = mapCenter || defaultCenter;

  return (
    <div className="relative h-[400px] w-full rounded-md overflow-hidden shadow-md border border-border">
      {isLoaded && displayCenter ? (
        <>
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={displayCenter}
            zoom={12}
            options={mapOptions}
            onLoad={onMapLoad}
            onClick={handleMapClick}
          >
            {markerPosition && (
              <Marker
                position={markerPosition}
                draggable={true}
                onDragEnd={handleMarkerDragEnd}
              />
            )}
            {markerPosition && searchRadiusKm && searchRadiusKm > 0 && (
              <Circle
                center={markerPosition}
                radius={searchRadiusKm * 1000}
                options={circleOptions}
              />
            )}
          </GoogleMap>
          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-background/80 backdrop-blur-sm p-2 rounded-md shadow-lg text-xs text-foreground">
            {markerPosition ? `Selected: ${markerPosition.lat.toFixed(4)}, ${markerPosition.lng.toFixed(4)}`
              : mapCenter ? `Current: ${mapCenter.lat.toFixed(4)}, ${mapCenter.lng.toFixed(4)}`
              : internalError ? "Using default location"
              : "Detecting location..."}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm hover:bg-secondary/80"
            onClick={() => getLocation(true)}
            disabled={internalLoading || !isLoaded}
          >
            <Icons.locate className="h-4 w-4 mr-1" /> {internalLoading ? "Locating..." : "My Location"}
          </Button>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-[400px] w-full bg-muted/50 rounded-md">
          <Icons.spinner className="mr-2 h-6 w-6 animate-spin text-primary" />
          <p className="text-foreground">Initializing map...</p>
          {!googleMapsApiKey && <p className="text-destructive text-sm mt-1">Google Maps API key missing.</p>}
          {loadError && <p className="text-destructive text-sm mt-1">Failed to load Google Maps script: {loadError.message}</p>}
          {internalError && <p className="text-sm text-destructive mt-2">{internalError}</p>}
        </div>
      )}
    </div>
  );
};

export default GoogleMapComponent;
    