"use server";

import { db } from "~/server/db";
import {
  timeBlockMembers,
  timeBlockGuests,
  timeBlocks,
  paceOfPlay,
  teesheets,
  fills,
  generalCharges,
  timeblockRestrictions,
  lotteryEntries,
  configBlocks,
  type TeesheetConfig,
} from "~/server/db/schema";
import { and, eq, sql, gte, lte, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "~/lib/auth-server";
import { initializePaceOfPlay } from "~/server/pace-of-play/actions";
import { formatDateToYYYYMMDD } from "~/lib/utils";
import { getTimeBlocksForTeesheet } from "~/server/teesheet/data";

type ActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

/**
 * Server action to create or replace time blocks for a teesheet
 * Maps config blocks to teesheet time blocks
 * Only works if all timeblocks are empty (no members, guests, or fills)
 */
export async function replaceTimeBlocks(
  teesheetId: number,
  config: TeesheetConfig,
): Promise<ActionResult> {
  await requireAdmin();
  try {
    // Check if any timeblock has members assigned
    const membersInTimeblocks = await db
      .select({ count: sql`count(*)` })
      .from(timeBlockMembers)
      .innerJoin(timeBlocks, eq(timeBlockMembers.timeBlockId, timeBlocks.id))
      .where(eq(timeBlocks.teesheetId, teesheetId));

    if (
      membersInTimeblocks[0]?.count &&
      parseInt(String(membersInTimeblocks[0].count)) > 0
    ) {
      return {
        success: false,
        error: "Cannot replace timeblocks: existing members are assigned",
      };
    }

    // Check if any timeblock has guests assigned
    const guestsInTimeblocks = await db
      .select({ count: sql`count(*)` })
      .from(timeBlockGuests)
      .innerJoin(timeBlocks, eq(timeBlockGuests.timeBlockId, timeBlocks.id))
      .where(eq(timeBlocks.teesheetId, teesheetId));

    if (
      guestsInTimeblocks[0]?.count &&
      parseInt(String(guestsInTimeblocks[0].count)) > 0
    ) {
      return {
        success: false,
        error: "Cannot replace timeblocks: existing guests are assigned",
      };
    }

    // Check if any timeblock has fills assigned
    const fillsInTimeblocks = await db
      .select({ count: sql`count(*)` })
      .from(fills)
      .innerJoin(timeBlocks, eq(fills.relatedId, timeBlocks.id))
      .where(
        and(
          eq(timeBlocks.teesheetId, teesheetId),
          eq(fills.relatedType, "timeblock"),
        ),
      );

    if (
      fillsInTimeblocks[0]?.count &&
      parseInt(String(fillsInTimeblocks[0].count)) > 0
    ) {
      return {
        success: false,
        error: "Cannot replace timeblocks: existing fills are assigned",
      };
    }

    // All checks passed, delete existing time blocks for this teesheet
    await db.delete(timeBlocks).where(eq(timeBlocks.teesheetId, teesheetId));

    // Fetch all config blocks and create time blocks from them
    const blocks = await db.query.configBlocks.findMany({
      where: eq(configBlocks.configId, config.id!),
      orderBy: [asc(configBlocks.sortOrder)],
    });

    if (!blocks || blocks.length === 0) {
      return {
        success: false,
        error: "Configuration has no blocks defined",
      };
    }

    try {
      // Create time blocks from config blocks
      const timeBlocksData = blocks.map((block, index) => ({
        teesheetId,
        startTime: block.startTime,
        endTime: block.startTime, // End time is same as start time
        maxMembers: block.maxPlayers,
        displayName: block.displayName,
        sortOrder: index,
      }));

      if (timeBlocksData.length > 0) {
        await db.insert(timeBlocks).values(timeBlocksData);
      }

      // Update the teesheet's configId to reflect the new configuration
      await db
        .update(teesheets)
        .set({ configId: config.id })
        .where(eq(teesheets.id, teesheetId));
    } catch (error) {
      return {
        success: false,
        error: "Failed to create time blocks from configuration",
      };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/lottery");
    return { success: true };
  } catch (error) {
    console.error("Error replacing time blocks:", error);
    return {
      success: false,
      error: "Failed to replace time blocks",
    };
  }
}

export async function removeTimeBlockMember(
  timeBlockId: number,
  memberId: number,
): Promise<ActionResult> {
  await requireAdmin();

  try {
    // Delete the time block member
    const result = await db
      .delete(timeBlockMembers)
      .where(
        and(
          eq(timeBlockMembers.timeBlockId, timeBlockId),
          eq(timeBlockMembers.memberId, memberId),
        ),
      )
      .returning();

    if (!result || result.length === 0) {
      return {
        success: false,
        error: "Member not found in time block",
      };
    }

    revalidatePath(`/admin`);
    revalidatePath(`/members/teesheet`);
    return { success: true };
  } catch (error) {
    console.error("Error removing time block member:", error);
    return {
      success: false,
      error: "Failed to remove member from time block",
    };
  }
}

export async function removeTimeBlockGuest(
  timeBlockId: number,
  guestId: number,
): Promise<ActionResult> {
  await requireAdmin();

  try {
    // Delete the time block guest
    const result = await db
      .delete(timeBlockGuests)
      .where(
        and(
          eq(timeBlockGuests.timeBlockId, timeBlockId),
          eq(timeBlockGuests.guestId, guestId),
        ),
      )
      .returning();

    if (!result || result.length === 0) {
      return {
        success: false,
        error: "Guest not found in time block",
      };
    }

    revalidatePath(`/admin`);
    revalidatePath(`/members/teesheet`);
    return { success: true };
  } catch (error) {
    console.error("Error removing time block guest:", error);
    return {
      success: false,
      error: "Failed to remove guest from time block",
    };
  }
}

export async function checkInMember(
  timeBlockId: number,
  memberId: number,
  isCheckedIn: boolean,
): Promise<ActionResult> {
  await requireAdmin();

  try {
    const result = await db
      .update(timeBlockMembers)
      .set({
        checkedIn: isCheckedIn,
        checkedInAt: isCheckedIn ? new Date() : null,
      })
      .where(
        and(
          eq(timeBlockMembers.timeBlockId, timeBlockId),
          eq(timeBlockMembers.memberId, memberId),
        ),
      )
      .returning();

    if (!result || result.length === 0) {
      return {
        success: false,
        error: "Member not found in time block",
      };
    }

    // If checking in, initialize pace of play
    if (isCheckedIn) {
      // Get the pace of play record for this time block
      const existingPaceOfPlay = await db.query.paceOfPlay.findFirst({
        where: eq(paceOfPlay.timeBlockId, timeBlockId),
      });

      // Only initialize pace of play if it hasn't been initialized yet
      if (!existingPaceOfPlay?.startTime) {
        const currentTime = new Date();
        await initializePaceOfPlay(timeBlockId, currentTime);
      }
    }
    return { success: true };
  } catch (error) {
    console.error("Error checking in member:", error);
    return {
      success: false,
      error: "Failed to check in member",
    };
  }
}

export async function checkInGuest(
  timeBlockId: number,
  guestId: number,
  isCheckedIn: boolean,
): Promise<ActionResult> {
  await requireAdmin();

  try {
    // Get guest and time block details
    const guestDetails = await db.query.timeBlockGuests.findFirst({
      where: and(
        eq(timeBlockGuests.timeBlockId, timeBlockId),
        eq(timeBlockGuests.guestId, guestId),
      ),
      with: {
        guest: true,
        timeBlock: {
          with: {
            teesheet: true,
          },
        },
        invitedByMember: true,
      },
    });

    if (!guestDetails) {
      return {
        success: false,
        error: "Guest not found in time block",
      };
    }

    // Update check-in status
    const result = await db
      .update(timeBlockGuests)
      .set({
        checkedIn: isCheckedIn,
        checkedInAt: isCheckedIn ? new Date() : null,
      })
      .where(
        and(
          eq(timeBlockGuests.timeBlockId, timeBlockId),
          eq(timeBlockGuests.guestId, guestId),
        ),
      )
      .returning();

    if (!result || result.length === 0) {
      return {
        success: false,
        error: "Failed to update guest check-in status",
      };
    }

    // If checking in (not out), create a general charge
    if (isCheckedIn && guestDetails.guest && guestDetails.timeBlock?.teesheet) {
      await db.insert(generalCharges).values({
        guestId: guestId,
        sponsorMemberId: guestDetails.invitedByMember?.id,
        date: guestDetails.timeBlock.teesheet.date,
        chargeType: "GUEST_FEE",
        charged: false,
        staffInitials: "AUTO", // Auto-generated charge
      });
    }

    revalidatePath(`/teesheet`);
    return { success: true };
  } catch (error) {
    console.error("Error checking in guest:", error);
    return {
      success: false,
      error: "Failed to check in guest",
    };
  }
}

export async function checkInAllTimeBlockParticipants(
  timeBlockId: number,
  isCheckedIn: boolean,
): Promise<ActionResult> {
  await requireAdmin();

  try {
    // Check in all members
    await db
      .update(timeBlockMembers)
      .set({
        checkedIn: isCheckedIn,
        checkedInAt: isCheckedIn ? new Date() : null,
      })
      .where(eq(timeBlockMembers.timeBlockId, timeBlockId));

    // Check in all guests
    await db
      .update(timeBlockGuests)
      .set({
        checkedIn: isCheckedIn,
        checkedInAt: isCheckedIn ? new Date() : null,
      })
      .where(eq(timeBlockGuests.timeBlockId, timeBlockId));

    // If checking in, initialize pace of play
    if (isCheckedIn) {
      // Get the pace of play record for this time block
      const existingPaceOfPlay = await db.query.paceOfPlay.findFirst({
        where: eq(paceOfPlay.timeBlockId, timeBlockId),
      });

      // Only initialize pace of play if it hasn't been initialized yet
      if (!existingPaceOfPlay?.startTime) {
        const currentTime = new Date();
        await initializePaceOfPlay(timeBlockId, currentTime);
      }
    }

    revalidatePath(`/teesheet`);
    revalidatePath(`/admin/pace-of-play`);
    return { success: true };
  } catch (error) {
    console.error("Error checking in all participants:", error);
    return {
      success: false,
      error: "Failed to check in all participants",
    };
  }
}

export async function updateTimeBlockNotes(
  timeBlockId: number,
  notes: string | null,
): Promise<ActionResult> {
  await requireAdmin();

  try {
    const result = await db
      .update(timeBlocks)
      .set({ notes })
      .where(eq(timeBlocks.id, timeBlockId))
      .returning();

    if (!result || result.length === 0) {
      return {
        success: false,
        error: "Time block not found",
      };
    }

    revalidatePath(`/teesheet`);
    return { success: true };
  } catch (error) {
    console.error("Error updating time block notes:", error);
    return {
      success: false,
      error: "Failed to update time block notes",
    };
  }
}

// DEBUG FUNCTION: Populate timeblocks with random members for testing
export async function populateTimeBlocksWithRandomMembers(
  teesheetId: number,
  date: string,
) {
  await requireAdmin();

  try {
    // Get all members in the organization (exclude RESIGNED, SUSPENDED, DINING)
    const excludedClasses = new Set([
      "RESIGNED",
      "SUSPENDED",
      "DINING",
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
    });

    // Filter out excluded classes in JavaScript
    const allMembers = allMembersRaw.filter(
      (member) => !excludedClasses.has(member.memberClass?.label || ""),
    );

    if (allMembers.length === 0) {
      return { success: false, error: "No members found in organization" };
    }

    // Get all timeblocks for the teesheet
    const teesheetTimeBlocks = await db.query.timeBlocks.findMany({
      where: eq(timeBlocks.teesheetId, teesheetId),
    });

    if (teesheetTimeBlocks.length === 0) {
      return { success: false, error: "No timeblocks found for teesheet" };
    }

    // For each timeblock, add 1-4 random members
    const promises = teesheetTimeBlocks.map(
      async (timeBlock: typeof timeBlocks.$inferSelect) => {
        // Clear existing members first
        await db
          .delete(timeBlockMembers)
          .where(eq(timeBlockMembers.timeBlockId, timeBlock.id));

        // Also clear any existing pace of play records
        await db
          .delete(paceOfPlay)
          .where(eq(paceOfPlay.timeBlockId, timeBlock.id));

        // Randomly decide how many members to add (1-4)
        const numMembersToAdd = Math.floor(Math.random() * 3) + 1; // 1-3 members

        // Shuffle members array to get random members
        const shuffledMembers = [...allMembers].sort(() => 0.5 - Math.random());

        // Select the first N members
        const selectedMembers = shuffledMembers.slice(0, numMembersToAdd);

        // Flag to track if we should initialize pace of play
        const shouldInitializePaceOfPlay = false;
        const checkInTime = new Date();

        // Add each member to the timeblock
        for (const member of selectedMembers) {
          // As requested, set checkedIn and checkedInAt to null
          // Even though it was previously set to be random
          const isCheckedIn = false;

          await db.insert(timeBlockMembers).values({
            timeBlockId: timeBlock.id,
            memberId: member.id,
            bookingDate: date,
            bookingTime: timeBlock.startTime,
            checkedIn: isCheckedIn,
            checkedInAt: null,
          });
        }

        // No need to initialize pace of play since no one is checked in
        // But keep this for when you want to re-enable it
        if (shouldInitializePaceOfPlay) {
          await initializePaceOfPlay(timeBlock.id, checkInTime);

          // For some (20%) timeblocks, also add turn time
          if (Math.random() < 0.2) {
            // Get the pace record we just created
            const paceRecord = await db.query.paceOfPlay.findFirst({
              where: eq(paceOfPlay.timeBlockId, timeBlock.id),
            });

            if (paceRecord) {
              // Add 2 hours +/- 20 minutes to the start time for turn time
              const turnTime = new Date(checkInTime);
              turnTime.setMinutes(
                turnTime.getMinutes() +
                  120 +
                  Math.floor(Math.random() * 40) -
                  20,
              );

              // Update pace of play with turn time
              await db
                .update(paceOfPlay)
                .set({
                  turn9Time: turnTime,
                  lastUpdatedBy: "Debug Populate",
                })
                .where(eq(paceOfPlay.timeBlockId, timeBlock.id));
            }
          }
        }
      },
    );

    await Promise.all(promises);

    return {
      success: true,
      message: `Successfully populated timeblocks with random members`,
    };
  } catch (error) {
    console.error("Error populating timeblocks with random members:", error);
    return {
      success: false,
      error: `Failed to populate timeblocks: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Updates the general notes for a teesheet
 */
export async function updateTeesheetGeneralNotes(
  teesheetId: number,
  generalNotes: string | null,
): Promise<ActionResult> {
  await requireAdmin();

  try {
    const result = await db
      .update(teesheets)
      .set({ generalNotes })
      .where(eq(teesheets.id, teesheetId))
      .returning();

    if (!result || result.length === 0) {
      return {
        success: false,
        error: "Teesheet not found",
      };
    }

    revalidatePath(`/teesheet`);
    revalidatePath(`/admin`);
    return { success: true };
  } catch (error) {
    console.error("Error updating teesheet general notes:", error);
    return {
      success: false,
      error: "Failed to update teesheet general notes",
    };
  }
}

export async function addFillToTimeBlock(
  timeBlockId: number,
  fillType: string,
  count: number,
  customName?: string,
): Promise<ActionResult> {
  await requireAdmin();

  try {
    // Create individual fill records instead of using count
    const fillPromises = Array.from({ length: count }, () =>
      db
        .insert(fills)
        .values({
          relatedType: "timeblock",
          relatedId: timeBlockId,
          fillType,
          customName: customName || null,
        })
        .returning(),
    );

    const results = await Promise.all(fillPromises);

    if (
      !results ||
      results.length === 0 ||
      !results[0] ||
      results[0].length === 0
    ) {
      return {
        success: false,
        error: "Failed to add fills to time block",
      };
    }

    revalidatePath(`/admin`);
    revalidatePath(`/teesheet`);
    return { success: true };
  } catch (error) {
    console.error("Error adding fills to time block:", error);
    return {
      success: false,
      error: "Failed to add fills to time block",
    };
  }
}
export async function removeFillFromTimeBlock(
  timeBlockId: number,
  fillId: number,
): Promise<ActionResult> {
  await requireAdmin();

  try {
    // Delete the fill directly, similar to member removal
    const result = await db
      .delete(fills)
      .where(
        and(
          eq(fills.relatedType, "timeblock"),
          eq(fills.relatedId, timeBlockId),
          eq(fills.id, fillId),
        ),
      )
      .returning();

    if (!result || result.length === 0) {
      return {
        success: false,
        error: "Fill not found in time block",
      };
    }

    revalidatePath(`/admin`);
    revalidatePath(`/teesheet`);
    return { success: true };
  } catch (error) {
    console.error("Error removing fill from time block:", error);
    return {
      success: false,
      error: "Failed to remove fill from time block",
    };
  }
}

/**
 * Swap two timeblocks in the teesheet
 */
export async function swapTimeBlocks(
  teesheetId: number,
  sourceTimeBlockId: number,
  targetTimeBlockId: number,
): Promise<ActionResult> {
  await requireAdmin();

  try {
    // Get both timeblocks
    const sourceBlock = await db.query.timeBlocks.findFirst({
      where: eq(timeBlocks.id, sourceTimeBlockId),
    });
    const targetBlock = await db.query.timeBlocks.findFirst({
      where: eq(timeBlocks.id, targetTimeBlockId),
    });

    if (!sourceBlock || !targetBlock) {
      return { success: false, error: "Timeblocks not found" };
    }

    // Verify both belong to the same teesheet
    if (
      sourceBlock.teesheetId !== teesheetId ||
      targetBlock.teesheetId !== teesheetId
    ) {
      return {
        success: false,
        error: "Timeblocks must belong to the same teesheet",
      };
    }

    // Swap the sortOrder values (without transaction for neon-http compatibility)
    const tempSortOrder = -1; // Temporary value to avoid conflicts

    // Step 1: Set source to temp value
    await db
      .update(timeBlocks)
      .set({ sortOrder: tempSortOrder })
      .where(eq(timeBlocks.id, sourceTimeBlockId));

    // Step 2: Set target to source's original value
    await db
      .update(timeBlocks)
      .set({ sortOrder: sourceBlock.sortOrder || 0 })
      .where(eq(timeBlocks.id, targetTimeBlockId));

    // Step 3: Set source to target's original value
    await db
      .update(timeBlocks)
      .set({ sortOrder: targetBlock.sortOrder || 0 })
      .where(eq(timeBlocks.id, sourceTimeBlockId));

    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    console.error("Error swapping timeblocks:", error);
    return { success: false, error: "Failed to swap timeblocks" };
  }
}

/**
 * Move a timeblock up or down in the sort order
 */
export async function moveTimeBlockPosition(
  teesheetId: number,
  timeBlockId: number,
  direction: "up" | "down",
): Promise<ActionResult> {
  await requireAdmin();

  try {
    // Get all timeblocks for this teesheet ordered by sortOrder
    const allBlocks = await db.query.timeBlocks.findMany({
      where: eq(timeBlocks.teesheetId, teesheetId),
      orderBy: [asc(timeBlocks.sortOrder)],
    });

    const currentIndex = allBlocks.findIndex(
      (block) => block.id === timeBlockId,
    );
    if (currentIndex === -1) {
      return { success: false, error: "Timeblock not found" };
    }

    // Calculate target index
    const targetIndex =
      direction === "up" ? currentIndex - 1 : currentIndex + 1;

    // Check bounds
    if (targetIndex < 0 || targetIndex >= allBlocks.length) {
      return { success: false, error: `Cannot move timeblock ${direction}` };
    }

    // Swap with the target timeblock
    return await swapTimeBlocks(
      teesheetId,
      timeBlockId,
      allBlocks[targetIndex]?.id || 0,
    );
  } catch (error) {
    console.error("Error moving timeblock:", error);
    return { success: false, error: "Failed to move timeblock" };
  }
}

/**
 * Insert a new timeblock between two existing timeblocks
 */
export async function insertTimeBlock(
  teesheetId: number,
  afterTimeBlockId: number,
  newTimeBlockData: {
    startTime: string;
    endTime: string;
    displayName?: string;
    maxMembers?: number;
  },
): Promise<ActionResult> {
  await requireAdmin();

  try {
    // Get the timeblock we're inserting after
    const afterBlock = await db.query.timeBlocks.findFirst({
      where: eq(timeBlocks.id, afterTimeBlockId),
    });

    if (!afterBlock) {
      return { success: false, error: "Reference timeblock not found" };
    }

    // Get all timeblocks for this teesheet ordered by sortOrder
    const allBlocks = await db.query.timeBlocks.findMany({
      where: eq(timeBlocks.teesheetId, teesheetId),
      orderBy: [asc(timeBlocks.sortOrder)],
    });

    const afterIndex = allBlocks.findIndex(
      (block) => block.id === afterTimeBlockId,
    );
    if (afterIndex === -1) {
      return {
        success: false,
        error: "Reference timeblock not found in teesheet",
      };
    }

    // Calculate the new sort order (between current and next) as integer
    const currentSortOrder = allBlocks[afterIndex]?.sortOrder || 0;
    const nextSortOrder =
      afterIndex + 1 < allBlocks.length
        ? allBlocks[afterIndex + 1]?.sortOrder || currentSortOrder + 100
        : currentSortOrder + 100;

    // Ensure we have at least 1 unit of space for integer sortOrder
    let newSortOrder: number;
    if (nextSortOrder - currentSortOrder <= 1) {
      // No space between, so renumber all subsequent blocks
      newSortOrder = currentSortOrder + 50;

      // Update all blocks after this position to make room
      for (let i = afterIndex + 1; i < allBlocks.length; i++) {
        await db
          .update(timeBlocks)
          .set({ sortOrder: allBlocks[i]!.sortOrder! + 100 })
          .where(eq(timeBlocks.id, allBlocks[i]!.id));
      }
    } else {
      // Calculate midpoint as integer
      newSortOrder = Math.floor(
        currentSortOrder + (nextSortOrder - currentSortOrder) / 2,
      );

      // Ensure it's different from currentSortOrder
      if (newSortOrder === currentSortOrder) {
        newSortOrder = currentSortOrder + 1;
      }
    }

    // Insert the new timeblock
    const [newBlock] = await db
      .insert(timeBlocks)
      .values({
        teesheetId,
        startTime: newTimeBlockData.startTime,
        endTime: newTimeBlockData.endTime,
        displayName: newTimeBlockData.displayName,
        maxMembers: newTimeBlockData.maxMembers || 4,
        sortOrder: newSortOrder,
      })
      .returning();

    revalidatePath("/admin");
    return { success: true, data: newBlock };
  } catch (error) {
    console.error("Error inserting timeblock:", error);
    return { success: false, error: "Failed to insert timeblock" };
  }
}

/**
 * Delete a timeblock and all its related data
 */
export async function deleteTimeBlock(
  teesheetId: number,
  timeBlockId: number,
): Promise<ActionResult> {
  await requireAdmin();

  try {
    // Verify the timeblock exists and belongs to the specified teesheet
    const timeBlock = await db.query.timeBlocks.findFirst({
      where: eq(timeBlocks.id, timeBlockId),
    });

    if (!timeBlock) {
      return { success: false, error: "Time block not found" };
    }

    if (timeBlock.teesheetId !== teesheetId) {
      return {
        success: false,
        error: "Time block does not belong to this teesheet",
      };
    }

    // Clear lottery entry references before deleting
    // This prevents orphaned lottery entries pointing to deleted time blocks
    await db
      .update(lotteryEntries)
      .set({ assignedTimeBlockId: null, status: "PENDING" })
      .where(eq(lotteryEntries.assignedTimeBlockId, timeBlockId));

    // Delete the timeblock - cascade will handle related records
    // (timeBlockMembers, timeBlockGuests, paceOfPlay, etc.)
    const result = await db
      .delete(timeBlocks)
      .where(eq(timeBlocks.id, timeBlockId))
      .returning();

    if (!result || result.length === 0) {
      return { success: false, error: "Failed to delete time block" };
    }

    // Revalidate paths to refresh the UI
    revalidatePath("/admin");
    revalidatePath("/admin/lottery");
    revalidatePath("/admin/teesheet");

    return { success: true };
  } catch (error) {
    console.error("Error deleting timeblock:", error);
    return { success: false, error: "Failed to delete time block" };
  }
}

/**
 * Get arrange results data for a teesheet
 */
export async function getArrangeResultsData(
  teesheetId: number,
): Promise<ActionResult> {
  await requireAdmin();

  try {
    const teesheet = await db.query.teesheets.findFirst({
      where: eq(teesheets.id, teesheetId),
    });

    if (!teesheet) {
      return { success: false, error: "Teesheet not found" };
    }

    // Check if lottery has been processed (consolidated schema - single table)
    const hasLotteryEntries = await db.query.lotteryEntries.findFirst({
      where: eq(lotteryEntries.lotteryDate, teesheet.date),
    });

    const lotteryProcessed = !!hasLotteryEntries;

    // Get timeblocks with their assignments
    const timeBlocksWithData = await getTimeBlocksForTeesheet(teesheetId);

    return {
      success: true,
      data: {
        teesheet,
        timeBlocks: timeBlocksWithData,
        lotteryProcessed: !!lotteryProcessed,
        canArrange: !!lotteryProcessed && !teesheet.isPublic,
      },
    };
  } catch (error) {
    console.error("Error getting arrange results data:", error);
    return { success: false, error: "Failed to get arrange results data" };
  }
}
