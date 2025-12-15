import { sql } from "drizzle-orm";
import { index, integer, timestamp, varchar } from "drizzle-orm/pg-core";
import {
  createInsertSchema,
  createUpdateSchema,
  createSelectSchema,
} from "drizzle-zod";
import { z } from "zod";
import { createTable } from "../helpers";

// Saved fills for reusable custom fills
export const fillsSaved = createTable(
  "fills_saved",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    name: varchar("name", { length: 100 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [index("fills_saved_name_idx").on(table.name)],
);

// Auto-generated schemas
export const fillSavedSelectSchema = createSelectSchema(fillsSaved);
export const fillSavedInsertSchema = createInsertSchema(fillsSaved);
export const fillSavedUpdateSchema = createUpdateSchema(fillsSaved);

// Type exports
export type FillSaved = z.infer<typeof fillSavedSelectSchema>;
export type FillSavedInsert = z.infer<typeof fillSavedInsertSchema>;
export type FillSavedUpdate = z.infer<typeof fillSavedUpdateSchema>;
