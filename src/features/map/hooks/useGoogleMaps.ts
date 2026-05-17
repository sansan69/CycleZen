'use client';

import { useJsApiLoader } from '@react-google-maps/api';

const GOOGLE_MAPS_LIBRARIES = ['places', 'geometry'] as ('places' | 'geometry')[];
const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export function useGoogleMaps() {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'cyclezen-google-maps',
    googleMapsApiKey,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  return {
    isLoaded,
    loadError: loadError || undefined,
    googleMapsApiKey,
  };
}
