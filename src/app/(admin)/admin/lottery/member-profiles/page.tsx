import { Suspense } from "react";
import { PageHeader } from "~/components/ui/page-header";
import { StatisticsCards } from "~/components/lottery/member-profiles/StatisticsCards";
import { ControlPanel } from "~/components/lottery/member-profiles/ControlPanel";
import { SearchAndFilters } from "~/components/lottery/member-profiles/SearchAndFilters";
import { MemberProfilesTable } from "~/components/lottery/member-profiles/MemberProfilesTable";
import { StatisticsSkeleton } from "~/components/lottery/member-profiles/skeletons";
import { getMemberProfilesWithFairness } from "~/server/lottery/member-profiles-data";
import { Card, CardContent } from "~/components/ui/card";

export const dynamic = "force-dynamic";

export default async function MemberProfilesPage() {
  // Fetch member profiles
  const profiles = await getMemberProfilesWithFairness();

  return (
    <div className="container mx-auto max-w-7xl p-6">
      {/* Page Header */}
      <div className="mb-6">
        <PageHeader
          title="Member Profiles Management"
          description="Manage member speed classifications, fairness scores, and lottery priority"
        />
      </div>

      {/* Statistics Cards with Suspense */}
      <Suspense fallback={<StatisticsSkeleton />}>
        <StatisticsCards />
      </Suspense>

      {/* Control Panel */}
      <div className="mt-6">
        <ControlPanel />
      </div>

      {/* Search and Filters */}
      <div className="mt-6">
        <Card>
          <CardContent className="pt-6">
            <SearchAndFilters />
          </CardContent>
        </Card>
      </div>

      {/* Member Profiles Table */}
      <div className="mt-6">
        <MemberProfilesTable profiles={profiles} />
      </div>
    </div>
  );
}
