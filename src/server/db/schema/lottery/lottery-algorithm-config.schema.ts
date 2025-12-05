import { sql } from "drizzle-orm";
import { integer, timestamp, varchar, jsonb } from "drizzle-orm/pg-core";
import {
  createInsertSchema,
  createUpdateSchema,
  createSelectSchema,
} from "drizzle-zod";
import { z } from "zod";
import { createTable } from "../../helpers";

// Type for speed bonus configuration per time window
export interface SpeedBonusConfig {
  window: "MORNING" | "MIDDAY" | "AFTERNOON" | "EVENING";
  fastBonus: number;
  averageBonus: number;
  slowBonus: number;
}

// Default speed bonuses - exported for use in data layer
export const DEFAULT_SPEED_BONUSES: SpeedBonusConfig[] = [
  { window: "MORNING", fastBonus: 5, averageBonus: 2, slowBonus: 0 },
  { window: "MIDDAY", fastBonus: 2, averageBonus: 1, slowBonus: 0 },
  { window: "AFTERNOON", fastBonus: 0, averageBonus: 0, slowBonus: 0 },
  { window: "EVENING", fastBonus: 0, averageBonus: 0, slowBonus: 0 },
];

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

  // Speed bonuses per time window (JSONB)
  speedBonuses: jsonb("speed_bonuses")
    .$type<SpeedBonusConfig[]>()
    .default(DEFAULT_SPEED_BONUSES)
    .notNull(),

  // Audit fields
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull()
    .$onUpdate(() => new Date()),
  updatedBy: varchar("updated_by", { length: 100 }),
});

// Zod schema for speed bonus configuration
export const speedBonusConfigSchema = z.object({
  window: z.enum(["MORNING", "MIDDAY", "AFTERNOON", "EVENING"]),
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
      speedBonuses: z.array(speedBonusConfigSchema),
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
