import { TurnPageClient } from "~/components/pace-of-play/TurnPageClient";
import { getTimeBlocksAtTurn } from "~/server/pace-of-play/data";
import { getBCToday, parseDate } from "~/lib/dates";

export default async function TurnPage() {
  const timeBlocks = await getTimeBlocksAtTurn(parseDate(getBCToday()));

  return (
    <div className="container mx-auto max-w-7xl py-6">
      <TurnPageClient initialTimeBlocks={timeBlocks} isAdmin={false} />
    </div>
  );
}
