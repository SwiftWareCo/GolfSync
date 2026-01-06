import { sql } from "drizzle-orm";
import {
  index,
  integer,
  timestamp,
  varchar,
  date,
  text,
  unique,
} from "drizzle-orm/pg-core";
import {
  createInsertSchema,
  createUpdateSchema,
  createSelectSchema,
} from "drizzle-zod";
import { z } from "zod";
import { createTable } from "../../helpers";
import { members } from "../core/members.schema";

// Tracks each lottery processing run for audit and log display
export const lotteryProcessingRuns = createTable(
  "lottery_processing_runs",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    lotteryDate: date("lottery_date").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    processedByAdminId: integer("processed_by_admin_id").references(
      () => members.id,
    ),

    // Processing stats
    totalEntries: integer("total_entries").notNull(),
    assignedCount: integer("assigned_count").notNull(),
    groupCount: integer("group_count").notNull(),
    individualCount: integer("individual_count").notNull(),
    violationCount: integer("violation_count").notNull().default(0),

    // Workflow tracking
    fairnessAssignedAt: timestamp("fairness_assigned_at", {
      withTimezone: true,
    }),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),

    notes: text("notes"),
  },
  (table) => [
    index("lottery_processing_runs_date_idx").on(table.lotteryDate),
    index("lottery_processing_runs_processed_at_idx").on(table.processedAt),
    // Only one processing run per date (can reprocess, but creates new run)
    unique("lottery_processing_runs_date_unq").on(table.lotteryDate),
  ],
);

// Auto-generated schemas
export const lotteryProcessingRunsSelectSchema = createSelectSchema(
  lotteryProcessingRuns,
);
export const lotteryProcessingRunsInsertSchema = createInsertSchema(
  lotteryProcessingRuns,
);
export const lotteryProcessingRunsUpdateSchema = createUpdateSchema(
  lotteryProcessingRuns,
);

// Type exports
export type LotteryProcessingRun = z.infer<
  typeof lotteryProcessingRunsSelectSchema
>;
export type LotteryProcessingRunInsert = z.infer<
  typeof lotteryProcessingRunsInsertSchema
>;
export type LotteryProcessingRunUpdate = z.infer<
  typeof lotteryProcessingRunsUpdateSchema
>;
