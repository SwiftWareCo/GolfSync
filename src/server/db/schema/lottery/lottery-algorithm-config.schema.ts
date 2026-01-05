import { sql } from "drizzle-orm";
import { integer, timestamp, varchar, jsonb } from "drizzle-orm/pg-core";
import {
  createInsertSchema,
  createUpdateSchema,
  createSelectSchema,
} from "drizzle-zod";
import { z } from "zod";
import { createTable } from "../../helpers";

// Position type for relative time-of-day (first 25%, 25-50%, etc.)
export type WindowPosition = "early" | "mid_early" | "mid_late" | "late";

// Position-based speed bonus configuration
// Applied based on relative position in day (instead of fixed windows)
export interface PositionSpeedBonusConfig {
  position: WindowPosition;
  fastBonus: number;
  averageBonus: number;
  slowBonus: number;
}

// Default position-based speed bonuses - exported for use in data layer
// "early" = first 25% of windows, "mid_early" = 25-50%, etc.
export const DEFAULT_POSITION_BONUSES: PositionSpeedBonusConfig[] = [
  { position: "early", fastBonus: 5, averageBonus: 2, slowBonus: 0 },
  { position: "mid_early", fastBonus: 2, averageBonus: 1, slowBonus: 0 },
  { position: "mid_late", fastBonus: 0, averageBonus: 0, slowBonus: 0 },
  { position: "late", fastBonus: 0, averageBonus: 0, slowBonus: 0 },
];

// Legacy type for backwards compatibility (deprecated)
export interface SpeedBonusConfig {
  window: "MORNING" | "MIDDAY" | "AFTERNOON" | "EVENING";
  fastBonus: number;
  averageBonus: number;
  slowBonus: number;
}

/**
 * Lottery Algorithm Configuration - Singleton Table
 * Stores configurable settings for the lottery processing algorithm.
 * This table should always have exactly one row with id=1.
 */
export const lotteryAlgorithmConfig = createTable("lottery_algorithm_config", {
  id: integer("id").primaryKey().default(1),

  // Speed tier thresholds (in total round minutes)
  // FAST: <= fastThresholdMinutes (default 235 = 3:55)
  // AVERAGE: <= averageThresholdMinutes (default 245 = 4:05)
  // SLOW: > averageThresholdMinutes
  fastThresholdMinutes: integer("fast_threshold_minutes")
    .default(235)
    .notNull(),
  averageThresholdMinutes: integer("average_threshold_minutes")
    .default(245)
    .notNull(),

  // Position-based speed bonuses (JSONB)
  // Applied based on relative position in day (early/mid_early/mid_late/late)
  speedBonuses: jsonb("speed_bonuses")
    .$type<PositionSpeedBonusConfig[]>()
    .default(DEFAULT_POSITION_BONUSES)
    .notNull(),

  // Audit fields
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull()
    .$onUpdate(() => new Date()),
  updatedBy: varchar("updated_by", { length: 100 }),
});

// Zod schema for position-based speed bonus configuration
export const positionSpeedBonusConfigSchema = z.object({
  position: z.enum(["early", "mid_early", "mid_late", "late"]),
  fastBonus: z.number().min(0).max(50),
  averageBonus: z.number().min(0).max(50),
  slowBonus: z.number().min(0).max(50),
});

// Auto-generated schemas
export const lotteryAlgorithmConfigSelectSchema = createSelectSchema(
  lotteryAlgorithmConfig,
);
export const lotteryAlgorithmConfigInsertSchema = createInsertSchema(
  lotteryAlgorithmConfig,
);
export const lotteryAlgorithmConfigUpdateSchema = createUpdateSchema(
  lotteryAlgorithmConfig,
);

// Form schema - extends insert schema with additional validation
export const lotteryAlgorithmConfigFormSchema =
  lotteryAlgorithmConfigInsertSchema
    .pick({
      fastThresholdMinutes: true,
      averageThresholdMinutes: true,
      speedBonuses: true,
    })
    .extend({
      fastThresholdMinutes: z
        .number()
        .min(1, "Must be at least 1")
        .max(600, "Must be at most 600"),
      averageThresholdMinutes: z
        .number()
        .min(1, "Must be at least 1")
        .max(600, "Must be at most 600"),
      speedBonuses: z.array(positionSpeedBonusConfigSchema),
    })
    .refine(
      (data) => data.fastThresholdMinutes < data.averageThresholdMinutes,
      {
        message: "Fast threshold must be less than average threshold",
        path: ["fastThresholdMinutes"],
      },
    );

export type LotteryAlgorithmConfigFormData = z.infer<
  typeof lotteryAlgorithmConfigFormSchema
>;

// Type exports
export type LotteryAlgorithmConfig = z.infer<
  typeof lotteryAlgorithmConfigSelectSchema
>;
export type LotteryAlgorithmConfigInsert = z.infer<
  typeof lotteryAlgorithmConfigInsertSchema
>;
export type LotteryAlgorithmConfigUpdate = z.infer<
  typeof lotteryAlgorithmConfigUpdateSchema
>;
