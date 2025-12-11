import { FinishPageClient } from "~/components/pace-of-play/FinishPageClient";
import { getTimeBlocksAtFinish } from "~/server/pace-of-play/data";
import { getBCToday, parseDate } from "~/lib/dates";
import { type Metadata } from "next";

export const metadata: Metadata = {
  title: "Record Finish Time",
};

interface PageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function FinishPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const dateString = params?.date || getBCToday();
  const timeBlocksData = await getTimeBlocksAtFinish(parseDate(dateString));

  return (
    <div className="container mx-auto max-w-7xl py-6">
      <FinishPageClient
        initialTimeBlocks={timeBlocksData.regular}
        isAdmin={true}
      />
    </div>
  );
}
