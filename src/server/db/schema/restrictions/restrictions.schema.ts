import { sql } from "drizzle-orm";
import {
  index,
  integer,
  timestamp,
  varchar,
  date,
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

// Timeblock restrictions
export const timeblockRestrictions = createTable(
  "timeblock_restrictions",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),

    // Restriction Category
    restrictionCategory: varchar("restriction_category", {
      length: 20,
    }).notNull(), // 'MEMBER_CLASS', 'GUEST', 'COURSE_AVAILABILITY'

    // Restriction Type
    restrictionType: varchar("restriction_type", { length: 15 }).notNull(), // 'TIME', 'FREQUENCY', 'AVAILABILITY'

    // Entity being restricted (for member class restrictions)
    memberClasses: varchar("member_classes", { length: 50 }).array(),

    // Time restriction
    startTime: varchar("start_time", { length: 5 }),
    endTime: varchar("end_time", { length: 5 }),
    daysOfWeek: integer("days_of_week").array(),

    // Date range
    startDate: date("start_date"),
    endDate: date("end_date"),

    // Frequency restriction
    maxCount: integer("max_count"),
    periodDays: integer("period_days"),
    applyCharge: boolean("apply_charge"),
    chargeAmount: text("charge_amount"),

    // Status and override
    isActive: boolean("is_active").notNull().default(true),
    canOverride: boolean("can_override").notNull().default(true),
    priority: integer("priority").notNull().default(0),

    // Audit
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
    lastUpdatedBy: varchar("last_updated_by", { length: 100 }),
  },
  (table) => [
    index("timeblock_restrictions_category_idx").on(table.restrictionCategory),
    index("timeblock_restrictions_type_idx").on(table.restrictionType),
    index("timeblock_restrictions_member_classes_idx").on(table.memberClasses),
  ],
);

// Timeblock restriction overrides
export const timeblockOverrides = createTable(
  "timeblock_overrides",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    restrictionId: integer("restriction_id").references(
      () => timeblockRestrictions.id,
    ),
    timeBlockId: integer("time_block_id").references(
      () => {
        return (require("../../schema") as any).timeBlocks.id;
      },
      {
        onDelete: "cascade",
      },
    ),
    memberId: integer("member_id").references(() => {
      return (require("../../schema") as any).members.id;
    }),
    guestId: integer("guest_id").references(() => {
      return (require("../../schema") as any).guests.id;
    }),
    overriddenBy: varchar("overridden_by", { length: 100 }).notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("timeblock_overrides_restriction_id_idx").on(table.restrictionId),
    index("timeblock_overrides_time_block_id_idx").on(table.timeBlockId),
  ],
);

// Auto-generated schemas for timeblockRestrictions
export const timeblockRestrictionsSelectSchema = createSelectSchema(
  timeblockRestrictions,
);
export const timeblockRestrictionsInsertSchema = createInsertSchema(
  timeblockRestrictions,
);
export const timeblockRestrictionsUpdateSchema = createUpdateSchema(
  timeblockRestrictions,
);

// Auto-generated schemas for timeblockOverrides
export const timeblockOverridesSelectSchema =
  createSelectSchema(timeblockOverrides);
export const timeblockOverridesInsertSchema =
  createInsertSchema(timeblockOverrides);
export const timeblockOverridesUpdateSchema =
  createUpdateSchema(timeblockOverrides);

// Relations are defined in schema.ts to avoid circular imports

// Type exports
export type TimeblockRestriction = z.infer<
  typeof timeblockRestrictionsSelectSchema
>;
export type TimeblockRestrictionInsert = z.infer<
  typeof timeblockRestrictionsInsertSchema
>;
export type TimeblockRestrictionUpdate = z.infer<
  typeof timeblockRestrictionsUpdateSchema
>;

export type TimeblockOverride = z.infer<typeof timeblockOverridesSelectSchema>;
export type TimeblockOverrideInsert = z.infer<
  typeof timeblockOverridesInsertSchema
>;
export type TimeblockOverrideUpdate = z.infer<
  typeof timeblockOverridesUpdateSchema
>;
