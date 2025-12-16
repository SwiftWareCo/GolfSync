"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Car } from "lucide-react";

// Chart colors using org-primary palette
const CHART_COLORS = {
  primary: "#06466c",
  primaryLight: "#3472a3",
};

interface PowerCartUsageData {
  solo9: number;
  solo18: number;
  split9: number;
  split18: number;
}

interface PowerCartUsageChartProps {
  data: PowerCartUsageData;
}

export function PowerCartUsageChart({ data }: PowerCartUsageChartProps) {
  const chartData = [
    {
      type: "9 Holes",
      solo: data.solo9,
      split: data.split9,
    },
    {
      type: "18 Holes",
      solo: data.solo18,
      split: data.split18,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Car className="h-5 w-5" />
          Power Cart Usage
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="solo"
                name="Solo"
                stackId="a"
                fill={CHART_COLORS.primary}
              />
              <Bar
                dataKey="split"
                name="Split"
                stackId="a"
                fill={CHART_COLORS.primaryLight}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
