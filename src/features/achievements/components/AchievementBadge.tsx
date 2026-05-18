"use client";

import React from "react";
import {
  Trophy,
  Zap,
  CalendarDays,
  Medal,
  Sunrise,
  Globe,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/shared/lib/utils";
import type { AchievementType, Achievement } from "../services/achievement-service";

// ── Icon mapping ───────────────────────────────────────

const ACHIEVEMENT_ICONS: Record<string, LucideIcon> = {
  trophy: Trophy,
  zap: Zap,
  calendar: CalendarDays,
  medal: Medal,
  sunrise: Sunrise,
  globe: Globe,
};

const ACHIEVEMENT_COLORS: Record<AchievementType, { border: string; bg: string; text: string; icon: string }> = {
  fastestClimb: {
    border: "border-orange-400 dark:border-orange-500",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    text: "text-orange-700 dark:text-orange-300",
    icon: "text-orange-500 dark:text-orange-400",
  },
  longestRide: {
    border: "border-teal-400 dark:border-teal-500",
    bg: "bg-teal-50 dark:bg-teal-950/30",
    text: "text-teal-700 dark:text-teal-300",
    icon: "text-teal-500 dark:text-teal-400",
  },
  weeklyWarrior: {
    border: "border-blue-400 dark:border-blue-500",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    text: "text-blue-700 dark:text-blue-300",
    icon: "text-blue-500 dark:text-blue-400",
  },
  centuryRide: {
    border: "border-purple-400 dark:border-purple-500",
    bg: "bg-purple-50 dark:bg-purple-950/30",
    text: "text-purple-700 dark:text-purple-300",
    icon: "text-purple-500 dark:text-purple-400",
  },
  earlyBird: {
    border: "border-yellow-400 dark:border-yellow-500",
    bg: "bg-yellow-50 dark:bg-yellow-950/30",
    text: "text-yellow-700 dark:text-yellow-300",
    icon: "text-yellow-500 dark:text-yellow-400",
  },
  explorer: {
    border: "border-green-400 dark:border-green-500",
    bg: "bg-green-50 dark:bg-green-950/30",
    text: "text-green-700 dark:text-green-300",
    icon: "text-green-500 dark:text-green-400",
  },
};

// ── Component ──────────────────────────────────────────

interface AchievementBadgeProps {
  achievement: Achievement;
  className?: string;
}

export const AchievementBadge = React.memo(function AchievementBadge({
  achievement,
  className,
}: AchievementBadgeProps) {
  const Icon = ACHIEVEMENT_ICONS[achievement.icon] || Trophy;
  const colors = ACHIEVEMENT_COLORS[achievement.type] || ACHIEVEMENT_COLORS.fastestClimb;

  const earnedDate = achievement.earnedAt?.toDate
    ? achievement.earnedAt.toDate().toLocaleDateString()
    : "";

  return (
    <Card
      className={cn(
        "border-2 transition-colors hover:shadow-md",
        colors.border,
        colors.bg,
        className
      )}
    >
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={cn(
            "flex-shrink-0 rounded-full p-2",
            "bg-white/80 dark:bg-black/20"
          )}
        >
          <Icon className={cn("h-6 w-6", colors.icon)} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn("font-semibold text-sm truncate", colors.text)}>
            {achievement.name}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {achievement.description}
          </p>
          {earnedDate && (
            <p className="text-xs text-muted-foreground/70 mt-1">
              Earned {earnedDate}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
});
