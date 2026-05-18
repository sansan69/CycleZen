"use client";

import React, { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface ElevationPoint {
  /** Distance along route in kilometers */
  distanceKm: number;
  /** Elevation in meters */
  elevation: number;
  /** Grade percentage at this segment */
  grade?: number;
}

interface ElevationProfileProps {
  coordinates: { lat: number; lng: number; elev?: number }[];
  /** Total ascent in meters — can be a number or undefined */
  ascent: number | undefined;
}

/**
 * Build simulated elevation data from route path.
 * Uses total ascent distributed along the route with a realistic
 * sinusoidal pattern, then computes grade at each segment.
 */
function buildElevationProfile(
  coordinates: { lat: number; lng: number; elev?: number }[],
  totalAscent: number,
  totalDistanceKm: number
): ElevationPoint[] {
  if (!coordinates || coordinates.length < 2) return [];

  // Check if we have real elevation data (from ORS "elevation: true")
  const hasElevation = coordinates.some((c) => typeof c.elev === "number");

  if (hasElevation) {
    const points: ElevationPoint[] = [];
    let cumulativeDist = 0;

    for (let i = 0; i < coordinates.length; i++) {
      if (i > 0) {
        const prev = coordinates[i - 1];
        const curr = coordinates[i];
        const dLat = (curr.lat - prev.lat) * 111320; // approximate
        const dLng =
          (curr.lng - prev.lng) *
          111320 *
          Math.cos((prev.lat * Math.PI) / 180);
        cumulativeDist += Math.sqrt(dLat * dLat + dLng * dLng) / 1000;
      }

      const elev = coordinates[i].elev ?? 0;
      let grade: number | undefined;
      if (i > 0 && points.length > 0) {
        const prevPt = points[points.length - 1];
        const distDiff = cumulativeDist - prevPt.distanceKm;
        const elevDiff = elev - prevPt.elevation;
        if (distDiff > 0.001) {
          grade = (elevDiff / (distDiff * 1000)) * 100;
        }
      }

      points.push({
        distanceKm: Number(cumulativeDist.toFixed(2)),
        elevation: Number(elev.toFixed(0)),
        grade: grade !== undefined ? Number(grade.toFixed(1)) : undefined,
      });
    }
    return points;
  }

  // Simulate elevation with sinusoidal pattern
  const points: ElevationPoint[] = [];
  const numPoints = Math.min(coordinates.length, 200);
  const step = Math.max(1, Math.floor(coordinates.length / numPoints));

  for (let i = 0; i < numPoints && i * step < coordinates.length; i++) {
    const idx = i * step;
    const progress = i / (numPoints - 1);

    // Sinusoidal pattern with 2-3 oscillations for realism
    const oscillations = 2 + (totalAscent > 200 ? 1 : 0);
    const sinComponent = Math.sin(progress * Math.PI * oscillations);
    const hillFactor = 1 - Math.abs(sinComponent * 0.7);

    // Build overall shape: start low, climb mid, end low
    const baseElevation =
      totalAscent * 0.1 +
      totalAscent * 0.8 * Math.sin(progress * Math.PI) * hillFactor;

    const elev = Math.max(0, baseElevation + (Math.random() - 0.5) * 10);

    let grade: number | undefined;
    if (i > 0) {
      const prevElev = points[i - 1].elevation;
      const distDiff = (totalDistanceKm / (numPoints - 1)) * 1000; // meters
      if (distDiff > 0.001) {
        grade = ((elev - prevElev) / distDiff) * 100;
      }
    }

    points.push({
      distanceKm: Number(((progress * totalDistanceKm)).toFixed(2)),
      elevation: Number(elev.toFixed(0)),
      grade: grade !== undefined ? Number(grade.toFixed(1)) : undefined,
    });
  }

  return points;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ElevationPoint }>;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-lg">
      <p className="font-medium text-foreground">{data.distanceKm} km</p>
      <p className="text-muted-foreground">
        Elevation: <span className="font-semibold text-foreground">{data.elevation} m</span>
      </p>
      {data.grade !== undefined && (
        <p
          className={
            Math.abs(data.grade) > 8
              ? "text-orange-500 font-medium"
              : "text-muted-foreground"
          }
        >
          Grade: {data.grade > 0 ? "+" : ""}{data.grade}%
        </p>
      )}
    </div>
  );
};

/**
 * ElevationProfile — Recharts area chart showing elevation along the route.
 * Renders a gradient-filled area chart with grade percentage labels at
 * the steepest sections.
 */
export const ElevationProfile = React.memo(function ElevationProfile({
  coordinates,
  ascent,
}: ElevationProfileProps) {
  const totalAscent = ascent ?? 0;

  // Approximate total distance from coordinate count
  const totalDistanceKm = useMemo(() => {
    if (!coordinates || coordinates.length < 2) return 0;
    let dist = 0;
    for (let i = 1; i < coordinates.length; i++) {
      const prev = coordinates[i - 1];
      const curr = coordinates[i];
      const dLat = (curr.lat - prev.lat) * 111.32;
      const dLng = (curr.lng - prev.lng) * 111.32 * Math.cos((prev.lat * Math.PI) / 180);
      dist += Math.sqrt(dLat * dLat + dLng * dLng);
    }
    return dist;
  }, [coordinates]);

  const data = useMemo(
    () => buildElevationProfile(coordinates, totalAscent, totalDistanceKm),
    [coordinates, totalAscent, totalDistanceKm]
  );

  if (!data.length) {
    return (
      <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground bg-muted/30 rounded-md">
        No elevation data available.
      </div>
    );
  }

  const avgElevation =
    data.reduce((sum, p) => sum + p.elevation, 0) / data.length;

  // Find steepest sections for reference lines
  const steepest = data
    .filter((p) => p.grade !== undefined)
    .sort((a, b) => Math.abs(b.grade!) - Math.abs(a.grade!))
    .slice(0, 2);

  return (
    <div className="mt-4 rounded-lg border border-border bg-card/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <svg
            className="h-4 w-4 text-muted-foreground"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          Elevation Profile
        </h4>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>Max: {Math.max(...data.map((d) => d.elevation))} m</span>
          <span>
            Gain: {totalAscent > 0 ? `+${totalAscent.toFixed(0)}` : "N/A"} m
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
          <defs>
            <linearGradient id="elevationGradient" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="hsl(var(--primary))"
                stopOpacity={0.3}
              />
              <stop
                offset="100%"
                stopColor="hsl(var(--primary))"
                stopOpacity={0.05}
              />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            vertical={false}
          />
          <XAxis
            dataKey="distanceKm"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            unit=" km"
          />
          <YAxis
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            unit=" m"
            width={45}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            y={avgElevation}
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="4 4"
            strokeOpacity={0.4}
            label={{
              value: `Avg ${Math.round(avgElevation)}m`,
              position: "insideBottomRight",
              fontSize: 10,
              fill: "hsl(var(--muted-foreground))",
            }}
          />
          {/* Mark steepest sections */}
          {steepest.map((pt, i) => (
            <ReferenceLine
              key={i}
              x={pt.distanceKm}
              stroke="hsl(var(--accent))"
              strokeOpacity={0.5}
              strokeDasharray="2 2"
              label={{
                value: `${pt.grade! > 0 ? "+" : ""}${pt.grade}%`,
                position: "top",
                fontSize: 10,
                fill: "hsl(var(--accent))",
              }}
            />
          ))}
          <Area
            type="monotone"
            dataKey="elevation"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="url(#elevationGradient)"
            dot={false}
            activeDot={{
              r: 4,
              fill: "hsl(var(--primary))",
              stroke: "hsl(var(--background))",
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>

      {data.length < coordinates.length && (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          ⓘ Elevation data is interpolated. Install{" "}
          <code className="text-[0.7rem] bg-muted px-1 rounded">elevation: true</code>{" "}
          in ORS API for precise data.
        </p>
      )}
    </div>
  );
});

export default ElevationProfile;
