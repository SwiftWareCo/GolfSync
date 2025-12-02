import "server-only";
import { getTeesheetWithTimeBlocks } from "~/server/teesheet/data";
import { getTimeBlocksForTeesheet } from "~/server/teesheet/data";
import { db } from "~/server/db";
import { timeBlockMembers, members } from "~/server/db/schema";
import { and, eq, or, gt, asc, gte } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";

import { checkBatchTimeblockRestrictions } from "~/server/timeblock-restrictions/data";
import { formatCalendarDate } from "~/lib/utils";
import { type Member } from "~/app/types/MemberTypes";
import { getBCToday, getBCNow } from "~/lib/dates";

/**
 * Get teesheet data for members
 * Should only be called from server components
 */
export async function getMemberTeesheetData(date: Date, id: string) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  // Get member data
  const member = await getMemberData(id);

  // Get or create teesheet for the date
  const { teesheet, config } = await getTeesheetWithTimeBlocks(date);

  // Get time blocks with all members
  const timeBlocks = await getTimeBlocksForTeesheet(teesheet.id);

  return {
    teesheet,
    config,
    timeBlocks,
    member,
  };
}

/**
 * Get teesheet data for members
 */
export async function getMemberTeesheet(date: Date) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  // Get member data
  const member = await getMemberData();

  // Get or create teesheet for the date
  const { teesheet, config } = await getTeesheetWithTimeBlocks(date);

  // Get time blocks with all members
  const timeBlocks = await getTimeBlocksForTeesheet(teesheet.id);

  return {
    teesheet,
    config,
    timeBlocks,
    memberClass: member?.memberClass?.label,
    memberId: member?.id,
  };
}

/**
 * Get bookings for the current member
 */
export async function getMemberBookings() {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  // Get member data
  const member = await getMemberData();

  if (!member) {
    throw new Error("Member not found");
  }

  const bookings = await db.query.timeBlockMembers.findMany({
    where: eq(timeBlockMembers.memberId, member.id),
    with: {
      timeBlock: true,
    },
    orderBy: (fields, { asc }) => [asc(fields.createdAt)],
  });

  return bookings;
}

/**
 * Get member data by current user
 */
export async function getMemberData(id?: string) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Not authenticated");
  }
  const user = await db.query.members.findFirst({
    where: and(eq(members.id, Number(id))),
    with: {
      memberClass: true,
    },
  });

  return user;
}

/**
 * Get teesheet data for members with pre-checked restrictions
 * Should only be called from server components
 */
export async function getMemberTeesheetDataWithRestrictions(
  date: Date,
  id: string,
) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  // Get member data
  const member = await getMemberData(id);

  if (!member) {
    throw new Error("Member not found");
  }

  // Get or create teesheet for the date
  // This now returns the full config with rules
  const dateString = formatCalendarDate(date);
  const { teesheet, config } = await getTeesheetWithTimeBlocks(dateString);

  // Get time blocks with all members
  const timeBlocks = await getTimeBlocksForTeesheet(teesheet.id);

  // Lottery settings are now stored on teesheet
  const lotterySettingsData = {
    enabled: teesheet.lotteryEnabled,
    disabledMessage: teesheet.lotteryDisabledMessage,
  };

  // Check restrictions for each time block
  let timeBlocksWithRestrictions = timeBlocks;
  try {
    const timeBlocksForBatch = timeBlocks.map((tb) => ({
      id: tb.id,
      startTime: tb.startTime,
      date: tb.date || formatCalendarDate(date),
    }));

    const batchResults = await checkBatchTimeblockRestrictions({
      timeBlocks: timeBlocksForBatch,
      memberId: member.id,
      memberClass: member.memberClass?.label,
    });

    if (Array.isArray(batchResults)) {
      // Map the results back to the timeBlocks
      timeBlocksWithRestrictions = timeBlocks.map((timeBlock) => {
        const restrictionResult = batchResults.find(
          (r: {
            timeBlockId: number;
            hasViolations: boolean;
            violations: any[];
            preferredReason?: string;
          }) => r.timeBlockId === timeBlock.id,
        );

        // Get the appropriate reason - description if not empty, otherwise message
        let reason = "";
        if (
          restrictionResult &&
          restrictionResult.hasViolations &&
          restrictionResult.violations.length > 0
        ) {
          const violation = restrictionResult.violations[0];
          reason =
            violation.restrictionDescription &&
            violation.restrictionDescription.trim() !== ""
              ? violation.restrictionDescription
              : violation.message;
        }

        return {
          ...timeBlock,
          restriction: {
            isRestricted: restrictionResult
              ? restrictionResult.hasViolations
              : false,
            reason,
            violations: restrictionResult ? restrictionResult.violations : [],
          },
        };
      });
    }
  } catch (error) {
    // Return timeblocks without restriction data in case of error
    timeBlocksWithRestrictions = timeBlocks.map((timeBlock) => ({
      ...timeBlock,
      restriction: {
        isRestricted: false,
        reason: "",
        violations: [],
      },
    }));
  }

  return {
    teesheet,
    config,
    timeBlocks: timeBlocksWithRestrictions,
    member,
    lotterySettings: lotterySettingsData,
  };
}

/**
 * Get upcoming tee times for the current member
 */
export async function getUpcomingTeeTimes(member: Member) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  if (!member) {
    throw new Error("Member not found");
  }

  // Get current BC date and time for filtering
  const today = getBCToday();
  const now = getBCNow();
  const currentTimeString = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  // Get bookings with accurate time filtering using BC timezone
  const bookings = await db.query.timeBlockMembers.findMany({
    where: and(
      eq(timeBlockMembers.memberId, member.id),
      or(
        // Future dates
        gt(timeBlockMembers.bookingDate, today),
        // Today but time hasn't passed yet
        and(
          eq(timeBlockMembers.bookingDate, today),
          gte(timeBlockMembers.bookingTime, currentTimeString),
        ),
      ),
    ),
    with: {
      timeBlock: true,
    },
    orderBy: [
      asc(timeBlockMembers.bookingDate),
      asc(timeBlockMembers.bookingTime),
    ],
  });

  // Format the results
  return bookings.map((booking) => ({
    id: booking.id,
    timeBlockId: booking.timeBlockId,
    memberId: booking.memberId,
    checkedIn: booking.checkedIn,
    checkedInAt: booking.checkedInAt,
    startTime: booking.bookingTime,
    endTime: booking.timeBlock.endTime,
    date: booking.bookingDate,
    teesheetId: booking.timeBlock.teesheetId,
  }));
}
