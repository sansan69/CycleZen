// ── Map defaults ───────────────────────────────────────
export const MAP_DEFAULTS = {
  center: { lat: 34.0522, lng: -118.2437 }, // Los Angeles
  zoom: { default: 10, search: 12, route: 13, detail: 14 },
} as const;

// ── Geolocation options ────────────────────────────────
export const GEO = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0,
} as const;

// ── Route generation ────────────────────────────────────
export const ROUTE = {
  defaultCount: 3,
  maxCount: 10,
  maxRetries: 2,
  maxGmapsWaypoints: 10,
} as const;

// ── Calorie estimation ─────────────────────────────────
export const CALORIES = {
  metModerate: 8.0,
  metVigorous: 10.0,
  defaultWeightKg: 70,
} as const;

// ── Difficulty thresholds ──────────────────────────────
export const DIFFICULTY = {
  thresholds: {
    easy: 15,     // elevation gain (m/km) < 15
    moderate: 30, // < 30
    hard: 50,     // < 50
    expert: 50,   // >= 50
  },
} as const;

// ── Toast / notification durations (ms) ────────────────
export const TOAST = {
  durations: {
    short: 5000,
    normal: 7000,
    long: 10000,
  },
} as const;

// ── UI text labels ─────────────────────────────────────
export const UI_TEXT = {
  difficulty: {
    easy: "Easy",
    moderate: "Moderate",
    hard: "Hard",
    expert: "Expert",
  },
  surface: {
    paved: "Paved",
    gravel: "Gravel",
    mixed: "Mixed",
    trail: "Trail",
    unknown: "Unknown",
  },
} as const;
