"use server";

import { revalidatePath } from "next/cache";
import { db } from "~/server/db";
import { memberSpeedProfiles } from "~/server/db/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Update a member's speed profile settings
 * Updated for useActionState pattern
 */
export async function updateMemberSpeedProfileAction(
  prevState: null,
  params: {
    memberId: number;
    speedTier: "FAST" | "AVERAGE" | "SLOW";
    adminPriorityAdjustment: number;
    manualOverride: boolean;
    notes: string | null;
  },
): Promise<null> {
  const {
    memberId,
    speedTier,
    adminPriorityAdjustment,
    manualOverride,
    notes,
  } = params;

  // Validate admin priority adjustment range
  if (adminPriorityAdjustment < -10 || adminPriorityAdjustment > 10) {
    throw new Error("Admin priority adjustment must be between -10 and +10");
  }

  await db
    .update(memberSpeedProfiles)
    .set({
      speedTier,
      adminPriorityAdjustment,
      manualOverride,
      notes,
      updatedAt: new Date(),
    })
    .where(eq(memberSpeedProfiles.memberId, memberId));

  // Revalidate relevant pages
  revalidatePath("/admin/lottery/member-profiles");
  revalidatePath("/admin/lottery/[date]", "page");

  return null;
}

/**
 * Reset all admin priority adjustments to 0
 */
export async function resetAllAdminPriorityAdjustmentsAction(): Promise<{
  success: boolean;
  updatedCount?: number;
  error?: string;
}> {
  try {
    const result = await db
      .update(memberSpeedProfiles)
      .set({
        adminPriorityAdjustment: 0,
        notes: null,
        updatedAt: new Date(),
      })
      .where(sql`admin_priority_adjustment != 0`);

    // Revalidate relevant pages
    revalidatePath("/admin/lottery/member-profiles");
    revalidatePath("/admin/lottery/[date]", "page");

    return {
      success: true,
      updatedCount: result.rowCount || 0,
    };
  } catch (error) {
    console.error("Error in resetAllAdminPriorityAdjustmentsAction:", error);
    return {
      success: false,
      error: "Failed to reset admin priority adjustments",
    };
  }
}
