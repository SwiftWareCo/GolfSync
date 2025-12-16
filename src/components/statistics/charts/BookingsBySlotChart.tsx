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
  primary: "#06466c",
};

interface BookingsBySlotData {
  slot: string;
  count: number;
}

interface BookingsBySlotChartProps {
  data: BookingsBySlotData[];
}

export function BookingsBySlotChart({ data }: BookingsBySlotChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Bookings by Time Slot
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="slot"
                fontSize={10}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar
                dataKey="count"
                name="Bookings"
                fill={CHART_COLORS.primary}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
