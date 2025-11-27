import { sql } from "drizzle-orm";
import {
  index,
  integer,
  timestamp,
  varchar,
  date,
  unique,
  boolean,
  text,
} from "drizzle-orm/pg-core";
import {
  createInsertSchema,
  createUpdateSchema,
  createSelectSchema,
} from "drizzle-zod";
import { z } from "zod";
import { createTable } from "../../helpers";

// Teesheets table
export const teesheets = createTable(
  "teesheets",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    date: date("date").notNull(),
    configId: integer("config_id").references(
      () => {
        return (require("../../schema") as any).teesheetConfigs.id;
      },
      { onDelete: "set null" },
    ),
    generalNotes: text("general_notes"),
    isPublic: boolean("is_public").default(false).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    publishedBy: varchar("published_by", { length: 100 }),
    privateMessage: text("private_message").default(
      "This teesheet is not yet available for booking.",
    ),
    lotteryEnabled: boolean("lottery_enabled").default(true).notNull(),
    lotteryDisabledMessage: text("lottery_disabled_message").default(
      "Lottery signup is disabled for this date",
    ),
    disallowMemberBooking: boolean("disallow_member_booking")
      .default(false)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [
    unique("teesheets_date_unq").on(table.date),
    index("teesheets_date_idx").on(table.date),
    index("teesheets_is_public_idx").on(table.isPublic),
  ],
);

// Time blocks table
export const timeBlocks = createTable(
  "time_blocks",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    teesheetId: integer("teesheet_id")
      .references(() => teesheets.id, { onDelete: "cascade" })
      .notNull(),
    startTime: varchar("start_time", { length: 5 }).notNull(),
    endTime: varchar("end_time", { length: 5 }).notNull(),
    maxMembers: integer("max_members").notNull().default(4),
    displayName: varchar("display_name", { length: 100 }),
    sortOrder: integer("sort_order").notNull().default(0),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [index("timeblocks_teesheet_id_idx").on(table.teesheetId)],
);

// Pace of Play table
export const paceOfPlay = createTable(
  "pace_of_play",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    timeBlockId: integer("time_block_id").references(() => timeBlocks.id, {
      onDelete: "set null",
    }),
    startTime: timestamp("start_time", { withTimezone: true }),
    turn9Time: timestamp("turn9_time", { withTimezone: true }),
    finishTime: timestamp("finish_time", { withTimezone: true }),
    expectedStartTime: timestamp("expected_start_time", {
      withTimezone: true,
    }).notNull(),
    expectedTurn9Time: timestamp("expected_turn9_time", {
      withTimezone: true,
    }).notNull(),
    expectedFinishTime: timestamp("expected_finish_time", {
      withTimezone: true,
    }).notNull(),
    status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, on_time, behind, ahead, completed
    lastUpdatedBy: varchar("last_updated_by", { length: 100 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [
    index("pace_of_play_time_block_id_idx").on(table.timeBlockId),
    index("pace_of_play_status_idx").on(table.status),
    unique("pace_of_play_time_block_id_unq").on(table.timeBlockId),
  ],
);

// Auto-generated schemas for teesheets
export const teesheetsSelectSchema = createSelectSchema(teesheets);
export const teesheetsInsertSchema = createInsertSchema(teesheets);
export const teesheetsUpdateSchema = createUpdateSchema(teesheets);

// Auto-generated schemas for timeBlocks
export const timeBlocksSelectSchema = createSelectSchema(timeBlocks);
export const timeBlocksInsertSchema = createInsertSchema(timeBlocks);
export const timeBlocksUpdateSchema = createUpdateSchema(timeBlocks);

// Auto-generated schemas for paceOfPlay
export const paceOfPlaySelectSchema = createSelectSchema(paceOfPlay);
export const paceOfPlayInsertSchema = createInsertSchema(paceOfPlay);
export const paceOfPlayUpdateSchema = createUpdateSchema(paceOfPlay);

// Relations are defined in schema.ts to avoid circular imports

// Type exports
export type Teesheet = z.infer<typeof teesheetsSelectSchema>;
export type TeesheetInsert = z.infer<typeof teesheetsInsertSchema>;
export type TeesheetUpdate = z.infer<typeof teesheetsUpdateSchema>;

export type TimeBlock = z.infer<typeof timeBlocksSelectSchema>;
export type TimeBlockInsert = z.infer<typeof timeBlocksInsertSchema>;
export type TimeBlockUpdate = z.infer<typeof timeBlocksUpdateSchema>;

export type PaceOfPlay = z.infer<typeof paceOfPlaySelectSchema>;
export type PaceOfPlayInsert = z.infer<typeof paceOfPlayInsertSchema>;
export type PaceOfPlayUpdate = z.infer<typeof paceOfPlayUpdateSchema>;
