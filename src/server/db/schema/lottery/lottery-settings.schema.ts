import { sql } from "drizzle-orm";
import {
  integer,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import {
  createInsertSchema,
  createUpdateSchema,
  createSelectSchema,
} from "drizzle-zod";
import { z } from "zod";
import { createTable } from "../../helpers";

/**
 * Lottery Settings - Singleton Table
 * Stores global lottery configuration settings.
 * This table should always have exactly one row with id=1.
 */
export const lotterySettings = createTable("lottery_settings", {
  id: integer("id").primaryKey().default(1),
  
  // How many days in advance lottery form becomes available
  lotteryAdvanceDays: integer("lottery_advance_days")
    .default(3)
    .notNull(),
  
  // Maximum days ahead that lottery entries can be submitted
  lotteryMaxDaysAhead: integer("lottery_max_days_ahead")
    .default(60)
    .notNull(),

  // Audit fields
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull()
    .$onUpdate(() => new Date()),
  updatedBy: varchar("updated_by", { length: 100 }),
});

// Auto-generated schemas
export const lotterySettingsSelectSchema = createSelectSchema(lotterySettings);
export const lotterySettingsInsertSchema = createInsertSchema(lotterySettings);
export const lotterySettingsUpdateSchema = createUpdateSchema(lotterySettings);

// Form schema for settings updates
export const lotterySettingsFormSchema = z.object({
  lotteryAdvanceDays: z.number().int().min(0).max(365),
  lotteryMaxDaysAhead: z.number().int().min(1).max(365),
});

// Type exports
export type LotterySettings = z.infer<typeof lotterySettingsSelectSchema>;
export type LotterySettingsInsert = z.infer<typeof lotterySettingsInsertSchema>;
export type LotterySettingsUpdate = z.infer<typeof lotterySettingsUpdateSchema>;
export type LotterySettingsFormData = z.infer<typeof lotterySettingsFormSchema>;

