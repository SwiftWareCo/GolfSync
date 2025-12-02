import { Suspense } from "react";
import { getTeesheetConfigs } from "~/server/settings/data";
import { TeesheetConfigs } from "~/components/settings/teesheet/TeesheetConfigs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Card, CardHeader, CardContent, CardTitle } from "~/components/ui/card";
import { Send, Target } from "lucide-react";
import {
  getTimeblockRestrictions,
  getTimeblockOverrides,
} from "~/server/timeblock-restrictions/data";
import { getActiveMemberClasses, getAllMemberClasses } from "~/server/member-classes/data";
import { TimeblockRestrictionsSettings } from "~/components/settings/timeblock-restrictions/TimeblockRestrictionsSettings";
import { CourseInfoSettings } from "~/components/settings/course-info/CourseInfoSettings";
import { getCourseInfo } from "~/server/settings/data";
import { PageHeader } from "~/components/ui/page-header";
import { OverridesSettings } from "~/components/settings/overrides/OverridesSettings";
import { MemberClassesSettings } from "~/components/settings/member-classes/MemberClassesSettings";
import { StatsCards } from "~/components/admin/notifications/StatsCards";
import { BulkNotificationForm } from "~/components/admin/notifications/BulkNotificationForm";
import { TargetedNotificationForm } from "~/components/admin/notifications/TargetedNotificationForm";
import { NotificationInfo } from "~/components/admin/notifications/NotificationInfo";
import {
  getPushNotificationStats,
  getMembersCountByClass,
} from "~/server/pwa/data";
import {
  ConfigurationsSkeleton,
  RestrictionsSkeleton,
  MemberClassesSkeleton,
  OverridesSkeleton,
  NotificationsSkeleton,
  CourseInfoSkeleton,
} from "~/components/settings/skeletons";

async function ConfigurationsTab() {
  const teesheetConfigs = await getTeesheetConfigs();

  return (
    <TeesheetConfigs
      configs={teesheetConfigs}
    />
  );
}

async function RestrictionsTab() {
  const [memberClasses, timeblockRestrictionsResult, allMemberClasses] =
    await Promise.all([
      getActiveMemberClasses(),
      getTimeblockRestrictions(),
      getAllMemberClasses(),
    ]);

  const timeblockRestrictions = "success" in timeblockRestrictionsResult
    ? []
    : timeblockRestrictionsResult;

  return (
    <TimeblockRestrictionsSettings
      initialRestrictions={timeblockRestrictions}
      memberClasses={memberClasses.map((mc) => mc.label)}
      allMemberClasses={allMemberClasses}
    />
  );
}

async function MemberClassesTab() {
  const allMemberClasses = await getAllMemberClasses();
  return <MemberClassesSettings initialMemberClasses={allMemberClasses} />;
}

async function OverridesTab() {
  const timeblockOverridesResult = await getTimeblockOverrides();
  const timeblockOverrides = "success" in timeblockOverridesResult
    ? []
    : timeblockOverridesResult;

  return <OverridesSettings initialOverrides={timeblockOverrides} />;
}

async function NotificationsTab() {
  const [memberClasses, stats, classCounts] = await Promise.all([
    getActiveMemberClasses(),
    getPushNotificationStats(),
    getMembersCountByClass([]),
  ]);

  const memberClassLabels = memberClasses.map((mc) => mc.label);

  return (
    <div className="space-y-6">
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
                memberClasses={memberClassLabels}
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

async function CourseInfoTab() {
  const courseInfo = await getCourseInfo();
  return <CourseInfoSettings courseInfo={courseInfo} />;
}

export default function SettingsPage() {
  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <PageHeader
        title="Settings"
        description="Manage your teesheet settings and configurations"
      />

      {/* Tabbed Interface */}
      <Tabs defaultValue="configurations" className="w-full">
        <div className="mb-6 flex justify-center">
          <TabsList className="flex w-full max-w-[1200px] flex-wrap">
            <TabsTrigger value="configurations" className="flex-1">
              Configurations
            </TabsTrigger>
            <TabsTrigger value="restrictions" className="flex-1">
              Timeblock Restrictions
            </TabsTrigger>
            <TabsTrigger value="memberClasses" className="flex-1">
              Member Classes
            </TabsTrigger>
            <TabsTrigger value="overrides" className="flex-1">
              Override Records
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex-1">
              Notifications
            </TabsTrigger>
            <TabsTrigger value="courseInfo" className="flex-1">
              Course Info
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="configurations" className="mt-4">
          <Suspense fallback={<ConfigurationsSkeleton />}>
            <ConfigurationsTab />
          </Suspense>
        </TabsContent>

        <TabsContent value="restrictions" className="mt-4">
          <Suspense fallback={<RestrictionsSkeleton />}>
            <RestrictionsTab />
          </Suspense>
        </TabsContent>

        <TabsContent value="memberClasses" className="mt-4">
          <Suspense fallback={<MemberClassesSkeleton />}>
            <MemberClassesTab />
          </Suspense>
        </TabsContent>

        <TabsContent value="overrides" className="mt-4">
          <Suspense fallback={<OverridesSkeleton />}>
            <OverridesTab />
          </Suspense>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <Suspense fallback={<NotificationsSkeleton />}>
            <NotificationsTab />
          </Suspense>
        </TabsContent>

        <TabsContent value="courseInfo" className="mt-4">
          <Suspense fallback={<CourseInfoSkeleton />}>
            <CourseInfoTab />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
