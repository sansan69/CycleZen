
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import type { Coordinate } from '@/services/open-route-service';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { useToast } from '@/hooks/use-toast';

interface GoogleMapComponentProps {
  onLocationSelected: (location: Coordinate) => void;
  googleMapsApiKey: string;
}

const defaultCenter: Coordinate = {
  lat: 34.052235, // Los Angeles
  lng: -118.243683,
};

// Define libraries as a constant outside the component
const GOOGLE_MAPS_LIBRARIES: ("places")[] = ['places'];

const GoogleMapComponent: React.FC<GoogleMapComponentProps> = ({
  onLocationSelected,
  googleMapsApiKey,
}) => {
  const [currentLocation, setCurrentLocation] = useState<Coordinate | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Coordinate | null>(
    null
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const mapRef = useRef<google.maps.Map>();

  const mapOptions = {
    disableDefaultUI: true,
    zoomControl: true,
  };

  const { isLoaded, loadError: apiLoadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: googleMapsApiKey,
    libraries: GOOGLE_MAPS_LIBRARIES, // Use the constant here
  });

  useEffect(() => {
    const getLocation = async () => {
      setLoading(true);
      setError(null);

      try {
        if (!navigator.geolocation) {
          throw new Error('Geolocation is not supported by your browser.');
        }

        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            const options: PositionOptions = {
              enableHighAccuracy: true,
              timeout: 5000,
              maximumAge: 0,
            };
            
            navigator.geolocation.getCurrentPosition(resolve, reject, options);
        });
          
        const { latitude, longitude } = position.coords;

        setCurrentLocation({ lat: latitude, lng: longitude });
        setSelectedLocation({ lat: latitude, lng: longitude }); 
      } catch (err: any) {
        console.error('Error getting location:', err.message);
        setError(err.message);
        toast({
          title: "Location Error",
          description:
            err.message || "Could not retrieve your location. Please manually select a location or check permissions.",
          variant: "destructive",
        });
        setCurrentLocation(defaultCenter);
        setSelectedLocation(defaultCenter);
      } finally {
        setLoading(false);
      }
    };

    if (googleMapsApiKey && isLoaded) {
      getLocation();
    } else if (!googleMapsApiKey) {
      setLoading(false);
      setError('Google Maps API key is missing.');
      toast({
        title: "API Key Missing",
        description:
          "Google Maps API key is missing. Please configure it to use the map.",
        variant: "destructive",
      });
    }
  }, [isLoaded, googleMapsApiKey, toast]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    if (selectedLocation) {
        map.panTo(selectedLocation);
    } else if (currentLocation) {
        map.panTo(currentLocation);
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
      <div className="text-destructive p-4 border border-destructive rounded-md bg-destructive/10">
        Error loading Google Maps: {apiLoadError.message}. Please check your API key and internet connection.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] w-full bg-muted/50 rounded-md">
        <Icons.spinner className="mr-2 h-6 w-6 animate-spin text-primary" />
        <p className="text-foreground">Loading location and map...</p>
      </div>
    );
  }
  
  if (error && !currentLocation) {
     return (
        <div className="text-destructive p-4 border border-destructive rounded-md bg-destructive/10 h-[400px] w-full flex flex-col items-center justify-center">
          <p>Error: {error}</p>
          <p className="text-sm">Please ensure location services are enabled and permissions are granted for this site.</p>
          <p className="text-sm mt-2">You can still manually select a location by dragging the marker if the map loads.</p>
           {isLoaded && (
             <div className="mt-4 text-foreground">Loading map with default location...</div>
           )}
        </div>
      );
  }


  return (
    <div className="relative h-[400px] w-full rounded-md overflow-hidden shadow-md">
      {isLoaded && (currentLocation || selectedLocation) ? (
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
          </GoogleMap>
          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-background/80 backdrop-blur-sm p-2 rounded-md shadow-lg text-xs text-foreground">
            {selectedLocation ? (
              `Selected: ${selectedLocation.lat.toFixed(4)}, ${selectedLocation.lng.toFixed(4)}`
            ) : (
              "Detecting location..."
            )}
          </div>
          <Button 
            variant="outline"
            size="sm"
            className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm hover:bg-background"
            onClick={() => {
                if (isLoaded) {
                     setError(null);
                     setLoading(true);
                     navigator.geolocation.getCurrentPosition(
                        (position) => {
                            const { latitude, longitude } = position.coords;
                            setCurrentLocation({ lat: latitude, lng: longitude });
                            setSelectedLocation({ lat: latitude, lng: longitude });
                            setLoading(false);
                        },
                        (err) => {
                            console.error('Error re-getting location:', err.message);
                            setError(err.message);
                             toast({
                                title: "Location Error",
                                description: err.message || "Could not retrieve your location. Please check permissions.",
                                variant: "destructive",
                            });
                            setLoading(false);
                            if (!currentLocation) setCurrentLocation(defaultCenter);
                            if (!selectedLocation) setSelectedLocation(defaultCenter);
                        },
                        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
                    );
                }
            }}
            disabled={loading}
            >
             <Icons.locate className="h-4 w-4 mr-1"/> {loading ? "Locating..." : "My Location"}
           </Button>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-[400px] w-full bg-muted/50 rounded-md">
          <Icons.spinner className="mr-2 h-6 w-6 animate-spin text-primary" />
          <p className="text-foreground">Initializing map...</p>
          {!googleMapsApiKey && <p className="text-destructive text-sm mt-1">API key missing.</p>}
          {apiLoadError && <p className="text-destructive text-sm mt-1">Failed to load Google Maps script.</p>}
        </div>
      )}
    </div>
  );
};

export default GoogleMapComponent;
