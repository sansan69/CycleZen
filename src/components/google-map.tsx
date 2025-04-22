'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleMap, LoadScript, Marker, useJsapiLoader } from '@react-google-maps/api';
import { Coordinate } from '@/services/open-route-service';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { useToast } from '@/hooks/use-toast';

const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

interface GoogleMapComponentProps {
  onLocationSelected: (location: Coordinate) => void;
}

const defaultCenter: Coordinate = {
  lat: 34.052235, // Los Angeles
  lng: -118.243683,
};

const GoogleMapComponent: React.FC<GoogleMapComponentProps> = ({
  onLocationSelected,
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

  const { isLoaded, loadError } = useJsapiLoader({
    id: 'google-map-script',
    googleMapsApiKey: googleMapsApiKey || '',
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
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });

        const { latitude, longitude } = position.coords;
        setCurrentLocation({ lat: latitude, lng: longitude });
        setSelectedLocation({ lat: latitude, lng: longitude }); // Initialize selected location
      } catch (err: any) {
        console.error('Error getting location:', err.message);
        setError(err.message);
        toast({
          title: "Location Error",
          description:
            "Could not retrieve your location. Please manually select a location.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (googleMapsApiKey) {
      getLocation();
    } else {
      setLoading(false);
      setError('Google Maps API key is missing.');
      toast({
        title: "API Key Missing",
        description:
          "Google Maps API key is missing. Please configure it to use the map.",
        variant: "destructive",
      });
    }
  }, [toast]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center">
        <Icons.spinner className="mr-2 h-6 w-6 animate-spin" />
        Loading location...
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  if (loadError) {
    return <div>Error loading Google Maps.</div>;
  }

  return (
    <div className="relative h-[400px] w-full">
      {isLoaded && currentLocation ? (
        <>
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={currentLocation}
            zoom={15}
            options={mapOptions}
            onLoad={onMapLoad}
          >
            <Marker
              position={selectedLocation}
              draggable={true}
              onDragEnd={onMarkerDragEnd}
            />
          </GoogleMap>
        </>
      ) : (
        <div>Map Loading...</div>
      )}
      {isLoaded && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white p-2 rounded shadow-md">
          {selectedLocation && (
            <p className="text-sm">
              Selected Location: {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default GoogleMapComponent;
