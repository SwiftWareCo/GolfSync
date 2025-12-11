"use server";

import { revalidatePath } from "next/cache";

import {
  getPaceOfPlayByTimeBlockId,

  upsertPaceOfPlay,
  type PaceOfPlayInsert,
  getMemberPaceOfPlayHistory,
} from "./data";
import { db } from "../db";
import {  eq } from "drizzle-orm";
import {
  timeBlocks,

  memberSpeedProfiles,
} from "../db/schema";
import { getAlgorithmConfig } from "~/server/lottery/algorithm-config-data";
import {
  calculatePaceStatus,
  mapPaceStatusToDbStatus,
} from "~/lib/pace-helpers";
import { parseDateTime, getDateForDB } from "~/lib/dates";

// Constants for round validation
const MIN_ROUND_MINUTES = 180; // 3 hours
const MAX_ROUND_MINUTES = 360; // 6 hours

// Constants for turn time validation
const MIN_TURN_MINUTES = 60; // 1 hour minimum to reach turn
const MAX_TURN_MINUTES = 240; // 4 hours maximum to reach turn

// Constants for expected pace durations in minutes
const EXPECTED_TURN_DURATION = 120; // 2 hours to reach the turn
const EXPECTED_FINISH_DURATION = 240; // 4 hours to complete the round

// Helper function to calculate expected times
function calculateExpectedTimes(startTime: Date) {
  const expectedTurn9Time = new Date(startTime);
  expectedTurn9Time.setMinutes(
    expectedTurn9Time.getMinutes() + EXPECTED_TURN_DURATION,
  );

  const expectedFinishTime = new Date(startTime);
  expectedFinishTime.setMinutes(
    expectedFinishTime.getMinutes() + EXPECTED_FINISH_DURATION,
  );

  return {
    expectedStartTime: startTime,
    expectedTurn9Time,
    expectedFinishTime,
  };
}

// Define pace status type based on schema varchar field
type PaceStatus =
  | "pending"
  | "on_time"
  | "behind"
  | "ahead"
  | "completed"
  | "completed_on_time"
  | "completed_early"
  | "completed_late";

// Helper to determine pace of play status
// DEPRECATED: Use calculatePaceStatus and mapPaceStatusToDbStatus instead
// Keeping for reference if needed during refactor, but should be removed
// function determinePaceStatus(...)

// Initialize pace of play when a group starts
export async function initializePaceOfPlay(
  timeBlockId: number,
  startTime: Date,
) {
  // Get the timeblock to get the actual scheduled tee time
  const timeBlockRes = await db
    .select({
      startTime: timeBlocks.startTime,
    })
    .from(timeBlocks)
    .where(eq(timeBlocks.id, timeBlockId));

  // Get scheduled tee time as string (e.g. "11:45")
  const scheduledTeeTimeStr = timeBlockRes[0]?.startTime || "";

  // Create a proper date object from the tee time
  let teeTimeDate = startTime; // Default to check-in time

  if (scheduledTeeTimeStr) {
    try {
      // Get today's date in YYYY-MM-DD format (BC timezone)
      const todayBC = getDateForDB(startTime);

      // Parse the tee time in BC timezone
      teeTimeDate = parseDateTime(todayBC, scheduledTeeTimeStr);
    } catch (error) {
      console.error("Error parsing tee time:", error);
    }
  }

  const { expectedStartTime, expectedTurn9Time, expectedFinishTime } =
    calculateExpectedTimes(teeTimeDate);

  const paceData: Partial<PaceOfPlayInsert> = {
    startTime, // This is the actual check-in time
    expectedStartTime: teeTimeDate, // This is when they were scheduled to tee off
    expectedTurn9Time,
    expectedFinishTime,
    status: "on_time",
    lastUpdatedBy: "system",
  };

  await upsertPaceOfPlay(timeBlockId, paceData);
  revalidatePath("/admin/pace-of-play");
  return { success: true };
}

// Update turn time (9th hole) for a group
export async function updateTurnTime(
  timeBlockId: number,
  turn9Time: Date,
  updatedBy: string,
  notes?: string,
): Promise<{ success: boolean; error?: string }> {
  const currentPace = await getPaceOfPlayByTimeBlockId(timeBlockId);
  if (!currentPace) {
    return { success: false, error: "Pace of play record not found" };
  }

  if (!currentPace.startTime) {
    return { success: false, error: "Start time not recorded" };
  }

  // Validate turn time is realistic
  const startTime = new Date(currentPace.startTime);
  const turnDurationMinutes = Math.floor(
    (turn9Time.getTime() - startTime.getTime()) / (1000 * 60),
  );

  if (turnDurationMinutes < MIN_TURN_MINUTES) {
    return {
      success: false,
      error: `Turn time too early (${turnDurationMinutes} min from start). Minimum is ${MIN_TURN_MINUTES} minutes.`,
    };
  }

  if (turnDurationMinutes > MAX_TURN_MINUTES) {
    return {
      success: false,
      error: `Turn time too late (${turnDurationMinutes} min from start). Maximum is ${MAX_TURN_MINUTES} minutes.`,
    };
  }

  // Calculate status using unified logic
  const tempPace = { ...currentPace, turn9Time };
  const clientStatus = calculatePaceStatus(tempPace);
  const status = mapPaceStatusToDbStatus(clientStatus);

  const paceData: Partial<PaceOfPlayInsert> = {
    turn9Time,
    status,
    lastUpdatedBy: updatedBy,
    notes: notes || currentPace.notes,
  };

  await upsertPaceOfPlay(timeBlockId, paceData);
  revalidatePath("/admin/pace-of-play");
  revalidatePath("/admin/pace-of-play/turn");
  return { success: true };
}

// Update finish time (18th hole) for a group
export async function updateFinishTime(
  timeBlockId: number,
  finishTime: Date,
  updatedBy: string,
  notes?: string,
): Promise<{ success: boolean; error?: string }> {
  const currentPace = await getPaceOfPlayByTimeBlockId(timeBlockId);
  if (!currentPace) {
    return { success: false, error: "Pace of play record not found" };
  }

  if (!currentPace.startTime) {
    return { success: false, error: "Start time not recorded" };
  }

  // Validate finish time is realistic
  const startTime = new Date(currentPace.startTime);
  const roundDurationMinutes = Math.floor(
    (finishTime.getTime() - startTime.getTime()) / (1000 * 60),
  );

  if (roundDurationMinutes < MIN_ROUND_MINUTES) {
    return {
      success: false,
      error: `Finish time too early (${roundDurationMinutes} min from start). Minimum is ${MIN_ROUND_MINUTES} minutes (3 hours).`,
    };
  }

  if (roundDurationMinutes > MAX_ROUND_MINUTES) {
    return {
      success: false,
      error: `Finish time too late (${roundDurationMinutes} min from start). Maximum is ${MAX_ROUND_MINUTES} minutes (6 hours).`,
    };
  }

  // Calculate status using unified logic
  const tempPace = { ...currentPace, finishTime };
  const clientStatus = calculatePaceStatus(tempPace);
  const status = mapPaceStatusToDbStatus(clientStatus, true);

  // If notes aren't provided, use turn notes if available, or fall back to existing notes
  const updateNotes =
    notes ||
    (currentPace.turn9Time && currentPace.notes ? currentPace.notes : null);

  const paceData: Partial<PaceOfPlayInsert> = {
    finishTime,
    status,
    lastUpdatedBy: updatedBy,
    notes: updateNotes,
  };

  await upsertPaceOfPlay(timeBlockId, paceData);

  // Update member speed profiles after completing a round (already validated above)
  await updateMemberSpeedProfiles(timeBlockId, startTime, finishTime);

  revalidatePath("/admin/pace-of-play");
  revalidatePath("/admin/pace-of-play/finish");
  revalidatePath("/admin");
  return { success: true };
}

// Helper function to update member speed profiles after a round completes
async function updateMemberSpeedProfiles(
  timeBlockId: number,
  startTime: Date,
  finishTime: Date,
) {
  try {
    // Calculate round duration in minutes
    const roundDurationMinutes = Math.floor(
      (finishTime.getTime() - startTime.getTime()) / (1000 * 60),
    );

    // Validate round duration
    if (
      roundDurationMinutes < MIN_ROUND_MINUTES ||
      roundDurationMinutes > MAX_ROUND_MINUTES
    ) {
      console.log(
        `Skipping speed profile update: abnormal round duration ${roundDurationMinutes} minutes`,
      );
      return;
    }

    // Get algorithm config for thresholds
    const config = await getAlgorithmConfig();

    // Get all members in this timeblock
    const timeBlockData = await db.query.timeBlocks.findFirst({
      where: eq(timeBlocks.id, timeBlockId),
      with: {
        timeBlockMembers: {
          with: { member: true },
        },
      },
    });

    if (!timeBlockData?.timeBlockMembers) {
      return;
    }

    // Update speed profile for each member
    for (const tbm of timeBlockData.timeBlockMembers) {
      const memberId = tbm.memberId;

      // Get existing profile
      const existingProfile = await db.query.memberSpeedProfiles.findFirst({
        where: eq(memberSpeedProfiles.memberId, memberId),
      });

      // Calculate new cumulative stats
      const currentTotalMinutes = existingProfile?.totalMinutes || 0;
      const currentRoundCount = existingProfile?.roundCount || 0;

      const newTotalMinutes = currentTotalMinutes + roundDurationMinutes;
      const newRoundCount = currentRoundCount + 1;
      const newAverageMinutes = Math.round(newTotalMinutes / newRoundCount);

      // Determine speed tier based on config thresholds
      let calculatedSpeedTier: "FAST" | "AVERAGE" | "SLOW" = "AVERAGE";
      if (newAverageMinutes <= config.fastThresholdMinutes) {
        calculatedSpeedTier = "FAST";
      } else if (newAverageMinutes <= config.averageThresholdMinutes) {
        calculatedSpeedTier = "AVERAGE";
      } else {
        calculatedSpeedTier = "SLOW";
      }

      // Respect manualOverride - only update tier if not manually overridden
      const shouldUpdateTier = !existingProfile?.manualOverride;
      const finalSpeedTier = shouldUpdateTier
        ? calculatedSpeedTier
        : (existingProfile?.speedTier ?? calculatedSpeedTier);

      // Upsert member speed profile
      await db
        .insert(memberSpeedProfiles)
        .values({
          memberId,
          averageMinutes: newAverageMinutes,
          totalMinutes: newTotalMinutes,
          roundCount: newRoundCount,
          hasData: true,
          speedTier: finalSpeedTier,
          lastCalculated: new Date(),
        })
        .onConflictDoUpdate({
          target: memberSpeedProfiles.memberId,
          set: {
            averageMinutes: newAverageMinutes,
            totalMinutes: newTotalMinutes,
            roundCount: newRoundCount,
            hasData: true,
            // Only update tier if not manually overridden
            ...(shouldUpdateTier ? { speedTier: calculatedSpeedTier } : {}),
            lastCalculated: new Date(),
          },
        });
    }
  } catch (error) {
    console.error("Error updating member speed profiles:", error);
    // Don't throw - we don't want to fail the finish time update if speed profile update fails
  }
}

// Update both turn and finish times together (for missed turn scenarios)
export async function updateTurnAndFinishTime(
  timeBlockId: number,
  turnTime: Date,
  finishTime: Date,
  updatedBy: string,
  notes?: string,
): Promise<{ success: boolean; error?: string }> {
  const currentPace = await getPaceOfPlayByTimeBlockId(timeBlockId);
  if (!currentPace) {
    throw new Error("Pace of play record not found");
  }

  // Validate times
  if (turnTime >= finishTime) {
    return {
      success: false,
      error: "Turn time must be before finish time",
    };
  }

  const startTime = new Date(currentPace.startTime!);
  if (startTime >= turnTime) {
    return {
      success: false,
      error: "Turn time must be after start time",
    };
  }

  // Calculate status for both turn and finish
  // Calculate status for both turn and finish
  // For finish, we use the finish time logic
  const tempPace = { ...currentPace, turn9Time: turnTime, finishTime };
  const clientStatus = calculatePaceStatus(tempPace);
  const finishStatus = mapPaceStatusToDbStatus(clientStatus, true);

  const paceData: Partial<PaceOfPlayInsert> = {
    turn9Time: turnTime,
    finishTime,
    status: finishStatus,
    lastUpdatedBy: updatedBy,
    notes: notes || "Turn and finish times recorded together",
  };

  await upsertPaceOfPlay(timeBlockId, paceData);
  revalidatePath("/admin/pace-of-play");
  revalidatePath("/admin/pace-of-play/finish");
  return { success: true };
}

// Get pace of play history for a specific member
export async function getMemberPaceOfPlayHistoryAction(memberId: number) {
  try {
    const history = await getMemberPaceOfPlayHistory(memberId);
    // Return history directly - status is already properly typed from schema
    return { success: true, data: history };
  } catch (error) {
    console.error("Error fetching member pace of play history:", error);
    return {
      success: false,
      data: [],
      error: "Failed to fetch pace of play history",
    };
  }
}
