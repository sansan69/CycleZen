
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
  const [mapCenter, setMapCenter] = useState<Coordinate | null>(null);
  const [markerPosition, setMarkerPosition] = useState<Coordinate | null>(null);
  const [internalLoading, setInternalLoading] = useState<boolean>(true);
  const [internalError, setInternalError] = useState<string | null>(null);
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

  const getLocation = useCallback(async (showProcessMessages = false) => {
    console.log('[getLocation] Called. showProcessMessages:', showProcessMessages, 'API Key available:', !!googleMapsApiKey, 'isLoaded prop:', isLoaded);
    setInternalLoading(true);
    setInternalError(null);

    if (!googleMapsApiKey) {
      const msg = 'Google Maps API key is missing.';
      console.error('[getLocation] API Key Missing:', msg);
      setInternalError(msg);
      if (showProcessMessages) toast({ title: "API Key Missing", description: msg, variant: "destructive" });
      setMapCenter(defaultCenter);
      setMarkerPosition(defaultCenter);
      setInternalLoading(false);
      return;
    }

    if (!isLoaded) {
      const msg = "Google Maps API not loaded yet.";
      console.warn('[getLocation] Attempted to get location before Google Maps API is loaded.');
      setInternalError(msg);
      if (showProcessMessages) toast({ title: "Map Not Ready", description: msg, variant: "default" });
      setMapCenter(defaultCenter);
      setMarkerPosition(defaultCenter);
      setInternalLoading(false);
      return;
    }
    if (loadError) {
      const msg = `Failed to load Google Maps script: ${loadError.message}.`;
      console.error('[getLocation] Google Maps API loadError:', msg);
      setInternalError(msg);
      if (showProcessMessages) toast({ title: "Map Load Error", description: msg, variant: "destructive" });
      setMapCenter(defaultCenter);
      setMarkerPosition(defaultCenter);
      setInternalLoading(false);
      return;
    }

    if (!navigator.geolocation) {
      const msg = 'Geolocation is not supported by your browser.';
      console.error('[getLocation] Geolocation not supported.');
      setInternalError(msg);
      if (showProcessMessages) toast({ title: "Geolocation Error", description: msg, variant: "destructive" });
      setMapCenter(defaultCenter);
      setMarkerPosition(defaultCenter);
      setInternalLoading(false);
      return;
    }

    if (navigator.permissions && navigator.permissions.query) {
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
        console.log('[getLocation] Geolocation permission status:', permissionStatus.state);
        if (permissionStatus.state === 'denied') {
          const msg = 'Location permission denied. Please enable it in browser/OS settings.';
          setInternalError(msg);
          if (showProcessMessages) toast({ title: "Location Permission Denied", description: msg, variant: "destructive" });
          setMapCenter(defaultCenter);
          setMarkerPosition(defaultCenter);
          setInternalLoading(false);
          return;
        } else if (permissionStatus.state === 'prompt' && showProcessMessages) {
          toast({ title: "Location Access", description: "Please grant permission when prompted by your browser.", duration: 7000 });
        }
      } catch (permError: any) {
        console.warn("[getLocation] Could not query geolocation permission status:", permError.message);
      }
    }

    try {
      console.log('[getLocation] Attempting navigator.geolocation.getCurrentPosition...');
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
      });
      const { latitude, longitude } = position.coords;
      const fetchedLocation = { lat: latitude, lng: longitude };
      console.log('[getLocation] Successfully fetched location:', fetchedLocation);
      
      setMapCenter(fetchedLocation);
      setMarkerPosition(fetchedLocation);

      if (showProcessMessages) { // only call onLocationSelected if initiated by user action (button click)
         onLocationSelected(fetchedLocation);
         toast({ title: "Location Updated", description: "Starting point set to your current location."});
      } else if (!initialLocation) { // or if it's the very first automatic fetch and no initialLocation was provided
         onLocationSelected(fetchedLocation);
      }

    } catch (err: any) {
      console.error('[getLocation] Error from getCurrentPosition:', err.code, err.message);
      let toastTitle = "Location Error";
      let toastDescription = "Could not retrieve your location. Please select manually or check settings.";
      if (err.code === 1) { toastTitle = "Location Access Denied"; toastDescription = "Please enable location permission in browser/OS settings to use this feature."; }
      else if (err.code === 2) { toastTitle = "Location Services Off?"; toastDescription = "Could not retrieve location. Please ensure device GPS/location services are turned on."; }
      else if (err.code === 3) { toastTitle = "Location Timeout"; toastDescription = "Could not get location in time. Ensure GPS/location services are on and try again."; }
      else if (err.message?.toLowerCase().includes("permissions policy")) { toastTitle = "Location Permission Blocked"; toastDescription = "Geolocation is disabled by a permissions policy. Check browser/OS settings.";}
      
      setInternalError(err.message || 'Failed to retrieve location.');
      if (showProcessMessages) toast({ title: toastTitle, description: toastDescription, variant: "destructive" });
      
      if (!mapCenter && !markerPosition) {
          setMarkerPosition(defaultCenter);
          setMapCenter(defaultCenter);
      }
    } finally {
      setInternalLoading(false);
    }
  }, [toast, googleMapsApiKey, isLoaded, loadError, onLocationSelected, initialLocation]);

  useEffect(() => {
    if (initialLocation) {
      console.log('[GoogleMapComponent] useEffect [initialLocation]: Received new initialLocation prop.', initialLocation);
      setMapCenter(initialLocation);
      setMarkerPosition(initialLocation);
      setMapReloadKey(prev => prev + 1); // Force map re-render on external location change
      if (internalLoading) {
         setInternalLoading(false);
      }
      setInternalError(null);
    }
  }, [initialLocation, internalLoading]); // Removed internalLoading from dependency to avoid potential loops if it's set elsewhere

  useEffect(() => {
    console.log('[GoogleMapComponent] useEffect [self-fetch check]: Evaluating conditions.', { initialLocation, isLoaded, loadError, mapCenter, internalLoading });
    if (!initialLocation && isLoaded && !loadError && !mapCenter && internalLoading) {
      console.log('[GoogleMapComponent] useEffect [self-fetch check]: Conditions met. Calling getLocation(false).');
      getLocation(false);
    } else if (isLoaded && !loadError && internalLoading && !mapCenter && !initialLocation) {
      // If API is loaded, no error, still loading internally, but no location yet. Fallback after a delay.
      console.log('[GoogleMapComponent] useEffect [self-fetch check]: Fallback to default if still loading without location.');
      setMapCenter(defaultCenter);
      setMarkerPosition(defaultCenter);
      setInternalLoading(false);
    } else if (isLoaded && internalLoading && initialLocation && (!mapCenter || !markerPosition)) {
      // This ensures that if initialLocation is provided and map is loaded, internal state reflects it
      setMapCenter(initialLocation);
      setMarkerPosition(initialLocation);
      setInternalLoading(false);
    } else if (isLoaded && !initialLocation && internalLoading) {
        // If map is loaded, no initial location, and still internal loading, try to fetch.
        getLocation(false);
    }

  }, [initialLocation, isLoaded, loadError, mapCenter, internalLoading, getLocation, markerPosition]);


  useEffect(() => {
    if (loadError && !mapCenter && !markerPosition) { 
      console.error('[GoogleMapComponent] useEffect [loadError from parent]: API loadError from parent and no location established. Setting defaults and internalLoading to false.', loadError);
      setInternalError(`Failed to load Google Maps script: ${loadError.message}.`);
      setMapCenter(defaultCenter);
      setMarkerPosition(defaultCenter);
      if (internalLoading) setInternalLoading(false);
    }
  }, [loadError, mapCenter, markerPosition, internalLoading]);


  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    console.log('[GoogleMapComponent] onMapLoad: Map instance loaded.');
  }, []);

  const handleMapClick = useCallback((event: google.maps.MapMouseEvent) => {
    if (event.latLng) {
      const newPos = { lat: event.latLng.lat(), lng: event.latLng.lng() };
      console.log('[GoogleMapComponent] handleMapClick: New position:', newPos);
      setMarkerPosition(newPos);
      onLocationSelected(newPos);
    }
  }, [onLocationSelected]);

  const handleMarkerDragEnd = useCallback((event: google.maps.MapMouseEvent) => {
    if (event.latLng) {
      const newPos = { lat: event.latLng.lat(), lng: event.latLng.lng() };
      console.log('[GoogleMapComponent] handleMarkerDragEnd: New position:', newPos);
      setMarkerPosition(newPos);
      onLocationSelected(newPos);
    }
  }, [onLocationSelected]);

  useEffect(() => {
    if (!isLoaded || !mapRef.current || loadError || !mapCenter) {
      console.log('[GoogleMapComponent] useEffect [fitBounds]: Skipping fitBounds due to conditions.', { isLoaded, mapRefCurrent: !!mapRef.current, loadError, mapCenter });
      return;
    }
    const map = mapRef.current;
    const targetPositionForBounds = markerPosition || mapCenter;

    console.log('[GoogleMapComponent] useEffect [fitBounds]: Running with targetPositionForBounds:', targetPositionForBounds, 'searchRadiusKm:', searchRadiusKm);

    if (targetPositionForBounds && searchRadiusKm && searchRadiusKm > 0 && typeof google !== 'undefined' && google.maps && google.maps.geometry && google.maps.geometry.spherical) {
      const centerLatLng = new google.maps.LatLng(targetPositionForBounds.lat, targetPositionForBounds.lng);
      const radiusInMeters = searchRadiusKm * 1000;
      try {
        const neBoundPoint = google.maps.geometry.spherical.computeOffset(centerLatLng, radiusInMeters * Math.sqrt(2), 45);
        const swBoundPoint = google.maps.geometry.spherical.computeOffset(centerLatLng, radiusInMeters * Math.sqrt(2), 225);
        if (neBoundPoint && swBoundPoint) {
          const bounds = new google.maps.LatLngBounds();
          bounds.extend(neBoundPoint);
          bounds.extend(swBoundPoint);
          console.log('[GoogleMapComponent] useEffect [fitBounds]: Fitting bounds:', bounds.toJSON());
          map.fitBounds(bounds);
        } else {
          console.warn('[GoogleMapComponent] useEffect [fitBounds]: Could not compute bounds, panning instead.');
          map.panTo(targetPositionForBounds);
          if ((map.getZoom() ?? 0) < 10 || (map.getZoom() ?? 0) > 15) map.setZoom(13);
        }
      } catch (e) {
        console.error("[GoogleMapComponent] useEffect [fitBounds]: Error calculating map bounds:", e);
        map.panTo(targetPositionForBounds);
        if ((map.getZoom() ?? 0) < 10 || (map.getZoom() ?? 0) > 15) map.setZoom(13);
      }
    } else if (targetPositionForBounds) { 
      console.log('[GoogleMapComponent] useEffect [fitBounds]: No searchRadiusKm, panning to targetPositionForBounds.');
      map.panTo(targetPositionForBounds); 
      if ((map.getZoom() ?? 0) < 10 || (map.getZoom() ?? 0) > 15) map.setZoom(13);
    }
  }, [markerPosition, searchRadiusKm, isLoaded, loadError, mapCenter]);


  console.log('[GoogleMapComponent Render States]', {
    props_isLoaded: isLoaded,
    props_loadError: loadError,
    props_initialLocation: initialLocation,
    state_internalLoading: internalLoading,
    state_internalError: internalError,
    state_mapCenter: mapCenter,
    state_markerPosition: markerPosition,
    map_reload_key: mapReloadKey,
  });


  if (loadError) {
    console.log('[GoogleMapComponent Render] Rendering: API Load Error Message');
    return (
      <div className="text-destructive p-4 border border-destructive rounded-md bg-destructive/10 h-[400px] w-full flex flex-col items-center justify-center text-center">
        <p className="font-semibold">Error loading Google Maps API: {loadError.message}</p>
        {!googleMapsApiKey && <p className="text-destructive text-sm mt-1">Google Maps API key is missing.</p>}
      </div>
    );
  }
  
  if (!isLoaded && !loadError && !googleMapsApiKey) {
    console.log('[GoogleMapComponent Render] Rendering: API Key Missing Message');
    return (
      <div className="flex flex-col items-center justify-center h-[400px] w-full bg-muted/50 rounded-md text-center p-4">
          <p className="text-foreground font-semibold">Map Unavailable</p>
          <p className="text-destructive text-sm mt-1">Google Maps API key missing.</p>
      </div>
    );
  }
  
  if (internalLoading && !markerPosition && !internalError && !mapCenter) {
    console.log('[GoogleMapComponent Render] Rendering: "Detecting location and initializing map..." because internalLoading AND no marker/error/mapCenter');
    return (
      <div className="flex flex-col items-center justify-center h-[400px] w-full bg-muted/50 rounded-md">
        <Icons.spinner className="mr-2 h-6 w-6 animate-spin text-primary" />
        <p className="text-foreground">Detecting location and initializing map...</p>
      </div>
    );
  }
  
  if (!isLoaded && !loadError) {
    console.log('[GoogleMapComponent Render] Rendering: "Map is initializing..." because !isLoaded from parent');
    return (
      <div className="flex flex-col items-center justify-center h-[400px] w-full bg-muted/50 rounded-md text-center p-4">
        <Icons.spinner className="mr-2 h-6 w-6 animate-spin text-primary" />
        <p className="text-foreground">Map is initializing...</p>
        {internalError && <p className="text-sm text-destructive mt-2">{internalError}</p>}
      </div>
    );
  }

  const displayCenter = mapCenter || markerPosition || defaultCenter;
  console.log('[GoogleMapComponent Render] Rendering: Actual Map. Display Center:', displayCenter);

  return (
    <div className="relative h-[400px] w-full rounded-md overflow-hidden shadow-md border border-border">
      {isLoaded && displayCenter ? (
        <>
          <GoogleMap
            key={mapReloadKey} // Add key here
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={displayCenter}
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
              : mapCenter ? `Current: ${mapCenter.lat.toFixed(4)}, ${mapCenter.lng.toFixed(4)}`
              : internalError ? `Error: ${internalError.substring(0,30)}... Using default.`
              : "Detecting location..."}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm hover:bg-secondary/80"
            onClick={() => getLocation(true)}
            disabled={internalLoading || !isLoaded}
          >
            <Icons.locate className="h-4 w-4 mr-1"/> {internalLoading ? "Locating..." : "My Location"}
          </Button>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-[400px] w-full bg-muted/50 rounded-md">
          <Icons.spinner className="mr-2 h-6 w-6 animate-spin text-primary" />
          <p className="text-foreground">Initializing map view...</p>
          {loadError && <p className="text-destructive text-sm mt-1">Failed to load Google Maps script: {loadError.message}</p>}
          {internalError && <p className="text-sm text-destructive mt-2">{internalError}</p>}
          {!googleMapsApiKey && <p className="text-destructive text-sm mt-1">API Key Missing.</p>}
        </div>
      )}
    </div>
  );
};

export default GoogleMapComponent;
    
