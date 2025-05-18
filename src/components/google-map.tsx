
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleMap, Marker, Circle, useJsApiLoader } from '@react-google-maps/api';
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
  const [currentLocation, setCurrentLocation] = useState<Coordinate | null>(initialLocation || null);
  const [selectedLocation, setSelectedLocation] = useState<Coordinate | null>(initialLocation || null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
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

  const getLocation = useCallback(async (showMessages = true) => {
    setLoading(true);
    setError(null);

    if (!googleMapsApiKey) {
      setError('Google Maps API key is missing.');
      if (showMessages) {
        toast({
          title: "API Key Missing",
          description: "Google Maps API key is missing. Map functionality will be limited.",
          variant: "destructive",
          duration: 10000,
        });
      }
      setCurrentLocation(defaultCenter);
      if (!selectedLocation) setSelectedLocation(defaultCenter);
      setLoading(false);
      return;
    }

    if (!isLoaded) {
      if (showMessages && !loadError) {
         console.warn("getLocation called before Google Maps API is loaded or while there's a load error.");
      }
      setLoading(false);
      return;
    }
    
    if (loadError) {
        setError(`Failed to load Google Maps script: ${loadError.message}`);
        if (showMessages) {
            toast({ title: "Map Load Error", description: `Google Maps script failed to load: ${loadError.message}. Map functionality may be limited.`, variant: "destructive", duration: 10000 });
        }
        setCurrentLocation(defaultCenter);
        if (!selectedLocation) setSelectedLocation(defaultCenter);
        setLoading(false);
        return;
    }


    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      if (showMessages) {
        toast({ title: "Geolocation Error", description: "Geolocation is not supported. Please select a location manually.", variant: "destructive", duration: 7000 });
      }
      setCurrentLocation(defaultCenter);
      if (!selectedLocation) setSelectedLocation(defaultCenter);
      setLoading(false);
      return;
    }

    if (navigator.permissions && navigator.permissions.query) {
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
        if (permissionStatus.state === 'denied') {
          setError('Location permission denied by user or policy.');
          if (showMessages) {
            toast({
              title: "Location Permission Required",
              description: "Location permission was denied. Please enable it in your browser/OS settings for CycleZen to determine your current location. You can still manually select or search for a location on the map.",
              variant: "destructive",
              duration: 10000,
            });
          }
          setCurrentLocation(defaultCenter);
          if (!selectedLocation) setSelectedLocation(defaultCenter);
          setLoading(false);
          return;
        } else if (permissionStatus.state === 'prompt' && showMessages) {
          toast({
            title: "Location Access",
            description: "CycleZen needs your location. Please grant permission when prompted by your browser.",
            duration: 7000,
          });
        }
      } catch (permError: any) {
        console.warn("Could not query geolocation permission status:", permError.message, "Proceeding to attempt fetching location.");
      }
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        const options: PositionOptions = {
          enableHighAccuracy: true,
          timeout: 12000, 
          maximumAge: 0,
        };
        navigator.geolocation.getCurrentPosition(resolve, reject, options);
      });

      const { latitude, longitude } = position.coords;
      const fetchedLocation = { lat: latitude, lng: longitude };
      setCurrentLocation(fetchedLocation);
      
      if (showMessages) { // If showMessages is true (e.g., "My Location" button clicked or initial load)
        setSelectedLocation(fetchedLocation); // Directly update selectedLocation
        toast({
          title: "Location Updated",
          description: "Starting point set to your current location.",
        });
      } else if (!selectedLocation) {
        // Fallback for a silent initial fetch if no location was pre-set
        setSelectedLocation(fetchedLocation);
      }

    } catch (err: any) {
      console.error('Error getting location (getCurrentPosition):', err.message, err.code, err.name);
      setError(err.message);
      let toastTitle = "Location Error";
      let toastDescription = "Could not retrieve your location. Please manually select or search for a location on the map.";

      if (err.code === 1) { // PERMISSION_DENIED
        toastTitle = "Location Access Denied";
        toastDescription = "Location access denied. Please enable it in your browser/OS settings and grant permission to CycleZen. You can still manually select or search for a location.";
      } else if (err.code === 2) { // POSITION_UNAVAILABLE
        toastTitle = "Location Services Off?";
        toastDescription = "Could not determine your location. Please ensure your device's GPS/location services are turned on and try again. You can still manually select or search for a location.";
      } else if (err.code === 3) { // TIMEOUT
        toastTitle = "Location Timeout";
        toastDescription = "Getting location timed out. Ensure GPS/location services are on and try again, or select a location manually on the map.";
      } else if (err.message && (err.message.toLowerCase().includes("permissions policy") || err.message.toLowerCase().includes("disabled in this document"))) {
        toastTitle = "Location Permission Blocked";
        toastDescription = "Geolocation has been disabled by a permissions policy. Please check your browser and OS location settings for CycleZen and grant permission. You can still manually select or search for a location.";
      }
      
      if (showMessages) {
        toast({
          title: toastTitle,
          description: toastDescription,
          variant: "destructive",
          duration: 10000,
        });
      }
      if (!currentLocation && !selectedLocation) {
        setCurrentLocation(defaultCenter);
        setSelectedLocation(defaultCenter);
      }
    } finally {
      setLoading(false);
    }
  }, [toast, googleMapsApiKey, isLoaded, loadError, selectedLocation]); 

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const onMarkerDragEnd = useCallback((event: google.maps.MapMouseEvent) => {
    if (event.latLng) {
      const lat = event.latLng.lat();
      const lng = event.latLng.lng();
      setSelectedLocation({ lat, lng });
    }
  }, []);

  useEffect(() => {
    if (selectedLocation) {
      onLocationSelected(selectedLocation);
    }
  }, [selectedLocation, onLocationSelected]);

  useEffect(() => {
    if (initialLocation) {
      setSelectedLocation(initialLocation);
      setCurrentLocation(initialLocation); 
      setLoading(false); 
    } else if (isLoaded && !loadError) { 
      getLocation(true);
    } else if (loadError) {
        setError(`Failed to load Google Maps script: ${loadError.message}`);
        toast({ title: "Map Load Error", description: `Google Maps script failed to load: ${loadError.message}. Map functionality may be limited.`, variant: "destructive", duration: 10000 });
        setCurrentLocation(defaultCenter);
        setSelectedLocation(defaultCenter);
        setLoading(false);
    }
  }, [isLoaded, loadError, initialLocation, getLocation, toast]);


  useEffect(() => {
    if (!isLoaded || !mapRef.current || loadError) return; 
    const map = mapRef.current;

    if (selectedLocation && searchRadiusKm && searchRadiusKm > 0 && google.maps.geometry) {
      const centerLatLng = new google.maps.LatLng(selectedLocation.lat, selectedLocation.lng);
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
            console.warn("Could not compute bounds for map fitting.");
            map.panTo(selectedLocation);
            if ((map.getZoom() ?? 0) < 10 || (map.getZoom() ?? 0) > 15) map.setZoom(13);
        }
      } catch (e) {
        console.error("Error calculating map bounds with geometry library:", e);
        map.panTo(selectedLocation);
        if ((map.getZoom() ?? 0) < 10 || (map.getZoom() ?? 0) > 15) map.setZoom(13);
      }
    } else if (selectedLocation) {
      map.panTo(selectedLocation);
      if ((map.getZoom() ?? 0) < 10 || (map.getZoom() ?? 0) > 15) map.setZoom(13);
    } else if (currentLocation) {
      map.panTo(currentLocation);
      map.setZoom(13);
    } else {
      map.panTo(defaultCenter);
      map.setZoom(5);
    }
  }, [selectedLocation, searchRadiusKm, isLoaded, loadError, currentLocation]);

  if (loadError) {
    return (
      <div className="text-destructive p-4 border border-destructive rounded-md bg-destructive/10 h-[400px] w-full flex flex-col items-center justify-center text-center">
        <p className="font-semibold">Error loading Google Maps API: {loadError.message}</p>
        <p className="text-sm mt-1">Please check your internet connection and the Google Maps API key configuration.</p>
         {!googleMapsApiKey && <p className="text-destructive text-sm mt-1">Google Maps API key is missing in your app configuration.</p>}
      </div>
    );
  }

  if (loading && !currentLocation && !error && !selectedLocation) {
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
        {error && <p className="text-sm text-destructive mt-2">{error}</p>}
        {!googleMapsApiKey && <p className="text-destructive text-sm mt-1">Google Maps API key missing.</p>}
      </div>
    );
  }

  return (
    <div className="relative h-[400px] w-full rounded-md overflow-hidden shadow-md border border-border">
      {isLoaded && (currentLocation || selectedLocation || defaultCenter) ? (
        <>
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={selectedLocation || currentLocation || defaultCenter}
            zoom={12}
            options={mapOptions}
            onLoad={onMapLoad}
            onClick={(e) => {
              if (e.latLng) {
                setSelectedLocation({ lat: e.latLng.lat(), lng: e.latLng.lng() });
              }
            }}
          >
            {selectedLocation && (
              <Marker
                position={selectedLocation}
                draggable={true}
                onDragEnd={onMarkerDragEnd}
              />
            )}
            {selectedLocation && searchRadiusKm && searchRadiusKm > 0 && (
              <Circle
                center={selectedLocation}
                radius={searchRadiusKm * 1000}
                options={circleOptions}
              />
            )}
          </GoogleMap>
          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-background/80 backdrop-blur-sm p-2 rounded-md shadow-lg text-xs text-foreground">
            {selectedLocation ? (
              `Selected: ${selectedLocation.lat.toFixed(4)}, ${selectedLocation.lng.toFixed(4)}`
            ) : currentLocation ? (
              `Current: ${currentLocation.lat.toFixed(4)}, ${currentLocation.lng.toFixed(4)}`
            ) : error ? (
              "Using default location"
            ) : (
              "Detecting location..."
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm"
            onClick={() => getLocation(true)} 
            disabled={loading || !isLoaded} 
          >
            <Icons.locate className="h-4 w-4 mr-1" /> {loading ? "Locating..." : "My Location"}
          </Button>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-[400px] w-full bg-muted/50 rounded-md">
          <Icons.spinner className="mr-2 h-6 w-6 animate-spin text-primary" />
          <p className="text-foreground">Initializing map...</p>
          {!googleMapsApiKey && <p className="text-destructive text-sm mt-1">Google Maps API key missing.</p>}
          {loadError && <p className="text-destructive text-sm mt-1">Failed to load Google Maps script: {loadError.message}</p>}
          {error && <p className="text-sm text-destructive mt-2">{error}</p>}
        </div>
      )}
    </div>
  );
};

export default GoogleMapComponent;
