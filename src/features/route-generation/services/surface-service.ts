// Basic surface type detection based on route characteristics
// Full OSM surface detection would require Overpass API integration

export type SurfaceType = 'Road' | 'Gravel' | 'Mixed' | 'Trail' | 'Unknown';

export function detectSurfaceType(
  elevationGainM: number,
  distanceKm: number,
  turnCount: number = 0
): SurfaceType {
  if (!isFinite(distanceKm) || distanceKm <= 0) return 'Unknown';
  
  const elevationPerKm = elevationGainM / distanceKm;
  
  // High elevation gain + many turns suggests trail
  if (elevationPerKm > 40 && turnCount > 20) return 'Trail';
  
  // Moderate-high elevation suggests mixed or gravel
  if (elevationPerKm > 25) return 'Gravel';
  
  // Low elevation, many turns = mixed terrain
  if (turnCount > 15) return 'Mixed';
  
  // Low elevation, few turns = road
  return 'Road';
}
