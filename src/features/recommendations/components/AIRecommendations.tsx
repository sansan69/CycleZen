"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { User } from "firebase/auth";
import { collection, query, getDocs, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { RouteRecommendation } from "@/features/recommendations/services/recommendation-service";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Icons } from "@/components/icons";

const RecommendationCard = dynamic(
  () =>
    import("@/features/recommendations/components/RecommendationCard").then(
      (mod) => ({ default: mod.RecommendationCard })
    ),
  { ssr: false }
);

interface AIRecommendationsProps {
  user: User | null;
}

export const AIRecommendations: React.FC<AIRecommendationsProps> = ({ user }) => {
  const [recommendations, setRecommendations] = useState<RouteRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !db) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchAndRecommend() {
      try {
        // Get user's saved routes for analysis
        const savedRef = collection(db!, "users", user!.uid, "rides");
        const savedQuery = query(savedRef, limit(20));
        const snapshot = await getDocs(savedQuery);

        if (snapshot.empty) {
          if (!cancelled) {
            setRecommendations([]);
            setLoading(false);
          }
          return;
        }

        // Map to analysis format
        const analysisData = snapshot.docs.map((doc) => {
          const data = doc.data();
          const routeData = data.routeData || data;
          const dist = routeData.distance || 30;
          const ascent = routeData.ascent;
          return {
            distanceKm: typeof dist === "number" ? dist : 30,
            ascentM: typeof ascent === "number" ? ascent : undefined,
            surfaceType: "Paved",
            difficulty:
              ascent && dist
                ? ascent / dist < 15
                  ? "Easy"
                  : ascent / dist < 30
                    ? "Moderate"
                    : ascent / dist < 50
                      ? "Hard"
                      : "Expert"
                : "Moderate",
          };
        });

        const response = await fetch("/api/recommendations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ savedRoutes: analysisData }),
        });
        const result = await response.json();
        const recs = result.recommendations || [];
        if (!cancelled) {
          setRecommendations(recs);
        }
      } catch (err) {
        if (!cancelled) {
          setError("Could not generate recommendations");
          console.error("AI recommendations error:", err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAndRecommend();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) return null;

  if (loading) {
    return (
      <Card className="mb-6 bg-card shadow">
        <CardHeader>
          <CardTitle className="text-lg text-primary flex items-center gap-2">
            <Icons.sparkles className="h-5 w-5 text-accent" />
            AI Recommendations
          </CardTitle>
          <CardDescription>Analyzing your riding style...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || recommendations.length === 0) {
    return null; // Silent fail — no recommendations to show
  }

  return (
    <Card className="mb-6 bg-card shadow border-l-4 border-l-accent">
      <CardHeader>
        <CardTitle className="text-lg text-primary flex items-center gap-2">
          <Icons.sparkles className="h-5 w-5 text-accent" />
          AI Recommendations
        </CardTitle>
        <CardDescription>
          Based on your riding style, here are some routes you might enjoy.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {recommendations.map((rec, i) => (
            <RecommendationCard key={i} recommendation={rec} index={i} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default AIRecommendations;
