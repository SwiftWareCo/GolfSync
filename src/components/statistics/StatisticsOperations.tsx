import { PaceOfPlayChart } from "./charts/PaceOfPlayChart";
import { PowerCartUsageChart } from "./charts/PowerCartUsageChart";
import { BookingsByDayChart } from "./charts/BookingsByDayChart";
import type { StatisticsData } from "~/lib/statistics/mock-data";

interface StatisticsOperationsProps {
  data: StatisticsData;
}

export function StatisticsOperations({ data }: StatisticsOperationsProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <PaceOfPlayChart data={data.paceOfPlayTrend} />
        <PowerCartUsageChart data={data.powerCartUsage} />
      </div>

      {/* Only show Bookings by Day - removed BookingsBySlotChart */}
      <BookingsByDayChart data={data.bookingsByDayOfWeek} />
    </div>
  );
}
