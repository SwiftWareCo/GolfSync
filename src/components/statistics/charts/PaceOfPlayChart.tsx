"use client";

import { format } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Timer } from "lucide-react";

// Chart colors using org-primary palette
const CHART_COLORS = {
  primary: "#06466c",
  success: "#22c55e",
};

interface PaceOfPlayData {
  date: string;
  avgMinutes: number;
  onTimePercentage: number;
}

interface PaceOfPlayChartProps {
  data: PaceOfPlayData[];
}

export function PaceOfPlayChart({ data }: PaceOfPlayChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Timer className="h-5 w-5" />
          Pace of Play Trend
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => format(new Date(value), "MMM d")}
                fontSize={12}
              />
              <YAxis yAxisId="left" fontSize={12} domain={[200, 280]} />
              <YAxis
                yAxisId="right"
                orientation="right"
                fontSize={12}
                domain={[0, 100]}
              />
              <Tooltip
                labelFormatter={(value) =>
                  format(new Date(value as string), "MMM d, yyyy")
                }
                formatter={(value, name) => {
                  if (name === "Avg Duration") {
                    const mins = value as number;
                    return [`${Math.floor(mins / 60)}h ${mins % 60}m`, name];
                  }
                  return [`${value}%`, name];
                }}
              />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="avgMinutes"
                name="Avg Duration"
                stroke={CHART_COLORS.primary}
                strokeWidth={2}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="onTimePercentage"
                name="On-Time %"
                stroke={CHART_COLORS.success}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
