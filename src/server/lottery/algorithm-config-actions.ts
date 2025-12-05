"use server";

import { db } from "~/server/db";
import { lotteryAlgorithmConfig } from "~/server/db/schema";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "~/lib/auth-server";
import type { LotteryAlgorithmConfigFormData } from "~/server/db/schema";

/**
 * Update algorithm config (for useActionState pattern)
 * Upserts the singleton row (creates if not exists, updates if exists)
 */
export async function updateAlgorithmConfigAction(
  prevState: null,
  params: LotteryAlgorithmConfigFormData,
): Promise<null> {
  await requireAdmin();

  const { fastThresholdMinutes, averageThresholdMinutes, speedBonuses } =
    params;

  // Upsert the config (singleton row with id=1)
  await db
    .insert(lotteryAlgorithmConfig)
    .values({
      id: 1,
      fastThresholdMinutes,
      averageThresholdMinutes,
      speedBonuses,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: lotteryAlgorithmConfig.id,
      set: {
        fastThresholdMinutes,
        averageThresholdMinutes,
        speedBonuses,
        updatedAt: new Date(),
      },
    });

  // Revalidate relevant pages
  revalidatePath("/admin/lottery/[date]", "page");
  revalidatePath("/admin/lottery/member-profiles");

  return null;
}
