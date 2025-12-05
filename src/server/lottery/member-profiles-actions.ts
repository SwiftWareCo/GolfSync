"use server";

import { revalidatePath } from "next/cache";
import { db } from "~/server/db";
import { memberSpeedProfiles } from "~/server/db/schema";
import { eq, sql } from "drizzle-orm";
import { getAlgorithmConfig } from "~/server/lottery/algorithm-config-data";

/**
 * Calculate what speed tier WOULD be based on current average minutes
 */
async function calculateExpectedSpeedTier(
  averageMinutes: number | null,
): Promise<"FAST" | "AVERAGE" | "SLOW" | null> {
  if (!averageMinutes) return null;

  const config = await getAlgorithmConfig();
  if (averageMinutes <= config.fastThresholdMinutes) {
    return "FAST";
  } else if (averageMinutes <= config.averageThresholdMinutes) {
    return "AVERAGE";
  }
  return "SLOW";
}

/**
 * Update a member's speed profile settings
 * Updated for useActionState pattern
 *
 * Auto-enables manualOverride if admin sets a tier different from calculated value
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

  // Validate admin priority adjustment range (expanded to ±20)
  if (adminPriorityAdjustment < -20 || adminPriorityAdjustment > 20) {
    throw new Error("Admin priority adjustment must be between -20 and +20");
  }

  // Get existing profile to check if tier is being manually changed
  const existingProfile = await db.query.memberSpeedProfiles.findFirst({
    where: eq(memberSpeedProfiles.memberId, memberId),
  });

  // Calculate what the tier SHOULD be based on pace data
  const calculatedTier = await calculateExpectedSpeedTier(
    existingProfile?.averageMinutes ?? null,
  );

  // Auto-enable manual override if:
  // 1. The user explicitly enabled it, OR
  // 2. The new tier differs from the calculated tier (admin is overriding)
  const shouldEnableOverride =
    manualOverride || (calculatedTier !== null && speedTier !== calculatedTier);

  await db
    .update(memberSpeedProfiles)
    .set({
      speedTier,
      adminPriorityAdjustment,
      manualOverride: shouldEnableOverride,
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
