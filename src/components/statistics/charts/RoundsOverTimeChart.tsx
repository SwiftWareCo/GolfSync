"use client";

import { format } from "date-fns";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { TrendingUp } from "lucide-react";

// Chart colors using org-primary palette
const CHART_COLORS = {
  primary: "#06466c",
  primaryLight: "#3472a3",
};

interface RoundsOverTime {
  date: string;
  memberRounds: number;
  guestRounds: number;
}

interface RoundsOverTimeChartProps {
  data: RoundsOverTime[];
}

export function RoundsOverTimeChart({ data }: RoundsOverTimeChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Rounds Over Time
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => format(new Date(value), "MMM d")}
                fontSize={12}
              />
              <YAxis fontSize={12} />
              <Tooltip
                labelFormatter={(value) =>
                  format(new Date(value as string), "MMM d, yyyy")
                }
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="memberRounds"
                name="Member Rounds"
                stackId="1"
                stroke={CHART_COLORS.primary}
                fill={CHART_COLORS.primary}
                fillOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="guestRounds"
                name="Guest Rounds"
                stackId="1"
                stroke={CHART_COLORS.primaryLight}
                fill={CHART_COLORS.primaryLight}
                fillOpacity={0.6}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
