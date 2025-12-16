import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Activity, Users, Timer, UserPlus } from "lucide-react";
import { RoundsOverTimeChart } from "./charts/RoundsOverTimeChart";
import { TopPlayersCard } from "./charts/TopPlayersCard";
import { MemberClassPieChart } from "./charts/MemberClassPieChart";
import type { StatisticsData } from "~/lib/statistics/mock-data";

interface StatisticsOverviewProps {
  data: StatisticsData;
  dateRange: { from: Date; to: Date };
}

export function StatisticsOverview({
  data,
  dateRange,
}: StatisticsOverviewProps) {
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Rounds
            </CardTitle>
            <Activity className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.summary.totalRounds.toLocaleString()}
            </div>
            <p className="text-muted-foreground text-xs">
              {format(dateRange.from, "MMM d")} -{" "}
              {format(dateRange.to, "MMM d")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Members
            </CardTitle>
            <Users className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.summary.activeMemberCount}
            </div>
            <p className="text-muted-foreground text-xs">Played in period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Avg Round Time
            </CardTitle>
            <Timer className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.floor(data.summary.avgRoundDuration / 60)}h{" "}
              {data.summary.avgRoundDuration % 60}m
            </div>
            <p className="text-muted-foreground text-xs">18 holes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Guest Rounds</CardTitle>
            <UserPlus className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.guestRounds}</div>
            <p className="text-muted-foreground text-xs">
              {(
                (data.summary.guestRounds / data.summary.totalRounds) *
                100
              ).toFixed(1)}
              % of total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <RoundsOverTimeChart data={data.roundsOverTime} />
      <TopPlayersCard players={data.topPlayers} />
      <MemberClassPieChart data={data.memberClassDistribution} />
    </div>
  );
}
