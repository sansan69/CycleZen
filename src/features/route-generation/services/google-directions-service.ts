/**
 * Google Maps Directions API integration for manual route planning.
 * Converts waypoint arrays into CyclingRoute objects compatible with the rest of the app.
 */

import type { Coordinate, CyclingRoute, RouteStep } from "./open-route-service";

interface GoogleDirectionsStep {
  distance: { value: number }; // meters
  duration: { value: number }; // seconds
  html_instructions: string;
  travel_mode: string;
  maneuver?: string;
}

interface GoogleDirectionsLeg {
  distance: { value: number }; // meters
  duration: { value: number }; // seconds
  steps: GoogleDirectionsStep[];
  start_location: { lat: number; lng: number };
  end_location: { lat: number; lng: number };
}

interface GoogleDirectionsResponse {
  status: string;
  routes?: Array<{
    legs: GoogleDirectionsLeg[];
    overview_polyline: { points: string };
    summary: string;
  }>;
  error_message?: string;
}

/**
 * Calls Google Maps Directions API in BICYCLING mode with waypoints.
 * Returns a CyclingRoute compatible with the RouteCard component.
 */
export async function getDirectionsRoute(
  waypoints: Coordinate[],
  apiKey: string,
): Promise<CyclingRoute> {
  if (waypoints.length < 2) {
    throw new Error("At least 2 waypoints are required for a route.");
  }

  const origin = `${waypoints[0].lat},${waypoints[0].lng}`;
  const destination = `${waypoints[waypoints.length - 1].lat},${waypoints[waypoints.length - 1].lng}`;

  let waypointsParam = "";
  if (waypoints.length > 2) {
    const middleWaypoints = waypoints
      .slice(1, waypoints.length - 1)
      .map((wp) => `${wp.lat},${wp.lng}`)
      .join("|");
    waypointsParam = `&waypoints=optimize:false|${middleWaypoints}`;
  }

  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}${waypointsParam}&mode=bicycling&key=${apiKey}`;

  const response = await fetch(url);
  const data: GoogleDirectionsResponse = await response.json();

  if (data.status !== "OK") {
    throw new Error(
      `Google Directions API error: ${data.status} — ${data.error_message || "No route found. Try adjusting waypoints."}`,
    );
  }

  if (!data.routes || data.routes.length === 0) {
    throw new Error("No routes returned from Google Directions API.");
  }

  const route = data.routes[0];
  const legs = route.legs;

  // Aggregate distance and duration across all legs
  let totalDistanceMeters = 0;
  let totalDurationSeconds = 0;
  const allSteps: RouteStep[] = [];
  
  // Decode overview polyline into coordinates
  const decodedCoords = decodePolyline(route.overview_polyline.points);

  for (const leg of legs) {
    totalDistanceMeters += leg.distance.value;
    totalDurationSeconds += leg.duration.value;
    
    if (leg.steps) {
      for (let i = 0; i < leg.steps.length; i++) {
        const s: GoogleDirectionsStep = leg.steps[i];
        // Strip HTML from instructions
        const instruction = s.html_instructions.replace(/<[^>]*>/g, "");
        allSteps.push({
          distance: s.distance.value,
          duration: s.duration.value,
          type: 0, // Google Directions doesn't use numeric types
          instruction,
          name: instruction.split("<b>").pop()?.split("</b>")[0] || "",
          way_points: [0, 0],
        });
      }
    }
  }

  return {
    distance: totalDistanceMeters / 1000,
    estimatedTime: totalDurationSeconds / 60,
    coordinates: decodedCoords,
    steps: allSteps.length > 0 ? allSteps : undefined,
    geometry: {
      type: "LineString",
      coordinates: decodedCoords.map((c) => [c.lng, c.lat]),
    },
  };
}

/**
 * Decodes a Google Maps encoded polyline string into an array of Coordinate objects.
 */
function decodePolyline(encoded: string): Coordinate[] {
  const points: Coordinate[] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}
