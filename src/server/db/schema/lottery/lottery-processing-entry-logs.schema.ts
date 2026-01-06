import { sql } from "drizzle-orm";
import {
  index,
  integer,
  timestamp,
  varchar,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import {
  createInsertSchema,
  createUpdateSchema,
  createSelectSchema,
} from "drizzle-zod";
import { z } from "zod";
import { createTable } from "../../helpers";
import { lotteryProcessingRuns } from "./lottery-processing-runs.schema";
import { lotteryEntries } from "./lottery-entries.schema";
import { timeBlocks } from "../booking/timeblocks.schema";

// Detailed per-entry log for each lottery processing run
export const lotteryProcessingEntryLogs = createTable(
  "lottery_processing_entry_logs",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    runId: integer("run_id")
      .notNull()
      .references(() => lotteryProcessingRuns.id, { onDelete: "cascade" }),
    entryId: integer("entry_id")
      .notNull()
      .references(() => lotteryEntries.id, { onDelete: "cascade" }),
    entryType: varchar("entry_type", { length: 20 }).notNull(), // GROUP, INDIVIDUAL

    // Window preferences from entry
    preferredWindow: varchar("preferred_window", { length: 10 }),
    alternateWindow: varchar("alternate_window", { length: 10 }),

    // Algorithm's initial assignment (before any manual admin changes)
    autoAssignedTimeBlockId: integer("auto_assigned_time_block_id").references(
      () => timeBlocks.id,
    ),
    autoAssignedStartTime: varchar("auto_assigned_start_time", { length: 10 }),

    // Final assignment (may differ if admin made changes)
    finalTimeBlockId: integer("final_time_block_id").references(
      () => timeBlocks.id,
    ),
    finalStartTime: varchar("final_start_time", { length: 10 }),

    // Assignment reason and violations
    assignmentReason: varchar("assignment_reason", { length: 50 }).notNull(),
    // Values: PREFERRED_MATCH, ALTERNATE_MATCH, ALLOWED_FALLBACK, RESTRICTION_VIOLATION
    violatedRestrictions: boolean("violated_restrictions").default(false),
    restrictionDetails: jsonb("restriction_details"), // { restrictionIds: [], reasons: [] }

    // Fairness tracking (populated when fairness scores are assigned)
    fairnessScoreBefore: integer("fairness_score_before"),
    fairnessScoreAfter: integer("fairness_score_after"),
    fairnessScoreDelta: integer("fairness_score_delta"),
    preferenceGranted: boolean("preference_granted"),

    processedAt: timestamp("processed_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("lottery_processing_entry_logs_run_id_idx").on(table.runId),
    index("lottery_processing_entry_logs_entry_id_idx").on(table.entryId),
    index("lottery_processing_entry_logs_entry_type_idx").on(table.entryType),
    index("lottery_processing_entry_logs_violated_idx").on(
      table.violatedRestrictions,
    ),
  ],
);

// Auto-generated schemas
export const lotteryProcessingEntryLogsSelectSchema = createSelectSchema(
  lotteryProcessingEntryLogs,
);
export const lotteryProcessingEntryLogsInsertSchema = createInsertSchema(
  lotteryProcessingEntryLogs,
);
export const lotteryProcessingEntryLogsUpdateSchema = createUpdateSchema(
  lotteryProcessingEntryLogs,
);

// Type exports
export type LotteryProcessingEntryLog = z.infer<
  typeof lotteryProcessingEntryLogsSelectSchema
>;
export type LotteryProcessingEntryLogInsert = z.infer<
  typeof lotteryProcessingEntryLogsInsertSchema
>;
export type LotteryProcessingEntryLogUpdate = z.infer<
  typeof lotteryProcessingEntryLogsUpdateSchema
>;
