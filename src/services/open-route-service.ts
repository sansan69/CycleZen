
// No changes needed to this file based on the immediate problem.
// The types Coordinate and CyclingRoute are already defined and exported correctly.
// The getCyclingRoutes and fetchRoute functions return CyclingRoute[].
// The error handling within fetchRoute for non-OK responses is present.

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
  /**
   * The raw geometry string, if needed for other purposes (optional)
   */
  geometry?: string;
}

/**
 * Asynchronously retrieves cycling routes from OpenRouteService API for a given location and radius.
 *
 * @param location The starting location for the routes.
 * @param radius The radius in kilometers which influences the target length of the routes.
 * @param numberOfRoutes The number of routes to generate. Defaults to 3.
 * @returns A promise that resolves to an array of CyclingRoute objects.
 */
export async function getCyclingRoutes(
  location: Coordinate,
  radius: number, // This radius is used for round_trip.length
  numberOfRoutes: number = 3
): Promise<CyclingRoute[]> {
  const apiKey = process.env.NEXT_PUBLIC_OPEN_ROUTE_SERVICE_API_KEY;

  const cyclingRoutes: CyclingRoute[] = [];
  const maxTriesPerRoute = 2; // Try a couple of times per route if random points fail

  if (!apiKey) {
    console.error("OpenRouteService API key is missing. Please configure it to use the map.");
    // Optionally throw an error or return an empty array with a user-facing message source
    throw new Error("OpenRouteService API key is not configured.");
  }

  for (let i = 0; i < numberOfRoutes; i++) {
    let route: CyclingRoute | null = null;
    for (let tryCount = 0; tryCount < maxTriesPerRoute; tryCount++) {
      try {
        // Pass a slightly different seed or variation for random points each time if needed
        // For now, random points are generated inside fetchRoute
        route = await fetchRoute(apiKey, location, radius * 1000); // radius to meters for length
        if (route) {
          cyclingRoutes.push(route);
          break; // Got a route, move to the next one
        }
      } catch (e: any) {
        console.warn(`Attempt ${tryCount + 1} to fetch route ${i + 1} failed: ${e.message}`);
        if (tryCount === maxTriesPerRoute - 1) {
          console.error(`Failed to fetch route ${i + 1} after ${maxTriesPerRoute} attempts.`);
        }
      }
    }
  }
  return cyclingRoutes;
}

async function fetchRoute(apiKey:string, startLocation: Coordinate, targetLengthMeters: number): Promise<CyclingRoute> {
  // Generate 3 to 5 random intermediate points.
  // The spread of these points might need to be relative to targetLengthMeters.
  // For now, using a fixed spread as in the original getRandomPoint.
  const randomIntermediatePoints = getRandomPoints(startLocation, 2, 3, targetLengthMeters * 0.1); // Spread based on 10% of target length

  const profile = "cycling-regular";
  const url = `https://api.openrouteservice.org/v2/directions/${profile}/geojson`;

  const coordinatesPayload = [
    [startLocation.lng, startLocation.lat],
    ...randomIntermediatePoints,
    [startLocation.lng, startLocation.lat]
  ];

  const body = {
    "coordinates": coordinatesPayload,
    "options": {
      "round_trip": {
        "length": targetLengthMeters, // Target length of the round trip in meters
        "points": Math.floor(coordinatesPayload.length / 2) , // Optional: influence number of points in generated round trip
        "seed": Math.floor(Math.random() * 1000) // Add randomness to ORS generation
      },
      "avoid_features": ["fords", "ferries"],
    },
    "preference": "recommended", // Moved from options to root
    "geometry_simplify": "true", // Simplify geometry to reduce payload
    "maximum_speed": 40 // Cycling speed limit
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": apiKey,
      "Content-Type": "application/json",
      "Accept": "application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8",
    },
    body: JSON.stringify(body),
  });

  const responseText = await response.text(); // Read text first for better error logging

  if (!response.ok) {
    console.error("OpenRouteService API Error Response Text:", responseText);
    let errorMessage = `OpenRouteService API request failed with status: ${response.status}.`;
    try {
        const errorJson = JSON.parse(responseText);
        errorMessage += ` Message: ${errorJson.error?.message || 'Unknown error.'}`;
        if(errorJson.error?.details) {
          errorMessage += ` Details: ${JSON.stringify(errorJson.error.details)}`;
        }
    } catch (e) {
        errorMessage += ` Response: ${responseText.substring(0, 200)}...`; // Log part of the response if not JSON
    }
    throw new Error(errorMessage);
  }

  const data = JSON.parse(responseText);

  if (!data.features || data.features.length === 0) {
    throw new Error("No features found in the OpenRouteService API response. The criteria might be too restrictive.");
  }

  const feature = data.features[0];

  if (!feature.geometry || feature.geometry.type !== 'LineString') {
    throw new Error("Invalid geometry type in OpenRouteService API response.");
  }

  const routeCoordinates: Coordinate[] = feature.geometry.coordinates.map(
    ([lng, lat]: number[]) => ({ lat, lng })
  );

  // The summary might be on feature.properties.summary or directly on feature.properties.segments[0] if not aggregated
  const summary = feature.properties.summary || (feature.properties.segments && feature.properties.segments[0]);
  if (!summary) {
    throw new Error("Route summary (distance, duration) not found in OpenRouteService API response.");
  }

  const distanceKm = summary.distance / 1000;
  const durationMinutes = summary.duration / 60;

  // ORS returns geometry as [[lng, lat], ...]. We need to convert it for Polyline.
  // Also, store the original geometry string if needed for other map types or debugging.
  // For Google Maps Polyline, it expects {lat, lng} array.

  return {
    distance: distanceKm,
    estimatedTime: durationMinutes,
    coordinates: routeCoordinates,
    // geometry: feature.geometry.coordinates.map((c: number[]) => c.join(',')).join(' ') // Example if string form needed
  };
}

// Helper function to generate random points around a center
// Added a 'spreadRadiusMeters' to make the random point generation more dynamic
function getRandomPoints(center: Coordinate, minPoints: number, maxPoints: number, spreadRadiusMeters: number): [number, number][] {
  const numPoints = Math.floor(Math.random() * (maxPoints - minPoints + 1)) + minPoints;
  const points: [number, number][] = [];
  // Convert spreadRadiusMeters to approximate degrees (very rough, varies by latitude)
  // 1 degree of latitude is approx 111km. 1 degree of longitude varies.
  const earthRadiusMeters = 6371000;
  const spreadRadiusDegreesLat = spreadRadiusMeters / earthRadiusMeters * (180 / Math.PI);
  const spreadRadiusDegreesLng = spreadRadiusMeters / (earthRadiusMeters * Math.cos(center.lat * Math.PI / 180)) * (180 / Math.PI);


  for (let i = 0; i < numPoints; i++) {
    // Generate random angle and distance
    const angle = Math.random() * 2 * Math.PI;
    // Ensure points are somewhat spread but not too far, scale distance by spreadRadiusDegrees
    const distanceLat = Math.random() * spreadRadiusDegreesLat;
    const distanceLng = Math.random() * spreadRadiusDegreesLng;

    // Calculate new latitude and longitude
    // Add random offset to make points less predictable
    const latOffset = distanceLat * Math.sin(angle);
    const lngOffset = distanceLng * Math.cos(angle);

    const randomLat = center.lat + latOffset;
    const randomLng = center.lng + lngOffset;
    points.push([randomLng, randomLat]);
  }
  return points;
}
