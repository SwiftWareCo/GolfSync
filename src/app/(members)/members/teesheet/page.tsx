import { getMemberTeesheetDataWithRestrictions } from "~/server/members-teesheet-client/data";
import { getLotteryEntryData } from "~/server/lottery/data";
import TeesheetClient from "../../../../components/member-teesheet-client/TeesheetClient";
import { auth } from "@clerk/nextjs/server";
import type { LotteryEntryData } from "~/server/db/schema/lottery/lottery-entries.schema";
import {
  getBCToday,
  parseDate,
  addDays,
  formatDateToYYYYMMDD,
} from "~/lib/dates";

interface PageProps {
  searchParams: Promise<{ date?: string | string[] }>;
}

export default async function MemberTeesheetPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { sessionClaims } = await auth();
  const userId = sessionClaims?.userId;

  // Get today's date in BC timezone
  const today = getBCToday();

  // Use the date param if valid, otherwise use today
  const dateParam = params?.date;
  const dateString = typeof dateParam === "string" ? dateParam : today;

  // Create a Date object from the date string
  const date = parseDate(dateString);

  // Check if this is a lottery-eligible date (3+ days from now)
  const threeDaysFromNow = formatDateToYYYYMMDD(addDays(today, 3));
  const isLotteryEligible = dateString >= threeDaysFromNow;

  // Fetch lottery data if this is a lottery-eligible date
  let lotteryEntry: LotteryEntryData = null;
  if (isLotteryEligible) {
    try {
      lotteryEntry = await getLotteryEntryData(
        dateString,
        sessionClaims?.userId as string,
      );
    } catch (error) {
      console.error("Error fetching lottery entry:", error);
      // Continue without lottery data - the component will handle the error state
    }
  }

  // Fetch teesheet data server-side with pre-checked restrictions
  const {
    teesheet,
    config,
    timeBlocks = [],
    member,
    lotterySettings,
  } = await getMemberTeesheetDataWithRestrictions(date, userId as string);

  return (
    <TeesheetClient
      teesheet={teesheet}
      config={config}
      timeBlocks={timeBlocks as any}
      member={member!}
      selectedDate={dateString}
      lotteryEntry={lotteryEntry}
      isLotteryEligible={isLotteryEligible}
      lotterySettings={lotterySettings}
    />
  );
}
