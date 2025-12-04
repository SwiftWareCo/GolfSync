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
    const speedResult = await recalculateSpeedProfiles();

    const totalRecords =
      (resetResult.data?.recordsAffected || 0) +
      (speedResult.data?.recordsAffected || 0);

    // Record that maintenance was completed
    await db.insert(systemMaintenance).values({
      maintenanceType: "MONTHLY_RESET",
      month: currentMonth,
      recordsAffected: totalRecords,
      notes: `Reset ${resetResult.data?.recordsAffected || 0} fairness scores, updated ${speedResult.data?.recordsAffected || 0} member profiles`,
    }).onConflictDoNothing();

    return {
      success: true,
      data: {
        recordsAffected: totalRecords,
        notes: `Monthly maintenance completed: Reset fairness scores and recalculated member profiles`,
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
      await db.insert(memberFairnessScores).values(newScores).onConflictDoNothing();
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
async function recalculateSpeedProfiles(): Promise<MaintenanceResult> {
  try {
    // Get pace data from last 3 months
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const threeMonthsAgoStr = threeMonthsAgo.toISOString().split("T")[0]!;

    // Get all members with pace data from last 3 months
    const memberPaceData = await db
      .select({
        memberId: timeBlockMembers.memberId,
        totalMinutes: sql<number>`EXTRACT(EPOCH FROM (${paceOfPlay.finishTime} - ${paceOfPlay.startTime})) / 60`,
        memberName: sql<string>`${members.firstName} || ' ' || ${members.lastName}`,
      })
      .from(paceOfPlay)
      .innerJoin(timeBlocks, eq(paceOfPlay.timeBlockId, timeBlocks.id))
      .innerJoin(teesheets, eq(timeBlocks.teesheetId, teesheets.id))
      .innerJoin(
        timeBlockMembers,
        eq(timeBlocks.id, timeBlockMembers.timeBlockId),
      )
      .innerJoin(members, eq(timeBlockMembers.memberId, members.id))
      .where(
        and(
          gte(teesheets.date, threeMonthsAgoStr),
          sql`${paceOfPlay.finishTime} IS NOT NULL`,
          sql`${paceOfPlay.startTime} IS NOT NULL`,
        ),
      );

    // Group by member and calculate averages
    const memberAverages = new Map<
      number,
      { totalMinutes: number; count: number; name: string }
    >();

    memberPaceData.forEach((record) => {
      if (!memberAverages.has(record.memberId)) {
        memberAverages.set(record.memberId, {
          totalMinutes: 0,
          count: 0,
          name: record.memberName,
        });
      }
      const existing = memberAverages.get(record.memberId)!;
      existing.totalMinutes += record.totalMinutes;
      existing.count += 1;
    });

    let updatedProfiles = 0;

    // Update speed profiles for members with sufficient data (3+ rounds)
    for (const [memberId, data] of memberAverages) {
      if (data.count >= 3) {
        const averageMinutes = data.totalMinutes / data.count;
        let speedTier: "FAST" | "AVERAGE" | "SLOW" = "AVERAGE";

        if (averageMinutes <= 235) {
          speedTier = "FAST";
        } else if (averageMinutes <= 245) {
          speedTier = "AVERAGE";
        } else {
          speedTier = "SLOW";
        }

        // Check if profile exists
        const existingProfile = await db.query.memberSpeedProfiles.findFirst({
          where: eq(memberSpeedProfiles.memberId, memberId),
        });

        if (existingProfile) {
          // Only update if not manually overridden
          if (!existingProfile.manualOverride) {
            await db
              .update(memberSpeedProfiles)
              .set({
                averageMinutes,
                speedTier,
                lastCalculated: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(memberSpeedProfiles.memberId, memberId));
            updatedProfiles++;
          }
        } else {
          // Create new profile
          await db.insert(memberSpeedProfiles).values({
            memberId,
            averageMinutes,
            speedTier,
            adminPriorityAdjustment: 0,
            manualOverride: false,
            lastCalculated: new Date(),
            notes: null,
          });
          updatedProfiles++;
        }
      }
    }

    // Record speed calculation maintenance (only if not already recorded this month)
    const currentMonth = new Date().toISOString().slice(0, 7);
    const existingSpeedMaintenance = await db.query.systemMaintenance.findFirst({
      where: and(
        eq(systemMaintenance.maintenanceType, "SPEED_RECALCULATION"),
        eq(systemMaintenance.month, currentMonth),
      ),
    });

    if (!existingSpeedMaintenance) {
      await db.insert(systemMaintenance).values({
        maintenanceType: "SPEED_RECALCULATION",
        month: currentMonth,
        recordsAffected: updatedProfiles,
        notes: `Recalculated member profiles for ${updatedProfiles} members with 3+ rounds in last 3 months`,
      }).onConflictDoNothing();
    }

    return {
      success: true,
      data: {
        recordsAffected: updatedProfiles,
        notes: `Updated ${updatedProfiles} member profiles based on recent pace data`,
      },
    };
  } catch (error) {
    console.error("Error recalculating speed profiles:", error);
    return {
      success: false,
      error: "Failed to recalculate speed profiles",
    };
  }
}


/**
 * Manual trigger for monthly maintenance (admin only)
 */
export async function triggerManualMaintenance(): Promise<MaintenanceResult> {
  try {
    const resetResult = await resetMonthlyFairnessScores();
    const speedResult = await recalculateSpeedProfiles();

    const totalRecords =
      (resetResult.data?.recordsAffected || 0) +
      (speedResult.data?.recordsAffected || 0);

    // Record manual maintenance
    await db.insert(systemMaintenance).values({
      maintenanceType: "MANUAL_MAINTENANCE",
      month: new Date().toISOString().slice(0, 7),
      recordsAffected: totalRecords,
      notes: `Manual maintenance: ${resetResult.data?.notes || ""}, ${speedResult.data?.notes || ""}`,
    }).onConflictDoNothing();

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
