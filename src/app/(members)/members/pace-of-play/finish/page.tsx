import { FinishPageClient } from "~/components/pace-of-play/FinishPageClient";
import { getTimeBlocksAtFinish } from "~/server/pace-of-play/data";
import { getBCToday, parseDate } from "~/lib/dates";

interface PageProps {
  searchParams: Promise<{ teesheetDate?: string }>;
}

export default async function FinishPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const dateString = params?.teesheetDate || getBCToday();
  const timeBlocksData = await getTimeBlocksAtFinish(parseDate(dateString));

  return (
    <div className="container mx-auto max-w-7xl py-6">
      <FinishPageClient
        initialTimeBlocks={timeBlocksData.regular}
        isAdmin={false}
      />
    </div>
  );
}
