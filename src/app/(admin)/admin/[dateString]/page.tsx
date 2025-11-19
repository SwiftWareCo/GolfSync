import { Suspense } from "react";
import { getTeesheetWithTimeBlocks } from "~/server/teesheet/data";
import { getTeesheetConfigs, getLotterySettings } from "~/server/settings/data";
import { parseDate, getDateForDB } from "~/lib/dates";
import { ConfigSummary } from "~/components/teesheet/admin/ConfigSummary";
import { CalendarPicker } from "~/components/teesheet/admin/CalendarPicker";
import { GeneralNotes } from "~/components/teesheet/admin/GeneralNotes";
import { TeesheetTable } from "~/components/teesheet/admin/TeesheetTable";
import { SidebarActions } from "~/components/teesheet/admin/SidebarActions";

export const dynamicParams = true;

export async function generateStaticParams() {
  const today = new Date();
  const threeDaysForward = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
  let currentDate = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);

  const params = [];

  while (currentDate <= threeDaysForward) {
    const dateString = getDateForDB(currentDate);
    await getTeesheetWithTimeBlocks(dateString);
    params.push({ date: dateString });
    currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
  }

  return params;
}

export default async function AdminPage({
  params,
}: {
  params: Promise<{ dateString: string }>; // ✅ Correct type
}) {
  const { dateString } = await params;

  const { teesheet, config, timeBlocks } =
    await getTeesheetWithTimeBlocks(dateString);

  const [teesheetConfigs, lotterySettings] = await Promise.all([
    getTeesheetConfigs().then((configs) => {
      if (!Array.isArray(configs)) throw new Error("Invalid configs payload");
      return configs;
    }),
    getLotterySettings(teesheet.id).catch((error) => {
      console.error("lotterySettings failed", error);
      return null;
    }),
  ]);

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

            <Suspense
              fallback={
                <div className="p-8 text-center">Loading teesheet...</div>
              }
            >
              <TeesheetTable
                teesheetId={teesheet.id}
                dateString={dateString}
                TimeBlocks={timeBlocks}
              />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
