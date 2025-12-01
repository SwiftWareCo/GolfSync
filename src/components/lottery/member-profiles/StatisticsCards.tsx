import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Users,
  TrendingUp,
  Target,
  Award,
} from "lucide-react";
import { getMemberProfileStats } from "~/server/lottery/member-profiles-data";

export async function StatisticsCards() {
  const stats = await getMemberProfileStats();

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Members</CardTitle>
          <Users className="text-muted-foreground h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalMembers}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Fast Players</CardTitle>
          <TrendingUp className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {stats.speedTiers.fast}
          </div>
          <p className="text-muted-foreground text-xs">≤ 3:55 pace</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">High Priority</CardTitle>
          <Target className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            {stats.fairnessScores.highPriority}
          </div>
          <p className="text-muted-foreground text-xs">
            Fairness score &gt; 20
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Avg Fulfillment
          </CardTitle>
          <Award className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">
            {(
              (stats.fairnessScores.averageFulfillmentRate || 0) * 100
            ).toFixed(0)}
            %
          </div>
          <p className="text-muted-foreground text-xs">Preference rate</p>
        </CardContent>
      </Card>
    </div>
  );
}
