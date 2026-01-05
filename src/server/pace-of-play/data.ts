import "server-only";
import { and, asc, desc, eq, sql, isNotNull, isNull } from "drizzle-orm";
import { db } from "../db";
import { getBCToday } from "~/lib/dates";

import {
  paceOfPlay,
  teesheets,
  timeBlockMembers,
  timeBlocks,
  timeBlockGuests,
  type PaceOfPlay,
  type PaceOfPlayInsert,
  type TimeBlock,
} from "../db/schema";

// Re-export schema types for convenience
export type { PaceOfPlay, PaceOfPlayInsert };

// Player info for pace of play display
export type PaceOfPlayPlayer = {
  name: string;
  checkedIn: boolean;
  isGuest: boolean;
};

// Composed type for time blocks with pace of play data
export type TimeBlockWithPaceOfPlay = TimeBlock & {
  paceOfPlay: PaceOfPlay | null;
  players: PaceOfPlayPlayer[];
  numPlayers: number;
};

// Create or update pace of play record
export async function upsertPaceOfPlay(
  timeBlockId: number,
  data: Partial<PaceOfPlayInsert>,
) {
  // Check if record exists
  const existingRecord = await db.query.paceOfPlay.findFirst({
    where: eq(paceOfPlay.timeBlockId, timeBlockId),
  });

  if (existingRecord) {
    // Update existing record
    return db
      .update(paceOfPlay)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(paceOfPlay.timeBlockId, timeBlockId))
      .returning();
  } else {
    // Create new record - ensure required fields are present
    // Explicitly handle values that might be undefined
    const insertData = {
      ...data,
      timeBlockId,
      // Ensure required fields have values
      expectedStartTime: data.expectedStartTime || new Date(),
      expectedTurn9Time: data.expectedTurn9Time || new Date(),
      expectedFinishTime: data.expectedFinishTime || new Date(),
    };

    return db.insert(paceOfPlay).values(insertData).returning();
  }
}

// Get pace of play by timeBlockId
export async function getPaceOfPlayByTimeBlockId(timeBlockId: number) {
  const paceData = await db.query.paceOfPlay.findFirst({
    where: eq(paceOfPlay.timeBlockId, timeBlockId),
  });

  return paceData;
}

// Get active time blocks at the turn (have started but not recorded turn time)
export async function getTimeBlocksAtTurn(
  date: Date,
): Promise<TimeBlockWithPaceOfPlay[]> {
  const formattedDate = date.toISOString().split("T")[0];

  // Use relational query to get pace of play with timeblock and players
  const result = await db.query.paceOfPlay.findMany({
    where: and(
      sql`${paceOfPlay.startTime} IS NOT NULL`,
      sql`${paceOfPlay.turn9Time} IS NULL`,
    ),
    with: {
      timeBlock: {
        with: {
          teesheet: true,
          timeBlockMembers: {
            with: { member: true },
          },
          timeBlockGuests: {
            with: { guest: true },
          },
        },
      },
    },
  });

  // Filter by date and transform to expected format
  return result
    .filter((pace) => pace.timeBlock?.teesheet?.date === formattedDate)
    .map((pace) => {
      const timeBlock = pace.timeBlock!;

      // Build players array from checked-in members and guests
      const players: PaceOfPlayPlayer[] = [
        ...(timeBlock.timeBlockMembers || [])
          .filter((tbm) => tbm.checkedIn)
          .map((tbm) => ({
            name: `${tbm.member.firstName} ${tbm.member.lastName}`,
            checkedIn: true,
            isGuest: false,
          })),
        ...(timeBlock.timeBlockGuests || [])
          .filter((tbg) => tbg.checkedIn)
          .map((tbg) => ({
            name: `${tbg.guest.firstName} ${tbg.guest.lastName}`,
            checkedIn: true,
            isGuest: true,
          })),
      ].sort((a, b) => a.name.localeCompare(b.name));

      const numPlayers = players.length;

      return {
        id: timeBlock.id,
        teesheetId: timeBlock.teesheetId,
        startTime: timeBlock.startTime,
        endTime: timeBlock.endTime,
        maxMembers: timeBlock.maxMembers,
        displayName: timeBlock.displayName,
        sortOrder: timeBlock.sortOrder,
        notes: timeBlock.notes,
        createdAt: timeBlock.createdAt,
        updatedAt: timeBlock.updatedAt,
        paceOfPlay: pace,
        players,
        numPlayers,
      };
    })
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

// Get active time blocks at the finish (have started, recorded turn time, but not finished)
export async function getTimeBlocksAtFinish(date: Date): Promise<{
  regular: TimeBlockWithPaceOfPlay[];
  missedTurns: TimeBlockWithPaceOfPlay[];
}> {
  const formattedDate = date.toISOString().split("T")[0];

  // Use relational query to get pace of play with timeblock and players
  const result = await db.query.paceOfPlay.findMany({
    where: and(
      sql`${paceOfPlay.startTime} IS NOT NULL`,
      sql`${paceOfPlay.finishTime} IS NULL`,
    ),
    with: {
      timeBlock: {
        with: {
          teesheet: true,
          timeBlockMembers: {
            with: { member: true },
          },
          timeBlockGuests: {
            with: { guest: true },
          },
        },
      },
    },
  });

  // Filter by date and transform to expected format
  const timeBlocksWithPace = result
    .filter((pace) => pace.timeBlock?.teesheet?.date === formattedDate)
    .map((pace) => {
      const timeBlock = pace.timeBlock!;

      // Build players array from checked-in members and guests
      const players: PaceOfPlayPlayer[] = [
        ...(timeBlock.timeBlockMembers || [])
          .filter((tbm) => tbm.checkedIn)
          .map((tbm) => ({
            name: `${tbm.member.firstName} ${tbm.member.lastName}`,
            checkedIn: true,
            isGuest: false,
          })),
        ...(timeBlock.timeBlockGuests || [])
          .filter((tbg) => tbg.checkedIn)
          .map((tbg) => ({
            name: `${tbg.guest.firstName} ${tbg.guest.lastName}`,
            checkedIn: true,
            isGuest: true,
          })),
      ].sort((a, b) => a.name.localeCompare(b.name));

      const numPlayers = players.length;

      return {
        id: timeBlock.id,
        teesheetId: timeBlock.teesheetId,
        startTime: timeBlock.startTime,
        endTime: timeBlock.endTime,
        maxMembers: timeBlock.maxMembers,
        displayName: timeBlock.displayName,
        sortOrder: timeBlock.sortOrder,
        notes: timeBlock.notes,
        createdAt: timeBlock.createdAt,
        updatedAt: timeBlock.updatedAt,
        paceOfPlay: pace,
        players,
        numPlayers,
        hasMissedTurn: !pace.turn9Time,
      };
    })
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  // Separate into regular and missed turns
  const regular = timeBlocksWithPace.filter((tb) => !tb.hasMissedTurn);
  const missedTurns = timeBlocksWithPace.filter((tb) => tb.hasMissedTurn);

  return {
    regular,
    missedTurns,
  };
}

// Get pace of play history for a specific member
// Only returns completed rounds (with finishTime) - incomplete rounds are hidden from members
export async function getMemberPaceOfPlayHistory(memberId: number) {
  const result = await db
    .select({
      id: paceOfPlay.id,
      timeBlockId: timeBlocks.id,
      date: teesheets.date,
      startTime: timeBlocks.startTime,
      actualStartTime: paceOfPlay.startTime,
      turn9Time: paceOfPlay.turn9Time,
      finishTime: paceOfPlay.finishTime,
      expectedStartTime: paceOfPlay.expectedStartTime,
      expectedTurn9Time: paceOfPlay.expectedTurn9Time,
      expectedFinishTime: paceOfPlay.expectedFinishTime,
      status: paceOfPlay.status,
      notes: paceOfPlay.notes,
      createdAt: paceOfPlay.createdAt,
    })
    .from(paceOfPlay)
    .innerJoin(timeBlocks, eq(paceOfPlay.timeBlockId, timeBlocks.id))
    .innerJoin(teesheets, eq(timeBlocks.teesheetId, teesheets.id))
    .innerJoin(
      timeBlockMembers,
      eq(timeBlocks.id, timeBlockMembers.timeBlockId),
    )
    .where(
      and(
        eq(timeBlockMembers.memberId, memberId),
        isNotNull(paceOfPlay.finishTime), // Only include completed rounds
      ),
    )
    .orderBy(desc(teesheets.date), asc(timeBlocks.startTime));

  return result;
}

// Get pace of play history for a specific guest
export async function getGuestPaceOfPlayHistory(guestId: number) {
  const result = await db
    .select({
      id: paceOfPlay.id,
      timeBlockId: timeBlocks.id,
      date: teesheets.date,
      startTime: timeBlocks.startTime,
      actualStartTime: paceOfPlay.startTime,
      turn9Time: paceOfPlay.turn9Time,
      finishTime: paceOfPlay.finishTime,
      expectedStartTime: paceOfPlay.expectedStartTime,
      expectedTurn9Time: paceOfPlay.expectedTurn9Time,
      expectedFinishTime: paceOfPlay.expectedFinishTime,
      status: paceOfPlay.status,
      notes: paceOfPlay.notes,
      createdAt: paceOfPlay.createdAt,
    })
    .from(paceOfPlay)
    .innerJoin(timeBlocks, eq(paceOfPlay.timeBlockId, timeBlocks.id))
    .innerJoin(teesheets, eq(timeBlocks.teesheetId, teesheets.id))
    .innerJoin(timeBlockGuests, eq(timeBlocks.id, timeBlockGuests.timeBlockId))
    .where(eq(timeBlockGuests.guestId, guestId))
    .orderBy(desc(teesheets.date), asc(timeBlocks.startTime));

  return result;
}

// Type for member's active round
export type MemberActiveRound = {
  timeBlockId: number;
  teesheetDate: string;
  scheduledStartTime: string;
  paceOfPlay: PaceOfPlay;
  players: PaceOfPlayPlayer[];
  numPlayers: number;
};

// Type for member's pace of play history item (inferred from getMemberPaceOfPlayHistory)
export type MemberPaceOfPlayHistoryItem = Awaited<
  ReturnType<typeof getMemberPaceOfPlayHistory>
>[number];

// Get member's active checked-in round for today
export async function getMemberActiveRound(
  memberId: number,
): Promise<MemberActiveRound | null> {
  const today = getBCToday();

  // First find the member's checked-in time block for today
  const memberTimeBlock = await db.query.timeBlockMembers.findFirst({
    where: and(
      eq(timeBlockMembers.memberId, memberId),
      eq(timeBlockMembers.checkedIn, true),
    ),
    with: {
      timeBlock: {
        with: {
          teesheet: true,
          timeBlockMembers: {
            with: { member: true },
          },
          timeBlockGuests: {
            with: { guest: true },
          },
        },
      },
    },
  });

  // If no checked-in time block found, return null
  if (!memberTimeBlock?.timeBlock?.teesheet) {
    return null;
  }

  // Check if this is today's teesheet
  if (memberTimeBlock.timeBlock.teesheet.date !== today) {
    return null;
  }

  // Get the pace of play record for this time block
  const paceRecord = await db.query.paceOfPlay.findFirst({
    where: and(
      eq(paceOfPlay.timeBlockId, memberTimeBlock.timeBlock.id),
      isNotNull(paceOfPlay.startTime),
      isNull(paceOfPlay.finishTime),
    ),
  });

  // If no active pace record (not started or already finished), return null
  if (!paceRecord) {
    return null;
  }

  const timeBlock = memberTimeBlock.timeBlock;

  // Build players array from checked-in members and guests
  const players: PaceOfPlayPlayer[] = [
    ...(timeBlock.timeBlockMembers || [])
      .filter((tbm) => tbm.checkedIn)
      .map((tbm) => ({
        name: `${tbm.member.firstName} ${tbm.member.lastName}`,
        checkedIn: true,
        isGuest: false,
      })),
    ...(timeBlock.timeBlockGuests || [])
      .filter((tbg) => tbg.checkedIn)
      .map((tbg) => ({
        name: `${tbg.guest.firstName} ${tbg.guest.lastName}`,
        checkedIn: true,
        isGuest: true,
      })),
  ].sort((a, b) => a.name.localeCompare(b.name));

  return {
    timeBlockId: timeBlock.id,
    teesheetDate: timeBlock.teesheet.date,
    scheduledStartTime: timeBlock.startTime,
    paceOfPlay: paceRecord,
    players,
    numPlayers: players.length,
  };
}

// Get combined rounds data for member (active round + history)
export async function getMemberRoundsData(memberId: number) {
  const [activeRound, history] = await Promise.all([
    getMemberActiveRound(memberId),
    getMemberPaceOfPlayHistory(memberId),
  ]);

  return {
    activeRound,
    history,
  };
}
