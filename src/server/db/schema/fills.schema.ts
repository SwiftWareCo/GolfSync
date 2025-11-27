import {
  index,
  integer,
  timestamp,
  varchar,
  pgEnum,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  createInsertSchema,
  createUpdateSchema,
  createSelectSchema,
} from "drizzle-zod";
import { z } from "zod";
import { createTable } from "../helpers";

// Enums for fill types
export const fillTypeEnum = pgEnum("fill_type", [
  "guest_fill",
  "reciprocal_fill",
  "custom_fill",
]);

export const fillRelatedTypeEnum = pgEnum("fill_related_type", [
  "lottery_entry",
  "timeblock",
]);

// Fills table for both lottery entries and timeblocks
export const fills = createTable(
  "fills",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    relatedType: fillRelatedTypeEnum("related_type").notNull(), // 'lottery_entry' or 'timeblock'
    relatedId: integer("related_id").notNull(), // entryId or timeBlockId
    fillType: varchar("fill_type", { length: 50 }).notNull(),
    customName: varchar("custom_name", { length: 100 }), // Only for CUSTOM fill type
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [
    index("fills_related_type_idx").on(table.relatedType),
    index("fills_related_type_id_idx").on(table.relatedType, table.relatedId),
  ],
);

// Auto-generated schemas
export const fillSelectSchema = createSelectSchema(fills);
export const fillInsertSchema = createInsertSchema(fills);
export const fillUpdateSchema = createUpdateSchema(fills);

// Type exports
export type Fill = z.infer<typeof fillSelectSchema>;
export type FillInsert = z.infer<typeof fillInsertSchema>;
export type FillUpdate = z.infer<typeof fillUpdateSchema>;
