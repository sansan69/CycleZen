import { Coordinate } from "../types";

/**
 * Represents a geographical coordinate with latitude and longitude.
 */
export interface Coordinate {
  /**
   * The latitude of the coordinate.
   */
  lat: number;
  /**
   * The longitude of the coordinate.
   */
  lng: number;
}

/**
 * Represents a cycling route.
 */
export interface CyclingRoute {
  /**
   * The total distance of the route in kilometers.
   */
  distance: number;
  /**
   * The estimated time to complete the route in minutes.
   */
  estimatedTime: number;
  /**
   * An array of geographical coordinates representing the route.
   */
  coordinates: Coordinate[];
}

/**
 * Asynchronously retrieves cycling routes from OpenRouteService API for a given location and radius.
 *
 * @param location The starting location for the routes.
 * @param radius The radius in kilometers within which to generate routes.
 * @param numberOfRoutes The number of routes to generate. Defaults to 3.
 * @returns A promise that resolves to an array of CyclingRoute objects.
 */
export async function getCyclingRoutes(
  location: Coordinate,
  radius: number,
  numberOfRoutes: number = 3
): Promise<CyclingRoute[]> {  
  const apiKey = process.env.NEXT_PUBLIC_OPEN_ROUTE_SERVICE_API_KEY;

  if (!apiKey) {
    throw new Error("OpenRouteService API key is missing.");
  }

  const cyclingRoutes: CyclingRoute[] = [];
  const maxTries = 3;

  for (let i = 0; i < numberOfRoutes; i++) {
    let route: CyclingRoute | null = null;
    let tries = 0;
    let retry = true;
    while (retry && tries < maxTries){
      try{
        route = await fetchRoute(apiKey, location, radius);
        retry = false;
      } catch (e) {
        tries++;
        console.error('Error getting route:', e);
        route = null;
      }
    }
    if (route) {
      cyclingRoutes.push(route);
    }

  }
  return cyclingRoutes;
}

async function fetchRoute(apiKey:string, location: Coordinate, radius: number): Promise<CyclingRoute> {
  const randomPoints = getRandomPoints(location, 3, 5);
  const profile = "cycling-regular";
  const maxRadiusMeters = radius * 1000
  const url = `https://api.openrouteservice.org/v2/directions/${profile}/geojson`;

  const body = {
    "coordinates": [
      [location.lng, location.lat],
      ...randomPoints,
      [location.lng, location.lat]
    ],
    "options": {
      "round_trip": {
        "length": maxRadiusMeters,
      },
      avoid_features: ["dead_ends"]
    },
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`OpenRouteService API request failed with status: ${response.status}`);
  }

  const data = await response.json();

  if (!data.features || data.features.length === 0) {
    throw new Error("No features found in the OpenRouteService API response.");
  }

  const feature = data.features[0];

  if (!feature.geometry || feature.geometry.type !== 'LineString') {
    throw new Error("Invalid geometry type in OpenRouteService API response.");
  }

  const coordinates: Coordinate[] = feature.geometry.coordinates.map(
    ([lng, lat]: number[]) => ({ lat, lng })
  );

  const distance = feature.properties.summary.distance / 1000;
  const estimatedTime = feature.properties.summary.duration / 60;

  return {
    distance,
    estimatedTime,
    coordinates,
  };

}




function getRandomPoints(center: Coordinate, minPoints: number, maxPoints: number): [number, number][] {
  const numPoints = Math.floor(Math.random() * (maxPoints - minPoints + 1)) + minPoints;
  const points = [];
  for (let i = 0; i < numPoints; i++) {
    points.push(getRandomPoint(center));
  }
  return points;
}



function getRandomPoint(center: Coordinate): [number, number] {
  const radius = 0.02; // Adjust the radius as needed for point distribution
  const angle = Math.random() * 2 * Math.PI;
  const distance = Math.random() * radius;

  const x = distance * Math.cos(angle);
  const y = distance * Math.sin(angle);

  const lat = center.lat + y;
  const lng = center.lng + x;

  return [lng, lat];
}

