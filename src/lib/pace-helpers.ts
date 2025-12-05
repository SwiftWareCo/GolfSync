import type { PaceOfPlay } from "~/server/db/schema";
import { getBCNow } from "~/lib/dates";

/**
 * Calculate pace status for a timeblock based on expected milestones
 *
 * Key assumption: When checked in, group is assumed to have started at scheduled tee time
 * Judges lateness relative to:
 * - Expected turn time (2 hours from scheduled start)
 * - Expected finish time (4 hours from scheduled start)
 *
 * Returns: "not-started" | "early" | "on-time" | "late"
 */
export function calculatePaceStatus(
  paceOfPlay: PaceOfPlay | null | undefined,
): "not-started" | "early" | "on-time" | "late" {
  if (!paceOfPlay?.startTime) {
    return "not-started";
  }

  const now = getBCNow();
  const scheduledStart = new Date(paceOfPlay.expectedStartTime);
  const expectedTurn = new Date(paceOfPlay.expectedTurn9Time);
  const expectedFinish = new Date(paceOfPlay.expectedFinishTime);

  // If they've finished, compare finish time to expected
  if (paceOfPlay.finishTime) {
    const actualFinish = new Date(paceOfPlay.finishTime);
    const finishDiffMinutes = Math.floor(
      (actualFinish.getTime() - expectedFinish.getTime()) / (1000 * 60),
    );

    if (finishDiffMinutes < -5) return "early";
    if (finishDiffMinutes <= 5) return "on-time";
    return "late";
  }

  // If they've recorded turn time, use that
  if (paceOfPlay.turn9Time) {
    const actualTurn = new Date(paceOfPlay.turn9Time);
    const turnDiffMinutes = Math.floor(
      (actualTurn.getTime() - expectedTurn.getTime()) / (1000 * 60),
    );

    if (turnDiffMinutes < -5) return "early";
    if (turnDiffMinutes <= 5) return "on-time";
    return "late";
  }

  // No turn or finish recorded yet - check if they SHOULD have turned by now
  // Assumption: They started at scheduled tee time when they checked in

  if (now > expectedFinish) {
    // They should have finished by now but haven't recorded finish
    return "late";
  }

  if (now > expectedTurn) {
    // They should have turned by now but haven't recorded turn
    return "late";
  }

  // They haven't reached expected turn time yet
  // Check if they're on pace so far (compare current time to scheduled start)
  const elapsedMinutes = Math.floor(
    (now.getTime() - scheduledStart.getTime()) / (1000 * 60),
  );

  // For early stage (before turn), they're on-time if within reasonable range
  // This is more lenient since we don't have actual position data
  if (elapsedMinutes < 0) return "early"; // Checked in before scheduled time
  if (elapsedMinutes <= 135) return "on-time"; // Within first 2h 15min
  return "late"; // More than 2h 15min without recording turn
}

/**
 * Get badge color classes for pace status
 */
export function getPaceBadgeClasses(
  status: "not-started" | "early" | "on-time" | "late",
): string {
  switch (status) {
    case "not-started":
      return "bg-gray-100 text-gray-700 border-gray-300";
    case "early":
      return "bg-green-100 text-green-700 border-green-300";
    case "on-time":
      return "bg-blue-100 text-blue-700 border-blue-300";
    case "late":
      return "bg-red-100 text-red-700 border-red-300";
  }
}

/**
 * Get display label for pace status
 */
export function getPaceLabel(
  status: "not-started" | "early" | "on-time" | "late",
): string {
  switch (status) {
    case "not-started":
      return "Not Started";
    case "early":
      return "Early";
    case "on-time":
      return "On Time";
    case "late":
      return "Late";
  }
}

/**
 * Calculate expected hole based on actual pace and 4-hour standard
 * Returns current hole, expected hole, and status
 */
export function calculateExpectedHole(
  paceOfPlay: PaceOfPlay | null | undefined,
): {
  currentHole: number;
  expectedHole: number;
  percentComplete: number;
  status: "ahead" | "on-pace" | "behind";
} | null {
  if (!paceOfPlay?.expectedStartTime) {
    return null;
  }

  const now = getBCNow();

  // If finished, return completed
  if (paceOfPlay.finishTime) {
    return {
      currentHole: 18,
      expectedHole: 18,
      percentComplete: 100,
      status: "on-pace",
    };
  }

  // If turn time recorded, calculate based on actual front-nine pace
  if (paceOfPlay.turn9Time) {
    const expectedStart = new Date(paceOfPlay.expectedStartTime);
    const actualTurn = new Date(paceOfPlay.turn9Time);

    // Calculate actual pace for front nine
    const frontNineMinutes =
      (actualTurn.getTime() - expectedStart.getTime()) / (1000 * 60);
    const minutesPerHole = Math.max(frontNineMinutes / 9, 1); // Prevent division issues

    // Calculate elapsed time since turn
    const elapsedSinceTurn =
      (now.getTime() - actualTurn.getTime()) / (1000 * 60);

    // Project current hole based on actual pace (ensure it stays within bounds)
    const backNineHolesFloat = elapsedSinceTurn / minutesPerHole;
    const backNineHoles = Math.min(
      Math.max(Math.ceil(backNineHolesFloat), 0),
      9,
    );
    const currentHole = Math.min(Math.max(9 + backNineHoles, 10), 18);

    // Calculate expected hole based on 4-hour standard (13.33 min/hole)
    const standardMinutesPerHole = 240 / 18; // 13.33 minutes per hole
    const expectedBackNineHolesFloat =
      elapsedSinceTurn / standardMinutesPerHole;
    const expectedBackNineHoles = Math.min(
      Math.max(Math.ceil(expectedBackNineHolesFloat), 0),
      9,
    );
    const expectedHole = Math.min(Math.max(9 + expectedBackNineHoles, 10), 18);

    const percentComplete = Math.min(Math.round((currentHole / 18) * 100), 100);
    const status: "ahead" | "on-pace" | "behind" =
      currentHole < expectedHole - 1
        ? "behind"
        : currentHole > expectedHole + 1
          ? "ahead"
          : "on-pace";

    return { currentHole, expectedHole, percentComplete, status };
  }

  // Otherwise, use standard 4-hour pace from expected start time
  const expectedStart = new Date(paceOfPlay.expectedStartTime);
  const elapsedMinutes =
    (now.getTime() - expectedStart.getTime()) / (1000 * 60);

  // 4-hour pace = 240 minutes for 18 holes
  const minutesPerHole = 240 / 18;
  const floatHole = elapsedMinutes / minutesPerHole;
  const currentHole = Math.min(Math.max(Math.ceil(floatHole), 1), 18);

  // Calculate percentage complete
  const percentComplete = Math.min((elapsedMinutes / 240) * 100, 100);

  return {
    currentHole,
    expectedHole: currentHole,
    percentComplete: Math.round(percentComplete),
    status: "on-pace",
  };
}

/**
 * Get text color class for pace status (used in PaceOfPlayStatus component)
 * Matches database status values: "on_time", "behind", "ahead", "completed_*"
 */
export function getPaceStatusColor(status: string): string {
  switch (status) {
    case "on_time":
    case "completed_on_time":
      return "text-blue-600";
    case "behind":
    case "completed_late":
      return "text-red-600";
    case "ahead":
    case "completed_early":
      return "text-green-600";
    case "completed":
      return "text-gray-600";
    default:
      return "text-gray-600";
  }
}

/**
 * Calculate turn status (for front nine performance)
 * Returns early/on-time/late based on turn time vs expected turn time
 */
export function calculateTurnStatus(
  paceOfPlay: PaceOfPlay | null | undefined,
): "early" | "on-time" | "late" {
  if (!paceOfPlay?.turn9Time) {
    return "on-time";
  }

  const actualTurn = new Date(paceOfPlay.turn9Time);
  const expectedTurn = new Date(paceOfPlay.expectedTurn9Time);

  const diffMinutes = Math.floor(
    (actualTurn.getTime() - expectedTurn.getTime()) / (1000 * 60),
  );

  // 5 minute tolerance window
  if (diffMinutes < -5) return "early";
  if (diffMinutes <= 5) return "on-time";
  return "late";
}

/**
 * Calculate finish status (for back nine performance)
 * Returns early/on-time/late based on finish time vs expected finish time
 */
export function calculateFinishStatus(
  paceOfPlay: PaceOfPlay | null | undefined,
): "early" | "on-time" | "late" {
  if (!paceOfPlay?.finishTime) {
    return "on-time";
  }

  const actualFinish = new Date(paceOfPlay.finishTime);
  const expectedFinish = new Date(paceOfPlay.expectedFinishTime);

  const diffMinutes = Math.floor(
    (actualFinish.getTime() - expectedFinish.getTime()) / (1000 * 60),
  );

  // 5 minute tolerance window
  if (diffMinutes < -5) return "early";
  if (diffMinutes <= 5) return "on-time";
  return "late";
}

/**
 * Calculate expected time to reach a specific hole
 * Returns expected times based on 4-hour standard pace and actual measured pace
 */
export function calculateExpectedHoleTime(
  paceOfPlay: PaceOfPlay | null | undefined,
  holeNumber: number,
): {
  timeAt4HourPace: string;
  timeAtActualPace: string | null;
} | null {
  if (!paceOfPlay?.expectedStartTime || holeNumber < 1 || holeNumber > 18) {
    return null;
  }

  const expectedStart = new Date(paceOfPlay.expectedStartTime);

  // Calculate time at 4-hour standard pace (13.33 minutes per hole)
  const minutesPerHoleStandard = 240 / 18;
  const timeAt4HourPace = new Date(
    expectedStart.getTime() + holeNumber * minutesPerHoleStandard * 60 * 1000,
  ).toISOString();

  // Calculate time at actual measured pace if available
  let timeAtActualPace: string | null = null;
  if (paceOfPlay.turn9Time) {
    const actualTurn = new Date(paceOfPlay.turn9Time);
    const frontNineMinutes =
      (actualTurn.getTime() - expectedStart.getTime()) / (1000 * 60);
    const minutesPerHoleFrontNine = Math.max(frontNineMinutes / 9, 1);

    // For holes 1-9, use front-nine pace
    if (holeNumber <= 9) {
      timeAtActualPace = new Date(
        expectedStart.getTime() +
          holeNumber * minutesPerHoleFrontNine * 60 * 1000,
      ).toISOString();
    } else if (paceOfPlay.finishTime) {
      // For holes 10-18, use back-nine pace if finish time exists
      const actualFinish = new Date(paceOfPlay.finishTime);
      const backNineMinutes =
        (actualFinish.getTime() - actualTurn.getTime()) / (1000 * 60);
      const minutesPerHoleBackNine = Math.max(backNineMinutes / 9, 1);

      timeAtActualPace = new Date(
        actualTurn.getTime() +
          (holeNumber - 9) * minutesPerHoleBackNine * 60 * 1000,
      ).toISOString();
    } else {
      // If no finish time yet, extend front-nine pace to back 9
      timeAtActualPace = new Date(
        expectedStart.getTime() +
          holeNumber * minutesPerHoleFrontNine * 60 * 1000,
      ).toISOString();
    }
  }

  return {
    timeAt4HourPace,
    timeAtActualPace,
  };
}

/**
 * Map client-side pace status to database status enum
 */
export function mapPaceStatusToDbStatus(
  status: "not-started" | "early" | "on-time" | "late",
  isFinish = false,
):
  | "pending"
  | "on_time"
  | "behind"
  | "ahead"
  | "completed_on_time"
  | "completed_early"
  | "completed_late" {
  if (status === "not-started") return "pending";

  if (isFinish) {
    switch (status) {
      case "early":
        return "completed_early";
      case "on-time":
        return "completed_on_time";
      case "late":
        return "completed_late";
    }
  }

  switch (status) {
    case "early":
      return "ahead";
    case "on-time":
      return "on_time";
    case "late":
      return "behind";
  }
}
