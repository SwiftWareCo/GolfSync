"use client";

import { Card, CardHeader, CardContent, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Bell, Users, BarChart3, Wrench } from "lucide-react";
import { runPushNotificationMaintenance } from "~/server/pwa/actions";
import toast from "react-hot-toast";
import { useState } from "react";

interface PushStats {
  totalMembers: number;
  subscribedMembers: number;
  validSubscriptions: number;
  subscriptionRate: number;
}

interface StatsCardsProps {
  stats: PushStats | null;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const [isRunningMaintenance, setIsRunningMaintenance] = useState(false);

  const handleRunMaintenance = async () => {
    try {
      setIsRunningMaintenance(true);
      toast.loading("Running maintenance tasks...", { id: "maintenance" });

      const result = await runPushNotificationMaintenance();

      if (result.success) {
        toast.success(
          `Maintenance completed! Cleaned up ${result.cleanedUp} expired subscriptions.`,
          { id: "maintenance" },
        );
      } else {
        toast.error("Maintenance failed", { id: "maintenance" });
      }
    } catch (error) {
      toast.error("Error running maintenance", { id: "maintenance" });
    } finally {
      setIsRunningMaintenance(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Members</CardTitle>
          <Users className="text-muted-foreground h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.totalMembers ?? 0}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Subscribed</CardTitle>
          <Bell className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats?.subscribedMembers ?? 0}
          </div>
          <p className="text-muted-foreground text-xs">
            {stats?.subscriptionRate.toFixed(1)}% subscription rate
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Valid Subscriptions
          </CardTitle>
          <BarChart3 className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats?.validSubscriptions ?? 0}
          </div>
          <p className="text-muted-foreground text-xs">
            Active push subscriptions
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Health Status</CardTitle>
          <Badge variant="outline" className="border-green-600 text-green-600">
            Active
          </Badge>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleRunMaintenance}
            disabled={isRunningMaintenance}
            variant="outline"
            size="sm"
            className="w-full"
          >
            <Wrench className="mr-2 h-4 w-4" />
            {isRunningMaintenance ? "Running..." : "Run Maintenance"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
