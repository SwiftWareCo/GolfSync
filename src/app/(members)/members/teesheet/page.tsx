import { getMemberTeesheetDataWithRestrictions } from "~/server/members-teesheet-client/data";
import { getLotteryEntryData } from "~/server/lottery/data";
import { getLotterySettings } from "~/server/lottery/lottery-settings-data";
import { checkLotteryTimeWindowRestrictions } from "~/server/timeblock-restrictions/actions";
import { calculateDynamicTimeWindows } from "~/lib/lottery-utils";
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

  // Get lottery settings to determine eligibility window
  const globalLotterySettings = await getLotterySettings();
  const advanceDaysDate = formatDateToYYYYMMDD(
    addDays(today, globalLotterySettings.lotteryAdvanceDays),
  );
  const maxDaysAheadDate = formatDateToYYYYMMDD(
    addDays(today, globalLotterySettings.lotteryMaxDaysAhead),
  );

  // Check if this is a lottery-eligible date (within advanceDays and maxDaysAhead)
  const isLotteryEligible =
    dateString >= advanceDaysDate && dateString <= maxDaysAheadDate;

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
    lotteryRestrictionViolation,
  } = await getMemberTeesheetDataWithRestrictions(date, userId as string);

  // Pre-fetch initial window restrictions for the logged-in member (server-side)
  let initialWindowRestrictions: Array<{
    windowIndex: number;
    isFullyRestricted: boolean;
    reasons: string[];
  }> = [];

  if (isLotteryEligible && config && member) {
    try {
      const timeWindows = calculateDynamicTimeWindows(config);
      const result = await checkLotteryTimeWindowRestrictions({
        lotteryDate: dateString,
        memberClassIds: [member.classId],
        hasGuestsOrGuestFills: false, // Initial state - no guests yet
        timeWindows: timeWindows.map((w) => ({
          index: w.index,
          startTime: `${String(Math.floor(w.startMinutes / 60)).padStart(2, "0")}:${String(w.startMinutes % 60).padStart(2, "0")}`,
          endTime: `${String(Math.floor(w.endMinutes / 60)).padStart(2, "0")}:${String(w.endMinutes % 60).padStart(2, "0")}`,
        })),
      });
      if (result.success) {
        initialWindowRestrictions = result.restrictions;
      }
    } catch (error) {
      console.error("Error fetching initial window restrictions:", error);
    }
  }

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
      lotteryRestrictionViolation={lotteryRestrictionViolation}
      initialWindowRestrictions={initialWindowRestrictions}
    />
  );
}
