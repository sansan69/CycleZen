import { NextResponse } from "next/server";
import { ai } from "@/ai/ai-instance";
import type { RouteRecommendation } from "@/features/recommendations/services/recommendation-service";

interface SavedRouteForAnalysis {
  distanceKm: number;
  ascentM: number | undefined;
  surfaceType: string;
  difficulty: string;
}

function mode<T extends string>(arr: T[]): T {
  if (!arr.length) return "" as T;
  const counts = new Map<T, number>();
  for (const item of arr) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  let maxCount = 0;
  let maxItem = arr[0];
  counts.forEach((count, item) => {
    if (count > maxCount) {
      maxCount = count;
      maxItem = item;
    }
  });
  return maxItem;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const savedRoutes: SavedRouteForAnalysis[] = body.savedRoutes || [];

    if (!savedRoutes || savedRoutes.length === 0) {
      return NextResponse.json({ recommendations: [] });
    }

    const avgDistance =
      savedRoutes.reduce((s, r) => s + r.distanceKm, 0) /
      savedRoutes.length;
    const mostCommonDifficulty = mode(
      savedRoutes.map((r) => r.difficulty)
    );
    const mostCommonSurface = mode(
      savedRoutes.map((r) => r.surfaceType)
    );
    const avgAscent = savedRoutes.some((r) => r.ascentM !== undefined)
      ? savedRoutes.reduce(
          (s, r) => s + (r.ascentM ?? 0),
          0
        ) / savedRoutes.filter((r) => r.ascentM !== undefined).length
      : 0;

    const prompt = `You are a cycling route recommendation engine for CycleZen, a cycling app.

A user has saved ${savedRoutes.length} cycling routes. Their riding profile:
- Average distance: ${avgDistance.toFixed(1)} km
- Most common difficulty: ${mostCommonDifficulty}
- Most common surface type: ${mostCommonSurface}
- Average elevation gain: ${avgAscent.toFixed(0)} m

Analyze their preferences and suggest 3 cycling route locations they might enjoy. For each suggestion, provide:
1. A real city/town/area name (be specific — use real locations worldwide that match their style)
2. An approximate latitude and longitude for that location
3. A recommended search radius in km (based on their avg distance)
4. A brief, personalized reason why this matches their riding style (friendly tone, 1 sentence)
5. Expected difficulty level
6. Expected surface type

Return ONLY valid JSON in this exact format:
[
  {
    "location": "City Name, Area",
    "lat": 12.3456,
    "lng": 78.9012,
    "radiusKm": 30,
    "reason": "Like your favorite routes, this offers beautiful rolling hills",
    "difficulty": "Moderate",
    "surface": "Paved"
  }
]`;

    const { text } = await ai.generate(prompt);
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ recommendations: [] });
    }

    const parsed = JSON.parse(jsonMatch[0]) as RouteRecommendation[];
    const valid = parsed
      .filter(
        (r) =>
          r.location &&
          typeof r.lat === "number" &&
          typeof r.lng === "number" &&
          r.reason
      )
      .slice(0, 3);

    return NextResponse.json({ recommendations: valid });
  } catch (error) {
    console.error("AI recommendation generation failed:", error);
    return NextResponse.json({ recommendations: [], error: "Generation failed" });
  }
}
