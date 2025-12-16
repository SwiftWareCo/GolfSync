import "server-only";

import { db } from "~/server/db";
import {
  lotteryEntries,
  members,
  teesheets,
  timeBlocks,
  timeblockRestrictions,
} from "~/server/db/schema";
import { eq, and, desc, asc, inArray } from "drizzle-orm";
import type { LotteryEntryData } from "~/server/db/schema/lottery/lottery-entries.schema";

/**
 * Get lottery entry for the authenticated member and specified date
 * Type detection: INDIVIDUAL if memberIds.length === 1
 *                 GROUP if memberIds.length > 1
 *                 GROUP_MEMBER if member is in memberIds but not the organizer
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
      with: {
        memberClass: true,
      },
    });

    if (!member) {
      throw new Error("Member not found");
    }

    // Query consolidated lotteryEntries table
    const entries = await db.query.lotteryEntries.findMany({
      where: eq(lotteryEntries.lotteryDate, lotteryDate),
      with: {
        fills: true,
      },
    });

    // Check for individual entry (memberIds length = 1, single member is the organizer)
    const individualEntry = entries.find(
      (entry) =>
        entry.memberIds.length === 1 &&
        entry.memberIds[0] === member.id &&
        entry.organizerId === member.id,
    );

    if (individualEntry) {
      return { type: "individual", entry: individualEntry };
    }

    // Check for group entry where this member is the organizer
    const groupEntry = entries.find(
      (entry) => entry.organizerId === member.id && entry.memberIds.length > 1,
    );

    if (groupEntry) {
      return { type: "group", entry: groupEntry };
    }

    // Check if member is part of another group
    const groupMemberEntry = entries.find(
      (entry) =>
        entry.memberIds.includes(member.id) &&
        entry.organizerId !== member.id &&
        entry.memberIds.length > 1,
    );

    if (groupMemberEntry) {
      return { type: "group_member", entry: groupMemberEntry };
    }

    return null;
  } catch (error) {
    console.error("Error getting lottery entry data:", error);
    throw error;
  }
}

/**
 * Consolidated function to get all lottery data for a date
 * Returns both stats and entries with full member details
 * @param date YYYY-MM-DD date string
 */
export async function getLotteryDataForDate(date: string) {
  try {
    // Query consolidated lotteryEntries table with organizer + memberClass
    const allEntries = await db.query.lotteryEntries.findMany({
      where: eq(lotteryEntries.lotteryDate, date),
      with: {
        organizer: {
          with: { memberClass: true },
        },
        assignedTimeBlock: true,
        fills: true,
      },
      orderBy: [asc(lotteryEntries.submissionTimestamp)],
    });

    // Separate entries by type
    const individualEntries = allEntries.filter(
      (entry) => entry.memberIds.length === 1,
    );

    const groupEntries = allEntries.filter(
      (entry) => entry.memberIds.length > 1,
    );

    // Collect all unique member IDs from all groups for batch fetch
    const allGroupMemberIds = [
      ...new Set(groupEntries.flatMap((group) => group.memberIds)),
    ];

    // Fetch all members in one query
    const allGroupMembers =
      allGroupMemberIds.length > 0
        ? await db.query.members.findMany({
            where: inArray(members.id, allGroupMemberIds),
            with: {
              memberClass: true,
            },
          })
        : [];

    // Create a map for O(1) lookup
    const memberMap = new Map(allGroupMembers.map((m) => [m.id, m]));

    // Map members to groups
    const groupEntriesWithMembers = groupEntries.map((group) => ({
      ...group,
      members: group.memberIds.map((id) => memberMap.get(id)).filter(Boolean),
    }));

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
    const hasAssignedEntries = allEntries.some(
      (entry) => entry.assignedTimeBlockId,
    );

    let processingStatus: "pending" | "processing" | "completed";
    if (hasAssignedEntries) {
      processingStatus = "completed";
    } else {
      processingStatus = "pending";
    }

    return {
      stats: {
        totalEntries: allEntries.length,
        individualEntries: individualEntries.length,
        groupEntries: groupEntries.length,
        totalPlayers: individualEntries.length + totalGroupPlayers,
        availableSlots,
        processingStatus,
      },
      entries: {
        individual: individualEntries,
        groups: groupEntriesWithMembers,
      },
    };
  } catch (error) {
    console.error("Error getting lottery data:", error);
    throw error;
  }
}


/**
 * Get all lottery entries for a date with member details
 * Queries consolidated table and separates by type (individual vs group)
 * For groups, fetches member details for all members in memberIds array
 */
export async function getLotteryEntriesForDate(date: string) {
  try {
    // Query consolidated lotteryEntries table with organizer + memberClass
    const allEntries = await db.query.lotteryEntries.findMany({
      where: eq(lotteryEntries.lotteryDate, date),
      with: {
        organizer: {
          with: { memberClass: true },
        },
        assignedTimeBlock: true,
        fills: true,
      },
      orderBy: [asc(lotteryEntries.submissionTimestamp)],
    });

    // Separate entries by type
    const individualEntries = allEntries.filter(
      (entry) => entry.memberIds.length === 1,
    );

    const groupEntries = allEntries.filter(
      (entry) => entry.memberIds.length > 1,
    );

    // Collect all unique member IDs from all groups
    const allGroupMemberIds = [
      ...new Set(groupEntries.flatMap((group) => group.memberIds)),
    ];

    // Fetch all members in one query
    const allGroupMembers =
      allGroupMemberIds.length > 0
        ? await db.query.members.findMany({
            where: inArray(members.id, allGroupMemberIds),
            with: {
              memberClass: true,
            },
          })
        : [];

    // Create a map for O(1) lookup
    const memberMap = new Map(allGroupMembers.map((m) => [m.id, m]));

    // Map members to groups
    const groupEntriesWithMembers = groupEntries.map((group) => ({
      ...group,
      members: group.memberIds.map((id) => memberMap.get(id)).filter(Boolean),
    }));

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
