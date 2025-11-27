import { index, integer, timestamp, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  createInsertSchema,
  createUpdateSchema,
  createSelectSchema,
} from "drizzle-zod";
import { z } from "zod";
import { createTable } from "../../helpers";

// Member fairness scores (monthly reset system)
// Note: memberId references members.id which is defined in schema.ts
// The reference uses a function to avoid circular imports
import { members } from "../core/members.schema";

export const memberFairnessScores = createTable(
  "member_fairness_scores",
  {
    memberId: integer("member_id")
      .references(() => members.id, { onDelete: "cascade" })
      .notNull(),
    currentMonth: varchar("current_month", { length: 7 }).notNull(), // "2024-01"
    totalEntriesMonth: integer("total_entries_month").notNull().default(0),
    preferencesGrantedMonth: integer("preferences_granted_month")
      .notNull()
      .default(0),
    preferenceFulfillmentRate: integer("preference_fulfillment_rate")
      .notNull()
      .default(0), // 0-100 percentage
    daysWithoutGoodTime: integer("days_without_good_time").notNull().default(0),
    fairnessScore: integer("fairness_score").notNull().default(0), // Final calculated fairness score
    lastUpdated: timestamp("last_updated", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("member_fairness_scores_member_id_month_idx").on(
      table.memberId,
      table.currentMonth,
    ),
    index("member_fairness_scores_fairness_idx").on(table.fairnessScore),
    index("member_fairness_scores_month_idx").on(table.currentMonth),
  ],
);

// Auto-generated schemas
export const memberFairnessScoresSelectSchema =
  createSelectSchema(memberFairnessScores);
export const memberFairnessScoresInsertSchema =
  createInsertSchema(memberFairnessScores);
export const memberFairnessScoresUpdateSchema =
  createUpdateSchema(memberFairnessScores);

// Type exports
export type MemberFairnessScore = z.infer<
  typeof memberFairnessScoresSelectSchema
>;
export type MemberFairnessScoreInsert = z.infer<
  typeof memberFairnessScoresInsertSchema
>;
export type MemberFairnessScoreUpdate = z.infer<
  typeof memberFairnessScoresUpdateSchema
>;
