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
  lotteryEntries,
  configBlocks,
  type TeesheetConfig,
} from "~/server/db/schema";
import { and, eq, sql, asc, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "~/lib/auth-server";
import { initializePaceOfPlay } from "~/server/pace-of-play/actions";
import { formatDateToYYYYMMDD } from "~/lib/utils";
import { getTimeBlocksForTeesheet } from "~/server/teesheet/data";

type ActionResult = {
  success: boolean;
  error?: string;
  data?: Record<string, unknown>;
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
        error: `Failed to create time blocks from configuration: ${error instanceof Error ? error.message : String(error)}`,
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
    // First, check if this member booked anyone else in the timeblock
    const membersBookedByThisMember = await db.query.timeBlockMembers.findMany({
      where: and(
        eq(timeBlockMembers.timeBlockId, timeBlockId),
        eq(timeBlockMembers.bookedByMemberId, memberId),
      ),
    });

    // If this member booked others, set their bookedByMemberId to null (admin)
    if (membersBookedByThisMember.length > 0) {
      await db
        .update(timeBlockMembers)
        .set({ bookedByMemberId: null })
        .where(
          and(
            eq(timeBlockMembers.timeBlockId, timeBlockId),
            eq(timeBlockMembers.bookedByMemberId, memberId),
          ),
        );
    }

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

    // Check if any checked-in players remain in the timeblock
    const remainingMembers = await db
      .select({ id: timeBlockMembers.memberId })
      .from(timeBlockMembers)
      .where(
        and(
          eq(timeBlockMembers.timeBlockId, timeBlockId),
          eq(timeBlockMembers.checkedIn, true),
        ),
      );

    const remainingGuests = await db
      .select({ id: timeBlockGuests.guestId })
      .from(timeBlockGuests)
      .where(
        and(
          eq(timeBlockGuests.timeBlockId, timeBlockId),
          eq(timeBlockGuests.checkedIn, true),
        ),
      );

    // If no checked-in players remain, uninitialize pace of play
    if (remainingMembers.length === 0 && remainingGuests.length === 0) {
      await db
        .update(paceOfPlay)
        .set({ startTime: null })
        .where(eq(paceOfPlay.timeBlockId, timeBlockId));
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

    // Check if any checked-in players remain in the timeblock
    const remainingMembers = await db
      .select({ id: timeBlockMembers.memberId })
      .from(timeBlockMembers)
      .where(
        and(
          eq(timeBlockMembers.timeBlockId, timeBlockId),
          eq(timeBlockMembers.checkedIn, true),
        ),
      );

    const remainingGuests = await db
      .select({ id: timeBlockGuests.guestId })
      .from(timeBlockGuests)
      .where(
        and(
          eq(timeBlockGuests.timeBlockId, timeBlockId),
          eq(timeBlockGuests.checkedIn, true),
        ),
      );

    // If no checked-in players remain, uninitialize pace of play
    if (remainingMembers.length === 0 && remainingGuests.length === 0) {
      await db
        .update(paceOfPlay)
        .set({ startTime: null })
        .where(eq(paceOfPlay.timeBlockId, timeBlockId));
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

    // If checking in, initialize pace of play (same as member check-in)
    if (isCheckedIn) {
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
    // Step 1: Insert the new timeblock with temporary sortOrder
    const [newBlock] = await db
      .insert(timeBlocks)
      .values({
        teesheetId,
        startTime: newTimeBlockData.startTime,
        endTime: newTimeBlockData.endTime,
        displayName: newTimeBlockData.displayName,
        maxMembers: newTimeBlockData.maxMembers || 4,
        sortOrder: 0, // Temporary, will be fixed below
      })
      .returning();

    // Step 2: Fetch ALL blocks ordered by startTime and renumber them
    const allBlocks = await db.query.timeBlocks.findMany({
      where: eq(timeBlocks.teesheetId, teesheetId),
      orderBy: [asc(timeBlocks.startTime)],
    });

    // Step 3: Update sortOrder for all blocks based on time order
    for (let i = 0; i < allBlocks.length; i++) {
      await db
        .update(timeBlocks)
        .set({ sortOrder: i })
        .where(eq(timeBlocks.id, allBlocks[i]!.id));
    }

    revalidatePath("/admin");
    revalidatePath("/admin/lottery");
    revalidatePath("/admin/arrange");
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

/**
 * Helper function to add minutes to a time string (HH:MM format)
 */
function addMinutesToTime(time: string, minutes: number): string {
  const [hours, mins] = time.split(":").map(Number);
  const totalMinutes = (hours || 0) * 60 + (mins || 0) + minutes;
  const newHours = Math.floor(totalMinutes / 60);
  const newMins = totalMinutes % 60;
  return `${newHours.toString().padStart(2, "0")}:${newMins.toString().padStart(2, "0")}`;
}

/**
 * Apply a frost delay to all timeblocks in a teesheet
 * Shifts all start/end times forward by the specified minutes
 */
export async function applyFrostDelay(
  teesheetId: number,
  delayMinutes: number,
): Promise<ActionResult> {
  await requireAdmin();

  try {
    // Validate delay is positive and reasonable (max 3 hours)
    if (delayMinutes <= 0 || delayMinutes > 180) {
      return {
        success: false,
        error: "Delay must be between 1 and 180 minutes",
      };
    }

    // Get all timeblocks for this teesheet ordered by sortOrder
    const allBlocks = await db.query.timeBlocks.findMany({
      where: eq(timeBlocks.teesheetId, teesheetId),
      orderBy: [asc(timeBlocks.sortOrder)],
    });

    if (allBlocks.length === 0) {
      return { success: false, error: "No timeblocks found for this teesheet" };
    }

    // Check if delay would push last timeblock past 8 PM (20:00)
    const MAX_END_TIME_MINUTES = 20 * 60; // 8 PM in minutes
    const lastBlock = allBlocks[allBlocks.length - 1];
    if (lastBlock) {
      const [lastHours, lastMins] = lastBlock.startTime.split(":").map(Number);
      const lastTimeMinutes = (lastHours || 0) * 60 + (lastMins || 0);
      const newLastTimeMinutes = lastTimeMinutes + delayMinutes;

      if (newLastTimeMinutes > MAX_END_TIME_MINUTES) {
        return {
          success: false,
          error: `Cannot apply ${delayMinutes} minute delay - would push last tee time past 8:00 PM`,
        };
      }
    }

    // Update all timeblocks with shifted times
    for (const block of allBlocks) {
      const newStartTime = addMinutesToTime(block.startTime, delayMinutes);
      const newEndTime = addMinutesToTime(block.endTime, delayMinutes);

      await db
        .update(timeBlocks)
        .set({ startTime: newStartTime, endTime: newEndTime })
        .where(eq(timeBlocks.id, block.id));
    }

    revalidatePath("/admin");
    revalidatePath("/admin/arrange");
    return {
      success: true,
      data: { blocksUpdated: allBlocks.length, delayMinutes },
    };
  } catch (error) {
    console.error("Error applying frost delay:", error);
    return { success: false, error: "Failed to apply frost delay" };
  }
}

/**
 * Batch move/swap players between timeblocks
 * Used by the arrange page to save all pending changes at once
 */
export async function batchMoveChanges(
  teesheetId: number,
  changes: Array<{
    playerId: number;
    playerType: "member" | "guest" | "fill";
    sourceTimeBlockId: number;
    targetTimeBlockId: number;
    invitedByMemberId?: number; // Required for guests
    fillType?: string; // Required for fills
    fillCustomName?: string | null; // Optional for fills
  }>,
): Promise<ActionResult> {
  await requireAdmin();

  try {
    // Verify teesheet exists
    const teesheet = await db.query.teesheets.findFirst({
      where: eq(teesheets.id, teesheetId),
    });

    if (!teesheet) {
      return { success: false, error: "Teesheet not found" };
    }

    const bookingDate = formatDateToYYYYMMDD(teesheet.date);
    let successCount = 0;

    for (const change of changes) {
      try {
        if (change.playerType === "member") {
          const existingMember = await db.query.timeBlockMembers.findFirst({
            where: and(
              eq(timeBlockMembers.timeBlockId, change.sourceTimeBlockId),
              eq(timeBlockMembers.memberId, change.playerId),
            ),
          });

          // Remove from source timeblock
          await db
            .delete(timeBlockMembers)
            .where(
              and(
                eq(timeBlockMembers.timeBlockId, change.sourceTimeBlockId),
                eq(timeBlockMembers.memberId, change.playerId),
              ),
            );

          // Get target timeblock for booking time
          const targetBlock = await db.query.timeBlocks.findFirst({
            where: eq(timeBlocks.id, change.targetTimeBlockId),
          });

            if (targetBlock) {
              // Add to target timeblock
              await db.insert(timeBlockMembers).values({
                timeBlockId: change.targetTimeBlockId,
                memberId: change.playerId,
                bookingDate,
                bookingTime: targetBlock.startTime,
                bookedByMemberId: existingMember?.bookedByMemberId ?? null,
                checkedIn: existingMember?.checkedIn ?? false,
                checkedInAt: existingMember?.checkedInAt ?? null,
              });
              successCount++;
            }
          } else if (change.playerType === "guest") {
            const existingGuest = await db.query.timeBlockGuests.findFirst({
              where: and(
                eq(timeBlockGuests.timeBlockId, change.sourceTimeBlockId),
                eq(timeBlockGuests.guestId, change.playerId),
              ),
            });
            const invitedByMemberId =
              change.invitedByMemberId ??
              existingGuest?.invitedByMemberId ??
              -1;

          // Remove from source timeblock
          await db
            .delete(timeBlockGuests)
            .where(
              and(
                eq(timeBlockGuests.timeBlockId, change.sourceTimeBlockId),
                eq(timeBlockGuests.guestId, change.playerId),
              ),
            );

          // Get target timeblock for booking time
          const targetBlock = await db.query.timeBlocks.findFirst({
            where: eq(timeBlocks.id, change.targetTimeBlockId),
          });

            if (targetBlock) {
              // Add to target timeblock
              await db.insert(timeBlockGuests).values({
                timeBlockId: change.targetTimeBlockId,
                guestId: change.playerId,
                invitedByMemberId,
                bookingDate,
                bookingTime: targetBlock.startTime,
                checkedIn: existingGuest?.checkedIn ?? false,
                checkedInAt: existingGuest?.checkedInAt ?? null,
              });
              successCount++;
            }
        } else if (change.playerType === "fill") {
          // Get fill metadata from existing record if not provided
          let fillType = change.fillType;
          let fillCustomName = change.fillCustomName;

          if (!fillType) {
            const existingFill = await db.query.fills.findFirst({
              where: and(
                eq(fills.relatedType, "timeblock"),
                eq(fills.relatedId, change.sourceTimeBlockId),
                eq(fills.id, change.playerId),
              ),
            });
            fillType = existingFill?.fillType || "unknown";
            fillCustomName = existingFill?.customName ?? null;
          }

          // Remove fill from source timeblock
          await db
            .delete(fills)
            .where(
              and(
                eq(fills.relatedType, "timeblock"),
                eq(fills.relatedId, change.sourceTimeBlockId),
                eq(fills.id, change.playerId),
              ),
            );

          // Recreate fill in target timeblock
          await db.insert(fills).values({
            relatedType: "timeblock",
            relatedId: change.targetTimeBlockId,
            fillType,
            customName: fillCustomName || null,
          });

          successCount++;
        }
      } catch (changeError) {
        console.error(
          `Error processing change for ${change.playerType} ${change.playerId}:`,
          changeError,
        );
        // Continue processing other changes even if one fails
      }
    }

    revalidatePath("/admin");
    revalidatePath("/admin/arrange");
    revalidatePath("/members/teesheet");

    return {
      success: true,
      data: { successCount, totalChanges: changes.length },
    };
  } catch (error) {
    console.error("Error in batch move changes:", error);
    return { success: false, error: "Failed to save changes" };
  }
}

/**
 * Update who booked a member in a timeblock (admin only)
 */
export async function updateMemberBookedBy(
  timeBlockId: number,
  memberId: number,
  bookedByMemberId: number | null,
): Promise<ActionResult> {
  await requireAdmin();

  try {
    const result = await db
      .update(timeBlockMembers)
      .set({ bookedByMemberId })
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
        error: "Booking not found",
      };
    }

    revalidatePath("/admin/teesheet");
    return { success: true };
  } catch (error) {
    console.error("Error updating booked by:", error);
    return {
      success: false,
      error: "Failed to update booked by",
    };
  }
}

/**
 * Set all members' bookedByMemberId to null (admin) in a timeblock
 * Used when the original booker removes themselves from the party
 */
export async function updateAllBookedByToAdmin(
  timeBlockId: number,
): Promise<ActionResult> {
  try {
    // Update all members in this timeblock to have null bookedByMemberId
    await db
      .update(timeBlockMembers)
      .set({ bookedByMemberId: null })
      .where(eq(timeBlockMembers.timeBlockId, timeBlockId));

    revalidatePath("/members/teesheet");
    return { success: true };
  } catch (error) {
    console.error("Error updating all booked by to admin:", error);
    return {
      success: false,
      error: "Failed to update bookings",
    };
  }
}

/**
 * Replace a range of time blocks with new blocks and remap players
 * Used for frost delay block remapping feature
 */
export async function replaceTimeBlockRange(
  teesheetId: number,
  startBlockId: number,
  endBlockId: number,
  replacementBlocks: Array<{
    startTime: string;
    maxMembers: number;
    displayName?: string;
    mappedPlayers: Array<{
      playerId: number;
      playerType: "member" | "guest" | "fill";
      invitedByMemberId?: number;
      fillType?: string;
      fillCustomName?: string | null;
    }>;
  }>,
): Promise<ActionResult> {
  await requireAdmin();

  try {
    // 1. Get teesheet for booking date
    const teesheet = await db.query.teesheets.findFirst({
      where: eq(teesheets.id, teesheetId),
    });
    if (!teesheet) {
      return { success: false, error: "Teesheet not found" };
    }
    const bookingDate = formatDateToYYYYMMDD(teesheet.date);

    // 2. Get all blocks for the teesheet to find range
    const allBlocks = await db.query.timeBlocks.findMany({
      where: eq(timeBlocks.teesheetId, teesheetId),
      orderBy: [asc(timeBlocks.sortOrder), asc(timeBlocks.startTime)],
    });

    const startIdx = allBlocks.findIndex((b) => b.id === startBlockId);
    const endIdx = allBlocks.findIndex((b) => b.id === endBlockId);

    if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) {
      return { success: false, error: "Invalid block range" };
    }

    const blocksToDelete = allBlocks.slice(startIdx, endIdx + 1);
    const blockIdsToDelete = blocksToDelete.map((b) => b.id);

    // 3. Fetch fills before deletion (they will cascade delete)
    const fillsToMigrate = await db.query.fills.findMany({
      where: and(
        eq(fills.relatedType, "timeblock"),
        inArray(fills.relatedId, blockIdsToDelete),
      ),
    });

    // 4. Clear lottery entry references for blocks being deleted
    for (const blockId of blockIdsToDelete) {
      await db
        .update(lotteryEntries)
        .set({ assignedTimeBlockId: null, status: "PENDING" })
        .where(eq(lotteryEntries.assignedTimeBlockId, blockId));
    }

    // 5. Delete old blocks (cascade handles members, guests, pace of play, fills)
    for (const blockId of blockIdsToDelete) {
      await db.delete(timeBlocks).where(eq(timeBlocks.id, blockId));
    }

    // 6. Create new blocks and map players
    const baseSortOrder = allBlocks[startIdx]?.sortOrder ?? startIdx;
    const createdBlocks: { id: number; startTime: string }[] = [];

    for (let i = 0; i < replacementBlocks.length; i++) {
      const newBlockData = replacementBlocks[i]!;

      // Insert new block
      const [newBlock] = await db
        .insert(timeBlocks)
        .values({
          teesheetId,
          startTime: newBlockData.startTime,
          endTime: newBlockData.startTime,
          maxMembers: newBlockData.maxMembers,
          displayName: newBlockData.displayName,
          sortOrder: baseSortOrder + i,
        })
        .returning();

      if (!newBlock) continue;
      createdBlocks.push({ id: newBlock.id, startTime: newBlock.startTime });

      // Add mapped players
      for (const player of newBlockData.mappedPlayers) {
        if (player.playerType === "member") {
          await db.insert(timeBlockMembers).values({
            timeBlockId: newBlock.id,
            memberId: player.playerId,
            bookingDate,
            bookingTime: newBlock.startTime,
          });
        } else if (player.playerType === "guest") {
          await db.insert(timeBlockGuests).values({
            timeBlockId: newBlock.id,
            guestId: player.playerId,
            invitedByMemberId: player.invitedByMemberId ?? -1,
            bookingDate,
            bookingTime: newBlock.startTime,
          });
        } else if (player.playerType === "fill") {
          await db.insert(fills).values({
            relatedType: "timeblock",
            relatedId: newBlock.id,
            fillType: player.fillType || "unknown",
            customName: player.fillCustomName || null,
          });
        }
      }
    }

    // 7. Fills are now mapped explicitly via mappedPlayers (removed proportional migration)

    // 8. Re-number all block sort orders
    const updatedBlocks = await db.query.timeBlocks.findMany({
      where: eq(timeBlocks.teesheetId, teesheetId),
      orderBy: [asc(timeBlocks.startTime)],
    });

    for (let i = 0; i < updatedBlocks.length; i++) {
      await db
        .update(timeBlocks)
        .set({ sortOrder: i })
        .where(eq(timeBlocks.id, updatedBlocks[i]!.id));
    }

    revalidatePath("/admin");
    revalidatePath("/admin/arrange");

    return {
      success: true,
      data: {
        deletedBlocks: blockIdsToDelete.length,
        createdBlocks: createdBlocks.length,
        migratedFills: fillsToMigrate.length,
      },
    };
  } catch (error) {
    console.error("Error replacing time block range:", error);
    return { success: false, error: "Failed to replace time blocks" };
  }
}
