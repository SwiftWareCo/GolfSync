"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Users } from "lucide-react";
import { useMemo } from "react";

// Chart colors using org-primary palette with variations
const CHART_COLORS = [
  "#06466c", // org-primary
  "#0a5a8a",
  "#0e6ea8",
  "#1282c6",
  "#1696e4",
  "#1aaaff",
  "#4ebfff",
  "#82d4ff",
  "#b6e9ff",
  "#eaf8ff",
];

interface MemberClassData {
  className: string;
  count: number;
}

interface MemberClassPieChartProps {
  data: MemberClassData[];
}

/**
 * Deterministically maps a class name to a color from the palette.
 * Uses a simple hash function to ensure consistent color assignment.
 */
function getColorForClass(className: string): string {
  // Simple hash function for deterministic color assignment
  let hash = 0;
  for (let i = 0; i < className.length; i++) {
    const char = className.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Use absolute value and modulo to get index
  const index = Math.abs(hash) % CHART_COLORS.length;
  const color = CHART_COLORS[index];
  return color ?? CHART_COLORS[0]!;
}

/**
 * Creates a custom tooltip component for the pie chart.
 * Must be defined outside render to avoid React warnings.
 */
function createCustomTooltip(total: number) {
  return function CustomTooltip({
    active,
    payload,
  }: TooltipContentProps<number, string>) {
    if (active && payload && payload.length) {
      return (
        <div className="border-org-primary rounded-lg border bg-white p-3 shadow-md">
          <p className="text-org-primary font-medium">{payload[0]!.name}</p>
          <p className="text-org-primary text-sm">
            {payload[0]!.value} member{payload[0]!.value !== 1 ? "s" : ""}
          </p>
          {payload[0]!.payload.count > 0 && total > 0 && (
            <p className="text-org-primary text-xs">
              {((payload[0]!.payload.count / total) * 100).toFixed(1)}%
            </p>
          )}
        </div>
      );
    }
    return null;
  };
}

export function MemberClassPieChart({ data }: MemberClassPieChartProps) {
  // Calculate total once for tooltip
  const total = useMemo(
    () => data.reduce((sum, item) => sum + item.count, 0),
    [data],
  );

  // Create color mapping based on class name (deterministic)
  const colorMap = useMemo(() => {
    const map = new Map<string, string>();
    data.forEach((item) => {
      if (!map.has(item.className)) {
        map.set(item.className, getColorForClass(item.className));
      }
    });
    return map;
  }, [data]);

  // Map data with deterministic colors
  const chartData = useMemo(
    () =>
      data.map((item) => ({
        ...item,
        fill: colorMap.get(item.className) ?? CHART_COLORS[0],
      })),
    [data, colorMap],
  );

  // Create tooltip component outside render
  const CustomTooltip = useMemo(() => createCustomTooltip(total), [total]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Member Class Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData.filter((d) => d.count > 0)}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={100}
                  fill={CHART_COLORS[0]}
                  dataKey="count"
                  nameKey="className"
                >
                  {chartData
                    .filter((d) => d.count > 0)
                    .map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                </Pie>
                <Tooltip content={CustomTooltip} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Custom scrollable legend */}
          <div className="scrollbar-visible border-org-primary/20 max-h-[120px] overflow-y-auto rounded border p-2">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {chartData
                .filter((d) => d.count > 0)
                .map((entry, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <div
                      className="h-3 w-3 rounded"
                      style={{ backgroundColor: entry.fill }}
                    />
                    <span className="text-org-primary">
                      {entry.className} ({entry.count})
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
