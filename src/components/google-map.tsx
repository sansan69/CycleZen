
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
  isLoaded: boolean; // Prop indicating if Google Maps API script is loaded
  loadError?: Error | null; // Prop for API script load error
  initialLocation?: Coordinate | null; // Prop for initial location from parent
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
  const [markerPosition, setMarkerPosition] = useState<Coordinate | null>(initialLocation);
  const [mapCenter, setMapCenter] = useState<Coordinate>(initialLocation || defaultCenter);
  const [isLocatingViaButton, setIsLocatingViaButton] = useState<boolean>(false);
  const { toast } = useToast();
  const mapRef = useRef<google.maps.Map | null>(null);
  const [mapReloadKey, setMapReloadKey] = useState(0);

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
      console.log('[GoogleMapComponent] useEffect [initialLocation prop change]: Updating internal states.', initialLocation);
      setMarkerPosition(initialLocation);
      setMapCenter(initialLocation);
      setMapReloadKey(prev => prev + 1); // Force map re-render for new initial location
    } else {
      // If initialLocation becomes null (e.g. parent cleared it), reset to default
      // Only reset if marker was previously set to avoid unnecessary default centering
      if (markerPosition) { 
        // setMarkerPosition(null); // Optional: clear marker if initialLocation is cleared
        // setMapCenter(defaultCenter);
      }
    }
  }, [initialLocation]);


  const getLocation = useCallback(async (showProcessMessages = false) => {
    console.log('[getLocation] Called. showProcessMessages:', showProcessMessages, 'API Key available:', !!googleMapsApiKey, 'isLoaded prop:', isLoaded);
    if (showProcessMessages) setIsLocatingViaButton(true);

    if (!googleMapsApiKey) {
      const msg = 'Google Maps API key is missing.';
      if (showProcessMessages) toast({ title: "API Key Missing", description: msg, variant: "destructive" });
      if (showProcessMessages) setIsLocatingViaButton(false);
      setMapCenter(defaultCenter); // Fallback
      setMarkerPosition(null);
      return;
    }

    if (!isLoaded) {
      const msg = "Google Maps API not loaded yet.";
      if (showProcessMessages) toast({ title: "Map Not Ready", description: msg, variant: "default" });
      if (showProcessMessages) setIsLocatingViaButton(false);
      return;
    }
    if (loadError) {
      const msg = `Failed to load Google Maps script: ${loadError.message}.`;
      if (showProcessMessages) toast({ title: "Map Load Error", description: msg, variant: "destructive" });
      if (showProcessMessages) setIsLocatingViaButton(false);
      setMapCenter(defaultCenter); // Fallback
      setMarkerPosition(null);
      return;
    }

    if (!navigator.geolocation) {
      const msg = 'Geolocation is not supported by your browser.';
      if (showProcessMessages) toast({ title: "Geolocation Error", description: msg, variant: "destructive" });
      if (showProcessMessages) setIsLocatingViaButton(false);
      setMapCenter(defaultCenter); // Fallback
      setMarkerPosition(null);
      return;
    }

    if (navigator.permissions && navigator.permissions.query) {
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
        console.log('[getLocation] Geolocation permission status:', permissionStatus.state);
        if (permissionStatus.state === 'denied') {
          const msg = 'Location permission denied. Please enable it in your browser/OS settings to use this feature.';
          if (showProcessMessages) toast({ title: "Location Permission Denied", description: msg, variant: "destructive", duration: 7000 });
          if (showProcessMessages) setIsLocatingViaButton(false);
          // Do not set defaultCenter here if showProcessMessages is false, allow parent to handle
          if (showProcessMessages) {
            setMapCenter(defaultCenter);
            setMarkerPosition(null);
          }
          return;
        } else if (permissionStatus.state === 'prompt' && showProcessMessages) {
          toast({ title: "Location Access Required", description: "Please grant permission when prompted by your browser to find your current location.", duration: 7000 });
        }
      } catch (permError: any) {
        console.warn("[getLocation] Could not query geolocation permission status:", permError.message);
        // Proceed with getCurrentPosition, it will re-prompt or fail.
      }
    }

    try {
      console.log('[getLocation] Attempting navigator.geolocation.getCurrentPosition...');
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
      });
      const { latitude, longitude } = position.coords;
      const fetchedLocation = { lat: latitude, lng: longitude };
      console.log('[getLocation] Successfully fetched location:', fetchedLocation);
      
      setMapCenter(fetchedLocation);
      setMarkerPosition(fetchedLocation);
      onLocationSelected(fetchedLocation); // Notify parent
      if (showProcessMessages) toast({ title: "Location Updated", description: "Map centered on your current location." });

    } catch (err: any) {
      console.error('[getLocation] Error from getCurrentPosition:', err.code, err.message);
      let toastTitle = "Location Error";
      let toastDescription = "Could not retrieve your location. Please select manually or check settings.";
      if (err.code === 1) { toastTitle = "Location Access Denied"; toastDescription = "Please enable location permission in browser/OS settings to use this feature."; }
      else if (err.code === 2) { toastTitle = "Location Unavailable"; toastDescription = "Could not retrieve location. Please ensure device GPS/location services are turned on and try again."; }
      else if (err.code === 3) { toastTitle = "Location Timeout"; toastDescription = "Could not get your location in time. Ensure GPS/location services are on and try again."; }
      else if (err.message?.toLowerCase().includes("permissions policy")) { toastTitle = "Location Permission Blocked"; toastDescription = "Geolocation is disabled by a permissions policy. Check browser/OS settings.";}
      
      if (showProcessMessages) toast({ title: toastTitle, description: toastDescription, variant: "destructive" });
      // Do not set defaultCenter here if showProcessMessages is false for auto-fetch
       if (showProcessMessages) {
         setMapCenter(defaultCenter);
         setMarkerPosition(null);
       }
    } finally {
      if (showProcessMessages) setIsLocatingViaButton(false);
    }
  }, [toast, googleMapsApiKey, isLoaded, loadError, onLocationSelected]);

  // Effect for initial auto-geolocation if no initialLocation is provided by parent
  useEffect(() => {
    if (isLoaded && !loadError && !initialLocation && !markerPosition) { // Check markerPosition to avoid re-fetching if already set
      console.log('[GoogleMapComponent] useEffect [initial auto-fetch]: No initialLocation from parent. Attempting to fetch current location.');
      getLocation(false); // Call without showing process messages for automatic fetch
    }
  }, [isLoaded, loadError, initialLocation, getLocation, markerPosition]);


  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    console.log('[GoogleMapComponent] onMapLoad: Map instance loaded.');
  }, []);

  const handleMapClick = useCallback((event: google.maps.MapMouseEvent) => {
    if (event.latLng) {
      const newPos = { lat: event.latLng.lat(), lng: event.latLng.lng() };
      console.log('[GoogleMapComponent] handleMapClick: New position:', newPos);
      setMarkerPosition(newPos); // Update internal state
      onLocationSelected(newPos); // Notify parent
    }
  }, [onLocationSelected]);

  const handleMarkerDragEnd = useCallback((event: google.maps.MapMouseEvent) => {
    if (event.latLng) {
      const newPos = { lat: event.latLng.lat(), lng: event.latLng.lng() };
      console.log('[GoogleMapComponent] handleMarkerDragEnd: New position:', newPos);
      setMarkerPosition(newPos); // Update internal state
      onLocationSelected(newPos); // Notify parent
    }
  }, [onLocationSelected]);

  // Effect to fit map bounds to the circle or pan to marker
 useEffect(() => {
    if (!isLoaded || !mapRef.current || loadError) {
      return;
    }
    const map = mapRef.current;
    const targetPositionForBounds = markerPosition || mapCenter; // Use current marker or mapCenter

    if (targetPositionForBounds && searchRadiusKm && searchRadiusKm > 0 && typeof google !== 'undefined' && google.maps.geometry?.spherical) {
      const centerLatLng = new google.maps.LatLng(targetPositionForBounds.lat, targetPositionForBounds.lng);
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
          map.panTo(targetPositionForBounds);
          if ((map.getZoom() ?? 0) < 10 || (map.getZoom() ?? 0) > 15) map.setZoom(12);
        }
      } catch (e) {
        console.error("[GoogleMapComponent] useEffect [fitBounds]: Error calculating map bounds:", e);
        map.panTo(targetPositionForBounds);
        if ((map.getZoom() ?? 0) < 10 || (map.getZoom() ?? 0) > 15) map.setZoom(12);
      }
    } else if (targetPositionForBounds) { 
      map.panTo(targetPositionForBounds); 
      if (!searchRadiusKm && ((map.getZoom() ?? 0) < 10 || (map.getZoom() ?? 0) > 15)) map.setZoom(13); // Default zoom if no radius
    }
  }, [markerPosition, mapCenter, searchRadiusKm, isLoaded, loadError]); // Added mapCenter here


  console.log('[GoogleMapComponent Render States]', {
    props_isLoaded: isLoaded,
    props_loadError: loadError,
    props_initialLocation: initialLocation,
    state_mapCenter: mapCenter,
    state_markerPosition: markerPosition,
    state_isLocatingViaButton: isLocatingViaButton,
    map_reload_key: mapReloadKey,
  });

  if (loadError) {
    return (
      <div className="text-destructive p-4 border border-destructive rounded-md bg-destructive/10 h-[400px] w-full flex flex-col items-center justify-center text-center">
        <p className="font-semibold">Error loading Google Maps API: {loadError.message}</p>
        {!googleMapsApiKey && <p className="text-destructive text-sm mt-1">Google Maps API key is missing.</p>}
      </div>
    );
  }
  
  if (!isLoaded && !loadError && !googleMapsApiKey) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] w-full bg-muted/50 rounded-md text-center p-4">
          <p className="text-foreground font-semibold">Map Unavailable</p>
          <p className="text-destructive text-sm mt-1">Google Maps API key missing.</p>
      </div>
    );
  }
  
  if (!isLoaded && !loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] w-full bg-muted/50 rounded-md text-center p-4">
        <Icons.spinner className="mr-2 h-6 w-6 animate-spin text-primary" />
        <p className="text-foreground">Map is initializing...</p>
      </div>
    );
  }

  // Render the map once isLoaded is true
  return (
    <div className="relative h-[400px] w-full rounded-md overflow-hidden shadow-md border border-border">
      <GoogleMap
        key={mapReloadKey}
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={mapCenter} // Use the mapCenter state
        zoom={(mapRef.current?.getZoom() && (mapRef.current.getZoom() ?? 0) > 3) ? undefined : 12} 
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
            key={markerPosition ? `${markerPosition.lat}-${markerPosition.lng}-${searchRadiusKm}` : String(searchRadiusKm ?? 'defaultRadiusKey')}
            center={markerPosition}
            radius={searchRadiusKm * 1000}
            options={circleOptions}
          />
        )}
      </GoogleMap>
      <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-background/80 backdrop-blur-sm p-2 rounded-md shadow-lg text-xs text-foreground">
        {markerPosition ? `Selected: ${markerPosition.lat.toFixed(4)}, ${markerPosition.lng.toFixed(4)}`
          : `Map Center: ${mapCenter.lat.toFixed(4)}, ${mapCenter.lng.toFixed(4)}`}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm hover:bg-secondary/80"
        onClick={() => getLocation(true)} // Explicitly show messages
        disabled={isLocatingViaButton || !isLoaded}
      >
        <Icons.locate className="h-4 w-4 mr-1"/> {isLocatingViaButton ? "Locating..." : "My Location"}
      </Button>
    </div>
  );
};

export default GoogleMapComponent;
