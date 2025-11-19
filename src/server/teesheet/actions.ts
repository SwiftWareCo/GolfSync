"use server";

import { db } from "~/server/db";
import {
  timeBlockMembers,
  timeBlockGuests,
  timeBlocks,
  paceOfPlay,
  members,
  guests,
  teesheets,
  timeBlockFills,
  generalCharges,
  timeblockRestrictions,
  lotteryEntries,
  lotteryGroups,
  templates,
  type TeesheetConfig,
} from "~/server/db/schema";
import { and, eq, sql, gte, lte, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { initializePaceOfPlay } from "~/server/pace-of-play/actions";
import type { FillType, TemplateBlock, ConfigTypes } from "~/app/types/TeeSheetTypes";
import { formatDateToYYYYMMDD } from "~/lib/utils";
import {
  getTeesheetWithTimeBlocks,
  getTimeBlocksForTeesheet,
} from "~/server/teesheet/data";
import { getTeesheetConfigs, getLotterySettings } from "~/server/settings/data";
import { getAllPaceOfPlayForDate } from "~/server/pace-of-play/actions";
import { parseDate } from "~/lib/dates";
import { generateTimeBlocks } from "~/lib/utils";
import { ConfigTypes as ConfigTypesEnum } from "~/app/types/TeeSheetTypes";

type ActionResult = {
  success: boolean;
  error?: string;
  data?: any;
};

type FillActionResult = ActionResult & {
  fill?: typeof timeBlockFills.$inferSelect;
};

type TeesheetDataResult = {
  success: boolean;
  error?: string;
  data?: {
    teesheet: any;
    config: any;
    timeBlocks: any[];
    availableConfigs: any[];
    paceOfPlayData: any[];
    lotterySettings?: any;
    date: string;
  };
};

/**
 * Server action to create or replace time blocks for a teesheet
 * Handles both custom template-based and regular interval-based configurations
 */
export async function replaceTimeBlocks(
  teesheetId: number,
  config: TeesheetConfig,
): Promise<ActionResult> {
  try {
    // First, delete all existing time blocks for this teesheet
    await db
      .delete(timeBlocks)
      .where(eq(timeBlocks.teesheetId, teesheetId));

    // For custom configurations, fetch the template and create blocks based on it
    if (config.type === ConfigTypesEnum.CUSTOM) {
      if (!config.templateId) {
        return {
          success: false,
          error: "Custom configuration missing templateId",
        };
      }

      const template = await db.query.templates.findFirst({
        where: eq(templates.id, config.templateId),
      });

      if (!template) {
        return {
          success: false,
          error: "Template not found",
        };
      }

      try {
        const templateBlocks = template.blocks as TemplateBlock[];

        // Create blocks based on template
        const blocks = templateBlocks.map((block, index) => ({
          teesheetId,
          startTime: block.startTime,
          endTime: block.startTime, // For template blocks, end time is same as start time
          maxMembers: block.maxPlayers,
          displayName: block.displayName,
          sortOrder: index, // Use the index to maintain order
        }));

        if (blocks.length > 0) {
          await db.insert(timeBlocks).values(blocks);
        }
      } catch (error) {
        return {
          success: false,
          error: "Failed to create template blocks",
        };
      }
    } else {
      // For regular configurations, generate blocks based on start time, end time, and interval
      if (
        !config.startTime ||
        !config.endTime ||
        !config.interval
      ) {
        return {
          success: false,
          error:
            "Invalid regular configuration: missing startTime, endTime, or interval",
        };
      }

      const timeBlocksArray = generateTimeBlocks(
        config.startTime,
        config.endTime,
        config.interval,
      );

      const blocksToInsert = timeBlocksArray.map((time, index) => ({
        teesheetId,
        startTime: time,
        endTime: time, // For regular blocks, end time is same as start time
        maxMembers: config.maxMembersPerBlock || 4,
        sortOrder: index,
      }));

      if (blocksToInsert.length > 0) {
        try {
          await db.insert(timeBlocks).values(blocksToInsert);
        } catch (error) {
          return {
            success: false,
            error: "Failed to create regular blocks",
          };
        }
      }
    }

    revalidatePath("/admin");
    revalidatePath("/teesheet");
    return { success: true };
  } catch (error) {
    console.error("Error replacing time blocks:", error);
    return {
      success: false,
      error: "Failed to replace time blocks",
    };
  }
}

/**
 * Server action to fetch teesheet data for client-side navigation
 * This can be called from client components with SWR
 */
export async function getTeesheetDataAction(
  dateString: string,
): Promise<TeesheetDataResult> {
  try {
    // Parse the date string into a Date object (BC timezone)
    const date = parseDate(dateString);

    // Get teesheet data - same logic as the admin page
    const { teesheet, config } = await getTeesheetWithTimeBlocks(date);

    if (!teesheet) {
      return {
        success: false,
        error: "Failed to load teesheet",
      };
    }

    const timeBlocks = await getTimeBlocksForTeesheet(teesheet.id);
    const configsResult = await getTeesheetConfigs();
    const paceOfPlayData = await getAllPaceOfPlayForDate(date);
    const lotterySettings = await getLotterySettings(teesheet.id);

    if (!Array.isArray(configsResult)) {
      return {
        success: false,
        error: "Failed to load configurations",
      };
    }

    // Return the same data structure as the server-side page
    return {
      success: true,
      data: {
        teesheet,
        config,
        timeBlocks,
        availableConfigs: configsResult,
        paceOfPlayData,
        lotterySettings,
        date: date.toISOString(), // Include the date for client-side use
      },
    };
  } catch (error) {
    console.error("Error in getTeesheetDataAction:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to load teesheet data",
    };
  }
}

export async function removeTimeBlockMember(
  timeBlockId: number,
  memberId: number,
): Promise<ActionResult> {
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

    revalidatePath(`/teesheet`);
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

    revalidatePath(`/teesheet`);
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

    // If checking in, handle frequency restrictions and initialize pace of play
    if (isCheckedIn) {
      // Get member details and timeblock info for frequency restriction checking
      const memberBooking = await db.query.timeBlockMembers.findFirst({
        where: and(
          eq(timeBlockMembers.timeBlockId, timeBlockId),
          eq(timeBlockMembers.memberId, memberId),
        ),
        with: {
          member: true,
          timeBlock: {
            with: {
              teesheet: true,
            },
          },
        },
      });

      // Check for frequency violations if member and timeblock exist
      if (memberBooking?.member && memberBooking?.timeBlock?.teesheet) {
        const memberClass = memberBooking.member.class;
        const bookingDate = memberBooking.timeBlock.teesheet.date;

        // Check for active frequency restrictions for this member class
        const frequencyRestrictions =
          await db.query.timeblockRestrictions.findMany({
            where: and(
              eq(timeblockRestrictions.restrictionCategory, "MEMBER_CLASS"),
              eq(timeblockRestrictions.restrictionType, "FREQUENCY"),
              eq(timeblockRestrictions.isActive, true),
              eq(timeblockRestrictions.applyCharge, true),
            ),
          });

        for (const restriction of frequencyRestrictions) {
          // Check if this restriction applies to the member class
          const memberClassesApplies =
            !restriction.memberClasses?.length ||
            restriction.memberClasses?.includes(memberClass);

          if (
            memberClassesApplies &&
            restriction.maxCount &&
            restriction.periodDays
          ) {
            // Calculate the current calendar month range
            const currentDate = new Date(bookingDate);
            const monthStart = new Date(
              currentDate.getFullYear(),
              currentDate.getMonth(),
              1,
            );
            const monthEnd = new Date(
              currentDate.getFullYear(),
              currentDate.getMonth() + 1,
              0,
            );

            const monthStartStr = formatDateToYYYYMMDD(monthStart);
            const monthEndStr = formatDateToYYYYMMDD(monthEnd);

            // Count existing bookings for this member in the current month
            const existingBookings = await db
              .select({ count: sql<number>`cast(count(*) as integer)` })
              .from(timeBlockMembers)
              .where(
                and(
                  eq(timeBlockMembers.memberId, memberId),
                  gte(timeBlockMembers.bookingDate, monthStartStr),
                  lte(timeBlockMembers.bookingDate, monthEndStr),
                ),
              );

            const currentBookingCount = Number(existingBookings[0]?.count || 0);

            // If this check-in exceeds the limit, create a charge
            if (currentBookingCount > restriction.maxCount) {
              await db.insert(generalCharges).values({
                memberId: memberId,
                date: bookingDate,
                chargeType: "FREQUENCY_FEE",
                charged: false,
                staffInitials: "AUTO", // Auto-generated charge from frequency restriction
              });
            }
          }
        }
      }

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
  try {
    // Get all members in the organization (exclude RESIGNED, SUSPENDED, DINING)
    const allMembers = await db.query.members.findMany({
      where: and(
        sql`${members.class} != 'RESIGNED'`,
        sql`${members.class} != 'SUSPENDED'`,
        sql`${members.class} != 'DINING'`,
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
    });

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
            bagNumber: member.bagNumber,
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
  fillType: FillType,
  count: number,
  customName?: string,
): Promise<FillActionResult> {
  try {
    // Create individual fill records instead of using count
    const fillPromises = Array.from({ length: count }, () =>
      db
        .insert(timeBlockFills)
        .values({
          timeBlockId,
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

    revalidatePath(`/teesheet`);
    return { success: true, fill: results[0][0] };
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
  try {
    // Delete the fill directly, similar to member removal
    const result = await db
      .delete(timeBlockFills)
      .where(
        and(
          eq(timeBlockFills.timeBlockId, timeBlockId),
          eq(timeBlockFills.id, fillId),
        ),
      )
      .returning();

    if (!result || result.length === 0) {
      return {
        success: false,
        error: "Fill not found in time block",
      };
    }

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
  try {
    const teesheet = await db.query.teesheets.findFirst({
      where: eq(teesheets.id, teesheetId),
    });

    if (!teesheet) {
      return { success: false, error: "Teesheet not found" };
    }

    // Check if lottery has been processed
    const hasLotteryEntries = await db.query.lotteryEntries.findFirst({
      where: eq(lotteryEntries.lotteryDate, teesheet.date),
    });

    const hasLotteryGroups = await db.query.lotteryGroups.findFirst({
      where: eq(lotteryGroups.lotteryDate, teesheet.date),
    });

    const lotteryProcessed = hasLotteryEntries || hasLotteryGroups;

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
