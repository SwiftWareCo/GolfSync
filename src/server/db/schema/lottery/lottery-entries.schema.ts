import { sql } from "drizzle-orm";
import {
  index,
  integer,
  timestamp,
  varchar,
  date,
  unique,
  pgEnum,
} from "drizzle-orm/pg-core";
import {
  createInsertSchema,
  createUpdateSchema,
  createSelectSchema,
} from "drizzle-zod";
import { z } from "zod";
import { createTable } from "../../helpers";



// Consolidated lottery entries table (individual + group)
// Type Detection: INDIVIDUAL if memberIds.length === 1
//                 GROUP if memberIds.length > 1
// organizerId is ALWAYS set to the entry creator
export const lotteryEntries = createTable(
  "lottery_entries",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    memberIds: integer("member_ids").array().notNull(), // ALL members including organizer
    organizerId: integer("organizer_id").notNull(), // Always set - the entry creator
    lotteryDate: date("lottery_date").notNull(),
    preferredWindow: varchar("preferred_window", { length: 20 }).notNull(), // MORNING, MIDDAY, AFTERNOON, EVENING
    alternateWindow: varchar("alternate_window", { length: 20 }), // Backup choice
    status: varchar("status", { length: 20 }).notNull().default("PENDING"), // PENDING, PROCESSING, ASSIGNED, CANCELLED
    submissionTimestamp: timestamp("submission_timestamp", {
      withTimezone: true,
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    assignedTimeBlockId: integer("assigned_time_block_id"), // References timeBlocks.id
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [
    index("lottery_entries_lottery_date_idx").on(table.lotteryDate),
    index("lottery_entries_status_idx").on(table.status),
    index("lottery_entries_date_status_idx").on(table.lotteryDate, table.status),
    index("lottery_entries_organizer_id_idx").on(table.organizerId),
    index("lottery_entries_organizer_date_idx").on(
      table.organizerId,
      table.lotteryDate,
    ),
    // Unique constraint: one entry per organizer per date
    unique("lottery_entries_organizer_date_unq").on(
      table.organizerId,
      table.lotteryDate,
    ),
  ],
);

// Auto-generated form validation schema from DB table
export const lotteryEntriesInsertSchema = createInsertSchema(lotteryEntries);
export const lotteryEntrySelectSchema = createSelectSchema(lotteryEntries);
export const lotteryEntryUpdateSchema = createUpdateSchema(lotteryEntries);

// Composite schema that includes fills (separate table)
// This combines lottery entry data with fill objects for form submission
// Note: Form uses simple objects, server transforms to add relatedType and relatedId
export const lotteryEntryWithFillsSchema = lotteryEntriesInsertSchema.extend({
  fills: z.array(z.object({
    fillType: z.string(),
    customName: z.string().optional(),
  })).optional(),
});

// Relations
// Note: Cross-domain relations (to members, timeBlocks, fills) are defined in schema.ts
// to avoid circular import issues. This file only defines fills relations.

// Type exports
export type LotteryEntry = z.infer<typeof lotteryEntrySelectSchema>;
export type LotteryEntryInsert = z.infer<typeof lotteryEntriesInsertSchema>;
export type LotteryEntryUpdate = z.infer<typeof lotteryEntryUpdateSchema>;
export type LotteryFormInput = z.infer<typeof lotteryEntryWithFillsSchema>;

// Lottery entry data return type for member view (discriminated union)
// Used by getLotteryEntryData() to distinguish individual/group/group_member entries
export type LotteryEntryData =
  | { type: "individual"; entry: LotteryEntry }
  | { type: "group"; entry: LotteryEntry }
  | { type: "group_member"; entry: LotteryEntry }
  | null;
