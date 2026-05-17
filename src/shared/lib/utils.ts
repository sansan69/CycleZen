import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { DIFFICULTY, CALORIES } from "./constants";

// ── className helper (kept from original) ──────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Time formatting ────────────────────────────────────
/**
 * Convert a duration in seconds to a human-readable string.
 *   <  1 h  →  MM:SS
 *   >= 1 h  →  HH:MM:SS
 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [
    h > 0 ? h.toString().padStart(2, "0") : null,
    m.toString().padStart(2, "0"),
    s.toString().padStart(2, "0"),
  ]
    .filter(Boolean)
    .join(":");
}

// ── Calorie estimation ─────────────────────────────────
/**
 * Estimate calories burned during a ride using the MET formula.
 *
 *   calories = MET × weightKg × hours
 *
 * @param distanceKm   – distance covered in kilometres
 * @param weightKg     – rider weight in kg (default 70)
 * @param metValue     – MET value (default CALORIES.metModerate = 8.0)
 * @returns estimated calories (integer)
 */
export function estimateCalories(
  distanceKm: number,
  weightKg: number = CALORIES.defaultWeightKg,
  metValue: number = CALORIES.metModerate
): number {
  if (typeof distanceKm !== "number" || !isFinite(distanceKm) || distanceKm <= 0) {
    return 0;
  }
  // Assume a moderate pace of ~20 km/h for MET calculation
  const hours = distanceKm / 20;
  return Math.round(metValue * weightKg * hours);
}

// ── Difficulty classifier ───────────────────────────────
/**
 * Classify a route's difficulty based on elevation gain per km.
 */
export function classifyDifficulty(
  elevationGainM: number,
  distanceKm: number
): "Easy" | "Moderate" | "Hard" | "Expert" {
  if (!isFinite(distanceKm) || distanceKm <= 0) return "Moderate";
  const ratio = elevationGainM / distanceKm;
  if (ratio < DIFFICULTY.thresholds.easy) return "Easy";
  if (ratio < DIFFICULTY.thresholds.moderate) return "Moderate";
  if (ratio < DIFFICULTY.thresholds.hard) return "Hard";
  return "Expert";
}

// ── Debounce ───────────────────────────────────────────
/**
 * Create a debounced version of the provided function.
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delayMs: number = 300
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeoutId !== null) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delayMs);
  };
}

// ── Bounds helper ──────────────────────────────────────
/**
 * Create a google.maps.LatLngBounds from an array of coordinate objects.
 * Returns null if coordinates are empty or google.maps is unavailable.
 */
export function createBoundsFromCoordinates(
  coordinates: { lat: number; lng: number }[],
  googleMaps: typeof google.maps
): google.maps.LatLngBounds | null {
  if (!coordinates?.length || !googleMaps?.LatLngBounds) return null;
  const bounds = new googleMaps.LatLngBounds();
  coordinates.forEach((coord) => {
    bounds.extend(new googleMaps.LatLng(coord.lat, coord.lng));
  });
  return bounds;
}
