"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { TrainingLoadData } from "@/shared/lib/training";
import { getTSSColor } from "@/shared/lib/training";

// ── Props ───────────────────────────────────────────────

interface TrainingLoadChartProps {
  data: TrainingLoadData[];
}

// ── Formatting helpers ──────────────────────────────────

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// ── Custom tooltip ──────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: TrainingLoadData & { fill?: string } }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;

  return (
    <div className="bg-card border border-border rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-medium text-foreground">
        {label ? formatDateLabel(label) : ""}
      </p>
      <p className="text-muted-foreground">
        TSS:{" "}
        <span className="font-bold text-foreground">{data.tss}</span>
      </p>
    </div>
  );
}

// ── Component ───────────────────────────────────────────

export function TrainingLoadChart({ data }: TrainingLoadChartProps) {
  const chartData = useMemo(() => {
    return data.map((d) => ({
      ...d,
      fill: getTSSColor(d.tss),
      displayDate: formatDateLabel(d.date),
    }));
  }, [data]);

  const hasData = data.some((d) => d.tss > 0);

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
        <p>No training data yet. Complete rides to see your training load.</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart
        data={chartData}
        margin={{ top: 5, right: 10, bottom: 5, left: -20 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(var(--border))"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tickFormatter={formatDateLabel}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={{ stroke: "hsl(var(--border))" }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          width={35}
          allowDecimals={false}
        />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ fill: "hsl(var(--muted) / 0.15)" }}
        />
        <Bar dataKey="tss" radius={[4, 4, 0, 0]} maxBarSize={32}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default TrainingLoadChart;
