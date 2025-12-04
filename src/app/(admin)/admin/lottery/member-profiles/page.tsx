import { PageHeader } from "~/components/ui/page-header";
import { StatisticsCards } from "~/components/lottery/member-profiles/StatisticsCards";
import { ControlPanel } from "~/components/lottery/member-profiles/ControlPanel";
import { MemberProfilesTable } from "~/components/lottery/member-profiles/MemberProfilesTable";
import { getMemberProfilesWithFairness } from "~/server/lottery/member-profiles-data";
import { Card, CardContent } from "~/components/ui/card";

export const dynamic = "force-dynamic";

export default async function MemberProfilesPage() {
  // Fetch member profiles with stats (combined for efficiency)
  const { profiles, stats } = await getMemberProfilesWithFairness();

  return (
    <div className="container mx-auto max-w-7xl p-6">
      {/* Page Header */}
      <div className="mb-6">
        <PageHeader
          title="Member Profiles Management"
          description="Manage member speed classifications, fairness scores, and lottery priority"
        />
      </div>

      {/* Statistics Cards */}
      <StatisticsCards stats={stats} />

      {/* Control Panel */}
      <div className="mt-6">
        <ControlPanel />
      </div>

      {/* Member Profiles Table with integrated search and filters */}
      <div className="mt-6">
        <Card>
          <CardContent className="pt-6">
            <MemberProfilesTable profiles={profiles} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
