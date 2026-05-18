"use client";

import React from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/icons";

export interface RouteRecommendation {
  /** Recommended location name */
  location: string;
  /** Latitude */
  lat: number;
  /** Longitude */
  lng: number;
  /** Recommended radius in km */
  radiusKm: number;
  /** Why this route was recommended */
  reason: string;
  /** Expected difficulty */
  difficulty: "Easy" | "Moderate" | "Hard" | "Expert";
  /** Suggested surface type */
  surface: "Paved" | "Gravel" | "Mixed" | "Trail";
}

interface RecommendationCardProps {
  recommendation: RouteRecommendation;
  index: number;
}

const difficultyColors: Record<string, string> = {
  Easy: "text-green-600 dark:text-green-400",
  Moderate: "text-yellow-600 dark:text-yellow-400",
  Hard: "text-orange-600 dark:text-orange-400",
  Expert: "text-red-600 dark:text-red-400",
};

export const RecommendationCard = React.memo(function RecommendationCard({
  recommendation,
  index,
}: RecommendationCardProps) {
  return (
    <Card className="bg-card shadow hover:shadow-md transition-shadow duration-200 border-l-4 border-l-accent">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base text-primary flex items-center gap-2">
            <Icons.sparkles className="h-4 w-4 text-accent" />
            {recommendation.location}
          </CardTitle>
          <span className={`text-xs font-medium ${difficultyColors[recommendation.difficulty]}`}>
            {recommendation.difficulty}
          </span>
        </div>
        <CardDescription className="text-xs leading-relaxed">
          <span className="inline-flex items-center gap-1 mr-3">
            <Icons.route className="h-3 w-3" /> ~{recommendation.radiusKm} km
          </span>
          <span className="inline-flex items-center gap-1">
            <Icons.mountain className="h-3 w-3" /> {recommendation.surface}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground mb-3 italic">
          &ldquo;{recommendation.reason}&rdquo;
        </p>
        <Button asChild variant="outline" size="sm" className="w-full text-xs">
          <Link href="/">Explore this route</Link>
        </Button>
      </CardContent>
    </Card>
  );
});

export default RecommendationCard;
