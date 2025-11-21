import "server-only";
import { cacheTag } from "next/cache";
import { db } from "~/server/db";
import { and, eq, or, desc, isNull, lte, gte, sql } from "drizzle-orm";

import {
  teesheetConfigs,
  teesheetConfigRules,
  templates,
  lotterySettings,
  lotteryEntries,
  lotteryGroups,
  timeBlocks,
  timeBlockMembers,
  type TeesheetConfigWithRules,
} from "~/server/db/schema";
import type { TeesheetConfig } from "~/server/db/schema";
import { ConfigTypes } from "~/app/types/TeeSheetTypes";
import type { LotterySettingsType } from "~/server/db/schema";
import { getDayOfWeek } from "~/lib/dates";

export async function initializeDefaultConfigs() {
  try {
    // First check if we already have configs
    const existingConfigs = await db.query.teesheetConfigs.findMany({});

    if (existingConfigs.length > 0) {
      return; // Configs already exist, no need to create defaults
    }

    // Create default weekday config (Mon-Fri)
    const [weekdayConfigDb] = await db
      .insert(teesheetConfigs)
      .values({
        name: "Weekday (Mon-Fri)",
        type: ConfigTypes.REGULAR,
        startTime: "07:00",
        endTime: "19:00",
        interval: 15,
        maxMembersPerBlock: 4,
        isActive: true,
        isSystemConfig: true,
      })
      .returning();

    if (!weekdayConfigDb) {
      throw new Error("Failed to create weekday config");
    }

    const weekdayConfig = { ...weekdayConfigDb, rules: [] } as TeesheetConfig;

    // Create default weekend config (Sat-Sun)
    const [weekendConfigDb] = await db
      .insert(teesheetConfigs)
      .values({
        name: "Weekend (Sat-Sun)",
        type: ConfigTypes.REGULAR,
        startTime: "07:00",
        endTime: "19:00",
        interval: 20,
        maxMembersPerBlock: 4,
        isActive: true,
        isSystemConfig: true,
      })
      .returning();

    if (!weekendConfigDb) {
      throw new Error("Failed to create weekend config");
    }

    const weekendConfig = { ...weekendConfigDb, rules: [] } as TeesheetConfig;

    // Create rules for system configs
    await db.insert(teesheetConfigRules).values([
      {
        configId: weekdayConfig.id,
        daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
      },
      {
        configId: weekendConfig.id,
        daysOfWeek: [0, 6], // Sat-Sun
      },
    ]);
  } catch (error) {
    console.error("Error initializing default configs:", error);
    // If we get a unique constraint error, it means another process already created the configs
    // We can safely ignore this error
    if (error instanceof Error && error.message.includes("unique constraint")) {
      return;
    }
    throw error;
  }
}

/**
 * Helper: Find config with specific date rule matching the given date
 */
function findConfigBySpecificDate(
  configs: TeesheetConfigWithRules[],
  dateString: string,
): TeesheetConfigWithRules | null {
  for (const config of configs) {
    const matchingRule = config.rules.filter(
      (rule) => rule.startDate === dateString && rule.endDate === dateString,
    )[0];

    if (matchingRule) {
      return config;
    }
  }
  return null;
}

/**
 * Helper: Find config with recurring rule matching the given date and day of week
 */
function findConfigByRecurring(
  configs: TeesheetConfigWithRules[],
  dateString: string,
  dayOfWeek: number,
): TeesheetConfigWithRules | null {
  for (const config of configs) {
    const matchingRule = config.rules.filter((rule) => {
      // Must have day of week match
      if (!rule.daysOfWeek?.includes(dayOfWeek)) return false;

      // Check start date (null or before/equal to target date)
      if (rule.startDate !== null && rule.startDate > dateString) return false;

      // Check end date (null or after/equal to target date)
      if (rule.endDate !== null && rule.endDate < dateString) return false;

      return true;
    })[0];

    if (matchingRule) {
      return config;
    }
  }
  return null;
}

/**
 * Helper: Find system config matching the given day of week
 */
function findSystemConfig(
  configs: TeesheetConfigWithRules[],
  dayOfWeek: number,
): TeesheetConfigWithRules | null {
  return (
    configs
      .filter((config) => config.isSystemConfig)
      .find((config) =>
        config.rules?.some((rule) => rule.daysOfWeek?.includes(dayOfWeek)),
      ) || null
  );
}

/**
 * Get the configuration for a specific date
 * Uses a single database query and filters in-memory for optimal performance
 *
 * @param dateString - Date in YYYY-MM-DD format (BC timezone)
 * @returns Config with rules for the specified date
 */
export async function getConfigForDate(
  dateString: string,
): Promise<TeesheetConfigWithRules> {
  // Ensure default configs exist
  await initializeDefaultConfigs();

  const dayOfWeek = getDayOfWeek(dateString); // BC timezone day of week

  // Single query: Fetch all active configs with their rules
  const allConfigs = await db.query.teesheetConfigs.findMany({
    where: eq(teesheetConfigs.isActive, true),
    with: {
      rules: true,
    },
  });

  // Priority 1: Check for specific date rules (highest priority)
  const specificDateConfig = findConfigBySpecificDate(allConfigs, dateString);
  if (specificDateConfig) {
    return specificDateConfig;
  }

  // Priority 2: Check for recurring day rules
  const recurringConfig = findConfigByRecurring(
    allConfigs,
    dateString,
    dayOfWeek,
  );
  if (recurringConfig) {
    return recurringConfig;
  }

  // Priority 3: Fall back to system config
  const systemConfig = findSystemConfig(allConfigs, dayOfWeek);
  if (!systemConfig) {
    console.error(
      "[getConfigForDate] No matching configuration found for date:",
      dateString,
      "dayOfWeek:",
      dayOfWeek,
    );
    throw new Error("No matching system configuration found");
  }

  return systemConfig;
}

export async function getTeesheetConfigs(): Promise<TeesheetConfigWithRules[]> {
  "use cache";
  const configs = await db.query.teesheetConfigs.findMany({
    with: { rules: true },
    orderBy: (teesheetConfigs, { asc }) => [asc(teesheetConfigs.name)],
  });

  cacheTag("teesheet-configs");
  return configs;
}

// Get course info for the current organization
export async function getCourseInfo() {
  const info = await db.query.courseInfo.findFirst({});

  if (!info) {
    throw new Error("Course info not found");
  }

  return info;
}

export async function getTemplates() {
  const templateList = await db.query.templates.findMany({
    orderBy: desc(templates.updatedAt),
  });

  if (!templateList) {
    return "Error fetching templates";
  }
  return templateList;
}

/**
 * Get lottery settings for a teesheet
 */
export async function getLotterySettings(
  teesheetId: number,
): Promise<LotterySettingsType | null> {
  try {
    const [settings] = await db
      .select()
      .from(lotterySettings)
      .where(eq(lotterySettings.teesheetId, teesheetId))
      .limit(1);

    return settings || null;
  } catch (error) {
    console.error("Error getting lottery settings:", error);
    return null;
  }
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
