import { FinishPageClient } from "~/components/pace-of-play/FinishPageClient";
import { getTimeBlocksAtFinish } from "~/server/pace-of-play/data";
import { getBCToday, parseDate } from "~/lib/dates";

export default async function FinishPage() {
  const timeBlocksData = await getTimeBlocksAtFinish(
    parseDate(getBCToday()),
    true,
  );

  return (
    <div className="container mx-auto max-w-7xl py-6">
      <FinishPageClient
        initialTimeBlocks={timeBlocksData.regular}
        isAdmin={false}
      />
    </div>
  );
}
