import "server-only";
import { cacheTag } from "next/cache";
import { db } from "~/server/db";
import { eq, sql } from "drizzle-orm";
import {
  teesheetConfigs,
  lotteryEntries,
  lotteryGroups,
  timeBlocks,
  timeBlockMembers,
  TeesheetConfigWithBlocks,
} from "~/server/db/schema";
import { getDayOfWeek } from "~/lib/dates";




/**
 * Get the configuration for a specific date
 * Matches against config's scheduling fields (daysOfWeek, startDate, endDate)
 *
 * @param dateString - Date in YYYY-MM-DD format (BC timezone)
 * @returns Config matching the specified date
 */
export async function getConfigForDate(
  dateString: string,
): Promise<TeesheetConfigWithBlocks | null> {
  const dayOfWeek = getDayOfWeek(dateString); // BC timezone day of week

  // Fetch all active configs with their blocks
  const allConfigs = await db.query.teesheetConfigs.findMany({
    where: eq(teesheetConfigs.isActive, true),
    with: {
      blocks: {
        orderBy: (blocks, { asc }) => [asc(blocks.sortOrder)],
      },
    },
  });

  if (!allConfigs.length) {
    return null;
  }

  // Find matching config
  const matchingConfig = allConfigs.find((config) => {
    // Check date range
    if (config.startDate && config.startDate > dateString) return false;
    if (config.endDate && config.endDate < dateString) return false;

    // Check day of week (if specified)
    if (config.daysOfWeek && !config.daysOfWeek.includes(dayOfWeek)) return false;

    return true;
  });

  if (!matchingConfig) {
    console.error(
      "[getConfigForDate] No matching configuration found for date:",
      dateString,
      "dayOfWeek:",
      dayOfWeek,
    );
    throw new Error("No teesheet configuration available. Please create one in settings.");
  }

  return matchingConfig;
}

export async function getTeesheetConfigs(): Promise<
  TeesheetConfigWithBlocks[]
> {
  "use cache";
  const configs = await db.query.teesheetConfigs.findMany({
    with: { blocks: { orderBy: (blocks, { asc }) => [asc(blocks.sortOrder)] } },
    orderBy: (teesheetConfigs, { asc }) => [asc(teesheetConfigs.name)],
  });

  cacheTag("teesheet-configs");
  return configs;
}

// Get course info for the current organization
export async function getCourseInfo() {
  "use cache";
  cacheTag("course-info");
  const info = await db.query.courseInfo.findFirst({});

  if (!info) {
    throw new Error("Course info not found");
  }

  return info;
}

/**
 * Check if teesheet has bookings or lottery entries (for validation)
 */
export async function checkTeesheetHasBookingsOrLotteryEntries(
  teesheetId: number,
  date: string,
): Promise<{
  hasBookings: boolean;
  hasLotteryEntries: boolean;
  bookingCount: number;
  lotteryEntryCount: number;
}> {
  try {
    // Check for member bookings
    const bookingCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(timeBlockMembers)
      .innerJoin(timeBlocks, eq(timeBlockMembers.timeBlockId, timeBlocks.id))
      .where(eq(timeBlocks.teesheetId, teesheetId))
      .then((res) => res[0]?.count || 0);

    // Check for lottery entries (both individual and group)
    const individualCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(lotteryEntries)
      .where(eq(lotteryEntries.lotteryDate, date))
      .then((res) => res[0]?.count || 0);

    const groupCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(lotteryGroups)
      .where(eq(lotteryGroups.lotteryDate, date))
      .then((res) => res[0]?.count || 0);

    const totalLotteryEntries = individualCount + groupCount;

    return {
      hasBookings: bookingCount > 0,
      hasLotteryEntries: totalLotteryEntries > 0,
      bookingCount,
      lotteryEntryCount: totalLotteryEntries,
    };
  } catch (error) {
    console.error("Error checking teesheet bookings/lottery entries:", error);
    return {
      hasBookings: false,
      hasLotteryEntries: false,
      bookingCount: 0,
      lotteryEntryCount: 0,
    };
  }
}
