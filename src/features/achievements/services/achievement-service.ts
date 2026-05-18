import {
  collection,
  doc,
  getDocs,
  query,
  orderBy,
  setDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logger } from "@/shared/services/logger";

// ── Achievement Types ──────────────────────────────────

export type AchievementType =
  | "fastestClimb"
  | "longestRide"
  | "weeklyWarrior"
  | "centuryRide"
  | "earlyBird"
  | "explorer";

export interface Achievement {
  id: AchievementType;
  type: AchievementType;
  name: string;
  description: string;
  icon: string;
  earnedAt: Timestamp;
  rideId: string;
  value: number;
}

export interface AchievementConfig {
  type: AchievementType;
  name: string;
  description: string;
  icon: string;
}

// ── Achievement Definitions ────────────────────────────

export const ACHIEVEMENT_CONFIGS: Record<AchievementType, AchievementConfig> = {
  fastestClimb: {
    type: "fastestClimb",
    name: "Fastest Climb",
    description: "Set a personal best for elevation gain on a single ride",
    icon: "trophy",
  },
  longestRide: {
    type: "longestRide",
    name: "Longest Ride",
    description: "Set a personal best for distance on a single ride",
    icon: "zap",
  },
  weeklyWarrior: {
    type: "weeklyWarrior",
    name: "Weekly Warrior",
    description: "Complete 3 or more rides in a single week",
    icon: "calendar",
  },
  centuryRide: {
    type: "centuryRide",
    name: "Century Ride",
    description: "Complete a ride of 100 km or more",
    icon: "medal",
  },
  earlyBird: {
    type: "earlyBird",
    name: "Early Bird",
    description: "Complete a ride that started before 7 AM",
    icon: "sunrise",
  },
  explorer: {
    type: "explorer",
    name: "Explorer",
    description: "Ride in 5 or more different locations",
    icon: "globe",
  },
};

// ── Ride Data Type (subset needed for checks) ──────────

export interface RideDataForAchievements {
  id: string;
  completedAt: Timestamp;
  actualDistanceCoveredKm?: number;
  plannedDistanceKm: number;
  ascent?: number;
  routeName: string;
}

// ── Helper: get all completed rides for a user ─────────

async function getAllCompletedRides(
  userId: string
): Promise<RideDataForAchievements[]> {
  if (!db) return [];

  const ridesCollection = collection(db, "users", userId, "completedRides");
  const q = query(ridesCollection, orderBy("completedAt", "desc"));

  try {
    const snapshot = await getDocs(q);
    const rides: RideDataForAchievements[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      rides.push({
        id: doc.id,
        completedAt: data.completedAt,
        actualDistanceCoveredKm: data.actualDistanceCoveredKm,
        plannedDistanceKm: data.plannedDistanceKm,
        ascent: data.ascent,
        routeName: data.routeName || "",
      });
    });
    return rides;
  } catch (error: any) {
    if (error.code === "permission-denied" || error.message?.includes("permission-denied")) {
      logger.warn("achievement-service", "Permission denied fetching rides for achievements");
    } else {
      logger.error("achievement-service", "Error fetching rides for achievements:", error);
    }
    return [];
  }
}

// ── Helper: get existing achievements for a user ───────

async function getExistingAchievements(
  userId: string
): Promise<Achievement[]> {
  if (!db) return [];

  const achievementsCollection = collection(
    db,
    "users",
    userId,
    "achievements"
  );

  try {
    const snapshot = await getDocs(achievementsCollection);
    const achievements: Achievement[] = [];
    snapshot.forEach((doc) => {
      achievements.push(doc.data() as Achievement);
    });
    return achievements;
  } catch (error: any) {
    if (error.code === "permission-denied" || error.message?.includes("permission-denied")) {
      logger.warn("achievement-service", "Permission denied fetching achievements");
    } else {
      logger.error("achievement-service", "Error fetching achievements:", error);
    }
    return [];
  }
}

// ── Helper: save an achievement ────────────────────────

async function saveAchievement(
  userId: string,
  achievement: Achievement
): Promise<void> {
  if (!db) return;

  try {
    const achievementDoc = doc(
      db,
      "users",
      userId,
      "achievements",
      achievement.id
    );
    await setDoc(achievementDoc, achievement);
    logger.info("achievement-service", `Achievement saved: ${achievement.type}`);
  } catch (error: any) {
    if (error.code === "permission-denied" || error.message?.includes("permission-denied")) {
      logger.warn("achievement-service", "Permission denied saving achievement");
    } else {
      logger.error("achievement-service", "Error saving achievement:", error);
    }
  }
}

// ── Check functions for each achievement type ───────────

function getWeekNumber(date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor(
    (date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000)
  );
  return Math.ceil((days + startOfYear.getDay() + 1) / 7);
}

function getWeekYear(date: Date): string {
  return `${date.getFullYear()}-W${getWeekNumber(date)}`;
}

interface AchievementCheckResult {
  type: AchievementType;
  awarded: boolean;
  value: number;
}

async function checkFastestClimb(
  userId: string,
  currentRide: RideDataForAchievements,
  _existingAchievements: Achievement[]
): Promise<AchievementCheckResult> {
  const allRides = await getAllCompletedRides(userId);
  const ascent = currentRide.ascent ?? 0;

  // Need at least some climb
  if (ascent <= 0) {
    return { type: "fastestClimb", awarded: false, value: ascent };
  }

  // Check if this is the highest ascent among all rides
  const maxAscent = Math.max(
    ascent,
    ...allRides.map((r) => r.ascent ?? 0)
  );

  // Award if this ride has the max and it's a new personal best
  if (ascent >= maxAscent && ascent > 0) {
    // Check if we already have this achievement
    const existing = _existingAchievements.find((a) => a.type === "fastestClimb");
    // Award if no existing achievement or this beats the previous record
    if (!existing || ascent > existing.value) {
      return { type: "fastestClimb", awarded: true, value: ascent };
    }
  }

  return { type: "fastestClimb", awarded: false, value: ascent };
}

async function checkLongestRide(
  userId: string,
  currentRide: RideDataForAchievements,
  _existingAchievements: Achievement[]
): Promise<AchievementCheckResult> {
  const allRides = await getAllCompletedRides(userId);
  const distance = currentRide.actualDistanceCoveredKm ?? currentRide.plannedDistanceKm;

  if (distance <= 0) {
    return { type: "longestRide", awarded: false, value: distance };
  }

  const maxDistance = Math.max(
    distance,
    ...allRides.map((r) => r.actualDistanceCoveredKm ?? r.plannedDistanceKm)
  );

  if (distance >= maxDistance && distance > 0) {
    const existing = _existingAchievements.find((a) => a.type === "longestRide");
    if (!existing || distance > existing.value) {
      return { type: "longestRide", awarded: true, value: distance };
    }
  }

  return { type: "longestRide", awarded: false, value: distance };
}

async function checkWeeklyWarrior(
  userId: string,
  currentRide: RideDataForAchievements,
  _existingAchievements: Achievement[]
): Promise<AchievementCheckResult> {
  const allRides = await getAllCompletedRides(userId);
  const currentWeek = getWeekYear(currentRide.completedAt.toDate());

  // Count rides in the current week
  const ridesThisWeek = allRides.filter((r) => {
    try {
      return getWeekYear(r.completedAt.toDate()) === currentWeek;
    } catch {
      return false;
    }
  });

  const count = ridesThisWeek.length;

  if (count >= 3) {
    // Only award if not already achieved for this specific week
    const existing = _existingAchievements.find((a) => a.type === "weeklyWarrior");
    const existingWeek = existing
      ? getWeekYear(existing.earnedAt.toDate())
      : "";

    if (existingWeek !== currentWeek) {
      return { type: "weeklyWarrior", awarded: true, value: count };
    }
  }

  return { type: "weeklyWarrior", awarded: false, value: count };
}

async function checkCenturyRide(
  _userId: string,
  currentRide: RideDataForAchievements,
  existingAchievements: Achievement[]
): Promise<AchievementCheckResult> {
  const distance = currentRide.actualDistanceCoveredKm ?? currentRide.plannedDistanceKm;

  if (distance >= 100) {
    const alreadyHas = existingAchievements.some((a) => a.type === "centuryRide");
    if (!alreadyHas) {
      return { type: "centuryRide", awarded: true, value: distance };
    }
  }

  return { type: "centuryRide", awarded: false, value: distance };
}

async function checkEarlyBird(
  _userId: string,
  currentRide: RideDataForAchievements,
  existingAchievements: Achievement[]
): Promise<AchievementCheckResult> {
  const completedDate = currentRide.completedAt.toDate();
  const hours = completedDate.getHours();

  if (hours < 7) {
    const alreadyHas = existingAchievements.some((a) => a.type === "earlyBird");
    if (!alreadyHas) {
      return { type: "earlyBird", awarded: true, value: hours };
    }
  }

  return { type: "earlyBird", awarded: false, value: hours };
}

async function checkExplorer(
  userId: string,
  _currentRide: RideDataForAchievements,
  existingAchievements: Achievement[]
): Promise<AchievementCheckResult> {
  const allRides = await getAllCompletedRides(userId);

  // Extract unique location names from route names
  // Route names follow pattern: "Ride near LAT, LNG on DATE" or "Route Option N near LAT, LNG on DATE"
  const locationSet = new Set<string>();
  for (const ride of allRides) {
    // Extract coordinates from route name as approximate location
    const match = ride.routeName.match(/near\s+([-\d.]+),\s*([-\d.]+)/);
    if (match) {
      // Round to 0.01 degrees (~1km) to group nearby rides
      const lat = Math.round(parseFloat(match[1]) * 100) / 100;
      const lng = Math.round(parseFloat(match[2]) * 100) / 100;
      locationSet.add(`${lat},${lng}`);
    }
  }

  const uniqueLocations = locationSet.size;

  if (uniqueLocations >= 5) {
    const alreadyHas = existingAchievements.some((a) => a.type === "explorer");
    if (!alreadyHas) {
      return { type: "explorer", awarded: true, value: uniqueLocations };
    }
  }

  return { type: "explorer", awarded: false, value: uniqueLocations };
}

// ── Main: Check and award achievements after a ride ────

export interface AchievementCheckParams {
  userId: string;
  rideId: string;
  ride: RideDataForAchievements;
}

/**
 * Check all achievement conditions against a completed ride and award any
 * newly earned achievements. Returns the list of achievements awarded.
 */
export async function checkAchievements(
  params: AchievementCheckParams
): Promise<Achievement[]> {
  const { userId, rideId, ride } = params;

  if (!db) {
    logger.warn("achievement-service", "Firestore not available for achievement checks");
    return [];
  }

  const existingAchievements = await getExistingAchievements(userId);

  const checkFunctions: Record<
    AchievementType,
    (
      userId: string,
      ride: RideDataForAchievements,
      existing: Achievement[]
    ) => Promise<AchievementCheckResult>
  > = {
    fastestClimb: checkFastestClimb,
    longestRide: checkLongestRide,
    weeklyWarrior: checkWeeklyWarrior,
    centuryRide: checkCenturyRide,
    earlyBird: checkEarlyBird,
    explorer: checkExplorer,
  };

  const newlyAwarded: Achievement[] = [];

  for (const [type, checkFn] of Object.entries(checkFunctions)) {
    try {
      const result = await checkFn(
        userId,
        ride,
        existingAchievements
      );

      if (result.awarded) {
        const config = ACHIEVEMENT_CONFIGS[type as AchievementType];
        const achievement: Achievement = {
          id: type as AchievementType,
          type: type as AchievementType,
          name: config.name,
          description: config.description,
          icon: config.icon,
          earnedAt: Timestamp.now(),
          rideId,
          value: result.value,
        };

        await saveAchievement(userId, achievement);
        newlyAwarded.push(achievement);

        // Update local cache for subsequent checks in this call
        const existingIdx = existingAchievements.findIndex(
          (a) => a.type === type
        );
        if (existingIdx >= 0) {
          existingAchievements[existingIdx] = achievement;
        } else {
          existingAchievements.push(achievement);
        }
      }
    } catch (error: any) {
      logger.error(
        "achievement-service",
        `Error checking achievement ${type}:`,
        error
      );
    }
  }

  return newlyAwarded;
}

/**
 * Fetch all achievements for a user from Firestore.
 */
export async function fetchAchievements(
  userId: string
): Promise<Achievement[]> {
  return getExistingAchievements(userId);
}
