import "server-only";
import { db } from "~/server/db";
import { lotterySettings } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import type { LotterySettings } from "~/server/db/schema";

/**
 * Get lottery settings (singleton row with id=1)
 * Creates default row if it doesn't exist
 */
export async function getLotterySettings(): Promise<LotterySettings> {
  let settings = await db.query.lotterySettings.findFirst({
    where: eq(lotterySettings.id, 1),
  });

  // If settings don't exist, create default row
  if (!settings) {
    const [newSettings] = await db
      .insert(lotterySettings)
      .values({
        id: 1,
        lotteryAdvanceDays: 3,
        lotteryMaxDaysAhead: 60,
      })
      .returning();

    if (!newSettings) {
      throw new Error("Failed to create default lottery settings");
    }

    return newSettings;
  }

  return settings;
}

