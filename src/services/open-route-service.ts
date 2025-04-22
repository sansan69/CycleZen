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
  // TODO: Implement this by calling OpenRouteService API.

  const stubbedRoute: CyclingRoute = {
    distance: 10,
    estimatedTime: 30,
    coordinates: [
      { lat: location.lat, lng: location.lng },
      { lat: location.lat + 0.01, lng: location.lng + 0.01 },
      { lat: location.lat + 0.02, lng: location.lng },
      { lat: location.lat, lng: location.lng },
    ],
  };

  return Array(numberOfRoutes).fill(stubbedRoute);
}
