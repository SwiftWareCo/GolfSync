import "server-only";
import { db } from "~/server/db";
import {
  teesheets,
  timeBlocks,
  templates,
  type Teesheet,
  type Timeblocks,
  type TimeblockInsert,
  type TeesheetConfig,
  type PaceOfPlay,
  type TimeblockMember,
  type TimeblockGuest,
  type TimeblockFill,
} from "~/server/db/schema";
import { eq, asc } from "drizzle-orm";

import { type TemplateBlock } from "~/app/types/TeeSheetTypes";
import { getConfigForDate } from "~/server/settings/data";
import { generateTimeBlocks } from "~/lib/utils";
import { getDateForDB, parseDate } from "~/lib/dates";

type TimeBlockWithRelations = Timeblocks & {
  timeBlockMembers: TimeblockMember[];
  timeBlockGuests: TimeblockGuest[];
  fills: TimeblockFill[];
  paceOfPlay: PaceOfPlay | null;
};

export async function createTimeBlocksForTeesheet(
  teesheetId: number,
  config: TeesheetConfig,
) {
  // For custom configurations, fetch the template and create blocks based on it
  if (config.type === "CUSTOM") {
    // Fetch the template

    if (!config.templateId) {
      throw new Error("Custom configuration missing templateId");
    }

    const template = await db.query.templates.findFirst({
      where: eq(templates.id, config.templateId),
    });

    const templateBlocks = template?.blocks as TemplateBlock[];

    if (templateBlocks.length === 0) {
      return [];
    }

    // Create blocks based on template
    const blocks = templateBlocks.map((block, index) => ({
      teesheetId,
      startTime: block.startTime,
      endTime: block.startTime, // For template blocks, end time is same as start time
      maxMembers: block.maxPlayers,
      displayName: block.displayName,
      sortOrder: index, // Use the index to maintain order
    }));

    return await db.insert(timeBlocks).values(blocks).returning();
  }
  const regularConfig = config;

  if (
    !regularConfig.startTime ||
    !regularConfig.endTime ||
    !regularConfig.interval
  ) {
    throw new Error(
      "Invalid regular configuration: missing startTime, endTime, or interval",
    );
  }
  // For regular configurations, generate blocks based on start time, end time, and interval
  const timeBlocksArray = generateTimeBlocks(
    regularConfig.startTime,
    regularConfig.endTime,
    regularConfig.interval,
  );

  const blocks: TimeblockInsert[] = timeBlocksArray.map((time, index) => ({
    teesheetId,
    startTime: time,
    endTime: time, // For regular blocks, end time is same as start time
    maxMembers: regularConfig.maxMembersPerBlock || 4,
    sortOrder: index,
  }));

  return await db.insert(timeBlocks).values(blocks).returning();
}

export async function getTeesheetWithTimeBlocks(dateString: string): Promise<{
  teesheet: Teesheet;
  config: TeesheetConfig;
  timeBlocks: TimeBlockWithRelations[];
}> {
  // 1. Check if teesheet exists WITH timeblocks already loaded
  const existingTeesheet = await db.query.teesheets.findFirst({
    where: eq(teesheets.date, dateString),
    with: {
      config: {
        with: { rules: true },
      },
      timeBlocks: {
        with: {
          timeBlockMembers: { with: { member: true } },
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
      config: existingTeesheet.config as TeesheetConfig,
      timeBlocks: existingTeesheet.timeBlocks as TimeBlockWithRelations[],
    };
  } else {
    const date = parseDate(dateString);
    const config = await getConfigForDate(date);

    const [newTeesheet] = await db
      .insert(teesheets)
      .values({ date: dateString, configId: config.id })
      .returning();

    if (!newTeesheet) {
      throw new Error("Failed to create new teesheet");
    }

    await createTimeBlocksForTeesheet(newTeesheet.id, config);

    const hydratedBlocks = await getTimeBlocksForTeesheet(newTeesheet.id);

    if (!config) {
      throw new Error("No configuration found for the given date");
    }
    // 4. Create timeblocks for new teesheet

    return {
      teesheet: newTeesheet,
      config,
      timeBlocks: hydratedBlocks,
    };
  }
}

export async function getTimeBlocksForTeesheet(teesheetId: number) {
  const teesheet = await db.query.teesheets.findFirst({
    where: eq(teesheets.id, teesheetId),
  });

  if (!teesheet) {
    throw new Error("Teesheet not found");
  }

  return await db.query.timeBlocks.findMany({
    where: eq(timeBlocks.teesheetId, teesheetId),
    with: {
      timeBlockMembers: { with: { member: true } },
      timeBlockGuests: { with: { guest: true, invitedByMember: true } },
      fills: true,
      paceOfPlay: true,
    },
    orderBy: [asc(timeBlocks.sortOrder), asc(timeBlocks.startTime)],
  });
}
