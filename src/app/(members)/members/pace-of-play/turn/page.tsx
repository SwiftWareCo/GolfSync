import { TurnPageClient } from "~/components/pace-of-play/TurnPageClient";
import { getTimeBlocksAtTurn } from "~/server/pace-of-play/data";
import { getBCToday, parseDate } from "~/lib/dates";

interface PageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function TurnPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const dateString = params?.date || getBCToday();
  const timeBlocks = await getTimeBlocksAtTurn(parseDate(dateString));

  return (
    <div className="container mx-auto max-w-7xl py-6">
      <TurnPageClient initialTimeBlocks={timeBlocks} isAdmin={false} />
    </div>
  );
}
