import { sql } from "drizzle-orm";
import {
  index,
  integer,
  timestamp,
  varchar,
  boolean,
  text,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";
import {
  createInsertSchema,
  createUpdateSchema,
  createSelectSchema,
} from "drizzle-zod";
import { z } from "zod";
import { createTable } from "../../helpers";

// Event registrations table
export const eventRegistrations = createTable(
  "event_registrations",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    eventId: integer("event_id")
      .references(() => {
        return (require("../../schema") as any).events.id;
      }, { onDelete: "cascade" })
      .notNull(),
    memberId: integer("member_id")
      .references(() => {
        return (require("../../schema") as any).members.id;
      }, { onDelete: "cascade" })
      .notNull(),
    status: varchar("status", { length: 20 }).default("PENDING").notNull(), // PENDING, APPROVED, REJECTED
    notes: text("notes"),
    teamMemberIds: integer("team_member_ids").array(), // Array of member IDs in team
    fills: jsonb("fills"), // Array of {fillType, customName} objects
    isTeamCaptain: boolean("is_team_captain").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date()
    ),
  },
  (table) => [
    index("event_registrations_event_id_idx").on(table.eventId),
    index("event_registrations_member_id_idx").on(table.memberId),
    unique("event_registrations_event_member_unq").on(
      table.eventId,
      table.memberId
    ),
  ]
);

// Auto-generated schemas for eventRegistrations
export const eventRegistrationsSelectSchema = createSelectSchema(
  eventRegistrations
);
export const eventRegistrationsInsertSchema = createInsertSchema(
  eventRegistrations
);
export const eventRegistrationsUpdateSchema = createUpdateSchema(
  eventRegistrations
);

// Relations are defined in schema.ts to avoid circular imports
// (they reference tables from other domains)

// Type exports
export type EventRegistration = z.infer<typeof eventRegistrationsSelectSchema>;
export type EventRegistrationInsert = z.infer<
  typeof eventRegistrationsInsertSchema
>;
export type EventRegistrationUpdate = z.infer<
  typeof eventRegistrationsUpdateSchema
>;
