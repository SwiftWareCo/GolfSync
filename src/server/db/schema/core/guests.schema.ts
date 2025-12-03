import { sql } from "drizzle-orm";
import { index, integer, timestamp, varchar } from "drizzle-orm/pg-core";
import {
  createInsertSchema,
  createUpdateSchema,
  createSelectSchema,
} from "drizzle-zod";
import { z } from "zod";
import { createTable } from "../../helpers";

// Guests table
export const guests = createTable(
  "guests",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    firstName: varchar("first_name", { length: 50 }).notNull(),
    lastName: varchar("last_name", { length: 50 }).notNull(),
    email: varchar("email", { length: 100 }),
    phone: varchar("phone", { length: 20 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [index("guests_name_idx").on(table.firstName, table.lastName)],
);

// Auto-generated schemas for guests
export const guestsSelectSchema = createSelectSchema(guests);
export const guestsInsertSchema = createInsertSchema(guests);
export const guestsUpdateSchema = createUpdateSchema(guests);

// Relations are defined in schema.ts to avoid circular imports

// Type exports
export type Guest = z.infer<typeof guestsSelectSchema>;
export type GuestSelect = z.infer<typeof guestsSelectSchema>;
export type GuestInsert = z.infer<typeof guestsInsertSchema>;
export type GuestUpdate = z.infer<typeof guestsUpdateSchema>;
