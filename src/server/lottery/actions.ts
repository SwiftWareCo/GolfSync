"use server";

import { db } from "~/server/db";
import {
  lotteryEntries,
  fills,
  members,
  timeBlockMembers,
  memberFairnessScores,
  timeBlocks,
  memberSpeedProfiles,
  TeesheetConfigWithBlocks,
} from "~/server/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { DynamicTimeWindowInfo } from "~/lib/lottery-utils";
import type { LotteryFormInput } from "~/server/db/schema/lottery/lottery-entries.schema";
import type { TimeblockRestriction } from "~/server/db/schema/restrictions/restrictions.schema";
import {
  calculateDynamicTimeWindows,
  getWindowPosition,
} from "~/lib/lottery-utils";
import { checkLotteryRestrictions } from "~/server/timeblock-restrictions/lottery-restrictions";

// Action result type for consistent return types
type ActionResult = { success: boolean; error?: string; data?: unknown };

/**
 * Submit a lottery entry (individual or group based on memberIds)
 * Consolidated schema: INDIVIDUAL if memberIds.length === 1
 *                      GROUP if memberIds.length > 1
 * organizerId is ALWAYS set to the entry creator
 */
export async function submitLotteryEntry(
  userId: number,
  data: LotteryFormInput,
): Promise<{ success: boolean; error?: string; data?: any }> {
  // Get member data
  const member = await db.query.members.findFirst({
    where: eq(members.id, userId),
  });

  if (!member) {
    return { success: false, error: "Member not found" };
  }

  // Always construct memberIds with organizer first, then additional members
  const allMemberIds = [member.id, ...(data.memberIds || [])];

  // Check if ANY member already has an entry for this date
  const existingEntries = await db.query.lotteryEntries.findMany({
    where: eq(lotteryEntries.lotteryDate, data.lotteryDate),
  });

  // Validate: No member in allMemberIds can already have an entry on this date
  for (const memberId of allMemberIds) {
    const memberHasEntry = existingEntries.some((entry) =>
      entry.memberIds.includes(memberId),
    );
    if (memberHasEntry) {
      // Find member details for error message
      const conflictingMember = await db.query.members.findFirst({
        where: eq(members.id, memberId),
      });
      const memberName = conflictingMember
        ? `${conflictingMember.firstName} ${conflictingMember.lastName}`
        : `Member #${memberId}`;
      return {
        success: false,
        error: `${memberName} already has a lottery entry for this date`,
      };
    }
  }

  // Validate all member IDs exist
  const memberIds = await db.query.members.findMany({
    where: inArray(members.id, allMemberIds),
  });
  if (memberIds.length !== allMemberIds.length) {
    return {
      success: false,
      error: "One or more members in the group do not exist",
    };
  }

  // Check lottery restrictions before allowing submission
  const restrictionCheck = await checkLotteryRestrictions(
    member.id,
    member.classId,
    data.lotteryDate,
  );

  if (restrictionCheck.hasViolations) {
    return {
      success: false,
      error: restrictionCheck.preferredReason || "Lottery entry limit exceeded",
    };
  }

  // Create lottery entry - organizerId is ALWAYS set to the creator
  const entryData = {
    memberIds: allMemberIds,
    organizerId: member.id, // Always set - the entry creator
    lotteryDate: data.lotteryDate,
    preferredWindow: data.preferredWindow,
    alternateWindow: data.alternateWindow || null,
    status: "PENDING" as const,
  };

  const [newEntry] = await db
    .insert(lotteryEntries)
    .values(entryData)
    .returning();

  // Insert fills if provided (for both individual and group entries)
  if (data.fills && data.fills.length > 0 && newEntry) {
    await db.insert(fills).values(
      data.fills.map((fill) => ({
        relatedType: "lottery_entry" as const,
        relatedId: newEntry.id,
        fillType: fill.fillType,
        customName: fill.customName || null,
      })),
    );
  }

  return { success: true, data: newEntry };
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
 * Update a group lottery entry (admin action - consolidated schema)
 * Can update memberIds, preferredWindow, and alternateWindow
 */
export async function updateLotteryGroupAdmin(
  entryId: number,
  data: {
    preferredWindow: string;
    alternateWindow?: string;
    memberIds: number[];
  },
): Promise<ActionResult> {
  try {
    // Verify the entry exists and is a group
    const entry = await db.query.lotteryEntries.findFirst({
      where: eq(lotteryEntries.id, entryId),
    });

    if (!entry) {
      return {
        success: false,
        error: "Lottery entry not found",
      };
    }

    // Verify it's a group (memberIds.length > 1)
    if (entry.memberIds.length <= 1) {
      return {
        success: false,
        error: "This is not a group entry",
      };
    }

    // Validate that memberIds includes the organizer
    if (!data.memberIds.includes(entry.organizerId)) {
      return {
        success: false,
        error: "Group organizer must be included in member list",
      };
    }

    // Validate all member IDs exist
    const memberIds = await db.query.members.findMany({
      where: inArray(members.id, data.memberIds),
    });
    if (memberIds.length !== data.memberIds.length) {
      return {
        success: false,
        error: "One or more members in the group do not exist",
      };
    }

    // Update the entry
    const [updatedEntry] = await db
      .update(lotteryEntries)
      .set({
        preferredWindow: data.preferredWindow,
        alternateWindow: data.alternateWindow || null,
        memberIds: data.memberIds,
        updatedAt: new Date(),
      })
      .where(eq(lotteryEntries.id, entryId))
      .returning();

    revalidatePath("/admin/lottery");
    return { success: true, data: updatedEntry };
  } catch (error) {
    console.error("Error updating lottery group (admin):", error);
    return { success: false, error: "Failed to update lottery group" };
  }
}

// ADMIN FUNCTIONS

/**
 * Cancel a lottery entry (admin action - consolidated schema)
 */
export async function cancelLotteryEntry(
  entryId: number,
): Promise<ActionResult> {
  try {
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
  } catch (error) {
    console.error("Error canceling lottery entry:", error);
    return { success: false, error: "Failed to cancel lottery entry" };
  }
}

/**
 * Calculate fairness score for a lottery entry based on fairness, speed, and admin adjustments
 * Uses organizerId (entry creator) consistently for all entries
 * NOTE: Now accepts pre-fetched Maps and configured speedBonuses to eliminate N+1 queries
 */
function calculateFairnessScore(
  entry: { organizerId: number; preferredWindow: string },
  timeWindows: DynamicTimeWindowInfo[],
  fairnessMap: Map<number, typeof memberFairnessScores.$inferSelect>,
  speedMap: Map<number, typeof memberSpeedProfiles.$inferSelect>,
  speedBonuses: Array<{
    position: string;
    fastBonus: number;
    averageBonus: number;
    slowBonus: number;
  }>,
): number {
  let fairnessScore = 0;

  // Get the member ID: always use organizerId (the entry creator)
  const memberId = entry.organizerId;

  // 1. Base fairness score (0-100, higher = more priority)
  const fairnessData = fairnessMap.get(memberId);

  if (fairnessData) {
    fairnessScore += fairnessData.fairnessScore || 0;
  }

  // 2. Speed bonus based on window position (position-based bonuses)
  const speedData = speedMap.get(memberId);

  if (speedData && entry.preferredWindow) {
    // Parse window index from string (e.g., "0", "1", "2")
    const windowIndex = parseInt(entry.preferredWindow, 10);

    if (!isNaN(windowIndex)) {
      // Get position category based on window index relative to total windows
      const position = getWindowPosition(windowIndex, timeWindows.length);
      const speedBonus = speedBonuses.find(
        (bonus) => bonus.position === position,
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
  }

  // 3. Admin priority adjustment (-20 to +20)
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
  config: TeesheetConfigWithBlocks,
): Promise<ActionResult> {
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
    const memberInserts: Array<{
      timeBlockId: number;
      memberId: number;
      bookingDate: string;
      bookingTime: string;
    }> = [];

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

    // Batch fetch all member IDs from entries to eliminate N+1 queries
    const allMemberIds = [
      ...entries.individual.map((e) => e.organizerId),
      ...entries.groups.map((g) => g.organizerId),
    ];

    // Batch fetch all fairness scores in one query
    const allFairnessScores = await db.query.memberFairnessScores.findMany({
      where: inArray(memberFairnessScores.memberId, allMemberIds),
    });

    // Batch fetch all speed profiles in one query
    const allSpeedProfiles = await db.query.memberSpeedProfiles.findMany({
      where: inArray(memberSpeedProfiles.memberId, allMemberIds),
    });

    // Create maps for O(1) lookup
    const fairnessMap = new Map(allFairnessScores.map((f) => [f.memberId, f]));
    const speedMap = new Map(allSpeedProfiles.map((s) => [s.memberId, s]));

    // Fetch algorithm config for speed bonuses (using configured values, not hardcoded)
    const { getAlgorithmConfig } = await import(
      "~/server/lottery/algorithm-config-data"
    );
    const algorithmConfig = await getAlgorithmConfig();

    // Calculate fairness scores for all entries (now synchronous with Maps)
    const individualEntriesWithPriority = entries.individual.map((entry) => {
      const priority = calculateFairnessScore(
        entry,
        timeWindows,
        fairnessMap,
        speedMap,
        algorithmConfig.speedBonuses,
      );
      return { ...entry, fairnessScore: priority };
    });

    const groupEntriesWithPriority = entries.groups.map((group) => {
      const priority = calculateFairnessScore(
        group,
        timeWindows,
        fairnessMap,
        speedMap,
        algorithmConfig.speedBonuses,
      );
      return { ...group, fairnessScore: priority };
    });

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
            {
              memberId: member?.id as number,
              memberClassId: member?.memberClass?.id ?? 0,
            },
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
          group.preferredWindow,
          group.alternateWindow,
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
          .update(lotteryEntries)
          .set({
            status: "ASSIGNED",
            assignedTimeBlockId: suitableBlock.id,
            processedAt: now,
            updatedAt: now,
          })
          .where(eq(lotteryEntries.id, group.id));

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

      // For individual entries, the member is the only one in memberIds
      const individualMemberId = entry.memberIds[0];
      if (!individualMemberId) continue;

      const memberData = await db.query.members.findFirst({
        where: eq(members.id, individualMemberId),
        with: {
          memberClass: true,
        },
      });

      if (!memberData) continue;

      // Find available block that matches preferences
      const suitableResult = findSuitableTimeBlock(
        availableBlocksOnly,
        entry.preferredWindow,
        entry.alternateWindow,
        config,
        {
          memberId: individualMemberId,
          memberClassId: memberData.memberClass?.id ?? 0,
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

        // Create timeBlockMembers record (use the individual member ID)
        memberInserts.push({
          timeBlockId: suitableResult.block.id,
          memberId: individualMemberId,
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

    // Note: Fairness scores are no longer updated automatically
    // They must be assigned manually via assignFairnessScoresForDate after manual adjustments

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
 * Filter timeblocks by member class TIME restrictions
 */
function filterBlocksByRestrictions(
  blocks: Array<{ id: number; startTime: string; availableSpots: number }>,
  memberInfo: { memberId: number; memberClassId: number },
  bookingDate: string,
  timeRestrictions: TimeblockRestriction[],
): Array<{ id: number; startTime: string; availableSpots: number }> {
  return blocks.filter((block) => {
    // Check each time restriction
    for (const restriction of timeRestrictions) {
      if (restriction.restrictionCategory !== "MEMBER_CLASS") continue;
      if (restriction.restrictionType !== "TIME") continue;
      if (!restriction.isActive) continue;

      // Check if restriction applies to this member class
      const appliesToMemberClass =
        !restriction.memberClassIds?.length ||
        restriction.memberClassIds.includes(memberInfo.memberClassId);

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
          const startDateStr = restriction.startDate;
          const endDateStr = restriction.endDate;
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
 * @param preferredWindowIndexStr - Window index as string (e.g., "0", "1", "2")
 * @param alternateWindowIndexStr - Alternate window index as string, or null
 */
function findBlockInWindow(
  availableBlocks: Array<{
    id: number;
    startTime: string;
    availableSpots: number;
  }>,
  preferredWindowIndexStr: string,
  alternateWindowIndexStr: string | null,
  config: TeesheetConfigWithBlocks,
): { id: number; startTime: string; availableSpots: number } | null {
  // Try preferred window
  const preferredMatch = availableBlocks.find(
    (block) =>
      matchesTimePreference(block, preferredWindowIndexStr, null, config) &&
      block.availableSpots > 0,
  );
  if (preferredMatch) return preferredMatch;

  // Then try alternate window
  if (alternateWindowIndexStr) {
    const alternateMatch = availableBlocks.find(
      (block) =>
        matchesTimePreference(block, alternateWindowIndexStr, null, config) &&
        block.availableSpots > 0,
    );
    if (alternateMatch) return alternateMatch;
  }

  return null;
}

/**
 * Helper function to find suitable time block based on preferences
 * IMPORTANT: Does NOT violate restrictions - will return null rather than assign to restricted slot
 * @param preferredWindowIndexStr - Window index as string (e.g., "0", "1", "2")
 * @param alternateWindowIndexStr - Alternate window index as string, or null
 */
function findSuitableTimeBlock(
  availableBlocks: Array<{
    id: number;
    startTime: string;
    availableSpots: number;
  }>,
  preferredWindowIndexStr: string,
  alternateWindowIndexStr: string | null,
  config: TeesheetConfigWithBlocks,
  memberInfo: { memberId: number; memberClassId: number },
  bookingDate: string,
  timeRestrictions: TimeblockRestriction[],
): {
  block: { id: number; startTime: string; availableSpots: number } | null;
  wasBlockedByRestrictions: boolean;
} {
  // First try with all blocks (no restriction filtering) to detect if restrictions affect choice
  const unrestrictedBlock = findBlockInWindow(
    availableBlocks,
    preferredWindowIndexStr,
    alternateWindowIndexStr,
    config,
  );

  // Then filter by restrictions - this is what we'll actually use
  const allowedBlocks = filterBlocksByRestrictions(
    availableBlocks,
    memberInfo,
    bookingDate,
    timeRestrictions,
  );
  const restrictedBlock = findBlockInWindow(
    allowedBlocks,
    preferredWindowIndexStr,
    alternateWindowIndexStr,
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

  // Last resort: try to find any available block in ALLOWED blocks only
  const anyAllowedBlock = allowedBlocks.find(
    (block) => block.availableSpots > 0,
  );
  if (anyAllowedBlock) {
    return { block: anyAllowedBlock, wasBlockedByRestrictions: true };
  }

  // NO FALLBACK TO RESTRICTED SLOTS
  // If no allowed block exists, member cannot be assigned
  // This prevents junior members being placed in restricted morning slots
  if (unrestrictedBlock) {
    console.log(
      `⚠️ Member ${memberInfo.memberId} blocked by restrictions - cannot be assigned to ${unrestrictedBlock.startTime}`,
    );
  }

  // No suitable block found within allowed restrictions
  return { block: null, wasBlockedByRestrictions: true };
}

/**
 * Helper function to check if a time block matches time preferences using dynamic windows
 * @param windowIndexStr - Window index as string (e.g., "0", "1", "2")
 * @param alternateWindowIndexStr - Alternate window index as string, or null
 */
function matchesTimePreference(
  block: { startTime: string },
  windowIndexStr: string,
  alternateWindowIndexStr: string | null,
  config: TeesheetConfigWithBlocks,
): boolean {
  // Get dynamic time windows from config
  const dynamicWindows = calculateDynamicTimeWindows(config);
  const blockTime = parseInt(block.startTime.replace(":", ""));

  // Convert block time to minutes from midnight for comparison
  const blockMinutes = Math.floor(blockTime / 100) * 60 + (blockTime % 100);

  // Parse preferred window index
  const windowIndex = parseInt(windowIndexStr, 10);

  // Check preferred window
  const preferredWindowInfo = dynamicWindows.find(
    (w) => w.index === windowIndex,
  );
  if (
    preferredWindowInfo &&
    blockMinutes >= preferredWindowInfo.startMinutes &&
    blockMinutes < preferredWindowInfo.endMinutes
  ) {
    return true;
  }

  // Check alternate window
  if (alternateWindowIndexStr) {
    const alternateIndex = parseInt(alternateWindowIndexStr, 10);
    const alternateWindowInfo = dynamicWindows.find(
      (w) => w.index === alternateIndex,
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
    const excludedClasses = new Set([
      "RESIGNED",
      "SUSPENDED",
      "DINING",
      "STAFF",
      "STAFF PLAY",
      "MANAGEMENT",
      "MGMT / PRO",
      "HONORARY MALE",
      "HONORARY FEMALE",
      "PRIVILEGED MALE",
      "PRIVILEGED FEMALE",
      "SENIOR RETIRED MALE",
      "SENIOR RETIRED FEMALE",
      "LEAVE OF ABSENCE",
    ]);

    const allMembersRaw = await db.query.members.findMany({
      with: { memberClass: true },
      limit: 200, // Get more members for realistic data
    });

    // Filter out excluded classes in JavaScript
    const allMembers = allMembersRaw.filter(
      (member) => !excludedClasses.has(member.memberClass?.label || ""),
    );

    if (allMembers.length < 20) {
      return {
        success: false,
        error: "Need at least 20 members to create realistic test entries",
      };
    }

    const testEntries: any[] = [];

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
    // Uses window indexes: "0" (early), "1" (mid), "2" (late)
    const getTimePreference = () => {
      const rand = Math.random();
      let preferredWindow = "0"; // Early/morning
      let alternateWindow: string | null = null;

      if (rand < 0.6) {
        // 60% want high-demand early times (creates conflicts)
        preferredWindow = "0";
        alternateWindow = Math.random() > 0.5 ? "1" : null;
      } else if (rand < 0.8) {
        // 20% want medium-demand times
        preferredWindow = Math.random() > 0.5 ? "0" : "1";
        alternateWindow = preferredWindow === "0" ? "1" : "2";
      } else {
        // 20% want later times (easier to accommodate)
        preferredWindow = Math.random() > 0.5 ? "1" : "2";
        alternateWindow = "2";
      }

      return { preferredWindow, alternateWindow };
    };

    // Create 4-player groups
    console.log(`🏌️‍♂️ Creating ${targetFourGroups} 4-player groups...`);
    let groupCount = 0;
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

      testEntries.push({
        organizerId: leader.id,
        memberIds: groupMembers,
        lotteryDate: date,
        preferredWindow,
        alternateWindow,
        status: "PENDING",
      });

      groupCount++;
      memberIndex += 4;
    }
    console.log(
      `✅ Created ${groupCount} 4-player groups, memberIndex now: ${memberIndex}`,
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

      testEntries.push({
        organizerId: leader.id,
        memberIds: groupMembers,
        lotteryDate: date,
        preferredWindow,
        alternateWindow,
        status: "PENDING",
      });

      groupCount++;
      memberIndex += 3;
    }
    console.log(
      `✅ Total groups after 3-player: ${groupCount}, memberIndex now: ${memberIndex}`,
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

      testEntries.push({
        organizerId: leader.id,
        memberIds: groupMembers,
        lotteryDate: date,
        preferredWindow,
        alternateWindow,
        status: "PENDING",
      });

      groupCount++;
      memberIndex += 2;
    }
    console.log(
      `✅ Total groups after 2-player: ${groupCount}, memberIndex now: ${memberIndex}`,
    );

    // Create individual entries
    console.log(`🏌️‍♂️ Creating ${targetIndividualEntries} individual entries...`);
    let individualCount = 0;
    for (
      let i = 0;
      i < targetIndividualEntries && memberIndex < shuffledMembers.length;
      i++
    ) {
      const member = shuffledMembers[memberIndex]!;
      const { preferredWindow, alternateWindow } = getTimePreference();

      testEntries.push({
        memberIds: [member.id],
        organizerId: member.id,
        lotteryDate: date,
        preferredWindow,
        alternateWindow,
        status: "PENDING",
      });

      individualCount++;
      memberIndex++;
    }
    console.log(
      `✅ Created ${individualCount} individual entries, memberIndex now: ${memberIndex}`,
    );

    // Insert all test entries (consolidated schema - both individual and group in same table)
    let totalCreated = 0;

    if (testEntries.length > 0) {
      const results = await db
        .insert(lotteryEntries)
        .values(testEntries)
        .returning();
      totalCreated = results.length;
    }

    const totalPlayers = testEntries.reduce(
      (sum, entry) => sum + entry.memberIds.length,
      0,
    );
    const createdGroups = groupCount;
    const createdIndividuals = individualCount;

    // Final summary
    const foursomeCount = testEntries.filter(
      (e) => e.memberIds.length === 4,
    ).length;
    const threesomeCount = testEntries.filter(
      (e) => e.memberIds.length === 3,
    ).length;
    const pairCount = testEntries.filter(
      (e) => e.memberIds.length === 2,
    ).length;

    console.log(`🎯 Test data creation complete!`);
    console.log(
      `📊 Final results: ${createdGroups} groups + ${createdIndividuals} individuals = ${totalCreated} total entries`,
    );
    console.log(`👥 Total players: ${totalPlayers}`);
    console.log(
      `📈 Breakdown: ${foursomeCount} foursomes, ${threesomeCount} threesomes, ${pairCount} pairs`,
    );

    revalidatePath("/admin/lottery");
    return {
      success: true,
      data: {
        createdIndividuals,
        createdGroups,
        totalPlayers,
        message: `Created realistic test data matching CSV patterns: ${createdGroups} groups (${foursomeCount} foursomes, ${threesomeCount} threesomes, ${pairCount} pairs) + ${createdIndividuals} individuals = ${totalCreated} total entries with ${totalPlayers} players.`,
      },
    };
  } catch (error) {
    console.error("Error creating test lottery entries:", error);
    return { success: false, error: "Failed to create test lottery entries" };
  }
}

/**
 * Clear all lottery entries for a date (debug function - consolidated schema)
 */
export async function clearLotteryEntriesForDate(
  date: string,
): Promise<ActionResult> {
  try {
    // Get all entries for the date to delete related fills
    const entriesToDelete = await db.query.lotteryEntries.findMany({
      where: eq(lotteryEntries.lotteryDate, date),
    });

    // Delete fills for these entries
    if (entriesToDelete.length > 0) {
      const entryIds = entriesToDelete.map((e) => e.id);
      await db
        .delete(fills)
        .where(
          and(
            eq(fills.relatedType, "lottery_entry"),
            inArray(fills.relatedId, entryIds),
          ),
        );
    }

    // Delete entries
    const deletedEntries = await db
      .delete(lotteryEntries)
      .where(eq(lotteryEntries.lotteryDate, date))
      .returning();

    revalidatePath("/admin/lottery");
    return {
      success: true,
      data: {
        deletedEntries: deletedEntries.length,
      },
    };
  } catch (error) {
    console.error("Error clearing lottery entries:", error);
    return { success: false, error: "Failed to clear lottery entries" };
  }
}

/**
 * [TESTING ONLY] Import legacy lottery entries from old app format
 * Used for migrating data from the legacy teesheet system
 */
export async function importLegacyLotteryEntries(
  lotteryDate: string,
  entries: Array<{
    memberIds: number[];
    organizerId: number;
    lotteryDate: string;
    preferredWindow: string; // Window index as string (e.g., "0", "1", "2")
    alternateWindow: string | null; // Window index as string, or null
    status: "PENDING" | "ASSIGNED" | "CANCELLED";
    submissionTimestamp: Date;
  }>,
): Promise<ActionResult> {
  try {
    if (entries.length === 0) {
      return { success: false, error: "No entries to import" };
    }

    let importedCount = 0;
    const failedEntries: string[] = [];

    for (const entry of entries) {
      try {
        // Validate that all member IDs exist
        const memberIds = await db.query.members.findMany({
          where: inArray(members.id, entry.memberIds),
        });

        if (memberIds.length !== entry.memberIds.length) {
          failedEntries.push(
            `Entry with organizer ${entry.organizerId}: Some members not found`,
          );
          continue;
        }

        // Check if any member already has an entry for this date
        const existingEntries = await db.query.lotteryEntries.findMany({
          where: eq(lotteryEntries.lotteryDate, lotteryDate),
        });

        const conflictingMember = entry.memberIds.find((memberId) =>
          existingEntries.some((e) => e.memberIds.includes(memberId)),
        );

        if (conflictingMember) {
          const member = memberIds.find((m) => m.id === conflictingMember);
          const memberName = member
            ? `${member.firstName} ${member.lastName}`
            : `Member #${conflictingMember}`;
          failedEntries.push(
            `${memberName} already has an entry for this date`,
          );
          continue;
        }

        // Create the lottery entry
        await db.insert(lotteryEntries).values({
          memberIds: entry.memberIds,
          organizerId: entry.organizerId,
          lotteryDate: entry.lotteryDate,
          preferredWindow: entry.preferredWindow,
          alternateWindow: entry.alternateWindow,
          status: entry.status,
          submissionTimestamp: entry.submissionTimestamp,
        });

        importedCount++;
      } catch (entryError) {
        failedEntries.push(
          `Entry with organizer ${entry.organizerId}: ${entryError instanceof Error ? entryError.message : String(entryError)}`,
        );
      }
    }

    revalidatePath("/admin/lottery");
    revalidatePath(`/admin/lottery/${lotteryDate}`);

    return {
      success: true,
      data: {
        importedCount,
        totalAttempted: entries.length,
        failedEntries,
      },
    };
  } catch (error) {
    console.error("Error importing legacy lottery entries:", error);
    return { success: false, error: "Failed to import legacy lottery entries" };
  }
}

/**
 * Batch update lottery assignments (save all client-side changes at once - consolidated schema)
 * This function actually moves the timeBlockMembers records, not just updates assignedTimeBlockId
 */
export async function batchUpdateLotteryAssignments(
  changes: {
    entryId: number;
    assignedTimeBlockId: number | null;
  }[],
): Promise<ActionResult> {
  try {
    // Process all entry assignment changes
    for (const change of changes) {
      // Get the entry details
      const entry = await db.query.lotteryEntries.findFirst({
        where: eq(lotteryEntries.id, change.entryId),
      });

      if (!entry) {
        console.error(`Entry ${change.entryId} not found`);
        continue;
      }

      // Remove existing timeBlockMembers for all members in this entry
      if (entry.memberIds && entry.memberIds.length > 0) {
        await db
          .delete(timeBlockMembers)
          .where(
            and(
              inArray(timeBlockMembers.memberId, entry.memberIds),
              eq(timeBlockMembers.bookingDate, entry.lotteryDate),
            ),
          );
      }

      // If assigning to a new time block, create new timeBlockMembers records
      if (
        change.assignedTimeBlockId &&
        entry.memberIds &&
        entry.memberIds.length > 0
      ) {
        const timeBlock = await db.query.timeBlocks.findFirst({
          where: eq(timeBlocks.id, change.assignedTimeBlockId),
        });

        if (timeBlock) {
          const memberInserts = entry.memberIds.map((memberId) => ({
            timeBlockId: change.assignedTimeBlockId!,
            memberId: memberId,
            bookingDate: entry.lotteryDate,
            bookingTime: timeBlock.startTime,
          }));

          await db.insert(timeBlockMembers).values(memberInserts);
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

    revalidatePath("/admin/lottery");
    revalidatePath("/admin/teesheet"); // Also revalidate teesheet since we moved actual bookings
    return { success: true };
  } catch (error) {
    console.error("Error batch updating lottery assignments:", error);
    return { success: false, error: "Failed to save changes" };
  }
}

/**
 * Assign fairness scores for lottery entries (manual action)
 * Only counts preferred and alternate window assignments as "granted"
 * Fallback assignments (outside preferred/alternate) are NOT counted as granted
 * Restrictions only exempt if the assigned time is within preferred/alternate windows
 */
export async function assignFairnessScoresForDate(
  date: string,
  config: TeesheetConfigWithBlocks,
): Promise<ActionResult> {
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
        // For individual entries, memberId is the first (and only) element in memberIds
        const memberId = entry.memberIds[0];
        if (!memberId) continue;

        // Get the assigned time block details
        const assignedTimeBlock = await db.query.timeBlocks.findFirst({
          where: eq(timeBlocks.id, entry.assignedTimeBlockId),
        });

        if (!assignedTimeBlock) continue;

        // Check if they got their preferred window, considering restrictions
        // Determine if this assignment was affected by restrictions
        // Get member details for restriction checking
        const member = await db.query.members.findFirst({
          where: eq(members.id, memberId),
          with: {
            memberClass: true,
          },
        });

        if (!member) continue;

        const memberInfo = {
          memberId: member.id,
          memberClassId: member.memberClass?.id ?? 0,
        };

        // First check if assigned time is in preferred/alternate windows
        const assignedTimeInPreferredOrAlternate = checkPreferenceMatch(
          assignedTimeBlock.startTime,
          entry.preferredWindow,
          entry.alternateWindow,
          timeWindows,
        );

        // Only check restriction exemption if assigned time is in preferred/alternate windows
        // Fallback assignments (outside preferred/alternate) should NEVER be exempted
        let wasBlockedByRestrictions = false;
        if (assignedTimeInPreferredOrAlternate) {
          // Get all available blocks for this date to check if restrictions blocked preferred/alternate windows
          const { getAvailableTimeBlocksForDate } = await import(
            "~/server/lottery/data"
          );
          const allAvailableBlocks = await getAvailableTimeBlocksForDate(date);
          const availableBlocksOnly = allAvailableBlocks.filter(
            (block) => block.availableSpots > 0,
          );

          // Check if there were blocks in preferred/alternate windows that were blocked by restrictions
          const blocksInPreferredOrAlternate = availableBlocksOnly.filter(
            (block) =>
              matchesTimePreference(
                block,
                entry.preferredWindow,
                entry.alternateWindow,
                config,
              ),
          );

          const allowedBlocksInPreferredOrAlternate =
            filterBlocksByRestrictions(
              blocksInPreferredOrAlternate,
              memberInfo,
              date,
              timeRestrictions,
            );

          // If there were blocks in preferred/alternate windows but restrictions blocked them,
          // and the assigned time is in preferred/alternate, then restrictions affected the assignment
          wasBlockedByRestrictions =
            blocksInPreferredOrAlternate.length > 0 &&
            allowedBlocksInPreferredOrAlternate.length === 0;
        }

        // Use the fixed logic: only exempt if assigned time is in preferred/alternate AND restrictions blocked those windows
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
          // Raw fulfillment rate for storage
          const newFulfillmentRate = newPreferencesGranted / newTotalEntries;
          // Bayesian dampened rate for fairness calculation (prevents harsh 0% for new members)
          // Formula: (granted + 1) / (total + 2) - starts at 50%, converges to actual rate
          const dampenedFulfillmentRate =
            (newPreferencesGranted + 1) / (newTotalEntries + 2);
          const newDaysWithoutGood = preferenceGranted
            ? 0
            : existingScore.daysWithoutGoodTime + 1;

          // Calculate new fairness score using dampened rate (higher = more priority needed)
          let newFairnessScore = 0;
          if (dampenedFulfillmentRate < 0.5) {
            // Less than 50% dampened fulfillment
            newFairnessScore += 20;
          } else if (dampenedFulfillmentRate < 0.7) {
            // Less than 70% dampened fulfillment
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
          // Bayesian dampened: 0/1 = 33%, 1/1 = 66% (much gentler for new members)
          const dampenedRate = (preferenceGranted ? 2 : 1) / 3;
          const daysWithoutGood = preferenceGranted ? 0 : 1;
          // Use dampened rate for fairness score calculation
          let fairnessScore = 0;
          if (dampenedRate < 0.5) {
            fairnessScore = 10; // Base score for not getting preference (but dampened)
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

    // Update scores for ALL group members (not just organizer)
    for (const group of entries.groups) {
      if (group.status === "ASSIGNED" && group.assignedTimeBlockId) {
        // Get the assigned time block details
        const assignedTimeBlock = await db.query.timeBlocks.findFirst({
          where: eq(timeBlocks.id, group.assignedTimeBlockId),
        });

        if (!assignedTimeBlock) continue;

        // First check if assigned time is in preferred/alternate windows
        const assignedTimeInPreferredOrAlternate = checkPreferenceMatch(
          assignedTimeBlock.startTime,
          group.preferredWindow,
          group.alternateWindow,
          timeWindows,
        );

        // Only check restriction exemption if assigned time is in preferred/alternate windows
        // Fallback assignments (outside preferred/alternate) should NEVER be exempted
        let wasBlockedByRestrictions = false;
        if (assignedTimeInPreferredOrAlternate) {
          // Get all available blocks for this date to check if restrictions blocked preferred/alternate windows
          const { getAvailableTimeBlocksForDate } = await import(
            "~/server/lottery/data"
          );
          const allAvailableBlocks = await getAvailableTimeBlocksForDate(date);
          const availableBlocksOnly = allAvailableBlocks.filter(
            (block) => block.availableSpots > 0,
          );

          // Get all group members to check restrictions
          const groupMembers = await db.query.members.findMany({
            where: inArray(members.id, group.memberIds),
            with: {
              memberClass: true,
            },
          });

          // Check if there were blocks in preferred/alternate windows that were blocked by restrictions for ANY member
          const blocksInPreferredOrAlternate = availableBlocksOnly.filter(
            (block) =>
              matchesTimePreference(
                block,
                group.preferredWindow,
                group.alternateWindow,
                config,
              ),
          );

          // Check if restrictions blocked preferred/alternate windows for any group member
          wasBlockedByRestrictions = groupMembers.some((member) => {
            const memberAllowedBlocks = filterBlocksByRestrictions(
              blocksInPreferredOrAlternate,
              {
                memberId: member.id,
                memberClassId: member.memberClass?.id ?? 0,
              },
              date,
              timeRestrictions,
            );
            // If there were blocks in preferred/alternate but restrictions blocked them all
            return (
              blocksInPreferredOrAlternate.length > 0 &&
              memberAllowedBlocks.length === 0
            );
          });
        }

        // Use the fixed logic: only exempt if assigned time is in preferred/alternate AND restrictions blocked those windows
        const preferenceGranted = checkPreferenceMatchWithRestrictions(
          assignedTimeBlock.startTime,
          group.preferredWindow,
          group.alternateWindow,
          timeWindows,
          wasBlockedByRestrictions,
        );

        // Update fairness score for ALL group members (not just organizer)
        for (const memberId of group.memberIds) {
          const existingScore = await db.query.memberFairnessScores.findFirst({
            where: and(
              eq(memberFairnessScores.memberId, memberId),
              eq(memberFairnessScores.currentMonth, currentMonth),
            ),
          });

          if (existingScore) {
            const newTotalEntries = existingScore.totalEntriesMonth + 1;
            const newPreferencesGranted =
              existingScore.preferencesGrantedMonth +
              (preferenceGranted ? 1 : 0);
            // Raw fulfillment rate for storage
            const newFulfillmentRate = newPreferencesGranted / newTotalEntries;
            // Bayesian dampened rate for fairness calculation
            const dampenedFulfillmentRate =
              (newPreferencesGranted + 1) / (newTotalEntries + 2);
            const newDaysWithoutGood = preferenceGranted
              ? 0
              : existingScore.daysWithoutGoodTime + 1;

            let newFairnessScore = 0;
            if (dampenedFulfillmentRate < 0.5) {
              newFairnessScore += 20;
            } else if (dampenedFulfillmentRate < 0.7) {
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
            // Bayesian dampened: 0/1 = 33%, 1/1 = 66%
            const dampenedRate = (preferenceGranted ? 2 : 1) / 3;
            const daysWithoutGood = preferenceGranted ? 0 : 1;
            let fairnessScore = 0;
            if (dampenedRate < 0.5) {
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
    }
    revalidatePath("/admin/lottery");
    return {
      success: true,
      data: { message: "Fairness scores assigned successfully" },
    };
  } catch (error) {
    console.error("Error assigning fairness scores:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to assign fairness scores",
    };
  }
}

/**
 * Check if an assigned time matches member's preferences
 * @param preferredWindow - Window index as string (e.g., "0", "1", "2")
 * @param alternateWindow - Alternate window index as string, or null
 */
function checkPreferenceMatch(
  assignedTime: string,
  preferredWindow: string,
  alternateWindow: string | null,
  timeWindows: DynamicTimeWindowInfo[],
): boolean {
  const assignedMinutes = parseInt(assignedTime.replace(":", ""));
  const assignedMinutesFromMidnight =
    Math.floor(assignedMinutes / 100) * 60 + (assignedMinutes % 100);

  // Parse preferred window index
  const preferredIndex = parseInt(preferredWindow, 10);

  // Check preferred window
  const preferredWindowInfo = timeWindows.find(
    (w) => w.index === preferredIndex,
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
    const alternateIndex = parseInt(alternateWindow, 10);
    const alternateWindowInfo = timeWindows.find(
      (w) => w.index === alternateIndex,
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
  timeWindows: DynamicTimeWindowInfo[],
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
