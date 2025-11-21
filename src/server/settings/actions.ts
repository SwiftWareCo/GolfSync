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
  TeesheetConfigWithRules,
} from "~/server/db/schema";
import { eq, inArray } from "drizzle-orm";

import { revalidatePath, revalidateTag, updateTag } from "next/cache";
import { replaceTimeBlocks } from "~/server/teesheet/actions";
import { auth } from "@clerk/nextjs/server";
import { ConfigTypes } from "~/app/types/TeeSheetTypes";

export async function createTeesheetConfig(data: TeesheetConfigWithRules) {
  // Validate required fields for REGULAR configs
  if (data.type === ConfigTypes.REGULAR) {
    if (
      !data.startTime ||
      !data.endTime ||
      !data.interval ||
      !data.maxMembersPerBlock
    ) {
      throw new Error(
        "REGULAR configurations require startTime, endTime, interval, and maxMembersPerBlock",
      );
    }
  }

  // Create the config
  const [newConfig] = await db
    .insert(teesheetConfigs)
    .values({
      name: data.name,
      type: data.type,
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
          })
          .returning(),
      ),
    );

    if (!rules.every((r) => r[0])) {
      throw new Error("Failed to create rules");
    }
  }

  updateTag("teesheet-configs");
}

export async function updateTeesheetConfig(
  id: number,
  data: TeesheetConfigWithRules,
) {
  // Validate required fields for REGULAR configs
  if (data.type === ConfigTypes.REGULAR) {
    if (
      !data.startTime ||
      !data.endTime ||
      !data.interval ||
      !data.maxMembersPerBlock
    ) {
      throw new Error(
        "REGULAR configurations require startTime, endTime, interval, and maxMembersPerBlock",
      );
    }
  }

  // Check config exists
  const existingConfig = await db.query.teesheetConfigs.findFirst({
    where: eq(teesheetConfigs.id, id),
  });

  if (!existingConfig) {
    throw new Error("Configuration not found");
  }

  // Prevent renaming system configs
  if (existingConfig.isSystemConfig && data.name !== existingConfig.name) {
    throw new Error("Cannot rename system configurations");
  }

  // Update the config
  const [updatedConfig] = await db
    .update(teesheetConfigs)
    .set({
      name: data.name,
      type: data.type,
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
          })
          .returning(),
      ),
    );

    if (!rules.every((r) => r[0])) {
      throw new Error("Failed to update rules");
    }
  }

  updateTag("teesheet-configs");
}

export async function deleteTeesheetConfig(configId: number) {
  // Check if config exists and is not a system config
  const config = await db.query.teesheetConfigs.findFirst({
    where: eq(teesheetConfigs.id, configId),
  });

  if (!config) {
    throw new Error("Configuration not found");
  }

  if (config.isSystemConfig) {
    throw new Error("Cannot delete system configurations");
  }

  await db.delete(teesheetConfigs).where(eq(teesheetConfigs.id, configId));

  updateTag("teesheet-configs");
}

// Update or create course info
export async function updateCourseInfo(data: { notes?: string }) {
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
) {
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
    throw new Error("Failed to update teesheet visibility");
  }

  revalidatePath("/admin/teesheet");
  revalidatePath("/members/teesheet");
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
) {
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
        settings.disabledMessage || "Lottery signup is disabled for this date",
    });
  }

  revalidatePath("/admin/teesheet");
  revalidatePath("/members/teesheet");
}

/**
 * FormData wrapper for creating teesheet configs from TeesheetConfigForm
 */
export async function createTeesheetConfigAction(formData: FormData) {
  const name = formData.get("name") as string;
  const type = formData.get("type") as "REGULAR" | "CUSTOM";
  const isActive = formData.get("isActive") === "true";

  if (!name || !type) {
    throw new Error("Name and type are required");
  }

  const data: TeesheetConfigWithRules = {
    id: 0,
    name,
    type,
    isActive,
    isSystemConfig: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    startTime: null,
    endTime: null,
    interval: null,
    maxMembersPerBlock: null,
    templateId: null,
    disallowMemberBooking: false,
    rules: [],
  };

  if (type === "REGULAR") {
    const startTime = formData.get("startTime") as string;
    const endTime = formData.get("endTime") as string;
    const interval = formData.get("interval") as string;
    const maxMembersPerBlock = formData.get("maxMembersPerBlock") as string;

    if (!startTime || !endTime || !interval || !maxMembersPerBlock) {
      throw new Error(
        "Start time, end time, interval, and max members are required for regular configs",
      );
    }

    data.startTime = startTime;
    data.endTime = endTime;
    data.interval = parseInt(interval, 10);
    data.maxMembersPerBlock = parseInt(maxMembersPerBlock, 10);

    const daysOfWeekStr = formData.get("daysOfWeek");
    if (daysOfWeekStr && typeof daysOfWeekStr === "string") {
      const daysOfWeek = JSON.parse(daysOfWeekStr);
      data.rules = [
        {
          id: 0,
          configId: 0,
          daysOfWeek,
          startDate: null,
          endDate: null,
          createdAt: new Date(),
          updatedAt: null,
        },
      ];
    }
  } else {
    const templateId = formData.get("templateId") as string;
    const disallowMemberBooking =
      formData.get("disallowMemberBooking") === "true";

    if (!templateId) {
      throw new Error("Template ID is required for custom configs");
    }

    data.templateId = parseInt(templateId, 10);
    data.disallowMemberBooking = disallowMemberBooking;
  }

  return createTeesheetConfig(data);
}

/**
 * FormData wrapper for updating teesheet configs from TeesheetConfigForm
 */
export async function updateTeesheetConfigAction(formData: FormData) {
  const configIdStr = formData.get("configId") as string;
  const name = formData.get("name") as string;
  const type = formData.get("type") as "REGULAR" | "CUSTOM";
  const isActive = formData.get("isActive") === "true";

  if (!configIdStr || !name || !type) {
    throw new Error("Config ID, name, and type are required");
  }

  const configId = parseInt(configIdStr, 10);

  const data: TeesheetConfigWithRules = {
    id: configId,
    name,
    type,
    isActive,
    isSystemConfig: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    startTime: null,
    endTime: null,
    interval: null,
    maxMembersPerBlock: null,
    templateId: null,
    disallowMemberBooking: false,
    rules: [],
  };

  if (type === "REGULAR") {
    const startTime = formData.get("startTime") as string;
    const endTime = formData.get("endTime") as string;
    const interval = formData.get("interval") as string;
    const maxMembersPerBlock = formData.get("maxMembersPerBlock") as string;

    if (!startTime || !endTime || !interval || !maxMembersPerBlock) {
      throw new Error(
        "Start time, end time, interval, and max members are required for regular configs",
      );
    }

    data.startTime = startTime;
    data.endTime = endTime;
    data.interval = parseInt(interval, 10);
    data.maxMembersPerBlock = parseInt(maxMembersPerBlock, 10);

    const daysOfWeekStr = formData.get("daysOfWeek");
    if (daysOfWeekStr && typeof daysOfWeekStr === "string") {
      const daysOfWeek = JSON.parse(daysOfWeekStr);
      data.rules = [
        {
          id: 0,
          configId,
          daysOfWeek,
          startDate: null,
          endDate: null,
          createdAt: new Date(),
          updatedAt: null,
        },
      ];
    }
  } else {
    const templateId = formData.get("templateId") as string;
    const disallowMemberBooking =
      formData.get("disallowMemberBooking") === "true";

    if (!templateId) {
      throw new Error("Template ID is required for custom configs");
    }

    data.templateId = parseInt(templateId, 10);
    data.disallowMemberBooking = disallowMemberBooking;
  }

  return updateTeesheetConfig(configId, data);
}
