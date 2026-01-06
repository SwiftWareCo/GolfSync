import { PageHeader } from "~/components/ui/page-header";
import { Button } from "~/components/ui/button";
import { Timer } from "lucide-react";
import Link from "next/link";
import { formatDate } from "~/lib/dates";
import { LotteryDashboard } from "~/components/lottery/LotteryDashboard";
import { getMembers } from "~/server/members/data";
import { getLotteryDataForDate } from "~/server/lottery/data";
import { checkAndRunMonthlyMaintenance } from "~/server/lottery/maintenance-actions";
import { getTeesheetWithTimeBlocks } from "~/server/teesheet/data";
import { getAlgorithmConfig } from "~/server/lottery/algorithm-config-data";
import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "Lottery Management",
};

interface PageProps {
  params: {
    date: string;
  };
}

export default async function LotteryManagementPage({ params }: PageProps) {
  const { date } = await params;

  // Check and run monthly maintenance if needed
  await checkAndRunMonthlyMaintenance();

  // Fetch all data at server level
  // Note: getTeesheetWithTimeBlocks returns teesheet with its assigned config and timeblocks
  const [allMembers, lotteryData, teesheetData, algorithmConfig] =
    await Promise.all([
      getMembers(),
      getLotteryDataForDate(date),
      getTeesheetWithTimeBlocks(date),
      getAlgorithmConfig(),
    ]);

  // Extract stats and entries from consolidated data
  const initialStats = lotteryData.stats;
  const lotteryEntries = lotteryData.entries;

  // Transform members to include class property for component compatibility
  const members = allMembers.map((member) => ({
    id: member.id,
    firstName: member.firstName,
    lastName: member.lastName,
    class: member.memberClass?.label || "",
  }));

  return (
    <div className="mx-auto p-4">
      {/* Page Header */}
      <div className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <PageHeader
            title="Lottery Management"
            description={`Managing lottery entries for ${formatDate(date, "EEEE, MMMM do, yyyy")}`}
          />
          <div className="flex items-center gap-2">
            <Link href="/admin/lottery/member-profiles" passHref>
              <Button variant="outline">
                <Timer className="mr-2 h-4 w-4" />
                Member Profiles
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Lottery Dashboard */}
      <LotteryDashboard
        date={date}
        members={members}
        initialStats={initialStats}
        initialLotteryEntries={lotteryEntries}
        algorithmConfig={algorithmConfig}
        teesheetData={{
          teesheet: teesheetData?.teesheet,
          config: teesheetData?.config,
          timeBlocks: teesheetData?.timeBlocks || [],
          availableConfigs: [],
          paceOfPlayData: [],
          date,
        }}
      />
    </div>
  );
}
