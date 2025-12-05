"use server";

import { db } from "~/server/db";
import {
  memberFairnessScores,
  memberSpeedProfiles,
  systemMaintenance,
  paceOfPlay,
  timeBlocks,
  teesheets,
  timeBlockMembers,
  members,
} from "~/server/db/schema";
import { eq, and, sql, gte } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type MaintenanceResult = {
  success: boolean;
  error?: string;
  data?: {
    recordsAffected: number;
    notes: string;
  };
};

/**
 * Check if monthly maintenance needs to be run and execute if needed
 */
export async function checkAndRunMonthlyMaintenance(): Promise<MaintenanceResult> {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7); // "2024-01"

    // Check if we've already run maintenance this month
    const lastMaintenanceRun = await db.query.systemMaintenance.findFirst({
      where: and(
        eq(systemMaintenance.maintenanceType, "MONTHLY_RESET"),
        eq(systemMaintenance.month, currentMonth),
      ),
    });

    if (lastMaintenanceRun) {
      return {
        success: true,
        data: {
          recordsAffected: 0,
          notes: `Maintenance already completed for ${currentMonth}`,
        },
      };
    }

    // Run monthly maintenance
    const resetResult = await resetMonthlyFairnessScores();
    // Note: Speed profiles are now cumulative and self-updating, so we don't recalculate them monthly
    // We only reset fairness scores

    const totalRecords = resetResult.data?.recordsAffected || 0;

    // Record that maintenance was completed
    await db
      .insert(systemMaintenance)
      .values({
        maintenanceType: "MONTHLY_RESET",
        month: currentMonth,
        recordsAffected: totalRecords,
        notes: `Reset ${resetResult.data?.recordsAffected || 0} fairness scores`,
      })
      .onConflictDoNothing();

    return {
      success: true,
      data: {
        recordsAffected: totalRecords,
        notes: `Monthly maintenance completed: Reset fairness scores`,
      },
    };
  } catch (error) {
    console.error("Error in monthly maintenance:", error);
    return {
      success: false,
      error: "Failed to run monthly maintenance",
    };
  }
}

/**
 * Reset fairness scores for the new month
 */
async function resetMonthlyFairnessScores(): Promise<MaintenanceResult> {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);

    // Get all members who have fairness scores
    const existingScores = await db.query.memberFairnessScores.findMany({
      where: eq(memberFairnessScores.currentMonth, currentMonth),
    });

    if (existingScores.length > 0) {
      // Already have scores for this month
      return {
        success: true,
        data: {
          recordsAffected: 0,
          notes: `Fairness scores already exist for ${currentMonth}`,
        },
      };
    }

    // Get all members and create new fairness score records
    const allMembers = await db.query.members.findMany();

    const newScores = allMembers.map((member) => ({
      memberId: member.id,
      currentMonth,
      totalEntriesMonth: 0,
      preferencesGrantedMonth: 0,
      preferenceFulfillmentRate: 0,
      daysWithoutGoodTime: 0,
      fairnessScore: 0,
    }));

    if (newScores.length > 0) {
      await db
        .insert(memberFairnessScores)
        .values(newScores)
        .onConflictDoNothing();
    }

    return {
      success: true,
      data: {
        recordsAffected: newScores.length,
        notes: `Created fairness scores for ${newScores.length} members`,
      },
    };
  } catch (error) {
    console.error("Error resetting fairness scores:", error);
    return {
      success: false,
      error: "Failed to reset fairness scores",
    };
  }
}

/**
 * Recalculate member speed profiles from pace data (last 3 months)
 */
/**
 * Reclassify all member speed tiers based on current config thresholds
 * Useful if admin changes the thresholds and wants to update everyone immediately
 */
export async function reclassifyAllSpeedTiers(): Promise<MaintenanceResult> {
  try {
    const { getAlgorithmConfig } = await import(
      "~/server/lottery/algorithm-config-data"
    );
    const config = await getAlgorithmConfig();

    // Get all speed profiles
    const profiles = await db.query.memberSpeedProfiles.findMany();
    let updatedCount = 0;

    for (const profile of profiles) {
      // Skip if no data
      if (!profile.hasData || !profile.averageMinutes) continue;

      let newTier: "FAST" | "AVERAGE" | "SLOW" = "AVERAGE";
      if (profile.averageMinutes <= config.fastThresholdMinutes) {
        newTier = "FAST";
      } else if (profile.averageMinutes <= config.averageThresholdMinutes) {
        newTier = "AVERAGE";
      } else {
        newTier = "SLOW";
      }

      // Only update if tier changed and not manually overridden
      if (profile.speedTier !== newTier && !profile.manualOverride) {
        await db
          .update(memberSpeedProfiles)
          .set({
            speedTier: newTier,
            updatedAt: new Date(),
          })
          .where(eq(memberSpeedProfiles.memberId, profile.memberId));
        updatedCount++;
      }
    }

    return {
      success: true,
      data: {
        recordsAffected: updatedCount,
        notes: `Reclassified ${updatedCount} members based on new thresholds`,
      },
    };
  } catch (error) {
    console.error("Error reclassifying speed tiers:", error);
    return {
      success: false,
      error: "Failed to reclassify speed tiers",
    };
  }
}

/**
 * Manual trigger for monthly maintenance (admin only)
 */
export async function triggerManualMaintenance(): Promise<MaintenanceResult> {
  try {
    const resetResult = await resetMonthlyFairnessScores();
    // Manual maintenance now only resets fairness scores by default
    // Admin can trigger reclassifyAllSpeedTiers separately if needed

    const totalRecords = resetResult.data?.recordsAffected || 0;

    // Record manual maintenance
    await db
      .insert(systemMaintenance)
      .values({
        maintenanceType: "MANUAL_MAINTENANCE",
        month: new Date().toISOString().slice(0, 7),
        recordsAffected: totalRecords,
        notes: `Manual maintenance: ${resetResult.data?.notes || ""}`,
      })
      .onConflictDoNothing();

    revalidatePath("/admin/lottery");
    revalidatePath("/admin/lottery/member-profiles");

    return {
      success: true,
      data: {
        recordsAffected: totalRecords,
        notes: "Manual maintenance completed successfully",
      },
    };
  } catch (error) {
    console.error("Error in manual maintenance:", error);
    return {
      success: false,
      error: "Failed to run manual maintenance",
    };
  }
}
