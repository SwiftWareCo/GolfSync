"use server";

import { db } from "~/server/db";
import {
  teesheetConfigs,
  teesheetConfigRules,
  teesheets,
  timeBlocks,
  courseInfo,
  lotterySettings,
  lotteryEntries,
  lotteryGroups,
} from "~/server/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import {
  type LotterySettingsType,
  type LotterySettingsInsert,
} from "~/server/db/schema";

import { revalidatePath } from "next/cache";
import { createTimeBlocksForTeesheet } from "~/server/teesheet/data";
import { auth } from "@clerk/nextjs/server";
import type {
  TeesheetConfigInput,
  TeesheetConfig,
} from "~/app/types/TeeSheetTypes";
import { ConfigTypes } from "~/app/types/TeeSheetTypes";
import {
  getTeesheetConfigs,
  getCourseInfo,
  getTemplates,
  getLotterySettings,
} from "./data";

// Query actions for client components
export async function getTeesheetConfigsAction() {
  try {
    const configs = await getTeesheetConfigs();
    return { success: true, data: configs };
  } catch (error) {
    console.error("Error fetching teesheet configs:", error);
    return { success: false, error: "Failed to fetch teesheet configs", data: [] };
  }
}

export async function getCourseInfoAction() {
  try {
    const info = await getCourseInfo();
    // Handle the different return types from getCourseInfo
    if (info && typeof info === 'object' && 'success' in info && !info.success) {
      return { success: false, error: info.error as string || "Failed to load course info" };
    }
    return { success: true, data: info };
  } catch (error) {
    console.error("Error fetching course info:", error);
    return { success: false, error: "Failed to fetch course info" };
  }
}

export async function getTemplatesAction() {
  try {
    const templates = await getTemplates();
    return { success: true, data: templates };
  } catch (error) {
    console.error("Error fetching templates:", error);
    return { success: false, error: "Failed to fetch templates", data: [] };
  }
}

export async function getLotterySettingsAction(teesheetId: number) {
  try {
    const settings = await getLotterySettings(teesheetId);
    return { success: true, data: settings };
  } catch (error) {
    console.error("Error fetching lottery settings:", error);
    return { success: false, error: "Failed to fetch lottery settings", data: null };
  }
}

export async function createTeesheetConfig(data: TeesheetConfigInput) {
  try {
    // Create the config
    const [newConfig] = await db
      .insert(teesheetConfigs)
      .values({
        name: data.name,
        type: data.type, // Store as uppercase in DB to match enum
        startTime: data.type === ConfigTypes.REGULAR ? data.startTime : null,
        endTime: data.type === ConfigTypes.REGULAR ? data.endTime : null,
        interval: data.type === ConfigTypes.REGULAR ? data.interval : null,
        maxMembersPerBlock:
          data.type === ConfigTypes.REGULAR ? data.maxMembersPerBlock : null,
        templateId: data.type === ConfigTypes.CUSTOM ? data.templateId : null,
        isActive: data.isActive ?? true,
        isSystemConfig: data.isSystemConfig ?? false,
        disallowMemberBooking: data.disallowMemberBooking ?? false,
      })
      .returning();

    if (!newConfig) {
      throw new Error("Failed to create configuration");
    }

    // Create the rules
    if (data.rules && data.rules.length > 0) {
      const rules = await Promise.all(
        data.rules.map((rule) =>
          db
            .insert(teesheetConfigRules)
            .values({
              configId: newConfig.id,
              daysOfWeek: rule.daysOfWeek,
              startDate: rule.startDate,
              endDate: rule.endDate,
              priority: rule.priority,
              isActive: rule.isActive,
            })
            .returning(),
        ),
      );

      if (!rules.every((r) => r[0])) {
        throw new Error("Failed to create rules");
      }
    }

    revalidatePath("/settings");
    return { success: true, data: newConfig };
  } catch (error) {
    console.error("Error creating teesheet config:", error);
    return { success: false, error: "Failed to create configuration" };
  }
}

export async function updateTeesheetConfig(
  id: number,
  data: TeesheetConfigInput,
) {
  try {
    // Update the config
    const [updatedConfig] = await db
      .update(teesheetConfigs)
      .set({
        name: data.name,
        type: data.type, // Store as uppercase in DB to match enum
        startTime: data.type === ConfigTypes.REGULAR ? data.startTime : null,
        endTime: data.type === ConfigTypes.REGULAR ? data.endTime : null,
        interval: data.type === ConfigTypes.REGULAR ? data.interval : null,
        maxMembersPerBlock:
          data.type === ConfigTypes.REGULAR ? data.maxMembersPerBlock : null,
        templateId: data.type === ConfigTypes.CUSTOM ? data.templateId : null,
        isActive: data.isActive,
        isSystemConfig: data.isSystemConfig,
        disallowMemberBooking: data.disallowMemberBooking ?? false,
      })
      .where(eq(teesheetConfigs.id, id))
      .returning();

    if (!updatedConfig) {
      throw new Error("Failed to update configuration");
    }

    // If isActive status changed, update all associated rules
    if (data.isActive !== undefined) {
      await db
        .update(teesheetConfigRules)
        .set({ isActive: data.isActive })
        .where(eq(teesheetConfigRules.configId, id));
    }

    // Update the rules if provided
    if (data.rules && data.rules.length > 0) {
      // First delete existing rules
      await db
        .delete(teesheetConfigRules)
        .where(eq(teesheetConfigRules.configId, id));

      // Then create new rules
      const rules = await Promise.all(
        data.rules.map((rule) =>
          db
            .insert(teesheetConfigRules)
            .values({
              configId: id,
              daysOfWeek: rule.daysOfWeek,
              startDate: rule.startDate,
              endDate: rule.endDate,
              priority: rule.priority,
              isActive: data.isActive ?? rule.isActive, // Use config's isActive if provided
            })
            .returning(),
        ),
      );

      if (!rules.every((r) => r[0])) {
        throw new Error("Failed to update rules");
      }
    }

    revalidatePath("/settings");
    return { success: true, data: updatedConfig };
  } catch (error) {
    console.error("Error updating teesheet config:", error);
    return { success: false, error: "Failed to update configuration" };
  }
}

export async function deleteTeesheetConfig(
  configId: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.delete(teesheetConfigs).where(eq(teesheetConfigs.id, configId));

    revalidatePath("/settings/teesheet");
    revalidatePath("/settings/teesheet/configuration");
    return { success: true };
  } catch (error) {
    console.error("Error deleting teesheet config:", error);
    return { success: false, error: "Failed to delete configuration" };
  }
}

export async function createTeesheetConfigRule(
  configId: number,
  rule: {
    daysOfWeek?: number[];
    startDate?: string | null;
    endDate?: string | null;
    priority?: number;
    isActive?: boolean;
  },
) {
  const [newRule] = await db
    .insert(teesheetConfigRules)
    .values({
      configId,
      daysOfWeek: rule.daysOfWeek || null,
      startDate: rule.startDate || null,
      endDate: rule.endDate || null,
      priority: rule.priority || 0,
      isActive: rule.isActive ?? true,
    })
    .returning();

  if (!newRule) {
    return { success: false, error: "Failed to create rule" };
  }

  return { success: true, data: newRule };
}

export async function updateTeesheetConfigRule(
  ruleId: number,
  updates: {
    daysOfWeek?: number[];
    startDate?: string | null;
    endDate?: string | null;
    priority?: number;
    isActive?: boolean;
  },
) {
  const [updatedRule] = await db
    .update(teesheetConfigRules)
    .set(updates)
    .where(eq(teesheetConfigRules.id, ruleId))
    .returning();

  if (!updatedRule) {
    return { success: false, error: "Failed to update rule" };
  }

  return { success: true, data: updatedRule };
}

export async function deleteTeesheetConfigRule(ruleId: number) {
  const [deletedRule] = await db
    .delete(teesheetConfigRules)
    .where(eq(teesheetConfigRules.id, ruleId))
    .returning();

  if (!deletedRule) {
    return { success: false, error: "Failed to delete rule" };
  }

  return { success: true, data: deletedRule };
}

export async function updateTeesheetConfigForDate(
  teesheetId: number,
  configId: number,
) {
  try {
    // First get the teesheet
    const [teesheet] = await db
      .select()
      .from(teesheets)
      .where(eq(teesheets.id, teesheetId));

    if (!teesheet) {
      return { success: false, error: "Teesheet not found" };
    }

    // Get the config
    const config = await db.query.teesheetConfigs.findFirst({
      where: eq(teesheetConfigs.id, configId),
      with: {
        rules: true,
      },
    });

    if (!config) {
      return { success: false, error: "Config not found" };
    }

    // Update the teesheet to use the new config
    const [updatedTeesheet] = await db
      .update(teesheets)
      .set({ configId })
      .where(eq(teesheets.id, teesheetId))
      .returning();

    if (!updatedTeesheet) {
      return { success: false, error: "Failed to update teesheet" };
    }

    // Clear foreign key references before deleting time blocks
    // First, get all timeblock IDs that will be deleted
    const timeBlockIds = await db
      .select({ id: timeBlocks.id })
      .from(timeBlocks)
      .where(eq(timeBlocks.teesheetId, teesheetId));

    const timeBlockIdArray = timeBlockIds.map((tb) => tb.id);

    if (timeBlockIdArray.length > 0) {
      // Clear assignedTimeBlockId from lottery entries that reference these timeblocks
      await db
        .update(lotteryEntries)
        .set({ assignedTimeBlockId: null })
        .where(inArray(lotteryEntries.assignedTimeBlockId, timeBlockIdArray));

      // Clear assignedTimeBlockId from lottery groups that reference these timeblocks
      await db
        .update(lotteryGroups)
        .set({ assignedTimeBlockId: null })
        .where(inArray(lotteryGroups.assignedTimeBlockId, timeBlockIdArray));
    }

    // Now delete existing time blocks
    await db.delete(timeBlocks).where(eq(timeBlocks.teesheetId, teesheetId));

    // Create new time blocks with the new config
    const fullConfig = {
      ...config,
      rules: config.rules.map((rule) => ({
        ...rule,
        startDate: rule.startDate ? new Date(rule.startDate) : null,
        endDate: rule.endDate ? new Date(rule.endDate) : null,
      })),
    } as TeesheetConfig;
    await createTimeBlocksForTeesheet(teesheetId, fullConfig, teesheet.date);

    // Revalidate paths
    revalidatePath(`/teesheet`);

    // Use the date as is, since we know it's a string from our schema changes
    const dateParam = teesheet.date || "";
    revalidatePath(`/admin/teesheet/${dateParam}`);

    return { success: true, data: updatedTeesheet };
  } catch (error) {
    console.error("Error updating teesheet config for date:", error);
    return {
      success: false,
      error: "Failed to update teesheet configuration",
    };
  }
}

// Update or create course info
export async function updateCourseInfo(data: {
  notes?: string;
}) {
  const { userId, orgId } = await auth();

  if (!orgId || !userId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    // Check if the course info exists
    const existing = await db.query.courseInfo.findFirst({
      where: eq(courseInfo.id, 1),
    });

    if (existing) {
      // Update existing record - clear weather fields
      const updated = await db
        .update(courseInfo)
        .set({
          weatherStatus: null,
          forecast: null,
          rainfall: null,
          notes: data.notes,
          lastUpdatedBy: userId,
          updatedAt: new Date(),
        })
        .where(eq(courseInfo.id, existing.id))
        .returning();

      revalidatePath("/members");
      revalidatePath("/admin/settings");
      return { success: true };
    } else {
      // Create new record - without weather fields
      const created = await db
        .insert(courseInfo)
        .values({
          weatherStatus: null,
          forecast: null,
          rainfall: null,
          notes: data.notes,
          lastUpdatedBy: userId,
        })
        .returning();

      revalidatePath("/members");
      revalidatePath("/admin/settings");
      return { success: true, data: created[0] };
    }
  } catch (error) {
    console.error("Error updating course info:", error);
    return { success: false, error: "Error updating course info" };
  }
}

/**
 * Update teesheet visibility settings
 */
export async function updateTeesheetVisibility(
  teesheetId: number,
  isPublic: boolean,
  privateMessage?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId } = await auth();
    const publishedBy = userId || "Unknown";

    const updateData: any = {
      isPublic,
      updatedAt: new Date(),
    };

    if (isPublic) {
      updateData.publishedAt = new Date();
      updateData.publishedBy = publishedBy;
    } else {
      updateData.publishedAt = null;
      updateData.publishedBy = null;
      if (privateMessage !== undefined) {
        updateData.privateMessage = privateMessage;
      }
    }

    const [updatedTeesheet] = await db
      .update(teesheets)
      .set(updateData)
      .where(eq(teesheets.id, teesheetId))
      .returning();

    if (!updatedTeesheet) {
      return { success: false, error: "Failed to update teesheet visibility" };
    }

    revalidatePath("/admin/teesheet");
    revalidatePath("/members/teesheet");

    return { success: true };
  } catch (error) {
    console.error("Error updating teesheet visibility:", error);
    return { success: false, error: "Failed to update teesheet visibility" };
  }
}

/**
 * Update lottery settings for a teesheet
 */
export async function updateLotterySettings(
  teesheetId: number,
  settings: {
    enabled: boolean;
    disabledMessage?: string;
  },
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if lottery settings exist for this teesheet
    const existingSettings = await db
      .select()
      .from(lotterySettings)
      .where(eq(lotterySettings.teesheetId, teesheetId))
      .limit(1);

    if (existingSettings.length > 0) {
      // Update existing settings
      await db
        .update(lotterySettings)
        .set({
          enabled: settings.enabled,
          disabledMessage:
            settings.disabledMessage ||
            "Lottery signup is disabled for this date",
          updatedAt: new Date(),
        })
        .where(eq(lotterySettings.teesheetId, teesheetId));
    } else {
      // Create new settings
      await db.insert(lotterySettings).values({
        teesheetId,
        enabled: settings.enabled,
        disabledMessage:
          settings.disabledMessage ||
          "Lottery signup is disabled for this date",
      });
    }

    revalidatePath("/admin/teesheet");
    revalidatePath("/members/teesheet");

    return { success: true };
  } catch (error) {
    console.error("Error updating lottery settings:", error);
    return { success: false, error: "Failed to update lottery settings" };
  }
}

// getLotterySettings moved to src/server/settings/data.ts
