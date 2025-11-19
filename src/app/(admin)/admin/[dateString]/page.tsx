import { getTeesheetWithTimeBlocks } from "~/server/teesheet/data";
import { getTeesheetConfigs, getLotterySettings } from "~/server/settings/data";
import { ConfigSummary } from "~/components/teesheet/admin/ConfigSummary";
import { CalendarPicker } from "~/components/teesheet/admin/CalendarPicker";
import { GeneralNotes } from "~/components/teesheet/admin/GeneralNotes";
import { TeesheetTable } from "~/components/teesheet/admin/TeesheetTable";
import { SidebarActions } from "~/components/teesheet/admin/SidebarActions";
import { getQueryClient } from "~/lib/query-client";
import { teesheetKeys } from "~/services/teesheet/keys";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";

export default async function AdminPage({
  params,
}: {
  params: Promise<{ dateString: string }>;
}) {
  const { dateString } = await params;

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

  const { teesheet, config, timeBlocks, lotterySettings } = result;

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <SidebarActions
        teesheet={teesheet}
        dateString={dateString}
        config={config}
        timeBlocks={timeBlocks}
        lotterySettings={lotterySettings}
        availableConfigs={teesheetConfigs}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 p-6">
          <ConfigSummary
            config={config}
            timeBlocks={timeBlocks}
            dateString={dateString}
          />

          <CalendarPicker dateString={dateString} />

          <div className="space-y-4">
            <GeneralNotes teesheet={teesheet} />

            <HydrationBoundary state={dehydrate(queryClient)}>
              <TeesheetTable dateString={dateString} />
            </HydrationBoundary>
          </div>
        </div>
      </div>
    </div>
  );
}
