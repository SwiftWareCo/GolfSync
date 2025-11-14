"use server";

import { db } from "~/server/db";
import {
  lotteryEntries,
  lotteryGroups,
  members,
  timeBlockMembers,
  memberFairnessScores,
  timeBlocks,
  memberSpeedProfiles,
} from "~/server/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type {
  LotteryEntryInsert,
  LotteryGroupInsert,
  LotteryEntryFormData,
  TimeWindow,
} from "~/app/types/LotteryTypes";
import type { TeesheetConfig } from "~/app/types/TeeSheetTypes";
import { calculateDynamicTimeWindows } from "~/lib/lottery-utils";
import { requireAdmin } from "~/lib/auth-helpers";
import { dateStringSchema } from "~/lib/validation-schemas";

export type ActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

/**
 * Submit a lottery entry (individual or group based on memberIds)
 */
export async function submitLotteryEntry(
  userId: number,
  data: LotteryEntryFormData,
): Promise<ActionResult> {
  try {
    // Get member data
    const member = await db.query.members.findFirst({
      where: eq(members.id, userId),
    });

    if (!member) {
      return { success: false, error: "Member not found" };
    }

    // Check if this is a group entry (has memberIds) or individual
    const isGroupEntry = data.memberIds && data.memberIds.length > 0;

    if (isGroupEntry) {
      // Handle group entry
      const allMemberIds = [member.id, ...(data.memberIds || [])];

      // Check if group entry already exists for this date
      const existingGroup = await db.query.lotteryGroups.findFirst({
        where: and(
          eq(lotteryGroups.leaderId, member.id),
          eq(lotteryGroups.lotteryDate, data.lotteryDate),
        ),
      });

      if (existingGroup) {
        return {
          success: false,
          error: "You already have a group lottery entry for this date",
        };
      }

      // Check if any of the group members already have individual entries
      const existingEntries = await db.query.lotteryEntries.findMany({
        where: and(eq(lotteryEntries.lotteryDate, data.lotteryDate)),
      });

      const conflictingMembers = existingEntries.filter((entry) =>
        allMemberIds.includes(entry.memberId),
      );

      if (conflictingMembers.length > 0) {
        return {
          success: false,
          error:
            "Some group members already have lottery entries for this date",
        };
      }

      // Create group lottery entry
      const groupData: LotteryGroupInsert = {
        leaderId: member.id,
        lotteryDate: data.lotteryDate,
        memberIds: allMemberIds,
        fills: data.fills || undefined,
        preferredWindow: data.preferredWindow,
        alternateWindow: data.alternateWindow || null,
        status: "PENDING",
      };

      const [newGroup] = await db
        .insert(lotteryGroups)
        .values(groupData)
        .returning();

      revalidatePath("/members/teesheet");
      return { success: true, data: newGroup };
    } else {
      // Handle individual entry
      // Check if entry already exists for this date
      const existingEntry = await db.query.lotteryEntries.findFirst({
        where: and(
          eq(lotteryEntries.memberId, member.id),
          eq(lotteryEntries.lotteryDate, data.lotteryDate),
        ),
      });

      if (existingEntry) {
        return {
          success: false,
          error: "You already have a lottery entry for this date",
        };
      }

      // Create individual lottery entry
      const entryData: LotteryEntryInsert = {
        memberId: member.id,
        lotteryDate: data.lotteryDate,
        preferredWindow: data.preferredWindow,
        alternateWindow: data.alternateWindow || null,
        status: "PENDING",
      };

      const [newEntry] = await db
        .insert(lotteryEntries)
        .values(entryData)
        .returning();

      revalidatePath("/members/teesheet");
      return { success: true, data: newEntry };
    }
  } catch (error) {
    console.error("Error submitting lottery entry:", error);
    return { success: false, error: "Failed to submit lottery entry" };
  }
}

/**
 * Get lottery entry for a member and date
 */
export async function getLotteryEntry(
  userId: string,
  lotteryDate: string,
): Promise<ActionResult> {
  try {
    // Get member data
    const member = await db.query.members.findFirst({
      where: eq(members.username, userId),
    });

    if (!member) {
      return { success: false, error: "Member not found" };
    }

    // Check for individual entry
    const individualEntry = await db.query.lotteryEntries.findFirst({
      where: and(
        eq(lotteryEntries.memberId, member.id),
        eq(lotteryEntries.lotteryDate, lotteryDate),
      ),
    });

    if (individualEntry) {
      return {
        success: true,
        data: { type: "individual", entry: individualEntry },
      };
    }

    // Check for group entry where this member is the leader
    const groupEntry = await db.query.lotteryGroups.findFirst({
      where: and(
        eq(lotteryGroups.leaderId, member.id),
        eq(lotteryGroups.lotteryDate, lotteryDate),
      ),
    });

    if (groupEntry) {
      return { success: true, data: { type: "group", entry: groupEntry } };
    }

    // Check if member is part of another group
    const otherGroupEntry = await db.query.lotteryGroups.findFirst({
      where: eq(lotteryGroups.lotteryDate, lotteryDate),
    });

    if (otherGroupEntry?.memberIds.includes(member.id)) {
      return {
        success: true,
        data: { type: "group_member", entry: otherGroupEntry },
      };
    }

    return { success: true, data: null };
  } catch (error) {
    console.error("Error getting lottery entry:", error);
    return { success: false, error: "Failed to get lottery entry" };
  }
}

/**
 * Update a lottery entry
 */
export async function updateLotteryEntry(
  userId: string,
  data: {
    entryId: number;
    preferredWindow: string;
    alternateWindow?: string;
  },
): Promise<ActionResult> {
  try {
    // Get member data
    const member = await db.query.members.findFirst({
      where: eq(members.username, userId),
    });

    if (!member) {
      return { success: false, error: "Member not found" };
    }

    // Verify the entry belongs to this member
    const entry = await db.query.lotteryEntries.findFirst({
      where: and(
        eq(lotteryEntries.id, data.entryId),
        eq(lotteryEntries.memberId, member.id),
      ),
    });

    if (!entry) {
      return {
        success: false,
        error: "Lottery entry not found or access denied",
      };
    }

    if (entry.status !== "PENDING") {
      return {
        success: false,
        error: "Cannot modify entry that has been processed",
      };
    }

    // Update the entry
    const [updatedEntry] = await db
      .update(lotteryEntries)
      .set({
        preferredWindow: data.preferredWindow,
        alternateWindow: data.alternateWindow || null,
        updatedAt: new Date(),
      })
      .where(eq(lotteryEntries.id, data.entryId))
      .returning();

    revalidatePath("/members/teesheet");
    return { success: true, data: updatedEntry };
  } catch (error) {
    console.error("Error updating lottery entry:", error);
    return { success: false, error: "Failed to update lottery entry" };
  }
}

/**
 * Update a lottery entry (admin action)
 */
export async function updateLotteryEntryAdmin(
  entryId: number,
  data: {
    preferredWindow: string;
    alternateWindow?: string;
  },
): Promise<ActionResult> {
  try {
    // Verify the entry exists
    const entry = await db.query.lotteryEntries.findFirst({
      where: eq(lotteryEntries.id, entryId),
    });

    if (!entry) {
      return {
        success: false,
        error: "Lottery entry not found",
      };
    }

    // Update the entry
    const [updatedEntry] = await db
      .update(lotteryEntries)
      .set({
        preferredWindow: data.preferredWindow,
        alternateWindow: data.alternateWindow || null,
        updatedAt: new Date(),
      })
      .where(eq(lotteryEntries.id, entryId))
      .returning();

    revalidatePath("/admin/lottery");
    return { success: true, data: updatedEntry };
  } catch (error) {
    console.error("Error updating lottery entry (admin):", error);
    return { success: false, error: "Failed to update lottery entry" };
  }
}

/**
 * Update a lottery group (admin action)
 */
export async function updateLotteryGroupAdmin(
  groupId: number,
  data: {
    preferredWindow: string;
    alternateWindow?: string;
    memberIds: number[];
  },
): Promise<ActionResult> {
  try {
    // Verify the group exists
    const group = await db.query.lotteryGroups.findFirst({
      where: eq(lotteryGroups.id, groupId),
    });

    if (!group) {
      return {
        success: false,
        error: "Lottery group not found",
      };
    }

    // Validate that memberIds includes the leader
    if (!data.memberIds.includes(group.leaderId)) {
      return {
        success: false,
        error: "Group leader must be included in member list",
      };
    }

    // Update the group
    const [updatedGroup] = await db
      .update(lotteryGroups)
      .set({
        preferredWindow: data.preferredWindow,
        alternateWindow: data.alternateWindow || null,
        memberIds: data.memberIds,
        updatedAt: new Date(),
      })
      .where(eq(lotteryGroups.id, groupId))
      .returning();

    revalidatePath("/admin/lottery");
    return { success: true, data: updatedGroup };
  } catch (error) {
    console.error("Error updating lottery group (admin):", error);
    return { success: false, error: "Failed to update lottery group" };
  }
}

// ADMIN FUNCTIONS

/**
 * Cancel a lottery entry (admin action)
 */
export async function cancelLotteryEntry(
  entryId: number,
  isGroup = false,
): Promise<ActionResult> {
  try {
    if (isGroup) {
      const [updatedGroup] = await db
        .update(lotteryGroups)
        .set({
          status: "CANCELLED",
          updatedAt: new Date(),
        })
        .where(eq(lotteryGroups.id, entryId))
        .returning();

      revalidatePath("/admin/lottery");
      return { success: true, data: updatedGroup };
    } else {
      const [updatedEntry] = await db
        .update(lotteryEntries)
        .set({
          status: "CANCELLED",
          updatedAt: new Date(),
        })
        .where(eq(lotteryEntries.id, entryId))
        .returning();

      revalidatePath("/admin/lottery");
      return { success: true, data: updatedEntry };
    }
  } catch (error) {
    console.error("Error canceling lottery entry:", error);
    return { success: false, error: "Failed to cancel lottery entry" };
  }
}

/**
 * Manually assign a lottery entry to a time block (admin action)
 */
export async function assignLotteryEntry(
  entryId: number,
  timeBlockId: number,
  isGroup = false,
): Promise<ActionResult> {
  try {
    const now = new Date();

    // Get the time block details to extract the proper time
    const timeBlock = await db.query.timeBlocks.findFirst({
      where: eq(timeBlocks.id, timeBlockId),
    });

    if (!timeBlock) {
      return { success: false, error: "Time block not found" };
    }

    if (isGroup) {
      // Update group status
      const [updatedGroup] = await db
        .update(lotteryGroups)
        .set({
          status: "ASSIGNED",
          assignedTimeBlockId: timeBlockId,
          processedAt: now,
          updatedAt: now,
        })
        .where(eq(lotteryGroups.id, entryId))
        .returning();

      // Add all group members to the time block
      if (updatedGroup) {
        const memberInserts = updatedGroup.memberIds.map((memberId) => ({
          timeBlockId,
          memberId,
          bookingDate: updatedGroup.lotteryDate,
          bookingTime: timeBlock.startTime, // Use actual time from time block
        }));

        await db.insert(timeBlockMembers).values(memberInserts);
      }

      revalidatePath("/admin/lottery");
      return { success: true, data: updatedGroup };
    } else {
      // Update entry status
      const [updatedEntry] = await db
        .update(lotteryEntries)
        .set({
          status: "ASSIGNED",
          assignedTimeBlockId: timeBlockId,
          processedAt: now,
          updatedAt: now,
        })
        .where(eq(lotteryEntries.id, entryId))
        .returning();

      // Add member to the time block
      if (updatedEntry) {
        await db.insert(timeBlockMembers).values({
          timeBlockId,
          memberId: updatedEntry.memberId,
          bookingDate: updatedEntry.lotteryDate,
          bookingTime: timeBlock.startTime, // Use actual time from time block
        });
      }

      revalidatePath("/admin/lottery");
      return { success: true, data: updatedEntry };
    }
  } catch (error) {
    console.error("Error assigning lottery entry:", error);
    return { success: false, error: "Failed to assign lottery entry" };
  }
}

/**
 * Calculate fairness score for a lottery entry based on fairness, speed, and admin adjustments
 */
async function calculateFairnessScore(
  entry: any,
  timeWindows: any[],
  isGroup = false,
): Promise<number> {
  let fairnessScore = 0;

  // Get the member ID (either direct member or group leader)
  const memberId = isGroup ? entry.leaderId : entry.memberId;

  // 1. Base fairness score (0-100, higher = more priority)
  const fairnessData = await db.query.memberFairnessScores.findFirst({
    where: eq(memberFairnessScores.memberId, memberId),
  });

  if (fairnessData) {
    fairnessScore += fairnessData.fairnessScore || 0;
  }

  // 2. Speed bonus for morning slots (FAST: +5, AVERAGE: +2, SLOW: +0)
  const speedData = await db.query.memberSpeedProfiles.findFirst({
    where: eq(memberSpeedProfiles.memberId, memberId),
  });

  if (speedData && entry.preferredWindow) {
    // Define speed bonuses directly to avoid import issues
    const speedBonuses = [
      { window: "MORNING", fastBonus: 5, averageBonus: 2, slowBonus: 0 },
      { window: "MIDDAY", fastBonus: 2, averageBonus: 1, slowBonus: 0 },
      { window: "AFTERNOON", fastBonus: 0, averageBonus: 0, slowBonus: 0 },
      { window: "EVENING", fastBonus: 0, averageBonus: 0, slowBonus: 0 },
    ];

    const speedBonus = speedBonuses.find(
      (bonus) => bonus.window === entry.preferredWindow,
    );

    if (speedBonus) {
      switch (speedData.speedTier) {
        case "FAST":
          fairnessScore += speedBonus.fastBonus;
          break;
        case "AVERAGE":
          fairnessScore += speedBonus.averageBonus;
          break;
        case "SLOW":
          fairnessScore += speedBonus.slowBonus;
          break;
      }
    }
  }

  // 3. Admin priority adjustment (-10 to +10)
  if (speedData?.adminPriorityAdjustment) {
    fairnessScore += speedData.adminPriorityAdjustment;
  }

  return fairnessScore;
}

/**
 * Process lottery entries by creating actual timeBlockMembers bookings directly
 * This creates real bookings that can be viewed and arranged in the teesheet preview
 * Enhanced with priority-based processing algorithm
 */
export async function processLotteryForDate(
  date: string,
  config: TeesheetConfig,
): Promise<ActionResult> {
  await requireAdmin();
  const validatedDate = dateStringSchema.parse(date);

  try {
    const {
      getLotteryEntriesForDate,
      getAvailableTimeBlocksForDate,
      getActiveTimeRestrictionsForDate,
    } = await import("~/server/lottery/data");

    const entries = await getLotteryEntriesForDate(date);
    const availableBlocks = await getAvailableTimeBlocksForDate(date);
    const timeRestrictions = await getActiveTimeRestrictionsForDate(date);

    const availableBlocksOnly = availableBlocks.filter(
      (block) => block.availableSpots > 0,
    );

    if (availableBlocksOnly.length === 0) {
      return {
        success: false,
        error: "No available time blocks for this date",
      };
    }

    // Calculate dynamic time windows for scoring
    const timeWindows = calculateDynamicTimeWindows(config);
    let processedCount = 0;
    const now = new Date();
    const memberInserts: any[] = [];

    // Simple logging for algorithm decisions
    console.log(`🎲 Starting lottery processing for ${date}`);
    console.log(
      `📊 Available blocks: ${availableBlocksOnly.length}, Total slots: ${availableBlocksOnly.reduce((sum, b) => sum + b.availableSpots, 0)}`,
    );
    console.log(
      `🏌️ Total entries: ${entries.individual.length} individual + ${entries.groups.length} groups`,
    );
    console.log(
      `⏰ Processing groups first, then individuals for better fairness`,
    );

    // Calculate fairness scores for all entries
    const individualEntriesWithPriority = await Promise.all(
      entries.individual.map(async (entry) => {
        const priority = await calculateFairnessScore(
          entry,
          timeWindows,
          false,
        );
        return { ...entry, fairnessScore: priority };
      }),
    );

    const groupEntriesWithPriority = await Promise.all(
      entries.groups.map(async (group) => {
        const priority = await calculateFairnessScore(group, timeWindows, true);
        return { ...group, fairnessScore: priority };
      }),
    );

    // Sort by fairness score (highest first), then by submission time as tiebreaker
    individualEntriesWithPriority.sort((a, b) => {
      if (b.fairnessScore !== a.fairnessScore) {
        return b.fairnessScore - a.fairnessScore;
      }
      return (
        new Date(a.submissionTimestamp).getTime() -
        new Date(b.submissionTimestamp).getTime()
      );
    });

    groupEntriesWithPriority.sort((a, b) => {
      if (b.fairnessScore !== a.fairnessScore) {
        return b.fairnessScore - a.fairnessScore;
      }
      return (
        new Date(a.submissionTimestamp).getTime() -
        new Date(b.submissionTimestamp).getTime()
      );
    });

    // Process group entries FIRST in priority order (groups are harder to accommodate)
    for (const group of groupEntriesWithPriority) {
      if (group.status !== "PENDING") continue;

      const groupSize = group.memberIds.length;

      // Check restrictions for ALL group members, not just leader
      const allowedBlocks = availableBlocksOnly.filter((block) => {
        // Block must have enough spots
        if (block.availableSpots < groupSize) return false;

        // Block must be allowed for ALL group members
        return group.members.every((member) => {
          const memberAllowedBlocks = filterBlocksByRestrictions(
            [block],
            { memberId: member.id, memberClass: member.class },
            date,
            timeRestrictions,
          );
          return memberAllowedBlocks.length > 0;
        });
      });

      // Try to find a block that matches time preferences
      let suitableBlock = allowedBlocks.find((block) =>
        matchesTimePreference(
          block,
          group.preferredWindow as TimeWindow,
          group.alternateWindow as TimeWindow | null,
          config,
        ),
      );

      // Fallback: if no preference match, try any allowed block
      if (!suitableBlock) {
        suitableBlock = allowedBlocks.find(
          (block) => block.availableSpots >= groupSize,
        );
      }

      // Final fallback: try ANY available block (even if restrictions violated)
      if (!suitableBlock) {
        const anyAvailableBlock = availableBlocksOnly.find(
          (block) => block.availableSpots >= groupSize,
        );
        if (anyAvailableBlock) {
          console.log(
            `⚠️ Group fallback assignment: Group ${group.id} assigned to ${anyAvailableBlock.startTime} (may violate restrictions)`,
          );
          suitableBlock = anyAvailableBlock;
        }
      }

      if (suitableBlock) {
        // Update group status to ASSIGNED
        await db
          .update(lotteryGroups)
          .set({
            status: "ASSIGNED",
            assignedTimeBlockId: suitableBlock.id,
            processedAt: now,
            updatedAt: now,
          })
          .where(eq(lotteryGroups.id, group.id));

        // Create timeBlockMembers records for all group members
        for (const memberId of group.memberIds) {
          memberInserts.push({
            timeBlockId: suitableBlock.id,
            memberId: memberId,
            bookingDate: date,
            bookingTime: suitableBlock.startTime,
          });
        }

        // Update available spots for next assignment calculations
        suitableBlock.availableSpots -= groupSize;
        processedCount++;
      }
    }

    // Process individual entries SECOND in priority order (fill remaining spots)
    for (const entry of individualEntriesWithPriority) {
      if (entry.status !== "PENDING") continue;

      // Find available block that matches preferences
      const suitableResult = findSuitableTimeBlock(
        availableBlocksOnly,
        entry.preferredWindow as TimeWindow,
        entry.alternateWindow as TimeWindow | null,
        config,
        {
          memberId: entry.memberId,
          memberClass: entry.member.class,
        },
        date,
        timeRestrictions,
      );

      if (suitableResult.block && suitableResult.block.availableSpots > 0) {
        // Update entry status to ASSIGNED
        await db
          .update(lotteryEntries)
          .set({
            status: "ASSIGNED",
            assignedTimeBlockId: suitableResult.block.id,
            processedAt: now,
            updatedAt: now,
          })
          .where(eq(lotteryEntries.id, entry.id));

        // Create timeBlockMembers record
        memberInserts.push({
          timeBlockId: suitableResult.block.id,
          memberId: entry.memberId,
          bookingDate: date,
          bookingTime: suitableResult.block.startTime,
        });

        // Update available spots for next assignment calculations
        suitableResult.block.availableSpots -= 1;
        processedCount++;
      }
    }

    // Insert all timeBlockMembers records at once
    if (memberInserts.length > 0) {
      await db.insert(timeBlockMembers).values(memberInserts);
    }

    // Update fairness scores after processing
    if (processedCount > 0) {
      await updateFairnessScoresAfterProcessing(date, config);
    }

    // Final results logging
    const totalEntries = entries.individual.length + entries.groups.length;
    const assignedGroups = entries.groups.filter(
      (g) => g.status === "ASSIGNED",
    ).length;
    const assignedIndividuals = entries.individual.filter(
      (e) => e.status === "ASSIGNED",
    ).length;
    const remainingSlots = availableBlocksOnly.reduce(
      (sum, b) => sum + b.availableSpots,
      0,
    );

    console.log(`✅ Lottery processing completed for ${date}`);
    console.log(
      `📈 Results: ${processedCount}/${totalEntries} entries assigned (${Math.round((processedCount / totalEntries) * 100)}%)`,
    );
    console.log(
      `👥 Groups: ${assignedGroups}/${entries.groups.length} assigned`,
    );
    console.log(
      `🏌️ Individuals: ${assignedIndividuals}/${entries.individual.length} assigned`,
    );
    console.log(`🎯 Remaining slots: ${remainingSlots}`);
    console.log(`🎫 Created ${memberInserts.length} actual bookings`);

    revalidatePath("/admin/lottery");
    revalidatePath("/admin/teesheet");
    return {
      success: true,
      data: {
        processedCount,
        totalEntries,
        bookingsCreated: memberInserts.length,
        message: `Enhanced algorithm processed ${processedCount} entries and created ${memberInserts.length} bookings`,
      },
    };
  } catch (error) {
    console.error("Error processing lottery:", error);
    return { success: false, error: "Failed to process lottery entries" };
  }
}

/**
 * Finalize lottery results by creating actual timeBlockMembers records
 * This should only be called after admin confirms the assignments
 */
export async function finalizeLotteryResults(
  date: string,
): Promise<ActionResult> {
  await requireAdmin();
  const validatedDate = dateStringSchema.parse(date);
  try {
    const { getLotteryEntriesForDate } = await import("~/server/lottery/data");
    const entries = await getLotteryEntriesForDate(validatedDate);
    const memberInserts: any[] = [];

    // Create timeBlockMembers records for assigned individual entries
    for (const entry of entries.individual) {
      if (entry.status === "ASSIGNED" && entry.assignedTimeBlockId) {
        const timeBlock = await db.query.timeBlocks.findFirst({
          where: eq(timeBlocks.id, entry.assignedTimeBlockId),
        });

        if (timeBlock) {
          memberInserts.push({
            timeBlockId: entry.assignedTimeBlockId,
            memberId: entry.memberId,
            bookingDate: validatedDate,
            bookingTime: timeBlock.startTime,
          });
        }
      }
    }

    // Create timeBlockMembers records for assigned group entries
    for (const group of entries.groups) {
      if (
        group.status === "ASSIGNED" &&
        group.assignedTimeBlockId &&
        group.members &&
        group.members.length > 0
      ) {
        // Get the assigned time block directly from the group's assignedTimeBlockId
        const assignedTimeBlock = await db.query.timeBlocks.findFirst({
          where: eq(timeBlocks.id, group.assignedTimeBlockId),
        });

        if (assignedTimeBlock) {
          // Add all group members to the time block
          for (const memberId of group.memberIds) {
            memberInserts.push({
              timeBlockId: assignedTimeBlock.id,
              memberId: memberId,
              bookingDate: validatedDate,
              bookingTime: assignedTimeBlock.startTime,
            });
          }
        }
      }
    }

    // Insert all timeBlockMembers records at once
    if (memberInserts.length > 0) {
      await db.insert(timeBlockMembers).values(memberInserts);
    }

    revalidatePath("/admin/lottery");
    revalidatePath("/admin/teesheet");

    return {
      success: true,
      data: {
        finalizedCount: memberInserts.length,
      },
    };
  } catch (error) {
    console.error("Error finalizing lottery results:", error);
    return { success: false, error: "Failed to finalize lottery results" };
  }
}

/**
 * Initialize fairness scores for a member
 */
export async function initializeFairnessScore(
  memberId: number,
): Promise<ActionResult> {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);

    // Check if record already exists
    const existing = await db.query.memberFairnessScores.findFirst({
      where: and(
        eq(memberFairnessScores.memberId, memberId),
        eq(memberFairnessScores.currentMonth, currentMonth),
      ),
    });

    if (!existing) {
      await db.insert(memberFairnessScores).values({
        memberId,
        currentMonth,
        totalEntriesMonth: 0,
        preferencesGrantedMonth: 0,
        preferenceFulfillmentRate: 0,
        daysWithoutGoodTime: 0,
        fairnessScore: 0,
      });
    }

    return { success: true };
  } catch (error) {
    console.error("Error initializing fairness score:", error);
    return { success: false, error: "Failed to initialize fairness score" };
  }
}

/**
 * Helper function to format date to YYYY-MM-DD for consistent comparison
 */
function formatDateToYYYYMMDD(date: string | Date): string {
  if (typeof date === "string") {
    return date.split("T")[0] || date; // Handle ISO strings
  }
  return date.toISOString().split("T")[0] || "";
}

/**
 * Filter timeblocks by member class TIME restrictions
 */
function filterBlocksByRestrictions(
  blocks: any[],
  memberInfo: { memberId: number; memberClass: string },
  bookingDate: string,
  timeRestrictions: any[],
): any[] {
  return blocks.filter((block) => {
    // Check each time restriction
    for (const restriction of timeRestrictions) {
      if (restriction.restrictionCategory !== "MEMBER_CLASS") continue;
      if (restriction.restrictionType !== "TIME") continue;
      if (!restriction.isActive) continue;

      // Check if restriction applies to this member class
      const appliesToMemberClass =
        !restriction.memberClasses?.length ||
        restriction.memberClasses.includes(memberInfo.memberClass);

      if (!appliesToMemberClass) continue;

      // Check day of week
      const bookingDateObj = new Date(bookingDate);
      const dayOfWeek = bookingDateObj.getDay();
      const appliesToDay =
        !restriction.daysOfWeek?.length ||
        restriction.daysOfWeek.includes(dayOfWeek);

      if (!appliesToDay) continue;

      // Check time range
      const blockTime = block.startTime; // "HH:MM"
      const withinTimeRange =
        blockTime >= (restriction.startTime || "00:00") &&
        blockTime <= (restriction.endTime || "23:59");

      if (withinTimeRange) {
        // Check date range if applicable
        if (restriction.startDate && restriction.endDate) {
          const startDateStr = formatDateToYYYYMMDD(restriction.startDate);
          const endDateStr = formatDateToYYYYMMDD(restriction.endDate);
          const withinDateRange =
            bookingDate >= startDateStr && bookingDate <= endDateStr;

          if (withinDateRange) {
            return false; // Block this timeblock
          }
        } else {
          return false; // Block this timeblock (no date range = always applies)
        }
      }
    }

    return true; // No restrictions block this timeblock
  });
}

/**
 * Helper to find a block within preferred/alternate windows
 */
function findBlockInWindow(
  availableBlocks: any[],
  preferredWindow: TimeWindow,
  alternateWindow: TimeWindow | null,
  config: TeesheetConfig,
): any | null {
  // Try preferred window
  const preferredMatch = availableBlocks.find(
    (block) =>
      matchesTimePreference(block, preferredWindow, null, config) &&
      block.availableSpots > 0,
  );
  if (preferredMatch) return preferredMatch;

  // Then try alternate window
  if (alternateWindow) {
    const alternateMatch = availableBlocks.find(
      (block) =>
        matchesTimePreference(block, alternateWindow, null, config) &&
        block.availableSpots > 0,
    );
    if (alternateMatch) return alternateMatch;
  }

  return null;
}

/**
 * Helper function to find suitable time block based on preferences
 */
function findSuitableTimeBlock(
  availableBlocks: any[],
  preferredWindow: TimeWindow,
  alternateWindow: TimeWindow | null,
  config: TeesheetConfig,
  memberInfo: { memberId: number; memberClass: string },
  bookingDate: string,
  timeRestrictions: any[],
): { block: any | null; wasBlockedByRestrictions: boolean } {
  // First try with all blocks (no restriction filtering)
  const unrestrictedBlock = findBlockInWindow(
    availableBlocks,
    preferredWindow,
    alternateWindow,
    config,
  );

  // Then try with restriction filtering
  const allowedBlocks = filterBlocksByRestrictions(
    availableBlocks,
    memberInfo,
    bookingDate,
    timeRestrictions,
  );
  const restrictedBlock = findBlockInWindow(
    allowedBlocks,
    preferredWindow,
    alternateWindow,
    config,
  );

  // If we found the same block both ways, no restrictions affected the choice
  if (
    unrestrictedBlock &&
    restrictedBlock &&
    unrestrictedBlock.id === restrictedBlock.id
  ) {
    return { block: restrictedBlock, wasBlockedByRestrictions: false };
  }

  // If we found a block with restrictions, restrictions affected the choice
  if (restrictedBlock) {
    return { block: restrictedBlock, wasBlockedByRestrictions: true };
  }

  // Last resort: try to find any available block in allowed blocks
  const anyAllowedBlock = allowedBlocks.find(
    (block) => block.availableSpots > 0,
  );
  if (anyAllowedBlock) {
    return { block: anyAllowedBlock, wasBlockedByRestrictions: true };
  }

  // Final fallback: assign to ANY available block (even if it violates restrictions)
  // This ensures no entry is left unassigned if ANY slot exists
  const anyAvailableBlock = availableBlocks.find(
    (block) => block.availableSpots > 0,
  );
  if (anyAvailableBlock) {
    console.log(
      `⚠️ Fallback assignment: Member ${memberInfo.memberId} assigned to ${anyAvailableBlock.startTime} (may violate restrictions)`,
    );
    return { block: anyAvailableBlock, wasBlockedByRestrictions: true };
  }

  // No suitable block found
  return { block: null, wasBlockedByRestrictions: false };
}

/**
 * Helper function to check if a time block matches time preferences using dynamic windows
 */
function matchesTimePreference(
  block: any,
  timeWindow: TimeWindow,
  alternateWindow: TimeWindow | null,
  config: TeesheetConfig,
): boolean {
  // Get dynamic time windows from config
  const dynamicWindows = calculateDynamicTimeWindows(config);
  const blockTime = parseInt(block.startTime.replace(":", ""));

  // Convert block time to minutes from midnight for comparison
  const blockMinutes = Math.floor(blockTime / 100) * 60 + (blockTime % 100);

  // Check preferred window
  const preferredWindowInfo = dynamicWindows.find(
    (w) => w.value === timeWindow,
  );
  if (
    preferredWindowInfo &&
    blockMinutes >= preferredWindowInfo.startMinutes &&
    blockMinutes < preferredWindowInfo.endMinutes
  ) {
    return true;
  }

  // Check alternate window
  if (alternateWindow) {
    const alternateWindowInfo = dynamicWindows.find(
      (w) => w.value === alternateWindow,
    );
    if (
      alternateWindowInfo &&
      blockMinutes >= alternateWindowInfo.startMinutes &&
      blockMinutes < alternateWindowInfo.endMinutes
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Create test lottery entries for debugging (admin only)
 */
export async function createTestLotteryEntries(
  date: string,
): Promise<ActionResult> {
  try {
    // Get active members from database - exclude STAFF and MANAGEMENT classes
    const allMembers = await db.query.members.findMany({
      where: and(
        sql`${members.class} != 'RESIGNED'`,
        sql`${members.class} != 'SUSPENDED'`,
        sql`${members.class} != 'DINING'`,
        sql`${members.class} != 'STAFF'`,
        sql`${members.class} != 'STAFF PLAY'`,
        sql`${members.class} != 'MANAGEMENT'`,
        sql`${members.class} != 'MGMT / PRO'`,
        sql`${members.class} != 'HONORARY MALE'`,
        sql`${members.class} != 'HONORARY FEMALE'`,
        sql`${members.class} != 'PRIVILEGED MALE'`,
        sql`${members.class} != 'PRIVILEGED FEMALE'`,
        sql`${members.class} != 'SENIOR RETIRED MALE'`,
        sql`${members.class} != 'SENIOR RETIRED FEMALE'`,
        sql`${members.class} != 'LEAVE OF ABSENCE'`,
      ),
      limit: 200, // Get more members for realistic data
    });

    if (allMembers.length < 20) {
      return {
        success: false,
        error: "Need at least 20 members to create realistic test entries",
      };
    }

    const testEntries: LotteryEntryInsert[] = [];
    const testGroups: LotteryGroupInsert[] = [];

    // Realistic time windows from CSV analysis
    const timeWindows: TimeWindow[] = ["MORNING", "MIDDAY", "AFTERNOON"];

    // Target: Create more realistic high-demand day
    const availableMembers = allMembers.length;

    // Base targets for a busy day (aim for 60-80% member participation)
    let targetIndividualEntries = Math.max(
      5,
      Math.floor(availableMembers * 0.1),
    ); // 10% individuals
    let targetPairGroups = Math.max(8, Math.floor(availableMembers * 0.08)); // ~16% in pairs
    let targetThreeGroups = Math.max(12, Math.floor(availableMembers * 0.12)); // ~36% in threesomes
    let targetFourGroups = Math.max(15, Math.floor(availableMembers * 0.15)); // ~60% in foursomes

    // Calculate members needed
    const calculateMembersNeeded = () =>
      targetIndividualEntries +
      targetPairGroups * 2 +
      targetThreeGroups * 3 +
      targetFourGroups * 4;

    // Scale down if we exceed available members, but keep realistic proportions
    while (calculateMembersNeeded() > availableMembers) {
      // Reduce proportionally to maintain realistic distribution
      if (targetFourGroups > 10) {
        targetFourGroups = Math.max(10, targetFourGroups - 2);
      } else if (targetThreeGroups > 8) {
        targetThreeGroups = Math.max(8, targetThreeGroups - 2);
      } else if (targetPairGroups > 5) {
        targetPairGroups = Math.max(5, targetPairGroups - 1);
      } else if (targetIndividualEntries > 3) {
        targetIndividualEntries = Math.max(3, targetIndividualEntries - 1);
      } else {
        break; // Can't reduce further
      }
    }

    // Debug logging
    console.log(`🎯 Test data generation for ${date}:`);
    console.log(
      `👥 Available members: ${availableMembers} (excluded STAFF/MANAGEMENT)`,
    );
    console.log(
      `📊 Target distribution: ${targetIndividualEntries} individuals, ${targetPairGroups} pairs, ${targetThreeGroups} threesomes, ${targetFourGroups} foursomes`,
    );
    console.log(`🧮 Members needed: ${calculateMembersNeeded()}`);

    // Shuffle members to avoid bias
    const shuffledMembers = [...allMembers].sort(() => Math.random() - 0.5);
    let memberIndex = 0;

    // Helper function to get realistic time preference based on demand
    const getTimePreference = () => {
      const rand = Math.random();
      let preferredWindow: TimeWindow = "MORNING";
      let alternateWindow: TimeWindow | null = null;

      if (rand < 0.6) {
        // 60% want high-demand morning times (creates conflicts)
        preferredWindow = "MORNING";
        alternateWindow = Math.random() > 0.5 ? "MIDDAY" : null;
      } else if (rand < 0.8) {
        // 20% want medium-demand times
        preferredWindow = Math.random() > 0.5 ? "MORNING" : "MIDDAY";
        alternateWindow =
          preferredWindow === "MORNING" ? "MIDDAY" : "AFTERNOON";
      } else {
        // 20% want afternoon times (easier to accommodate)
        preferredWindow = Math.random() > 0.5 ? "MIDDAY" : "AFTERNOON";
        alternateWindow = "AFTERNOON";
      }

      return { preferredWindow, alternateWindow };
    };

    // Create 4-player groups
    console.log(`🏌️‍♂️ Creating ${targetFourGroups} 4-player groups...`);
    for (
      let i = 0;
      i < targetFourGroups && memberIndex < shuffledMembers.length - 3;
      i++
    ) {
      const leader = shuffledMembers[memberIndex]!;
      const groupMembers = [
        leader.id,
        shuffledMembers[memberIndex + 1]!.id,
        shuffledMembers[memberIndex + 2]!.id,
        shuffledMembers[memberIndex + 3]!.id,
      ];

      const { preferredWindow, alternateWindow } = getTimePreference();

      testGroups.push({
        leaderId: leader.id,
        lotteryDate: date,
        memberIds: groupMembers,
        preferredWindow,
        alternateWindow,
        status: "PENDING",
      });

      memberIndex += 4;
    }
    console.log(
      `✅ Created ${testGroups.length} 4-player groups, memberIndex now: ${memberIndex}`,
    );

    // Create 3-player groups
    console.log(`🏌️‍♂️ Creating ${targetThreeGroups} 3-player groups...`);
    for (
      let i = 0;
      i < targetThreeGroups && memberIndex < shuffledMembers.length - 2;
      i++
    ) {
      const leader = shuffledMembers[memberIndex]!;
      const groupMembers = [
        leader.id,
        shuffledMembers[memberIndex + 1]!.id,
        shuffledMembers[memberIndex + 2]!.id,
      ];

      const { preferredWindow, alternateWindow } = getTimePreference();

      testGroups.push({
        leaderId: leader.id,
        lotteryDate: date,
        memberIds: groupMembers,
        preferredWindow,
        alternateWindow,
        status: "PENDING",
      });

      memberIndex += 3;
    }
    console.log(
      `✅ Total groups after 3-player: ${testGroups.length}, memberIndex now: ${memberIndex}`,
    );

    // Create 2-player groups
    console.log(`🏌️‍♂️ Creating ${targetPairGroups} 2-player groups...`);
    for (
      let i = 0;
      i < targetPairGroups && memberIndex < shuffledMembers.length - 1;
      i++
    ) {
      const leader = shuffledMembers[memberIndex]!;
      const groupMembers = [leader.id, shuffledMembers[memberIndex + 1]!.id];

      const { preferredWindow, alternateWindow } = getTimePreference();

      testGroups.push({
        leaderId: leader.id,
        lotteryDate: date,
        memberIds: groupMembers,
        preferredWindow,
        alternateWindow,
        status: "PENDING",
      });

      memberIndex += 2;
    }
    console.log(
      `✅ Total groups after 2-player: ${testGroups.length}, memberIndex now: ${memberIndex}`,
    );

    // Create individual entries
    console.log(`🏌️‍♂️ Creating ${targetIndividualEntries} individual entries...`);
    for (
      let i = 0;
      i < targetIndividualEntries && memberIndex < shuffledMembers.length;
      i++
    ) {
      const member = shuffledMembers[memberIndex]!;
      const { preferredWindow, alternateWindow } = getTimePreference();

      testEntries.push({
        memberId: member.id,
        lotteryDate: date,
        preferredWindow,
        alternateWindow,
        status: "PENDING",
      });

      memberIndex++;
    }
    console.log(
      `✅ Created ${testEntries.length} individual entries, memberIndex now: ${memberIndex}`,
    );

    // Insert all test entries
    let createdEntries = 0;
    let createdGroups = 0;

    if (testEntries.length > 0) {
      const results = await db
        .insert(lotteryEntries)
        .values(testEntries)
        .returning();
      createdEntries = results.length;
    }

    if (testGroups.length > 0) {
      const results = await db
        .insert(lotteryGroups)
        .values(testGroups)
        .returning();
      createdGroups = results.length;
    }

    const totalPlayers =
      createdEntries +
      testGroups.reduce((sum, group) => sum + group.memberIds.length, 0);

    // Final summary
    console.log(`🎯 Test data creation complete!`);
    console.log(
      `📊 Final results: ${createdGroups} groups + ${createdEntries} individuals = ${createdGroups + createdEntries} total entries`,
    );
    console.log(`👥 Total players: ${totalPlayers}`);
    console.log(
      `📈 Breakdown: ${testGroups.filter((g) => g.memberIds.length === 4).length} foursomes, ${testGroups.filter((g) => g.memberIds.length === 3).length} threesomes, ${testGroups.filter((g) => g.memberIds.length === 2).length} pairs`,
    );

    revalidatePath("/admin/lottery");
    return {
      success: true,
      data: {
        createdEntries,
        createdGroups,
        totalPlayers,
        message: `Created realistic test data matching CSV patterns: ${createdGroups} groups (${testGroups.filter((g) => g.memberIds.length === 4).length} foursomes, ${testGroups.filter((g) => g.memberIds.length === 3).length} threesomes, ${testGroups.filter((g) => g.memberIds.length === 2).length} pairs) + ${createdEntries} individuals = ${createdGroups + createdEntries} total entries with ${totalPlayers} players.`,
      },
    };
  } catch (error) {
    console.error("Error creating test lottery entries:", error);
    return { success: false, error: "Failed to create test lottery entries" };
  }
}

/**
 * Clear all lottery entries for a date (debug function)
 */
export async function clearLotteryEntriesForDate(
  date: string,
): Promise<ActionResult> {
  await requireAdmin();
  const validatedDate = dateStringSchema.parse(date);
  try {
    // Delete individual entries
    const deletedEntries = await db
      .delete(lotteryEntries)
      .where(eq(lotteryEntries.lotteryDate, validatedDate))
      .returning();

    // Delete group entries
    const deletedGroups = await db
      .delete(lotteryGroups)
      .where(eq(lotteryGroups.lotteryDate, validatedDate))
      .returning();

    revalidatePath("/admin/lottery");
    return {
      success: true,
      data: {
        deletedEntries: deletedEntries.length,
        deletedGroups: deletedGroups.length,
      },
    };
  } catch (error) {
    console.error("Error clearing lottery entries:", error);
    return { success: false, error: "Failed to clear lottery entries" };
  }
}

/**
 * Update lottery assignment (move entry/group between time blocks or unassign)
 */
export async function updateLotteryAssignment(
  entryId: number,
  isGroup: boolean,
  targetTimeBlockId: number | null,
): Promise<ActionResult> {
  try {
    if (isGroup) {
      await db
        .update(lotteryGroups)
        .set({
          assignedTimeBlockId: targetTimeBlockId,
          status: targetTimeBlockId ? "ASSIGNED" : "PENDING",
          updatedAt: new Date(),
        })
        .where(eq(lotteryGroups.id, entryId));
    } else {
      await db
        .update(lotteryEntries)
        .set({
          assignedTimeBlockId: targetTimeBlockId,
          status: targetTimeBlockId ? "ASSIGNED" : "PENDING",
          updatedAt: new Date(),
        })
        .where(eq(lotteryEntries.id, entryId));
    }

    revalidatePath("/admin/lottery");
    return { success: true };
  } catch (error) {
    console.error("Error updating lottery assignment:", error);
    return { success: false, error: "Failed to update assignment" };
  }
}

/**
 * Batch update lottery assignments (save all client-side changes at once)
 * This function actually moves the timeBlockMembers records, not just updates assignedTimeBlockId
 */
export async function batchUpdateLotteryAssignments(
  changes: {
    entryId: number;
    isGroup: boolean;
    assignedTimeBlockId: number | null;
  }[],
): Promise<ActionResult> {
  try {
    // Process all entry assignment changes
    for (const change of changes) {
      if (change.isGroup) {
        // Get the group details
        const group = await db.query.lotteryGroups.findFirst({
          where: eq(lotteryGroups.id, change.entryId),
          with: {
            leader: true,
          },
        });

        if (!group) {
          console.error(`Group ${change.entryId} not found`);
          continue;
        }

        // Remove existing timeBlockMembers for all group members
        if (group.memberIds && group.memberIds.length > 0) {
          await db
            .delete(timeBlockMembers)
            .where(
              and(
                inArray(timeBlockMembers.memberId, group.memberIds),
                eq(timeBlockMembers.bookingDate, group.lotteryDate),
              ),
            );
        }

        // If assigning to a new time block, create new timeBlockMembers records
        if (
          change.assignedTimeBlockId &&
          group.memberIds &&
          group.memberIds.length > 0
        ) {
          const timeBlock = await db.query.timeBlocks.findFirst({
            where: eq(timeBlocks.id, change.assignedTimeBlockId!),
          });

          if (timeBlock) {
            const memberInserts = group.memberIds.map((memberId) => ({
              timeBlockId: change.assignedTimeBlockId!,
              memberId: memberId,
              bookingDate: group.lotteryDate,
              bookingTime: timeBlock.startTime,
            }));

            await db.insert(timeBlockMembers).values(memberInserts);
          }
        }

        // Update group assignment
        await db
          .update(lotteryGroups)
          .set({
            assignedTimeBlockId: change.assignedTimeBlockId,
            status: change.assignedTimeBlockId ? "ASSIGNED" : "PENDING",
            updatedAt: new Date(),
          })
          .where(eq(lotteryGroups.id, change.entryId));
      } else {
        // Get the individual entry details
        const entry = await db.query.lotteryEntries.findFirst({
          where: eq(lotteryEntries.id, change.entryId),
          with: {
            member: true,
          },
        });

        if (!entry) {
          console.error(`Entry ${change.entryId} not found`);
          continue;
        }

        // Remove existing timeBlockMembers for this member
        await db
          .delete(timeBlockMembers)
          .where(
            and(
              eq(timeBlockMembers.memberId, entry.memberId),
              eq(timeBlockMembers.bookingDate, entry.lotteryDate),
            ),
          );

        // If assigning to a new time block, create new timeBlockMembers record
        if (change.assignedTimeBlockId) {
          const timeBlock = await db.query.timeBlocks.findFirst({
            where: eq(timeBlocks.id, change.assignedTimeBlockId),
          });

          if (timeBlock) {
            await db.insert(timeBlockMembers).values({
              timeBlockId: change.assignedTimeBlockId,
              memberId: entry.memberId,
              bookingDate: entry.lotteryDate,
              bookingTime: timeBlock.startTime,
            });
          }
        }

        // Update entry assignment
        await db
          .update(lotteryEntries)
          .set({
            assignedTimeBlockId: change.assignedTimeBlockId,
            status: change.assignedTimeBlockId ? "ASSIGNED" : "PENDING",
            updatedAt: new Date(),
          })
          .where(eq(lotteryEntries.id, change.entryId));
      }
    }

    revalidatePath("/admin/lottery");
    revalidatePath("/admin/teesheet"); // Also revalidate teesheet since we moved actual bookings
    return { success: true };
  } catch (error) {
    console.error("Error batch updating lottery assignments:", error);
    return { success: false, error: "Failed to save changes" };
  }
}

/**
 * Update fairness scores after lottery processing
 */
async function updateFairnessScoresAfterProcessing(
  date: string,
  config: TeesheetConfig,
): Promise<void> {
  try {
    const { getLotteryEntriesForDate, getActiveTimeRestrictionsForDate } =
      await import("~/server/lottery/data");
    const entries = await getLotteryEntriesForDate(date);
    const timeRestrictions = await getActiveTimeRestrictionsForDate(date);
    const currentMonth = new Date().toISOString().slice(0, 7); // "2024-01" format
    const timeWindows = calculateDynamicTimeWindows(config);

    // Update scores for individual entries
    for (const entry of entries.individual) {
      if (entry.status === "ASSIGNED" && entry.assignedTimeBlockId) {
        const memberId = entry.memberId;

        // Get the assigned time block details
        const assignedTimeBlock = await db.query.timeBlocks.findFirst({
          where: eq(timeBlocks.id, entry.assignedTimeBlockId),
        });

        if (!assignedTimeBlock) continue;

        // Check if they got their preferred window, considering restrictions
        // Determine if this assignment was affected by restrictions
        const memberInfo = {
          memberId: entry.memberId,
          memberClass: entry.member.class,
        };

        // Check what blocks were available without restrictions
        const allBlocks = [
          { startTime: assignedTimeBlock.startTime, id: assignedTimeBlock.id },
        ];
        const allowedBlocks = filterBlocksByRestrictions(
          allBlocks,
          memberInfo,
          date,
          timeRestrictions,
        );

        // If the assigned block wouldn't be allowed without restrictions,
        // or if member has any active restrictions, consider this affected by restrictions
        const wasBlockedByRestrictions =
          allowedBlocks.length === 0 ||
          timeRestrictions.some((restriction) => {
            const appliesToMemberClass =
              !restriction.memberClasses?.length ||
              restriction.memberClasses.includes(memberInfo.memberClass);
            return (
              restriction.isActive &&
              restriction.restrictionCategory === "MEMBER_CLASS" &&
              restriction.restrictionType === "TIME" &&
              appliesToMemberClass
            );
          });

        const preferenceGranted = checkPreferenceMatchWithRestrictions(
          assignedTimeBlock.startTime,
          entry.preferredWindow,
          entry.alternateWindow,
          timeWindows,
          wasBlockedByRestrictions,
        );

        // Update or create fairness score record
        const existingScore = await db.query.memberFairnessScores.findFirst({
          where: and(
            eq(memberFairnessScores.memberId, memberId),
            eq(memberFairnessScores.currentMonth, currentMonth),
          ),
        });

        if (existingScore) {
          // Update existing record
          const newTotalEntries = existingScore.totalEntriesMonth + 1;
          const newPreferencesGranted =
            existingScore.preferencesGrantedMonth + (preferenceGranted ? 1 : 0);
          const newFulfillmentRate = newPreferencesGranted / newTotalEntries;
          const newDaysWithoutGood = preferenceGranted
            ? 0
            : existingScore.daysWithoutGoodTime + 1;

          // Calculate new fairness score (higher = more priority needed)
          let newFairnessScore = 0;
          if (newFulfillmentRate < 0.5) {
            // Less than 50% fulfillment
            newFairnessScore += 20;
          } else if (newFulfillmentRate < 0.7) {
            // Less than 70% fulfillment
            newFairnessScore += 10;
          }
          newFairnessScore += Math.min(newDaysWithoutGood * 2, 30); // +2 per day without good time, max 30

          await db
            .update(memberFairnessScores)
            .set({
              totalEntriesMonth: newTotalEntries,
              preferencesGrantedMonth: newPreferencesGranted,
              preferenceFulfillmentRate: newFulfillmentRate,
              daysWithoutGoodTime: newDaysWithoutGood,
              fairnessScore: newFairnessScore,
              lastUpdated: new Date(),
            })
            .where(eq(memberFairnessScores.memberId, memberId));
        } else {
          // Create new record
          const fulfillmentRate = preferenceGranted ? 1 : 0;
          const daysWithoutGood = preferenceGranted ? 0 : 1;
          let fairnessScore = 0;
          if (!preferenceGranted) {
            fairnessScore = 10; // Base score for not getting preference
          }

          await db.insert(memberFairnessScores).values({
            memberId,
            currentMonth,
            totalEntriesMonth: 1,
            preferencesGrantedMonth: preferenceGranted ? 1 : 0,
            preferenceFulfillmentRate: fulfillmentRate,
            daysWithoutGoodTime: daysWithoutGood,
            fairnessScore,
            lastUpdated: new Date(),
          });
        }
      }
    }

    // Update scores for group entries (using group leader)
    for (const group of entries.groups) {
      if (group.status === "ASSIGNED" && group.assignedTimeBlockId) {
        const memberId = group.leaderId;

        // Get the assigned time block details
        const assignedTimeBlock = await db.query.timeBlocks.findFirst({
          where: eq(timeBlocks.id, group.assignedTimeBlockId),
        });

        if (!assignedTimeBlock) continue;

        // Check if they got their preferred window, considering restrictions
        // For groups, check if ANY member was blocked by restrictions
        const groupMemberInfo = {
          memberId: group.leaderId,
          memberClass: group.leader.class,
        };

        // Check if the group assignment was affected by restrictions from any member
        const allBlocks = [
          { startTime: assignedTimeBlock.startTime, id: assignedTimeBlock.id },
        ];
        const wasBlockedByRestrictions =
          group.members?.some((member) => {
            const memberAllowedBlocks = filterBlocksByRestrictions(
              allBlocks,
              { memberId: member.id, memberClass: member.class },
              date,
              timeRestrictions,
            );
            return memberAllowedBlocks.length === 0;
          }) || false;

        const preferenceGranted = checkPreferenceMatchWithRestrictions(
          assignedTimeBlock.startTime,
          group.preferredWindow,
          group.alternateWindow,
          timeWindows,
          wasBlockedByRestrictions,
        );

        // Update fairness score for group leader (similar logic as individual)
        const existingScore = await db.query.memberFairnessScores.findFirst({
          where: and(
            eq(memberFairnessScores.memberId, memberId),
            eq(memberFairnessScores.currentMonth, currentMonth),
          ),
        });

        if (existingScore) {
          const newTotalEntries = existingScore.totalEntriesMonth + 1;
          const newPreferencesGranted =
            existingScore.preferencesGrantedMonth + (preferenceGranted ? 1 : 0);
          const newFulfillmentRate = newPreferencesGranted / newTotalEntries;
          const newDaysWithoutGood = preferenceGranted
            ? 0
            : existingScore.daysWithoutGoodTime + 1;

          let newFairnessScore = 0;
          if (newFulfillmentRate < 0.5) {
            newFairnessScore += 20;
          } else if (newFulfillmentRate < 0.7) {
            newFairnessScore += 10;
          }
          newFairnessScore += Math.min(newDaysWithoutGood * 2, 30);

          await db
            .update(memberFairnessScores)
            .set({
              totalEntriesMonth: newTotalEntries,
              preferencesGrantedMonth: newPreferencesGranted,
              preferenceFulfillmentRate: newFulfillmentRate,
              daysWithoutGoodTime: newDaysWithoutGood,
              fairnessScore: newFairnessScore,
              lastUpdated: new Date(),
            })
            .where(eq(memberFairnessScores.memberId, memberId));
        } else {
          const fulfillmentRate = preferenceGranted ? 1 : 0;
          const daysWithoutGood = preferenceGranted ? 0 : 1;
          let fairnessScore = 0;
          if (!preferenceGranted) {
            fairnessScore = 10;
          }

          await db.insert(memberFairnessScores).values({
            memberId,
            currentMonth,
            totalEntriesMonth: 1,
            preferencesGrantedMonth: preferenceGranted ? 1 : 0,
            preferenceFulfillmentRate: fulfillmentRate,
            daysWithoutGoodTime: daysWithoutGood,
            fairnessScore,
            lastUpdated: new Date(),
          });
        }
      }
    }
  } catch (error) {
    console.error("Error updating fairness scores:", error);
  }
}

/**
 * Check if an assigned time matches member's preferences
 */
function checkPreferenceMatch(
  assignedTime: string,
  preferredWindow: string,
  alternateWindow: string | null,
  timeWindows: any[],
): boolean {
  const assignedMinutes = parseInt(assignedTime.replace(":", ""));
  const assignedMinutesFromMidnight =
    Math.floor(assignedMinutes / 100) * 60 + (assignedMinutes % 100);

  // Check preferred window
  const preferredWindowInfo = timeWindows.find(
    (w) => w.value === preferredWindow,
  );
  if (
    preferredWindowInfo &&
    assignedMinutesFromMidnight >= preferredWindowInfo.startMinutes &&
    assignedMinutesFromMidnight < preferredWindowInfo.endMinutes
  ) {
    return true;
  }

  // Check alternate window
  if (alternateWindow) {
    const alternateWindowInfo = timeWindows.find(
      (w) => w.value === alternateWindow,
    );
    if (
      alternateWindowInfo &&
      assignedMinutesFromMidnight >= alternateWindowInfo.startMinutes &&
      assignedMinutesFromMidnight < alternateWindowInfo.endMinutes
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Enhanced preference checking that considers restrictions
 * Per club policy: restrictions don't penalize fairness scores
 */
function checkPreferenceMatchWithRestrictions(
  assignedTime: string,
  preferredWindow: string,
  alternateWindow: string | null,
  timeWindows: any[],
  wasBlockedByRestrictions = false,
): boolean {
  // First check if they got their preferred/alternate window
  const preferenceGranted = checkPreferenceMatch(
    assignedTime,
    preferredWindow,
    alternateWindow,
    timeWindows,
  );

  if (preferenceGranted) {
    return true; // Got their window
  }

  // If they didn't get their window BUT it was due to restrictions,
  // treat as preference met (don't penalize for rule violations)
  if (wasBlockedByRestrictions) {
    return true; // Don't penalize for restrictions
  }

  return false; // Only penalize for availability issues
}
