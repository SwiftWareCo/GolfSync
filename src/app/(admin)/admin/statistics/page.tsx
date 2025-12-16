import { type Metadata } from "next";
import { PageHeader } from "~/components/ui/page-header";
import { StatisticsClient } from "~/components/statistics/StatisticsClient";
import { getStatisticsData } from "~/server/statistics/data";
import { generateMockStatisticsData } from "~/lib/statistics/mock-data";
import type { StatisticsFilters } from "~/lib/statistics/mock-data";
import type { StatisticsData } from "~/lib/statistics/mock-data";
import { getBCToday, parseDate, formatDateToYYYYMMDD } from "~/lib/dates";

export const metadata: Metadata = {
  title: "Statistics Dashboard",
};

interface PageProps {
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
    useMockData?: string;
    memberId?: string;
  }>;
}

export default async function StatisticsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  // Parse date range from URL or use defaults (YTD - year to date)
  const today = getBCToday();
  const todayDate = new Date();
  const yearStart = new Date(todayDate.getFullYear(), 0, 1);
  const yearStartString = formatDateToYYYYMMDD(yearStart);

  const filters: StatisticsFilters = {
    startDate: params.startDate || yearStartString,
    endDate: params.endDate || today,
  };

  // Parse useMockData from URL (default to false for real data)
  const useMockData = params.useMockData === "true";

  // Fetch club-wide data
  const clubData = useMockData
    ? generateMockStatisticsData(filters)
    : await getStatisticsData(filters);

  // Fetch member-specific data if memberId is provided
  let memberData: StatisticsData | null = null;
  if (params.memberId) {
    const memberId = parseInt(params.memberId, 10);
    if (!isNaN(memberId)) {
      memberData = useMockData
        ? generateMockStatisticsData({ ...filters, memberId })
        : await getStatisticsData({ ...filters, memberId });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Statistics Dashboard"
        description="View club usage metrics, booking patterns, and member activity"
      />

      <StatisticsClient
        clubData={clubData}
        memberData={memberData}
        initialDateRange={{
          from: parseDate(filters.startDate),
          to: parseDate(filters.endDate),
        }}
      />
    </div>
  );
}
