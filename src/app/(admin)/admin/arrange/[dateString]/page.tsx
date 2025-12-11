import { getTeesheetWithTimeBlocks } from "~/server/teesheet/data";
import { ArrangeContainer } from "~/components/teesheet/arrange/ArrangeContainer";
import { notFound } from "next/navigation";
import { parseDate, getDateForDB } from "~/lib/dates";

export default async function ArrangePage({
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

  const { teesheet, config, timeBlocks } =
    await getTeesheetWithTimeBlocks(dateString);

  return (
    <div className="p-4">
      <ArrangeContainer
        dateString={dateString}
        teesheetId={teesheet.id}
        initialTimeBlocks={timeBlocks}
        config={config}
      />
    </div>
  );
}
