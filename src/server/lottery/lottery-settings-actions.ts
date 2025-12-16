"use server";

import { db } from "~/server/db";
import { lotterySettings } from "~/server/db/schema";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "~/lib/auth-server";
import type { LotterySettingsFormData } from "~/server/db/schema";

/**
 * Update lottery settings (singleton row with id=1)
 * Upserts the singleton row (creates if not exists, updates if exists)
 */
export async function updateLotterySettings(
  data: LotterySettingsFormData,
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();

  try {
    const { lotteryAdvanceDays, lotteryMaxDaysAhead } = data;

    // Upsert the settings (singleton row with id=1)
    await db
      .insert(lotterySettings)
      .values({
        id: 1,
        lotteryAdvanceDays,
        lotteryMaxDaysAhead,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: lotterySettings.id,
        set: {
          lotteryAdvanceDays,
          lotteryMaxDaysAhead,
          updatedAt: new Date(),
        },
      });

    // Revalidate relevant pages
    revalidatePath("/admin/settings");
    revalidatePath("/members/teesheet");

    return { success: true };
  } catch (error) {
    console.error("Error updating lottery settings:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update lottery settings",
    };
  }
}

