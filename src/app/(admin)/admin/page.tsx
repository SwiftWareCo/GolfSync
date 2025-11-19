import {
  getTeesheetWithTimeBlocks,
  getTimeBlocksForTeesheet,
} from "~/server/teesheet/data";
import { TeesheetPageClient } from "~/components/teesheet/TeesheetPageClient";
import { getTeesheetConfigs, getLotterySettings } from "~/server/settings/data";
import { getAllPaceOfPlayForDate } from "~/server/pace-of-play/actions";
import { getBCToday, parseDate } from "~/lib/dates";

interface PageProps {
  searchParams: Promise<{
    date?: string;
  }>;
}

export default async function AdminPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const dateString = params?.date ?? getBCToday();
  const date = parseDate(dateString);

  const { teesheet, config } = await getTeesheetWithTimeBlocks(date);

  const [timeBlocks, availableConfigs, paceOfPlayData, lotterySettings] =
    await Promise.all([
      getTimeBlocksForTeesheet(teesheet.id).catch((error) => {
        console.error("timeBlocks failed", error);
        return [];
      }),
      getTeesheetConfigs().then((configs) => {
        if (!Array.isArray(configs)) throw new Error("Invalid configs payload");
        return configs;
      }),
      getAllPaceOfPlayForDate(date).catch((error) => {
        console.error("paceOfPlay failed", error);
        return [];
      }),
      getLotterySettings(teesheet.id).catch((error) => {
        console.error("lotterySettings failed", error);
        return null;
      }),
    ]);

  const initialData = {
    teesheet,
    config,
    timeBlocks,
    availableConfigs,
    paceOfPlayData,
    lotterySettings,
  };

  return (
    <div>
      {/* Admin Teesheet Page */}

      <TeesheetPageClient
        initialDate={date}
        initialData={initialData}
        isAdmin={true}
      />
    </div>
  );
}
