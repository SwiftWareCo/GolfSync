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

import { revalidatePath, updateTag } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { generateTimeBlocks } from "~/lib/utils";
import type { TeesheetConfigWithBlocksInsert } from "~/server/db/schema";

export async function deleteTeesheetConfig(
  previousState: any,
  configId: number,
) {
  // Check if config exists
  const config = await db.query.teesheetConfigs.findFirst({
    where: eq(teesheetConfigs.id, configId),
  });

  if (!config) {
    throw new Error("Configuration not found");
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

  revalidatePath("/admin/teesheet");
  revalidatePath("/members/teesheet");
}

/**
 * FormData wrapper for creating teesheet configs
 * Blocks can be generated from startTime/endTime/interval or added individually
 */
export async function createTeesheetConfig(
  previousState: any,
  data: TeesheetConfigWithBlocksInsert
) {
  
console.log(data);
}

/**
 * FormData wrapper for updating teesheet configs
 */
export async function updateTeesheetConfig(
  previousState: any,
  data: TeesheetConfigWithBlocksInsert

) {

}
