import "server-only";
import { db } from "~/server/db";
import { eq, sql, and, ne } from "drizzle-orm";
import {
  teesheetConfigs,
  lotteryEntries,
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
    console.warn(
      "[getConfigForDate] No matching configuration found for date:",
      dateString,
      "dayOfWeek:",
      dayOfWeek,
      "- proceeding with empty teesheet",
    );
    return null;
  }

  return matchingConfig;
}

/**
 * Validate that active config's days don't conflict with other active configs
 *
 * @param configId - ID of config being updated (null for create)
 * @param daysOfWeek - Days of week for this config
 * @param isActive - Whether config is being activated
 * @returns Validation result with conflicts if any
 */
export async function validateConfigDaysOfWeek(
  configId: number | null,
  daysOfWeek: number[],
  isActive: boolean,
): Promise<{
  isValid: boolean;
  conflictingDays: number[];
  conflictingConfigNames: string[];
}> {
  // Only validate if being set to active
  if (!isActive) {
    return {
      isValid: true,
      conflictingDays: [],
      conflictingConfigNames: [],
    };
  }

  // Get all OTHER active configs
  const activeConfigs = await db.query.teesheetConfigs.findMany({
    where: configId
      ? and(eq(teesheetConfigs.isActive, true), ne(teesheetConfigs.id, configId))
      : eq(teesheetConfigs.isActive, true),
    columns: {
      id: true,
      name: true,
      daysOfWeek: true,
    },
  });

  // Find day overlaps
  const conflicts = new Map<number, string[]>(); // day -> [config names]

  for (const activeConfig of activeConfigs) {
    if (!activeConfig.daysOfWeek) continue;

    for (const day of daysOfWeek) {
      if (activeConfig.daysOfWeek.includes(day)) {
        if (!conflicts.has(day)) {
          conflicts.set(day, []);
        }
        conflicts.get(day)!.push(activeConfig.name);
      }
    }
  }

  if (conflicts.size === 0) {
    return {
      isValid: true,
      conflictingDays: [],
      conflictingConfigNames: [],
    };
  }

  const conflictingDays = Array.from(conflicts.keys()).sort();
  const conflictingConfigNamesSet = new Set<string>();
  conflicts.forEach((names) =>
    names.forEach((n) => conflictingConfigNamesSet.add(n)),
  );

  return {
    isValid: false,
    conflictingDays,
    conflictingConfigNames: Array.from(conflictingConfigNamesSet),
  };
}

/**
 * Validate that config name is unique
 *
 * @param configId - ID of config being updated (null for create)
 * @param name - Config name to validate
 * @returns Validation result with existing config name if duplicate
 */
export async function validateConfigName(
  configId: number | null,
  name: string,
): Promise<{
  isValid: boolean;
  existingConfigName?: string;
}> {
  // Get all OTHER configs with this name
  const existingConfigs = await db.query.teesheetConfigs.findMany({
    where: configId
      ? and(eq(teesheetConfigs.name, name), ne(teesheetConfigs.id, configId))
      : eq(teesheetConfigs.name, name),
    columns: {
      id: true,
      name: true,
    },
  });

  if (existingConfigs.length > 0) {
    return {
      isValid: false,
      existingConfigName: existingConfigs[0]?.name,
    };
  }

  return { isValid: true };
}

/**
 * Validate that blocks + displayName combination is unique
 * Checks if another config has BOTH the same time blocks AND same display name
 *
 * @param configId - ID of config being updated (null for create)
 * @param blocks - Array of blocks with startTime and displayName
 * @param displayNameToCheck - Display name to check for duplicates
 * @returns Validation result with duplicate config name if found
 */
export async function validateBlockStructure(
  configId: number | null,
  blocks: Array<{ startTime: string; displayName?: string | null }>,
  displayNameToCheck: string | null | undefined,
): Promise<{
  isValid: boolean;
  duplicateConfigName?: string;
}> {
  // Get all OTHER configs with their blocks
  const otherConfigs = await db.query.teesheetConfigs.findMany({
    where: configId ? ne(teesheetConfigs.id, configId) : undefined,
    with: {
      blocks: {
        columns: {
          startTime: true,
          displayName: true,
        },
        orderBy: (blocks, { asc }) => [asc(blocks.sortOrder)],
      },
    },
  });

  // Sort input blocks by startTime for comparison
  const sortedInputBlocks = [...blocks].sort((a, b) =>
    a.startTime.localeCompare(b.startTime),
  );

  for (const config of otherConfigs) {
    // First check: Do all blocks have matching startTimes?
    const sortedConfigBlocks = [...config.blocks].sort((a, b) =>
      a.startTime.localeCompare(b.startTime),
    );

    // Must have same number of blocks
    if (sortedInputBlocks.length !== sortedConfigBlocks.length) {
      continue;
    }

    // Check if all startTimes match
    const allTimesMatch = sortedInputBlocks.every((inputBlock, index) => {
      return inputBlock.startTime === sortedConfigBlocks[index]?.startTime;
    });

    if (!allTimesMatch) {
      continue;
    }

    // Times match, now check displayName
    // Compare first block's displayName (assuming all blocks in config use same displayName)
    const configDisplayName = config.blocks[0]?.displayName;
    const normalizedInput = displayNameToCheck?.trim() || null;
    const normalizedConfig = configDisplayName?.trim() || null;

    if (normalizedInput === normalizedConfig) {
      return {
        isValid: false,
        duplicateConfigName: config.name,
      };
    }
  }

  return { isValid: true };
}

export async function getTeesheetConfigs(): Promise<
  TeesheetConfigWithBlocks[]
> {
  const configs = await db.query.teesheetConfigs.findMany({
    with: { blocks: { orderBy: (blocks, { asc }) => [asc(blocks.sortOrder)] } },
    orderBy: (teesheetConfigs, { asc }) => [asc(teesheetConfigs.name)],
  });

  return configs;
}

// Get course info
export async function getCourseInfo() {
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

    // Check for lottery entries (consolidated schema - individual and group in same table)
    const allLotteryEntries = await db.query.lotteryEntries.findMany({
      where: eq(lotteryEntries.lotteryDate, date),
    });

    // Separate into individual and group entries
    const individualCount = allLotteryEntries.filter(
      (entry) => entry.memberIds.length === 1,
    ).length;

    const groupCount = allLotteryEntries.filter(
      (entry) => entry.memberIds.length > 1,
    ).length;

    const totalLotteryEntries = allLotteryEntries.length;

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
