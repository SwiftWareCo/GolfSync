"use server";

import { db } from "~/server/db";
import {
  teesheetConfigs,
  configBlocks,
  teesheets,
  courseInfo,
  TeesheetConfigWithBlocks,
} from "~/server/db/schema";
import { eq } from "drizzle-orm";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "~/lib/auth-server";
import type {
  ConfigBlockInsert,
  TeesheetConfigWithBlocksInsert,
} from "~/server/db/schema";

export async function deleteTeesheetConfig(
  previousState: any,
  configId: number,
) {
  await requireAdmin();

  // Check if config exists
  const config = await db.query.teesheetConfigs.findFirst({
    where: eq(teesheetConfigs.id, configId),
  });

  if (!config) {
    throw new Error("Configuration not found");
  }

  await db.delete(teesheetConfigs).where(eq(teesheetConfigs.id, configId));

  revalidatePath("/admin/settings");
}

// Update or create course info
export async function updateCourseInfo(data: { notes?: string }) {
  const { userId } = await requireAdmin();

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

      revalidatePath("/admin/settings");
      revalidatePath("/members");
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

      revalidatePath("/admin/settings");
      revalidatePath("/members");
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
  disallowMemberBooking?: boolean,
) {
  const { userId } = await requireAdmin();
  const publishedBy = userId;

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

  // Update disallowMemberBooking if provided
  if (disallowMemberBooking !== undefined) {
    updateData.disallowMemberBooking = disallowMemberBooking;
  }

  const [updatedTeesheet] = await db
    .update(teesheets)
    .set(updateData)
    .where(eq(teesheets.id, teesheetId))
    .returning();

  if (!updatedTeesheet) {
    throw new Error("Failed to update teesheet visibility");
  }

  revalidatePath("/admin/settings");
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
  await requireAdmin();

  const updateData: any = {
    lotteryEnabled: settings.enabled,
    lotteryDisabledMessage:
      settings.disabledMessage || "Lottery signup is disabled for this date",
    updatedAt: new Date(),
  };

  await db
    .update(teesheets)
    .set(updateData)
    .where(eq(teesheets.id, teesheetId));

  revalidatePath("/admin/settings");
}

/**
 * Create a new teesheet configuration with blocks
 */
export async function createTeesheetConfig(
  previousState: any,
  data: TeesheetConfigWithBlocksInsert & { id?: number },
) {
  await requireAdmin();

  try {
    const { id, blocks, ...configData } = data;

    // Create the config
    const [createdConfig] = await db
      .insert(teesheetConfigs)
      .values(configData)
      .returning();

    if (!createdConfig) {
      throw new Error("Failed to create configuration");
    }

    // Create blocks if provided
    let createdBlocks: ConfigBlockInsert[] = [];
    if (blocks && blocks.length > 0) {
      const blocksToInsert = blocks.map((block) => ({
        configId: createdConfig.id,
        displayName: block.displayName,
        startTime: block.startTime,
        maxPlayers: block.maxPlayers,
        sortOrder: block.sortOrder,
      }));

      createdBlocks = await db
        .insert(configBlocks)
        .values(blocksToInsert)
        .returning();
    }

    revalidatePath("/admin/settings");
    return { success: true, data: { ...createdConfig, blocks: createdBlocks } };
  } catch (error) {
    console.error("Error creating teesheet config:", error);
    return { success: false, error: "Error creating configuration" };
  }
}

/**
 * Update an existing teesheet configuration with blocks
 */
export async function updateTeesheetConfig(
  previousState: any,
  data: TeesheetConfigWithBlocksInsert & { id: number },
) {
  await requireAdmin();

  try {
    const { id, blocks, ...configData } = data;

    // Verify config exists
    const existingConfig = await db.query.teesheetConfigs.findFirst({
      where: eq(teesheetConfigs.id, id),
    });

    if (!existingConfig) {
      throw new Error("Configuration not found");
    }

    // Update the config
    const [updatedConfig] = await db
      .update(teesheetConfigs)
      .set(configData)
      .where(eq(teesheetConfigs.id, id))
      .returning();

    if (!updatedConfig) {
      throw new Error("Failed to update configuration");
    }

    // Delete existing blocks for this config
    await db.delete(configBlocks).where(eq(configBlocks.configId, id));

    // Create new blocks if provided
    let createdBlocks: ConfigBlockInsert[] = [];
    if (blocks && blocks.length > 0) {
      const blocksToInsert = blocks.map((block) => ({
        configId: id,
        displayName: block.displayName,
        startTime: block.startTime,
        maxPlayers: block.maxPlayers,
        sortOrder: block.sortOrder,
      }));

      createdBlocks = await db
        .insert(configBlocks)
        .values(blocksToInsert)
        .returning();
    }

    revalidatePath("/admin/settings");
    return { success: true, data: { ...updatedConfig, blocks: createdBlocks } };
  } catch (error) {
    console.error("Error updating teesheet config:", error);
    return { success: false, error: "Error updating configuration" };
  }
}
