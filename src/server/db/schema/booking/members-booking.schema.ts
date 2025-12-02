import { sql } from "drizzle-orm";
import {
  index,
  integer,
  timestamp,
  varchar,
  date,
  unique,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import {
  createInsertSchema,
  createUpdateSchema,
  createSelectSchema,
} from "drizzle-zod";
import { z } from "zod";
import { createTable } from "../../helpers";
import { timeBlocks } from "./timeblocks.schema";
import { members } from "../core/members.schema";
import { guests } from "../core/guests.schema";

// Time block members (join table)
export const timeBlockMembers = createTable(
  "time_block_members",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    timeBlockId: integer("time_block_id")
      .references(() => timeBlocks.id, { onDelete: "cascade" })
      .notNull(),
    memberId: integer("member_id")
      .references(() => members.id, { onDelete: "cascade" })
      .notNull(),
    bookingDate: date("booking_date").notNull(),
    bookingTime: varchar("booking_time", { length: 5 }).notNull(),
    checkedIn: boolean("checked_in").default(false),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("block_members_time_block_id_idx").on(table.timeBlockId),
    index("block_members_member_id_idx").on(table.memberId),
    index("block_members_booking_date_idx").on(table.bookingDate),
    index("block_members_booking_datetime_idx").on(
      table.bookingDate,
      table.bookingTime,
    ),
    index("block_members_member_date_idx").on(
      table.memberId,
      table.bookingDate,
    ),
    index("block_members_created_at_idx").on(table.createdAt),
    index("block_members_member_created_idx").on(
      table.memberId,
      table.createdAt,
    ),
    unique("block_members_time_block_member_unq").on(
      table.timeBlockId,
      table.memberId,
    ),
  ],
);

// Time block guests (join table)
export const timeBlockGuests = createTable(
  "time_block_guests",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    timeBlockId: integer("time_block_id")
      .references(() => timeBlocks.id, { onDelete: "cascade" })
      .notNull(),
    guestId: integer("guest_id")
      .references(() => guests.id, { onDelete: "cascade" })
      .notNull(),
    invitedByMemberId: integer("invited_by_member_id")
      .references(() => members.id)
      .notNull(),
    bookingDate: date("booking_date").notNull(),
    bookingTime: varchar("booking_time", { length: 5 }).notNull(),
    checkedIn: boolean("checked_in").default(false),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("block_guests_time_block_id_idx").on(table.timeBlockId),
    index("block_guests_guest_id_idx").on(table.guestId),
    index("block_guests_booking_date_idx").on(table.bookingDate),
    index("block_guests_booking_datetime_idx").on(
      table.bookingDate,
      table.bookingTime,
    ),
    index("block_guests_created_at_idx").on(table.createdAt),
    index("block_guests_guest_created_idx").on(table.guestId, table.createdAt),
    unique("block_guests_time_block_guest_unq").on(
      table.timeBlockId,
      table.guestId,
    ),
  ],
);

// Auto-generated schemas for timeBlockMembers
export const timeBlockMembersSelectSchema =
  createSelectSchema(timeBlockMembers);
export const timeBlockMembersInsertSchema =
  createInsertSchema(timeBlockMembers);
export const timeBlockMembersUpdateSchema =
  createUpdateSchema(timeBlockMembers);

// Auto-generated schemas for timeBlockGuests
export const timeBlockGuestsSelectSchema = createSelectSchema(timeBlockGuests);
export const timeBlockGuestsInsertSchema = createInsertSchema(timeBlockGuests);
export const timeBlockGuestsUpdateSchema = createUpdateSchema(timeBlockGuests);

// Relations are defined in schema.ts to avoid circular imports

// Type exports
export type TimeBlockMember = z.infer<typeof timeBlockMembersSelectSchema>;
export type TimeBlockMemberInsert = z.infer<
  typeof timeBlockMembersInsertSchema
>;
export type TimeBlockMemberUpdate = z.infer<
  typeof timeBlockMembersUpdateSchema
>;

export type TimeBlockGuest = z.infer<typeof timeBlockGuestsSelectSchema>;
export type TimeBlockGuestInsert = z.infer<typeof timeBlockGuestsInsertSchema>;
export type TimeBlockGuestUpdate = z.infer<typeof timeBlockGuestsUpdateSchema>;
