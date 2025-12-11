import "server-only";
import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "../db";

import {
  members,
  paceOfPlay,
  teesheets,
  timeBlockMembers,
  timeBlocks,
  timeBlockGuests,
  guests,
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

// Get all pace of play records for a specific date
export async function getPaceOfPlayByDate(
  date: Date,
): Promise<TimeBlockWithPaceOfPlay[]> {
  const formattedDate = date.toISOString().split("T")[0];

  const result = await db
    .select({
      timeBlock: timeBlocks,
      paceOfPlay: paceOfPlay,
      numPlayers: sql<number>`COUNT(DISTINCT CASE WHEN ${timeBlockMembers.checkedIn} = true THEN ${timeBlockMembers.memberId} END) + COUNT(DISTINCT ${timeBlockGuests.guestId})`,
      players: sql<
        PaceOfPlayPlayer[]
      >`COALESCE(json_agg(DISTINCT jsonb_build_object('name', CONCAT(${members.firstName}, ' ', ${members.lastName}), 'checkedIn', COALESCE(${timeBlockMembers.checkedIn}, false))) FILTER (WHERE ${members.id} IS NOT NULL AND ${timeBlockMembers.checkedIn} = true), '[]')`,
    })
    .from(timeBlocks)
    .innerJoin(teesheets, eq(timeBlocks.teesheetId, teesheets.id))
    .leftJoin(paceOfPlay, eq(timeBlocks.id, paceOfPlay.timeBlockId))
    .leftJoin(timeBlockMembers, eq(timeBlocks.id, timeBlockMembers.timeBlockId))
    .leftJoin(members, eq(timeBlockMembers.memberId, members.id))
    .leftJoin(timeBlockGuests, eq(timeBlocks.id, timeBlockGuests.timeBlockId))
    .leftJoin(guests, eq(timeBlockGuests.guestId, guests.id))
    .where(sql`${teesheets.date} = ${formattedDate}`)
    .groupBy(timeBlocks.id, paceOfPlay.id)
    .orderBy(asc(timeBlocks.startTime));

  return result.map((row) => ({
    ...row.timeBlock,
    paceOfPlay: row.paceOfPlay,
    players: row.players || [],
    numPlayers: row.numPlayers,
  }));
}

// Get active time blocks at the turn (have started but not recorded turn time)
export async function getTimeBlocksAtTurn(
  date: Date,
): Promise<TimeBlockWithPaceOfPlay[]> {
  const formattedDate = date.toISOString().split("T")[0];

  const result = await db
    .select({
      timeBlock: timeBlocks,
      paceOfPlay: paceOfPlay,
      numPlayers: sql<number>`COUNT(DISTINCT CASE WHEN ${timeBlockMembers.checkedIn} = true THEN ${timeBlockMembers.memberId} END) + COUNT(DISTINCT ${timeBlockGuests.guestId})`,
      players: sql<
        PaceOfPlayPlayer[]
      >`COALESCE(json_agg(DISTINCT jsonb_build_object('name', CONCAT(${members.firstName}, ' ', ${members.lastName}), 'checkedIn', COALESCE(${timeBlockMembers.checkedIn}, false))) FILTER (WHERE ${members.id} IS NOT NULL AND ${timeBlockMembers.checkedIn} = true), '[]')`,
    })
    .from(timeBlocks)
    .innerJoin(teesheets, eq(timeBlocks.teesheetId, teesheets.id))
    .innerJoin(paceOfPlay, eq(timeBlocks.id, paceOfPlay.timeBlockId))
    .leftJoin(timeBlockMembers, eq(timeBlocks.id, timeBlockMembers.timeBlockId))
    .leftJoin(members, eq(timeBlockMembers.memberId, members.id))
    .leftJoin(timeBlockGuests, eq(timeBlocks.id, timeBlockGuests.timeBlockId))
    .leftJoin(guests, eq(timeBlockGuests.guestId, guests.id))
    .where(
      and(
        sql`${teesheets.date} = ${formattedDate}`,
        sql`${paceOfPlay.startTime} IS NOT NULL`,
        sql`${paceOfPlay.turn9Time} IS NULL`,
      ),
    )
    .groupBy(timeBlocks.id, paceOfPlay.id)
    .orderBy(asc(timeBlocks.startTime));

  return result.map((row) => ({
    ...row.timeBlock,
    paceOfPlay: row.paceOfPlay,
    players: row.players || [],
    numPlayers: row.numPlayers,
  }));
}

// Get active time blocks at the finish (have started, recorded turn time, but not finished)
export async function getTimeBlocksAtFinish(date: Date): Promise<{
  regular: TimeBlockWithPaceOfPlay[];
  missedTurns: TimeBlockWithPaceOfPlay[];
}> {
  const formattedDate = date.toISOString().split("T")[0];

  // Base query conditions
  const baseConditions = [
    sql`${teesheets.date} = ${formattedDate}`,
    sql`${paceOfPlay.startTime} IS NOT NULL`,
    sql`${paceOfPlay.finishTime} IS NULL`,
  ];

  const result = await db
    .select({
      timeBlock: timeBlocks,
      paceOfPlay: paceOfPlay,
      numPlayers: sql<number>`COUNT(DISTINCT CASE WHEN ${timeBlockMembers.checkedIn} = true THEN ${timeBlockMembers.memberId} END) + COUNT(DISTINCT ${timeBlockGuests.guestId})`,
      players: sql<
        PaceOfPlayPlayer[]
      >`COALESCE(json_agg(DISTINCT jsonb_build_object('name', CONCAT(${members.firstName}, ' ', ${members.lastName}), 'checkedIn', COALESCE(${timeBlockMembers.checkedIn}, false))) FILTER (WHERE ${members.id} IS NOT NULL AND ${timeBlockMembers.checkedIn} = true), '[]')`,
    })
    .from(timeBlocks)
    .innerJoin(teesheets, eq(timeBlocks.teesheetId, teesheets.id))
    .innerJoin(paceOfPlay, eq(timeBlocks.id, paceOfPlay.timeBlockId))
    .leftJoin(timeBlockMembers, eq(timeBlocks.id, timeBlockMembers.timeBlockId))
    .leftJoin(members, eq(timeBlockMembers.memberId, members.id))
    .leftJoin(timeBlockGuests, eq(timeBlocks.id, timeBlockGuests.timeBlockId))
    .leftJoin(guests, eq(timeBlockGuests.guestId, guests.id))
    .where(and(...baseConditions))
    .groupBy(timeBlocks.id, paceOfPlay.id)
    .orderBy(asc(timeBlocks.startTime));

  const timeBlocksWithPace = result.map((row) => ({
    ...row.timeBlock,
    paceOfPlay: row.paceOfPlay,
    players: row.players || [],
    numPlayers: row.numPlayers,
    hasMissedTurn: !row.paceOfPlay.turn9Time,
  }));

  // If including missed turns, separate them into two groups
  const regular = timeBlocksWithPace.filter((tb) => !tb.hasMissedTurn);
  const missedTurns = timeBlocksWithPace.filter((tb) => tb.hasMissedTurn);

  return {
    regular,
    missedTurns,
  };
}

// Get pace of play history for a specific member
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
    .where(eq(timeBlockMembers.memberId, memberId))
    .orderBy(desc(teesheets.date), asc(timeBlocks.startTime));

  return result;
}
