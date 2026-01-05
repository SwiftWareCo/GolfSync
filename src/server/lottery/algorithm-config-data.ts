import "server-only";

import { db } from "~/server/db";
import { eq } from "drizzle-orm";
import {
  lotteryAlgorithmConfig,
  DEFAULT_POSITION_BONUSES,
  type LotteryAlgorithmConfigFormData,
} from "~/server/db/schema";

/**
 * Get algorithm config for lottery processing
 * Since defaults are defined in schema, table may be empty - returns defaults if no row exists
 */
export async function getAlgorithmConfig(): Promise<LotteryAlgorithmConfigFormData> {
  const config = await db.query.lotteryAlgorithmConfig.findFirst({
    where: eq(lotteryAlgorithmConfig.id, 1),
  });

  if (config) {
    return {
      fastThresholdMinutes: config.fastThresholdMinutes,
      averageThresholdMinutes: config.averageThresholdMinutes,
      speedBonuses: config.speedBonuses,
    };
  }

  // Return defaults if no config exists (singleton not yet created)
  return {
    fastThresholdMinutes: 235,
    averageThresholdMinutes: 245,
    speedBonuses: DEFAULT_POSITION_BONUSES,
  };
}
