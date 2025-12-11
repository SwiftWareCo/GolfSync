import { getTeesheetWithTimeBlocks } from "~/server/teesheet/data";
import { getQueryClient } from "~/lib/query-client";
import { teesheetKeys } from "~/services/teesheet/keys";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getBCToday, parseDate, getDateForDB } from "~/lib/dates";
import { notFound } from "next/navigation";
import { ProshopTeesheetDisplay } from "~/components/proshop/ProshopTeesheetDisplay";

interface PageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function ProshopDisplayPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const dateString = params?.date || getBCToday();

  // Validate date format
  try {
    const date = parseDate(dateString);
    if (getDateForDB(date) !== dateString) {
      notFound();
    }
  } catch {
    notFound();
  }

  const queryClient = getQueryClient();

  // Prefetch teesheet data for SSR hydration
  await queryClient.prefetchQuery({
    queryKey: teesheetKeys.detail(dateString),
    queryFn: () => getTeesheetWithTimeBlocks(dateString),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProshopTeesheetDisplay dateString={dateString} />
    </HydrationBoundary>
  );
}
