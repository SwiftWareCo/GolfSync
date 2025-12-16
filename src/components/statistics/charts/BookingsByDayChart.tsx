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
import { Calendar } from "lucide-react";

// Chart colors using org-primary palette
const CHART_COLORS = {
  secondary: "#39638e",
};

interface BookingsByDayData {
  day: string;
  count: number;
}

interface BookingsByDayChartProps {
  data: BookingsByDayData[];
}

export function BookingsByDayChart({ data }: BookingsByDayChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Bookings by Day
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" fontSize={12} />
              <YAxis fontSize={12} />
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
