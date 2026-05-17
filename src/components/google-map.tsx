
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleMap, Marker, Circle, Autocomplete } from '@react-google-maps/api';
import type { Coordinate } from '@/features/route-generation/services/open-route-service';
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

const GoogleMapComponent: React.FC<GoogleMapComponentProps> = ({
  onLocationSelected,
  googleMapsApiKey,
  searchRadiusKm,
  isLoaded, // Use this from props
  loadError, // Use this from props
  initialLocation,
}) => {
  const [markerPosition, setMarkerPosition] = useState<Coordinate | null>(null);
  const [mapCenter, setMapCenter] = useState<Coordinate>(defaultCenter);
  const [isLocatingViaButton, setIsLocatingViaButton] = useState<boolean>(false);
  const { toast } = useToast();
  const mapRef = useRef<google.maps.Map | null>(null);

  const mapOptions = {
    disableDefaultUI: true,
    zoomControl: true,
    gestureHandling: 'cooperative'
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

  // Effect to update internal marker and map center when initialLocation prop changes
  useEffect(() => {
    if (initialLocation) {
      console.log('[GoogleMapComponent] useEffect [initialLocation prop change]: Updating internal states from prop.', initialLocation);
      setMarkerPosition(initialLocation);
      setMapCenter(initialLocation);
      // The other useEffect that depends on markerPosition/mapCenter will handle map view updates.
    } else if (!initialLocation && isLoaded) {
       // If parent clears initialLocation, and map is loaded, consider resetting to default or last known good
       // For now, let's ensure mapCenter is at least default to avoid issues if marker is also null.
        if (!markerPosition) { // Only reset to default if there's no marker either
           // setMapCenter(defaultCenter); // This might cause an unwanted jump if user just cleared search
        }
    }
  }, [initialLocation, isLoaded]); // Added isLoaded to avoid setting mapCenter before map is ready


  const getLocation = useCallback(async (showProcessMessages = false) => {
    console.log('[GoogleMapComponent getLocation] Called. showProcessMessages:', showProcessMessages, 'API Key available:', !!googleMapsApiKey, 'isLoaded prop:', isLoaded);
    if (showProcessMessages) setIsLocatingViaButton(true);

    if (!googleMapsApiKey) {
      const msg = 'Google Maps API key is missing.';
      if (showProcessMessages) toast({ title: "API Key Missing", description: msg, variant: "destructive" });
      console.error("[GoogleMapComponent getLocation]", msg);
      // Don't set defaultCenter here if map isn't loaded or key is missing, could cause issues.
      if (showProcessMessages) setIsLocatingViaButton(false);
      return;
    }

    if (!isLoaded) {
      const msg = "Google Maps API not loaded yet.";
      if (showProcessMessages) toast({ title: "Map Not Ready", description: msg, variant: "default" });
      console.warn("[GoogleMapComponent getLocation]", msg);
      if (showProcessMessages) setIsLocatingViaButton(false);
      return;
    }
    if (loadError) {
      const msg = `Failed to load Google Maps script: ${loadError.message}.`;
      if (showProcessMessages) toast({ title: "Map Load Error", description: msg, variant: "destructive" });
      console.error("[GoogleMapComponent getLocation]", msg, loadError);
      if (showProcessMessages) setIsLocatingViaButton(false);
      return;
    }

    if (!navigator.geolocation) {
      const msg = 'Geolocation is not supported by your browser.';
      if (showProcessMessages) toast({ title: "Geolocation Error", description: msg, variant: "destructive" });
      console.error("[GoogleMapComponent getLocation]", msg);
      if (showProcessMessages) setIsLocatingViaButton(false);
      return;
    }

    if (navigator.permissions && navigator.permissions.query) {
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
        console.log('[GoogleMapComponent getLocation] Geolocation permission status:', permissionStatus.state);
        if (permissionStatus.state === 'denied') {
          const msg = 'Location permission denied. Please enable it in your browser/OS settings.';
          if (showProcessMessages) toast({ title: "Location Permission Denied", description: msg, variant: "destructive", duration: 7000 });
          if (showProcessMessages) setIsLocatingViaButton(false);
          return;
        } else if (permissionStatus.state === 'prompt' && showProcessMessages) {
          toast({ title: "Location Access Required", description: "Please grant permission when prompted by your browser.", duration: 7000 });
        }
      } catch (permError: any) {
        console.warn("[GoogleMapComponent getLocation] Could not query geolocation permission status:", permError.message);
      }
    }

    try {
      console.log('[GoogleMapComponent getLocation] Attempting navigator.geolocation.getCurrentPosition...');
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
      });
      const { latitude, longitude } = position.coords;
      const fetchedLocation = { lat: latitude, lng: longitude };
      console.log('[GoogleMapComponent getLocation] Successfully fetched location:', fetchedLocation);
      
      // Directly pan the map if the map instance exists
      if (mapRef.current) {
        mapRef.current.panTo(fetchedLocation);
        if ((mapRef.current.getZoom() ?? 0) < 14) { // If too zoomed out
            mapRef.current.setZoom(14);
        }
      }
      
      setMapCenter(fetchedLocation); // Update internal state
      setMarkerPosition(fetchedLocation); // Update internal state

      if (showProcessMessages) { // Only if called by button or explicitly
        onLocationSelected(fetchedLocation); // Notify parent
        toast({ title: "Location Updated", description: "Map centered on your current location.", duration: 5000 });
      } else if (!initialLocation) { 
        // If this was an initial auto-fetch and parent didn't provide an initialLocation
        onLocationSelected(fetchedLocation);
      }

    } catch (err: any) {
      console.error('[GoogleMapComponent getLocation] Error from getCurrentPosition:', err.code, err.message);
      let toastTitle = "Location Error";
      let toastDescription = "Could not retrieve your location. Please select manually or check settings.";
      if (err.code === 1) { toastTitle = "Location Access Denied"; toastDescription = "Please enable location permission in browser/OS settings to use this feature."; }
      else if (err.code === 2) { toastTitle = "Location Unavailable"; toastDescription = "Could not retrieve location. Ensure device GPS/location services are turned on and try again."; }
      else if (err.code === 3) { toastTitle = "Location Timeout"; toastDescription = "Could not get your location in time. Ensure GPS/location services are on and try again."; }
      else if (err.message?.toLowerCase().includes("permissions policy")) { toastTitle = "Location Permission Blocked"; toastDescription = "Geolocation is disabled by a permissions policy. Check browser/OS settings or if running in an iframe, ensure 'geolocation' is allowed.";}
      
      if (showProcessMessages) toast({ title: toastTitle, description: toastDescription, variant: "destructive", duration: 7000 });
    } finally {
      if (showProcessMessages) setIsLocatingViaButton(false);
    }
  }, [toast, googleMapsApiKey, isLoaded, loadError, onLocationSelected, initialLocation]); // initialLocation added back carefully for auto-fetch logic

  // Effect for initial auto-geolocation if no initialLocation is provided by parent
  useEffect(() => {
    if (isLoaded && !loadError && !initialLocation && !markerPosition) {
      console.log('[GoogleMapComponent] useEffect [initial auto-fetch]: No initialLocation from parent. Attempting to fetch current location.');
      getLocation(false); // Call without showing process messages for automatic fetch
    }
  }, [isLoaded, loadError, initialLocation, markerPosition, getLocation]);


  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    console.log('[GoogleMapComponent] onMapLoad: Map instance loaded.');
    // Initial centering/zoom if initialLocation is present at map load
    if (initialLocation) {
        map.setCenter(initialLocation);
        if (!searchRadiusKm) map.setZoom(13); // Default zoom if no radius to fit
    } else if (markerPosition) { // If markerPosition was set by auto-fetch before map load
        map.setCenter(markerPosition);
        if (!searchRadiusKm) map.setZoom(13);
    } else {
        map.setCenter(defaultCenter);
        map.setZoom(10); // A more zoomed-out default if no location at all
    }
  }, [initialLocation, markerPosition, searchRadiusKm]);

  const handleMapClick = useCallback((event: google.maps.MapMouseEvent) => {
    if (event.latLng) {
      const newPos = { lat: event.latLng.lat(), lng: event.latLng.lng() };
      console.log('[GoogleMapComponent] handleMapClick: New position:', newPos);
      setMarkerPosition(newPos); 
      setMapCenter(newPos); // Keep map centered on marker after click
      onLocationSelected(newPos); 
    }
  }, [onLocationSelected]);

  const handleMarkerDragEnd = useCallback((event: google.maps.MapMouseEvent) => {
    if (event.latLng) {
      const newPos = { lat: event.latLng.lat(), lng: event.latLng.lng() };
      console.log('[GoogleMapComponent] handleMarkerDragEnd: New position:', newPos);
      setMarkerPosition(newPos); 
      setMapCenter(newPos); // Keep map centered on marker after drag
      onLocationSelected(newPos); 
    }
  }, [onLocationSelected]);

 useEffect(() => {
    if (!isLoaded || !mapRef.current || loadError) {
      return;
    }
    const map = mapRef.current;
    const targetPositionForBounds = markerPosition || mapCenter;

    console.log('[GoogleMapComponent] useEffect [fitBounds]: Triggered.', { markerPosition, mapCenter, searchRadiusKm, isLoaded, loadError });

    if (targetPositionForBounds && searchRadiusKm && searchRadiusKm > 0 && typeof google !== 'undefined' && google.maps.geometry?.spherical) {
      const centerLatLng = new google.maps.LatLng(targetPositionForBounds.lat, targetPositionForBounds.lng);
      const radiusInMeters = searchRadiusKm * 1000;
      try {
        const circleForBounds = new google.maps.Circle({center: centerLatLng, radius: radiusInMeters});
        const bounds = circleForBounds.getBounds();
        if (bounds) {
          map.fitBounds(bounds);
        } else {
          // Fallback if bounds are somehow not available
          map.panTo(targetPositionForBounds);
           if ((map.getZoom() ?? 0) < 10 || (map.getZoom() ?? 0) > 15) map.setZoom(12);
        }
      } catch (e) {
        console.error("[GoogleMapComponent] useEffect [fitBounds]: Error calculating map bounds:", e);
        map.panTo(targetPositionForBounds);
        if ((map.getZoom() ?? 0) < 10 || (map.getZoom() ?? 0) > 15) map.setZoom(12);
      }
    } else if (targetPositionForBounds) {
      // Pan to the targetPositionForBounds if it's just a point without a radius
      // Only pan if the map's current center is significantly different to avoid jitter
      const currentMapCenter = map.getCenter();
      if (currentMapCenter && (Math.abs(currentMapCenter.lat() - targetPositionForBounds.lat) > 0.0001 || Math.abs(currentMapCenter.lng() - targetPositionForBounds.lng) > 0.0001 )) {
        map.panTo(targetPositionForBounds);
      }
      if (!searchRadiusKm && ((map.getZoom() ?? 0) < 10 || (map.getZoom() ?? 0) > 15)) map.setZoom(13);
    }
  }, [markerPosition, mapCenter, searchRadiusKm, isLoaded, loadError]);


  console.log('[GoogleMapComponent Render States]', {
    props_isLoaded: isLoaded,
    props_loadError: loadError,
    props_initialLocation: initialLocation,
    state_mapCenter: mapCenter,
    state_markerPosition: markerPosition,
    state_isLocatingViaButton: isLocatingViaButton,
  });


  if (loadError || (!isLoaded && !googleMapsApiKey)) {
    let errorMsg = "Map could not be loaded.";
    if (loadError) errorMsg = `Error loading Google Maps API: ${loadError.message}`;
    if (!googleMapsApiKey) errorMsg = "Google Maps API key missing. Map cannot be loaded.";
    
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

  return (
    <div className="relative h-[400px] w-full rounded-md overflow-hidden shadow-md border border-border">
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={mapCenter}
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
            key={`${markerPosition.lat}-${markerPosition.lng}-${searchRadiusKm}`}
            center={markerPosition}
            radius={searchRadiusKm * 1000}
            options={circleOptions}
          />
        )}
      </GoogleMap>
      <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-background/80 backdrop-blur-sm p-2 rounded-md shadow-lg text-xs text-foreground text-center">
        {markerPosition ? `Selected: ${markerPosition.lat.toFixed(4)}, ${markerPosition.lng.toFixed(4)}`
          : (mapCenter !== defaultCenter ? `Map Center: ${mapCenter.lat.toFixed(4)}, ${mapCenter.lng.toFixed(4)}` : "Select a starting point")}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm hover:bg-secondary/80"
        onClick={() => getLocation(true)}
        disabled={isLocatingViaButton || !isLoaded}
      >
        <Icons.locate className="h-4 w-4 mr-1"/> {isLocatingViaButton ? "Locating..." : "My Location"}
      </Button>
    </div>
  );
};

export default GoogleMapComponent;

