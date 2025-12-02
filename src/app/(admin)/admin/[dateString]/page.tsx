import { getTeesheetWithTimeBlocks } from "~/server/teesheet/data";
import { getTeesheetConfigs } from "~/server/settings/data";
import { TeesheetViewContainer } from "~/components/teesheet/admin/TeesheetViewContainer";
import { getQueryClient } from "~/lib/query-client";
import { teesheetKeys } from "~/services/teesheet/keys";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";

import { notFound } from "next/navigation";
import { parseDate, getDateForDB } from "~/lib/dates";

export default async function AdminPage({
  params,
}: {
  params: Promise<{ dateString: string }>;
}) {
  const { dateString } = await params;

  try {
    const date = parseDate(dateString);
    // Ensure the date string is a valid calendar date (e.g. reject 2025-02-30)
    if (getDateForDB(date) !== dateString) {
      notFound();
    }
  } catch {
    notFound();
  }

  const queryClient = getQueryClient();

  const [result, teesheetConfigs] = await Promise.all([
    queryClient.ensureQueryData({
      queryKey: teesheetKeys.detail(dateString),
      queryFn: () => getTeesheetWithTimeBlocks(dateString),
    }),
    getTeesheetConfigs().then((configs) => {
      if (!Array.isArray(configs)) throw new Error("Invalid configs payload");
      return configs;
    }),
  ]);

  const { teesheet, config, timeBlocks, occupiedSpots, totalCapacity } = result;

  return (
    <div className="flex h-screen">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <TeesheetViewContainer
          dateString={dateString}
          teesheet={teesheet}
          config={config}
          timeBlocks={timeBlocks}
          teesheetConfigs={teesheetConfigs}
          occupiedSpots={occupiedSpots}
          totalCapacity={totalCapacity}
        />
      </HydrationBoundary>
    </div>
  );
}
