import {
  getPushNotificationStats,
  getMembersCountByClass,
} from "~/server/pwa/data";
import { getActiveMemberClasses } from "~/server/member-classes/data";
import { NotificationDashboard } from "~/components/admin/notifications/NotificationDashboard";
import { PageHeader } from "~/components/ui/page-header";

export default async function AdminNotificationsPage() {
  // Fetch data on the server
  const [statsResult, memberClassesData, classCountsResult] = await Promise.all(
    [
      getPushNotificationStats(),
      getActiveMemberClasses(),
      getMembersCountByClass([]), // Fetch counts for all classes
    ],
  );

  const stats = statsResult.success ? statsResult.stats! : null;
  const memberClasses = memberClassesData.map((mc) => mc.label);
  const classCounts = classCountsResult.success
    ? classCountsResult.classCounts || []
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Push Notifications"
        description="Manage push notifications and member communication"
      />

      <NotificationDashboard
        stats={stats}
        memberClasses={memberClasses}
        classCounts={classCounts}
      />
    </div>
  );
}
