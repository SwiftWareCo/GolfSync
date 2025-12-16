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
import { Users } from "lucide-react";

// Chart colors using org-primary palette
const CHART_COLORS = {
  primary: "#06466c",
};

interface MemberClassData {
  className: string;
  count: number;
}

interface MemberClassDistributionChartProps {
  data: MemberClassData[];
}

export function MemberClassDistributionChart({
  data,
}: MemberClassDistributionChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Member Class Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="className" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar
                dataKey="count"
                name="Members"
                fill={CHART_COLORS.primary}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
