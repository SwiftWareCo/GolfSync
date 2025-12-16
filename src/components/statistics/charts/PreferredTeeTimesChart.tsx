"use client";

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
import { Clock } from "lucide-react";

// Chart colors using org-primary palette
const CHART_COLORS = {
  secondary: "#39638e",
};

interface BookingsBySlotData {
  slot: string;
  count: number;
}

interface PreferredTeeTimesChartProps {
  data: BookingsBySlotData[];
}

export function PreferredTeeTimesChart({ data }: PreferredTeeTimesChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Preferred Tee Times
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.slice(0, 12)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" fontSize={12} />
              <YAxis
                dataKey="slot"
                type="category"
                fontSize={10}
                width={50}
              />
              <Tooltip />
              <Bar
                dataKey="count"
                name="Bookings"
                fill={CHART_COLORS.secondary}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
