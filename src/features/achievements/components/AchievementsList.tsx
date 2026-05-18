"use client";

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/shared/components/EmptyState";
import { AchievementBadge } from "./AchievementBadge";
import type { Achievement } from "../services/achievement-service";

// ── Component Props ────────────────────────────────────

interface AchievementsListProps {
  achievements: Achievement[];
  loading: boolean;
  className?: string;
}

// ── Component ──────────────────────────────────────────

export const AchievementsList = React.memo(function AchievementsList({
  achievements,
  loading,
  className,
}: AchievementsListProps) {
  if (loading) {
    return (
      <div className={className}>
        <h2 className="text-2xl font-semibold text-foreground mb-4">
          Achievements
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[88px] w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (achievements.length === 0) {
    return (
      <div className={className}>
        <h2 className="text-2xl font-semibold text-foreground mb-4">
          Achievements
        </h2>
        <EmptyState
          icon="activity"
          title="No achievements yet. Go ride!"
          description="Complete rides to earn badges for distance, climbing, consistency, and more."
        />
      </div>
    );
  }

  return (
    <div className={className}>
      <h2 className="text-2xl font-semibold text-foreground mb-4">
        Achievements
        <span className="ml-2 text-sm font-normal text-muted-foreground">
          ({achievements.length})
        </span>
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {achievements.map((achievement) => (
          <AchievementBadge
            key={achievement.id}
            achievement={achievement}
          />
        ))}
      </div>
    </div>
  );
});
