import { Timestamp } from "firebase/firestore";

// ── Types ───────────────────────────────────────────────

export interface CompletedRide {
  id?: string;
  routeName: string;
  completedAt: Timestamp | Date;
  actualDurationSeconds: number;
  plannedDistanceKm: number;
  actualDistanceCoveredKm?: number;
  estimatedCalories: number;
  ascent?: number;
  difficulty?: "Easy" | "Moderate" | "Hard" | "Expert";
}

export interface TrainingLoadData {
  date: string;
  tss: number;
}

export interface WeeklyLoadResult {
  load: number;
  trend: "↑" | "→" | "↓";
  trendLabel: "increasing" | "stable" | "decreasing";
  recommendation: string;
}

// ── Constants ───────────────────────────────────────────

const INTENSITY_FACTORS: Record<string, number> = {
  Easy: 0.55,
  Moderate: 0.65,
  Hard: 0.80,
  Expert: 0.95,
};

const DEFAULT_WEIGHT_KG = 70;

const TSS_COLORS = {
  low: 50,
  medium: 100,
  high: 150,
} as const;

// ── Internal Helpers ────────────────────────────────────

function getDate(ride: CompletedRide): Date {
  if (ride.completedAt instanceof Timestamp) {
    return ride.completedAt.toDate();
  }
  return ride.completedAt;
}

function getDistanceKm(ride: CompletedRide): number {
  return ride.actualDistanceCoveredKm ?? ride.plannedDistanceKm;
}

function getAvgSpeedKmh(ride: CompletedRide): number {
  const distKm = getDistanceKm(ride);
  const hours = ride.actualDurationSeconds / 3600;
  if (hours <= 0) return 0;
  return distKm / hours;
}

function getIntensityFactor(difficulty?: string): number {
  return INTENSITY_FACTORS[difficulty ?? "Moderate"] ?? 0.65;
}

function getDifficultyFromRide(ride: CompletedRide): string {
  if (ride.difficulty) return ride.difficulty;
  // Infer from ascent/distance ratio if ascent data is available
  if (ride.ascent !== undefined && isFinite(ride.ascent)) {
    const distance = getDistanceKm(ride);
    if (distance > 0) {
      const ratio = ride.ascent / distance;
      if (ratio < 15) return "Easy";
      if (ratio < 30) return "Moderate";
      if (ratio < 50) return "Hard";
      return "Expert";
    }
  }
  return "Moderate";
}

// ── FTP Estimation ──────────────────────────────────────

/**
 * Estimate Functional Threshold Power without a power meter.
 *
 * Uses simplified formula:
 *   FTP = (bestAvgSpeedKmh × weightKg × 3.5) / 200
 *
 * Scans all rides for the best average speed (km/h) and uses
 * it as the basis for the FTP estimate.
 *
 * @param rides - Array of completed rides
 * @returns estimated FTP (watts), or 0 if no rides available
 */
export function estimateFTP(rides: CompletedRide[]): number {
  if (!rides || rides.length === 0) return 0;

  let bestSpeed = 0;
  for (const ride of rides) {
    const speed = getAvgSpeedKmh(ride);
    if (isFinite(speed) && speed > bestSpeed) {
      bestSpeed = speed;
    }
  }

  if (bestSpeed <= 0) return 0;
  return Math.round((bestSpeed * DEFAULT_WEIGHT_KG * 3.5) / 200);
}

// ── TSS Calculation ─────────────────────────────────────

/**
 * Calculate Training Stress Score for a single ride.
 *
 * TSS = (durationMinutes × IF² × 100) / 60
 *
 * @param rideMinutes   - duration in minutes
 * @param intensityFactor - IF value (0.55–0.95 based on difficulty)
 * @returns TSS value (integer)
 */
export function calculateTSS(
  rideMinutes: number,
  intensityFactor: number
): number {
  if (rideMinutes <= 0 || intensityFactor <= 0) return 0;
  return Math.round(
    (rideMinutes * Math.pow(intensityFactor, 2) * 100) / 60
  );
}

/**
 * Calculate TSS directly from a CompletedRide object.
 * Infers difficulty and intensity factor automatically.
 */
export function calculateRideTSS(ride: CompletedRide): number {
  const minutes = ride.actualDurationSeconds / 60;
  const difficulty = getDifficultyFromRide(ride);
  const if_ = getIntensityFactor(difficulty);
  return calculateTSS(minutes, if_);
}

// ── Weekly Load ─────────────────────────────────────────

/**
 * Calculate weekly training load and trend.
 *
 * Sums TSS for the past 7 days and compares against the previous 7 days.
 *
 * @param rides         - all completed rides
 * @param ftp           - estimated FTP (preserved for future use)
 * @param referenceDate - date to calculate from (defaults to now)
 */
export function calculateWeeklyLoad(
  rides: CompletedRide[],
  _ftp: number,
  referenceDate: Date = new Date()
): WeeklyLoadResult {
  const now = referenceDate;
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // Current week (past 7 days)
  const currentWeekRides = rides.filter((ride) => {
    const date = getDate(ride);
    return date >= sevenDaysAgo && date <= now;
  });

  // Previous week (8–14 days ago)
  const previousWeekRides = rides.filter((ride) => {
    const date = getDate(ride);
    return date >= fourteenDaysAgo && date < sevenDaysAgo;
  });

  const currentLoad = currentWeekRides.reduce(
    (sum, ride) => sum + calculateRideTSS(ride),
    0
  );

  const previousLoad = previousWeekRides.reduce(
    (sum, ride) => sum + calculateRideTSS(ride),
    0
  );

  // Determine trend
  let trend: "↑" | "→" | "↓";
  let trendLabel: "increasing" | "stable" | "decreasing";

  if (previousLoad === 0) {
    trend = currentLoad > 0 ? "↑" : "→";
    trendLabel = currentLoad > 0 ? "increasing" : "stable";
  } else {
    const change = (currentLoad - previousLoad) / previousLoad;
    if (change > 0.1) {
      trend = "↑";
      trendLabel = "increasing";
    } else if (change < -0.1) {
      trend = "↓";
      trendLabel = "decreasing";
    } else {
      trend = "→";
      trendLabel = "stable";
    }
  }

  // Recovery recommendation
  let recommendation: string;
  if (currentLoad > 500) {
    recommendation =
      "Rest day recommended — your training load is high. Take 1–2 days off for recovery.";
  } else if (currentLoad > 350) {
    recommendation =
      "Consider an easy spin or active recovery day. Keep intensity low.";
  } else if (currentLoad > 0) {
    recommendation = "You're in a good training zone. Continue as planned.";
  } else {
    recommendation = "No rides this week. Get out and ride!";
  }

  return { load: currentLoad, trend, trendLabel, recommendation };
}

// ── Training Load Data for Charts ───────────────────────

/**
 * Build daily TSS data for the past N days (used by TrainingLoadChart).
 *
 * @param rides - all completed rides
 * @param days  - number of days to include (default 14)
 * @returns array of { date, tss } entries, one per day
 */
export function buildTrainingLoadData(
  rides: CompletedRide[],
  days: number = 14
): TrainingLoadData[] {
  const result: TrainingLoadData[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split("T")[0];

    // Find rides on this calendar date
    const dayRides = rides.filter((ride) => {
      const rideDate = getDate(ride);
      const rideDateStr = rideDate.toISOString().split("T")[0];
      return rideDateStr === dateStr;
    });

    const tss = dayRides.reduce(
      (sum, ride) => sum + calculateRideTSS(ride),
      0
    );
    result.push({ date: dateStr, tss });
  }

  return result;
}

/**
 * Get a color for a bar based on TSS value.
 * Green < 50, Yellow < 100, Orange < 150, Red >= 150.
 */
export function getTSSColor(tss: number): string {
  if (tss < TSS_COLORS.low) return "#22c55e"; // green-500
  if (tss < TSS_COLORS.medium) return "#eab308"; // yellow-500
  if (tss < TSS_COLORS.high) return "#f97316"; // orange-500
  return "#ef4444"; // red-500
}
