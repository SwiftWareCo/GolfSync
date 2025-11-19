import "server-only";
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
} from "~/server/db/schema";
import type { TeesheetConfig } from "~/server/db/schema";
import { ConfigTypes } from "~/app/types/TeeSheetTypes";
import { format } from "date-fns";
import type { LotterySettingsType } from "~/server/db/schema";

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

    // Create rules with lowest priority (0)
    await db.insert(teesheetConfigRules).values([
      {
        configId: weekdayConfig.id,
        daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
        priority: 0,
        isActive: true,
      },
      {
        configId: weekendConfig.id,
        daysOfWeek: [0, 6], // Sat-Sun
        priority: 0,
        isActive: true,
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

export async function getConfigForDate(date: Date): Promise<TeesheetConfig> {
  // First ensure we have default configs
  await initializeDefaultConfigs();

  // Use UTC date for consistent day of week calculation

  const dayOfWeek = date.getUTCDay();
  const formattedDate = format(date, "yyyy-MM-dd");

  // First check for specific date rules
  const specificDateRules = await db.query.teesheetConfigRules.findMany({
    where: and(
      eq(teesheetConfigRules.isActive, true),
      eq(teesheetConfigRules.startDate, formattedDate),
      eq(teesheetConfigRules.endDate, formattedDate),
    ),
    orderBy: desc(teesheetConfigRules.priority),
    limit: 1,
  });

  if (specificDateRules.length > 0 && specificDateRules[0]) {
    const config = await db.query.teesheetConfigs.findFirst({
      where: and(
        eq(teesheetConfigs.id, specificDateRules[0].configId),
        eq(teesheetConfigs.isActive, true),
      ),
      with: {
        rules: true,
      },
    });

    if (!config) {
      console.error(
        "[getConfigForDate] Configuration not found for specific date rule",
      );
      throw new Error("Configuration not found");
    }

    return {
      ...config,
      rules: config.rules.map((rule) => ({
        ...rule,
        startDate: rule.startDate ? new Date(rule.startDate) : null,
        endDate: rule.endDate ? new Date(rule.endDate) : null,
      })),
    } as TeesheetConfig;
  }

  // Then check for recurring day rules
  const recurringRules = await db.query.teesheetConfigRules.findMany({
    where: and(
      eq(teesheetConfigRules.isActive, true),
      sql`${dayOfWeek} = ANY(${teesheetConfigRules.daysOfWeek})`,
      or(
        isNull(teesheetConfigRules.startDate),
        lte(teesheetConfigRules.startDate, formattedDate),
      ),
      or(
        isNull(teesheetConfigRules.endDate),
        gte(teesheetConfigRules.endDate, formattedDate),
      ),
    ),
    orderBy: desc(teesheetConfigRules.priority),
    limit: 1,
  });

  if (recurringRules.length > 0 && recurringRules[0]) {
    const config = await db.query.teesheetConfigs.findFirst({
      where: and(
        eq(teesheetConfigs.id, recurringRules[0].configId),
        eq(teesheetConfigs.isActive, true),
      ),
      with: {
        rules: true,
      },
    });

    if (!config) {
      console.error(
        "[getConfigForDate] Configuration not found for recurring rule",
      );
      throw new Error("Configuration not found");
    }

    return {
      ...config,
      rules: config.rules.map((rule) => ({
        ...rule,
        startDate: rule.startDate ? new Date(rule.startDate) : null,
        endDate: rule.endDate ? new Date(rule.endDate) : null,
      })),
    } as TeesheetConfig;
  }

  // If no specific or recurring rules found, fall back to system configs
  const systemConfigs = await db.query.teesheetConfigs.findMany({
    where: and(
      eq(teesheetConfigs.isSystemConfig, true),
      eq(teesheetConfigs.isActive, true),
    ),
    with: {
      rules: true,
    },
  });

  if (systemConfigs.length === 0) {
    console.error("[getConfigForDate] No system configurations found");
    throw new Error("No system configurations found");
  }

  // Find the appropriate system config based on day of week
  const weekdayConfig = systemConfigs.find((config) =>
    config.rules?.some((rule) => rule.daysOfWeek?.includes(dayOfWeek)),
  );

  if (!weekdayConfig) {
    console.error(
      "[getConfigForDate] No matching system configuration found for day:",
      dayOfWeek,
    );
    throw new Error("No matching system configuration found");
  }

  return {
    ...weekdayConfig,
    rules: weekdayConfig.rules.map((rule) => ({
      ...rule,
      startDate: rule.startDate ? new Date(rule.startDate) : null,
      endDate: rule.endDate ? new Date(rule.endDate) : null,
    })),
  } as TeesheetConfig;
}

export async function getTeesheetConfigs(): Promise<TeesheetConfig[]> {
  try {
    const configs = await db.query.teesheetConfigs.findMany({
      with: {
        rules: true,
      },
      orderBy: (teesheetConfigs, { asc }) => [asc(teesheetConfigs.name)],
    });

    return configs.map((config) => ({
      ...config,
      rules: config.rules.map((rule) => ({
        ...rule,
        startDate: rule.startDate ? new Date(rule.startDate) : null,
        endDate: rule.endDate ? new Date(rule.endDate) : null,
      })),
    })) as TeesheetConfig[];
  } catch (error) {
    console.error("Error fetching teesheet configs:", error);
    return [];
  }
}

// Get course info for the current organization
export async function getCourseInfo() {
  try {
    const info = await db.query.courseInfo.findFirst({});

    return info ?? null;
  } catch (error) {
    console.error("Error fetching course info:", error);
    return { success: false, error: "Error fetching course info" };
  }
}

export async function getTemplates() {
  try {
    const templateList = await db.query.templates.findMany({
      orderBy: desc(templates.updatedAt),
    });

    return templateList;
  } catch (error) {
    console.error("Error fetching templates:", error);
    return [];
  }
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
