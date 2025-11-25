import "server-only";

import { db } from "~/server/db";
import {
  lotteryEntries,
  lotteryGroups,
  members,
  teesheets,
  timeBlocks,
  timeblockRestrictions,
} from "~/server/db/schema";
import { eq, and, sql, desc, asc, inArray } from "drizzle-orm";
import type { LotteryEntryData } from "~/app/types/LotteryTypes";

/**
 * Get lottery entry for the authenticated member and specified date
 * @param lotteryDate YYYY-MM-DD date string
 * @returns Lottery entry data or null if none found
 */
export async function getLotteryEntryData(
  lotteryDate: string,
  userId: string,
): Promise<LotteryEntryData> {
  try {

    // Get member data using the external userId from session claims
    const member = await db.query.members.findFirst({
      where: eq(members.id, Number(userId)),
    });

    if (!member) {
      throw new Error("Member not found");
    }

    // Check for individual entry
    const individualEntry = await db.query.lotteryEntries.findFirst({
      where: and(
        eq(lotteryEntries.memberId, member.id),
        eq(lotteryEntries.lotteryDate, lotteryDate),
      ),
    });

    if (individualEntry) {
      return { type: "individual", entry: individualEntry as any };
    }

    // Check for group entry where this member is the leader
    const groupEntry = await db.query.lotteryGroups.findFirst({
      where: and(
        eq(lotteryGroups.leaderId, member.id),
        eq(lotteryGroups.lotteryDate, lotteryDate),
      ),
    });

    if (groupEntry) {
      return { type: "group", entry: groupEntry as any };
    }

    // Check if member is part of another group
    const otherGroupEntry = await db.query.lotteryGroups.findFirst({
      where: eq(lotteryGroups.lotteryDate, lotteryDate),
    });

    if (otherGroupEntry?.memberIds.includes(member.id)) {
      return { type: "group_member", entry: otherGroupEntry as any };
    }

    return null;
  } catch (error) {
    console.error("Error getting lottery entry data:", error);
    throw error;
  }
}

/**
 * Get lottery statistics for a specific date
 * @param date YYYY-MM-DD date string
 */
export async function getLotteryStatsForDate(date: string) {
  try {
    // Get individual entries
    const individualEntries = await db.query.lotteryEntries.findMany({
      where: eq(lotteryEntries.lotteryDate, date),
      with: {
        member: true,
      },
    });

    // Get group entries
    const groupEntries = await db.query.lotteryGroups.findMany({
      where: eq(lotteryGroups.lotteryDate, date),
      with: {
        leader: true,
      },
    });

    // Calculate total players in groups
    const totalGroupPlayers = groupEntries.reduce(
      (sum, group) => sum + group.memberIds.length,
      0,
    );

    // Get available slots for the date
    const teesheet = await db.query.teesheets.findFirst({
      where: eq(teesheets.date, date),
      with: {
        timeBlocks: true,
      },
    });

    const availableSlots =
      teesheet?.timeBlocks.reduce((sum, block) => sum + block.maxMembers, 0) ||
      0;

    // Determine processing status
    const hasProcessedEntries =
      individualEntries.some((entry) => entry.status === "ASSIGNED") ||
      groupEntries.some((group) => group.status === "ASSIGNED");

    const hasAssignedEntries =
      individualEntries.some((entry) => entry.assignedTimeBlockId) ||
      groupEntries.some((group) => group.processedAt);

    let processingStatus: "pending" | "processing" | "completed";
    if (hasAssignedEntries) {
      processingStatus = "completed";
    } else if (hasProcessedEntries) {
      processingStatus = "processing";
    } else {
      processingStatus = "pending";
    }

    return {
      totalEntries: individualEntries.length + groupEntries.length,
      individualEntries: individualEntries.length,
      groupEntries: groupEntries.length,
      totalPlayers: individualEntries.length + totalGroupPlayers,
      availableSlots,
      processingStatus,
      entries: {
        individual: individualEntries,
        groups: groupEntries,
      },
    };
  } catch (error) {
    console.error("Error getting lottery stats:", error);
    throw error;
  }
}

/**
 * Get all lottery entries for a date with member details
 */
export async function getLotteryEntriesForDate(date: string) {
  try {
    const individualEntries = await db.query.lotteryEntries.findMany({
      where: eq(lotteryEntries.lotteryDate, date),
      with: {
        member: true,
        submittedByMember: true,
        assignedTimeBlock: true,
      },
      orderBy: [asc(lotteryEntries.submissionTimestamp)],
    });

    const groupEntries = await db.query.lotteryGroups.findMany({
      where: eq(lotteryGroups.lotteryDate, date),
      with: {
        leader: true,
      },
      orderBy: [asc(lotteryGroups.submissionTimestamp)],
    });

    // For group entries, get member details for all members in the group
    const groupEntriesWithMembers = await Promise.all(
      groupEntries.map(async (group) => {
        const groupMembers = await db.query.members.findMany({
          where: inArray(members.id, group.memberIds),
        });
        return {
          ...group,
          members: groupMembers,
        };
      }),
    );

    return {
      individual: individualEntries,
      groups: groupEntriesWithMembers,
    };
  } catch (error) {
    console.error("Error getting lottery entries for date:", error);
    throw error;
  }
}

/**
 * Get available time blocks for a specific date
 */
export async function getAvailableTimeBlocksForDate(date: string) {
  try {
    const teesheet = await db.query.teesheets.findFirst({
      where: eq(teesheets.date, date),
      with: {
        timeBlocks: {
          with: {
            timeBlockMembers: {
              with: {
                member: true,
              },
            },
            timeBlockGuests: {
              with: {
                guest: true,
                invitedByMember: true,
              },
            },
            fills: true,
          },
          orderBy: [asc(timeBlocks.startTime)],
        },
      },
    });

    if (!teesheet) {
      return [];
    }

    // Calculate available spots for each time block
    const timeBlocksWithAvailability = teesheet.timeBlocks.map((block) => {
      const currentOccupancy =
        block.timeBlockMembers.length +
        block.timeBlockGuests.length +
        block.fills.length;

      const availableSpots = block.maxMembers - currentOccupancy;

      return {
        ...block,
        currentOccupancy,
        availableSpots,
        isAvailable: availableSpots > 0,
      };
    });

    return timeBlocksWithAvailability;
  } catch (error) {
    console.error("Error getting available time blocks:", error);
    throw error;
  }
}

/**
 * Get active time restrictions for lottery processing
 * Only fetches MEMBER_CLASS TIME restrictions that are currently active
 */
export async function getActiveTimeRestrictionsForDate(date: string) {
  try {
    return await db.query.timeblockRestrictions.findMany({
      where: and(
        eq(timeblockRestrictions.restrictionCategory, "MEMBER_CLASS"),
        eq(timeblockRestrictions.restrictionType, "TIME"),
        eq(timeblockRestrictions.isActive, true),
      ),
      orderBy: [desc(timeblockRestrictions.priority)],
    });
  } catch (error) {
    console.error("Error fetching time restrictions:", error);
    return [];
  }
}
