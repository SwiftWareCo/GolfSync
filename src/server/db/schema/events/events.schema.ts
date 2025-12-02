import { sql } from "drizzle-orm";
import {
  index,
  integer,
  timestamp,
  varchar,
  date,
  boolean,
  text,
  real,
  unique,
} from "drizzle-orm/pg-core";
import {
  createInsertSchema,
  createUpdateSchema,
  createSelectSchema,
} from "drizzle-zod";
import { z } from "zod";
import { createTable } from "../../helpers";

// Events table
export const events = createTable(
  "events",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description").notNull(),
    eventType: varchar("event_type", { length: 20 }).notNull(), // DINNER, TOURNAMENT, SOCIAL, etc.
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    startTime: varchar("start_time", { length: 5 }),
    endTime: varchar("end_time", { length: 5 }),
    location: varchar("location", { length: 100 }),
    capacity: integer("capacity"),
    requiresApproval: boolean("requires_approval").default(false),
    registrationDeadline: date("registration_deadline"),
    isActive: boolean("is_active").default(true),
    memberClassIds: integer("member_class_ids").array(),
    teamSize: integer("team_size").default(1).notNull(), // 1, 2, or 4 players
    guestsAllowed: boolean("guests_allowed").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [
    index("events_type_idx").on(table.eventType),
    index("events_date_idx").on(table.startDate),
  ],
);

// Event Details for tournaments or special events
export const eventDetails = createTable(
  "event_details",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    eventId: integer("event_id")
      .references(() => events.id, { onDelete: "cascade" })
      .notNull(),
    format: varchar("format", { length: 50 }), // For tournaments: Scramble, Stroke Play, etc.
    rules: text("rules"),
    prizes: text("prizes"),
    entryFee: real("entry_fee"),
    additionalInfo: text("additional_info"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [
    index("event_details_event_id_idx").on(table.eventId),
    unique("event_details_event_id_unq").on(table.eventId),
  ],
);

// Auto-generated schemas for events
export const eventsSelectSchema = createSelectSchema(events);
export const eventsInsertSchema = createInsertSchema(events);
export const eventsUpdateSchema = createUpdateSchema(events);

// Auto-generated schemas for eventDetails
export const eventDetailsSelectSchema = createSelectSchema(eventDetails);
export const eventDetailsInsertSchema = createInsertSchema(eventDetails);
export const eventDetailsUpdateSchema = createUpdateSchema(eventDetails);

// Relations are defined in schema.ts to avoid circular imports

// eventsRelations is defined in schema.ts to avoid circular imports
// (it references eventRegistrations which is in a different domain)

// Type exports
export type Event = z.infer<typeof eventsSelectSchema>;
export type EventInsert = z.infer<typeof eventsInsertSchema>;
export type EventUpdate = z.infer<typeof eventsUpdateSchema>;

export type EventDetail = z.infer<typeof eventDetailsSelectSchema>;
export type EventDetailInsert = z.infer<typeof eventDetailsInsertSchema>;
export type EventDetailUpdate = z.infer<typeof eventDetailsUpdateSchema>;
