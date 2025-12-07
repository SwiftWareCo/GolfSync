import { Suspense } from "react";
import { getTeesheetConfigs } from "~/server/settings/data";
import { TeesheetConfigs } from "~/components/settings/teesheet/TeesheetConfigs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  getTimeblockRestrictions,
  getTimeblockOverrides,
} from "~/server/timeblock-restrictions/data";
import {
  getActiveMemberClasses,
  getAllMemberClasses,
} from "~/server/member-classes/data";
import { TimeblockRestrictionsSettings } from "~/components/settings/timeblock-restrictions/TimeblockRestrictionsSettings";
import { CourseInfoSettings } from "~/components/settings/course-info/CourseInfoSettings";
import { getCourseInfo } from "~/server/settings/data";
import { PageHeader } from "~/components/ui/page-header";
import { OverridesSettings } from "~/components/settings/overrides/OverridesSettings";
import { MemberClassesSettings } from "~/components/settings/member-classes/MemberClassesSettings";
import { NotificationsPanel } from "~/components/admin/notifications/NotificationsPanel";
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

  return <TeesheetConfigs configs={teesheetConfigs} />;
}

async function RestrictionsTab() {
  const [timeblockRestrictionsResult, allMemberClasses] = await Promise.all([
    getTimeblockRestrictions(),
    getAllMemberClasses(),
  ]);

  const timeblockRestrictions =
    "success" in timeblockRestrictionsResult ? [] : timeblockRestrictionsResult;

  return (
    <TimeblockRestrictionsSettings
      restrictions={timeblockRestrictions}
      allMemberClasses={allMemberClasses}
    />
  );
}

async function MemberClassesTab() {
  const allMemberClasses = await getAllMemberClasses();
  return <MemberClassesSettings MemberClasses={allMemberClasses} />;
}

async function OverridesTab() {
  const timeblockOverridesResult = await getTimeblockOverrides();
  const timeblockOverrides =
    "success" in timeblockOverridesResult ? [] : timeblockOverridesResult;

  return <OverridesSettings initialOverrides={timeblockOverrides} />;
}

async function NotificationsTab() {
  const [memberClasses, stats, classCounts] = await Promise.all([
    getActiveMemberClasses(),
    getPushNotificationStats(),
    getMembersCountByClass(),
  ]);

  // Convert member classes to format expected by NotificationsPanel
  const memberClassOptions = memberClasses.map((mc) => ({
    id: mc.id,
    label: mc.label,
  }));

  return (
    <NotificationsPanel
      stats={stats}
      memberClasses={memberClassOptions}
      classCounts={classCounts}
    />
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
