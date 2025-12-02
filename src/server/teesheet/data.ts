import "server-only";
import { db } from "~/server/db";
import {
  teesheets,
  timeBlocks,
  type Teesheet,
  type TimeBlockWithRelations,
  type TeesheetConfigWithBlocks,
} from "~/server/db/schema";
import { eq, asc } from "drizzle-orm";
import { getConfigForDate } from "~/server/settings/data";

// Helper function to flatten nested timeBlockMembers and timeBlockGuests to members and guests
function flattenTimeBlock(rawTimeBlock: any): TimeBlockWithRelations {
  return {
    ...rawTimeBlock,
    members:
      rawTimeBlock.timeBlockMembers?.map((tbm: any) => ({
        ...tbm.member,
        bagNumber: tbm.member.bagNumber,
        checkedIn: tbm.checkedIn,
        checkedInAt: tbm.checkedInAt,
      })) ?? [],
    guests:
      rawTimeBlock.timeBlockGuests?.map((tbg: any) => ({
        ...tbg.guest,
        invitedByMemberId: tbg.invitedByMemberId,
        invitedByMember: tbg.invitedByMember,
      })) ?? [],
  };
}

export async function createTimeBlocksForTeesheet(
  teesheetId: number,
  config: TeesheetConfigWithBlocks,
) {
  const blocks = config.blocks;

  if (!blocks || blocks.length === 0) {
    return [];
  }

  // Create time blocks based on config blocks
  const timeBlocksData = blocks.map((block, index) => ({
    teesheetId,
    startTime: block.startTime,
    endTime: block.startTime, // For config blocks, end time is same as start time
    maxMembers: block.maxPlayers,
    displayName: block.displayName,
    sortOrder: index, // Use the index to maintain order
  }));

  return await db.insert(timeBlocks).values(timeBlocksData).returning();
}

export async function getTeesheetWithTimeBlocks(dateString: string): Promise<{
  teesheet: Teesheet;
  config: TeesheetConfigWithBlocks | null;
  timeBlocks: TimeBlockWithRelations[];
}> {
  // 1. Check if teesheet exists WITH timeblocks already loaded
  const existingTeesheet = await db.query.teesheets.findFirst({
    where: eq(teesheets.date, dateString),
    with: {
      config: {
        with: { blocks: true },
      },
      timeBlocks: {
        with: {
          timeBlockMembers: { with: { member: { with: { memberClass: true } } } },
          timeBlockGuests: { with: { guest: true, invitedByMember: true } },
          fills: true,
          paceOfPlay: true,
        },
      },
    },
  });

  // 2. If exists return it
  if (existingTeesheet) {
    return {
      teesheet: existingTeesheet,
      config: existingTeesheet.config as TeesheetConfigWithBlocks | null,
      timeBlocks: existingTeesheet.timeBlocks.map(flattenTimeBlock),
    };
  }

  // 3. Teesheet doesn't exist - create one without requiring a config
  const config = await getConfigForDate(dateString);

  const [newTeesheet] = await db
    .insert(teesheets)
    .values({ date: dateString, configId: config?.id ?? null })
    .returning();

  if (!newTeesheet) {
    throw new Error("Failed to create new teesheet");
  }

  // 4. Create timeblocks if config exists
  let hydratedBlocks: TimeBlockWithRelations[] = [];
  if (config) {
    await createTimeBlocksForTeesheet(newTeesheet.id, config);
    hydratedBlocks = await getTimeBlocksForTeesheet(newTeesheet.id);
  }

  return {
    teesheet: newTeesheet,
    config: config ?? null,
    timeBlocks: hydratedBlocks,
  };
}

export async function getTimeBlocksForTeesheet(teesheetId: number) {
  const teesheet = await db.query.teesheets.findFirst({
    where: eq(teesheets.id, teesheetId),
  });

  if (!teesheet) {
    throw new Error("Teesheet not found");
  }

  const rawTimeBlocks = await db.query.timeBlocks.findMany({
    where: eq(timeBlocks.teesheetId, teesheetId),
    with: {
      timeBlockMembers: { with: { member: { with: { memberClass: true } } } },
      timeBlockGuests: { with: { guest: true, invitedByMember: true } },
      fills: true,
      paceOfPlay: true,
    },
    orderBy: [asc(timeBlocks.sortOrder), asc(timeBlocks.startTime)],
  });

  return rawTimeBlocks.map(flattenTimeBlock);
}
