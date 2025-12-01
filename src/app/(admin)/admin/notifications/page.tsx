import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Card, CardHeader, CardContent, CardTitle } from "~/components/ui/card";
import { Send, Target } from "lucide-react";
import {
  getPushNotificationStats,
  getMembersCountByClass,
} from "~/server/pwa/data";
import { getActiveMemberClasses } from "~/server/member-classes/data";
import { StatsCards } from "~/components/admin/notifications/StatsCards";
import { BulkNotificationForm } from "~/components/admin/notifications/BulkNotificationForm";
import { TargetedNotificationForm } from "~/components/admin/notifications/TargetedNotificationForm";
import { NotificationInfo } from "~/components/admin/notifications/NotificationInfo";
import { PageHeader } from "~/components/ui/page-header";

export default async function AdminNotificationsPage() {
  // Fetch data on the server
  const [stats, memberClassesData, classCounts] = await Promise.all([
    getPushNotificationStats(),
    getActiveMemberClasses(),
    getMembersCountByClass([]), // Fetch counts for all classes
  ]);

  const memberClasses = memberClassesData.map((mc) => mc.label);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Push Notifications"
        description="Manage push notifications and member communication"
      />

      <StatsCards stats={stats} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="bulk" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="bulk" className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                Bulk Notification
              </TabsTrigger>
              <TabsTrigger value="targeted" className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Targeted Notification
              </TabsTrigger>
            </TabsList>

            <TabsContent value="bulk" className="mt-6">
              <BulkNotificationForm
                validSubscriptions={stats.validSubscriptions}
                hideCard={true}
              />
            </TabsContent>

            <TabsContent value="targeted" className="mt-6">
              <TargetedNotificationForm
                memberClasses={memberClasses}
                classCounts={classCounts}
                hideCard={true}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <NotificationInfo />
    </div>
  );
}
