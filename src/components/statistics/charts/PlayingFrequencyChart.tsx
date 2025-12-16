"use client";

import { format } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { BarChart3 } from "lucide-react";

// Chart colors using org-primary palette
const CHART_COLORS = {
  primary: "#06466c",
};

interface RoundsOverTime {
  date: string;
  memberRounds: number;
}

interface PlayingFrequencyChartProps {
  data: RoundsOverTime[];
}

export function PlayingFrequencyChart({ data }: PlayingFrequencyChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Playing Frequency
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => format(new Date(value), "MMM d")}
                fontSize={10}
              />
              <YAxis fontSize={12} />
              <Tooltip
                labelFormatter={(value) =>
                  format(new Date(value as string), "MMM d, yyyy")
                }
              />
              <Bar
                dataKey="memberRounds"
                name="Rounds"
                fill={CHART_COLORS.primary}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
