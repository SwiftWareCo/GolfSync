import { isAfter, isBefore, startOfDay } from "date-fns";
import { PageHeader } from "~/components/ui/page-header";
import { Button } from "~/components/ui/button";
import { Timer } from "lucide-react";
import Link from "next/link";
import { formatDate } from "~/lib/dates";
import { LotteryDashboard } from "~/components/lottery/LotteryDashboard";
import { getMembers } from "~/server/members/data";
import { getConfigForDate } from "~/server/settings/data";
import {
  getLotteryStatsForDate,
  getLotteryEntriesForDate,
  getAvailableTimeBlocksForDate,
  getActiveTimeRestrictionsForDate,
} from "~/server/lottery/data";
import { checkAndRunMonthlyMaintenance } from "~/server/lottery/maintenance-actions";
import { getTeesheetWithTimeBlocks } from "~/server/teesheet/data";
import { getAlgorithmConfig } from "~/server/lottery/algorithm-config-data";

interface PageProps {
  params: {
    date: string;
  };
}

export default async function LotteryManagementPage({ params }: PageProps) {
  const { date } = await params;

  const lotteryDate = new Date(date);
  const today = startOfDay(new Date());

  // Check and run monthly maintenance if needed
  await checkAndRunMonthlyMaintenance();

  // Fetch all data at server level
  const [
    allMembers,
    initialStats,
    lotteryEntries,
    timeBlocks,
    config,
    restrictions,
    teesheetData,
    algorithmConfig,
  ] = await Promise.all([
    getMembers(),
    getLotteryStatsForDate(date),
    getLotteryEntriesForDate(date),
    getAvailableTimeBlocksForDate(date),
    getConfigForDate(date),
    getActiveTimeRestrictionsForDate(date),
    getTeesheetWithTimeBlocks(date),
    getAlgorithmConfig(),
  ]);

  // Transform members to include class property for component compatibility
  const members = allMembers.map((member) => ({
    id: member.id,
    firstName: member.firstName,
    lastName: member.lastName,
    class: member.memberClass?.label || "",
  }));

  // Determine lottery status
  const isPastDate = isBefore(lotteryDate, today);
  const isToday = lotteryDate.getTime() === today.getTime();

  let status: "setup" | "active" | "closed";
  if (isPastDate) {
    status = "closed";
  } else if (isToday) {
    status = "active";
  } else {
    status = "setup";
  }

  return (
    <div className="container mx-auto max-w-7xl p-6">
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
        status={status}
        members={members}
        initialStats={initialStats}
        initialLotteryEntries={lotteryEntries}
        initialTimeBlocks={timeBlocks}
        config={config}
        restrictions={restrictions}
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
