"use server";

import { db } from "~/server/db";
import { configBlocks } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { updateTag } from "next/cache";

export async function createConfigBlocks(
  configId: number,
  blocks: Array<{
    displayName: string | null;
    startTime: string;
    maxPlayers: number;
  }>,
) {
  if (!blocks || blocks.length === 0) {
    return [];
  }

  const blocksToInsert = blocks.map((block, index) => ({
    configId,
    displayName: block.displayName,
    startTime: block.startTime,
    maxPlayers: block.maxPlayers,
    sortOrder: index,
  }));

  await db.insert(configBlocks).values(blocksToInsert);
  updateTag("teesheet-configs");
}

export async function updateConfigBlocks(
  configId: number,
  blocks: Array<{
    displayName: string | null;
    startTime: string;
    maxPlayers: number;
  }>,
) {
  // Delete existing blocks and insert new ones
  await db.delete(configBlocks).where(eq(configBlocks.configId, configId));

  if (blocks && blocks.length > 0) {
    const blocksToInsert = blocks.map((block, index) => ({
      configId,
      displayName: block.displayName,
      startTime: block.startTime,
      maxPlayers: block.maxPlayers,
      sortOrder: index,
    }));

    await db.insert(configBlocks).values(blocksToInsert);
  }

  updateTag("teesheet-configs");
}

export async function deleteConfigBlocks(configId: number) {
  await db.delete(configBlocks).where(eq(configBlocks.configId, configId));
  updateTag("teesheet-configs");
}
