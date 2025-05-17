
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
}

const defaultCenter: Coordinate = {
  lat: 34.052235, // Los Angeles
  lng: -118.243683,
};

const GOOGLE_MAPS_LIBRARIES = ['places'] as ('places')[]; // Ensure stable reference

const GoogleMapComponent: React.FC<GoogleMapComponentProps> = ({
  onLocationSelected,
  googleMapsApiKey,
  searchRadiusKm,
}) => {
  const [currentLocation, setCurrentLocation] = useState<Coordinate | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Coordinate | null>(null);
  const [loading, setLoading] = useState<boolean>(true); 
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const mapRef = useRef<google.maps.Map>();

  const mapOptions = {
    disableDefaultUI: true,
    zoomControl: true,
  };

  const circleOptions = {
    strokeColor: "hsl(var(--accent))", 
    strokeOpacity: 0.8,
    strokeWeight: 2,
    fillColor: "hsl(var(--accent))", 
    fillOpacity: 0.20, // Slightly more transparent fill
    clickable: false,
    draggable: false,
    editable: false,
    visible: true,
    zIndex: 1,
  };

  const { isLoaded, loadError: apiLoadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: googleMapsApiKey,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const getLocation = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (!googleMapsApiKey) {
      setError('Google Maps API key is missing.');
      toast({
        title: "API Key Missing",
        description: "Google Maps API key is missing. Map functionality will be limited.",
        variant: "destructive",
        duration: 10000,
      });
      setCurrentLocation(defaultCenter);
      setSelectedLocation(defaultCenter);
      setLoading(false);
      return;
    }

    if (!isLoaded) {
      setLoading(false); 
      return;
    }

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      toast({ title: "Geolocation Error", description: "Geolocation is not supported by your browser. Please select a location manually.", variant: "destructive", duration: 7000 });
      setCurrentLocation(defaultCenter);
      setSelectedLocation(defaultCenter);
      setLoading(false);
      return;
    }

    if (navigator.permissions && navigator.permissions.query) {
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
        if (permissionStatus.state === 'denied') {
          setError('Location permission denied by user or policy.');
          toast({
            title: "Location Permission Required",
            description: "Location permission was denied. Please enable it in your browser/OS settings for CycleZen to determine your current location. You can still manually select a location on the map.",
            variant: "destructive",
            duration: 10000,
          });
          setCurrentLocation(defaultCenter);
          setSelectedLocation(defaultCenter);
          setLoading(false);
          return;
        } else if (permissionStatus.state === 'prompt') {
          toast({
            title: "Location Access",
            description: "CycleZen needs your location to enhance your experience. Please grant permission when prompted.",
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
      setCurrentLocation({ lat: latitude, lng: longitude });
      setSelectedLocation({ lat: latitude, lng: longitude });
    } catch (err: any) {
      console.error('Error getting location (getCurrentPosition):', err.message, err.code, err.name);
      setError(err.message);
      let toastTitle = "Location Error";
      let toastDescription = "Could not retrieve your location. Please manually select a location on the map.";
      
      if (err.code === 1) { 
          toastTitle = "Location Access Denied";
          toastDescription = "Location access was denied. Please enable it in your browser/OS settings and grant permission to CycleZen. You can still manually select a location.";
      } else if (err.code === 2) { 
          toastTitle = "Location Services Off?";
          toastDescription = "Could not determine your location. Please ensure your device's GPS/location services are turned on and try again. You can still manually select a location.";
      } else if (err.code === 3) { 
          toastTitle = "Location Timeout";
          toastDescription = "Getting location timed out. Ensure GPS/location services are on and try again, or select a location manually on the map.";
      } else if (err.message && (err.message.toLowerCase().includes("permissions policy") || err.message.toLowerCase().includes("disabled in this document"))) {
          toastTitle = "Location Permission Blocked";
          toastDescription = "Geolocation has been disabled by a permissions policy. Please check your browser and OS location settings for CycleZen and grant permission. You can still manually select a location.";
      }

      toast({
        title: toastTitle,
        description: toastDescription,
        variant: "destructive",
        duration: 10000,
      });
      setCurrentLocation(defaultCenter); 
      setSelectedLocation(defaultCenter); 
    } finally {
      setLoading(false);
    }
  }, [toast, googleMapsApiKey, isLoaded]); 

  useEffect(() => {
    getLocation();
  }, [getLocation]);


  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    if (selectedLocation) {
        map.panTo(selectedLocation);
    } else if (currentLocation) {
        map.panTo(currentLocation);
    } else if (mapRef.current && defaultCenter) {
        mapRef.current.panTo(defaultCenter); 
    }
  }, [selectedLocation, currentLocation]);

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
      if (mapRef.current) {
        mapRef.current.panTo(selectedLocation);
      }
    }
  }, [selectedLocation, onLocationSelected]);

  if (apiLoadError) {
    return (
      <div className="text-destructive p-4 border border-destructive rounded-md bg-destructive/10 h-[400px] w-full flex flex-col items-center justify-center text-center">
        <p className="font-semibold">Error loading Google Maps API: {apiLoadError.message}</p>
        <p className="text-sm mt-1">Please check your internet connection and the Google Maps API key configuration.</p>
      </div>
    );
  }
  
  if (loading && !currentLocation && !error) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] w-full bg-muted/50 rounded-md">
        <Icons.spinner className="mr-2 h-6 w-6 animate-spin text-primary" />
        <p className="text-foreground">Detecting location and initializing map...</p>
      </div>
    );
  }

  if (!isLoaded && error) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] w-full bg-muted/50 rounded-md text-center p-4">
        <Icons.spinner className="mr-2 h-6 w-6 animate-spin text-primary" />
        <p className="text-foreground">Map is initializing...</p>
        <p className="text-sm text-destructive mt-2">{error}</p>
        <p className="text-xs text-muted-foreground mt-1">Attempting to load map with default location.</p>
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
            zoom={13}
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
                radius={searchRadiusKm * 1000} // Convert km to meters
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
            className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm hover:bg-background"
            onClick={getLocation} 
            disabled={loading}
            >
             <Icons.locate className="h-4 w-4 mr-1"/> {loading ? "Locating..." : "My Location"}
           </Button>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-[400px] w-full bg-muted/50 rounded-md">
          <Icons.spinner className="mr-2 h-6 w-6 animate-spin text-primary" />
          <p className="text-foreground">Initializing map...</p>
          {!googleMapsApiKey && <p className="text-destructive text-sm mt-1">Google Maps API key missing.</p>}
          {apiLoadError && <p className="text-destructive text-sm mt-1">Failed to load Google Maps script: {apiLoadError.message}</p>}
        </div>
      )}
    </div>
  );
};

export default GoogleMapComponent;

