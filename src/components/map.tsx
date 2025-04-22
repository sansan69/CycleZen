'use client';

import {useEffect, useRef} from 'react';
import {Coordinate} from '@/services/open-route-service';
import mapboxgl from 'mapbox-gl'; // Import the mapboxgl library

interface MapProps {
  location: Coordinate | null;
  onLocationChange: (location: Coordinate) => void;
}

export function Map({location, onLocationChange}: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    const loadMap = async () => {
      const mapboxAccessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

      if (!mapboxAccessToken) {
        console.error('Mapbox access token is missing.');
        return;
      }

      mapboxgl.accessToken = mapboxAccessToken;

      try {
        const map = new mapboxgl.Map({
          container: mapRef.current,
          style: 'mapbox://styles/mapbox/streets-v12', // Style URL
          center: location ? [location.lng, location.lat] : [0, 0], // Default to 0,0 if no location
          zoom: location ? 12 : 2,
        });

        // Add marker if location exists
        if (location) {
          new mapboxgl.Marker().setLngLat([location.lng, location.lat]).addTo(map);

          map.flyTo({
            center: [location.lng, location.lat],
            essential: true,
            zoom: 12,
          });
        }

        // Handle map click to update location
        map.on('click', e => {
          const newLocation: Coordinate = {
            lng: e.lngLat.lng,
            lat: e.lngLat.lat,
          };

          onLocationChange(newLocation);

          // Clear existing markers
          const existingMarkers = document.getElementsByClassName('mapboxgl-marker');
          while (existingMarkers[0]) {
            existingMarkers[0].parentNode?.removeChild(existingMarkers[0]);
          }

          // Add new marker
          new mapboxgl.Marker().setLngLat([newLocation.lng, newLocation.lat]).addTo(map);
        });

        map.on('error', (error) => {
          console.error('Mapbox API error:', error);
        });
      } catch (error) {
        console.error('Error loading Mapbox map:', error);
      }
    };

    loadMap();
  }, [location, onLocationChange]);

  return (
    <div
      ref={mapRef}
      className="map-container h-64 w-full rounded-md"
      id="map"
    />
  );
}


