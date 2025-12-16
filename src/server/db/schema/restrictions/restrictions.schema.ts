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
import { timeBlocks } from "../booking/timeblocks.schema";
import { members } from "../core/members.schema";
import { guests } from "../core/guests.schema";

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
    }).notNull(), // 'MEMBER_CLASS', 'GUEST', 'LOTTERY'

    // Restriction Type
    restrictionType: varchar("restriction_type", { length: 15 }).notNull(), // 'TIME', 'FREQUENCY'

    // Entity being restricted (for member class restrictions)
    memberClassIds: integer("member_class_ids").array(),

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
    timeBlockId: integer("time_block_id").references(() => timeBlocks.id, {
      onDelete: "cascade",
    }),
    memberId: integer("member_id").references(() => members.id),
    guestId: integer("guest_id").references(() => guests.id),
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

// Insert schema with validation refinements
export const timeblockRestrictionsInsertSchema = createInsertSchema(
  timeblockRestrictions,
)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    name: z.string().min(1, "Name is required"),
    restrictionCategory: z.enum(["MEMBER_CLASS", "GUEST", "LOTTERY"], {
      message: "Restriction category is required",
    }),
    restrictionType: z.enum(["TIME", "FREQUENCY"], {
      message: "Restriction type is required",
    }),
  })
  .refine(
    (data) => {
      if (data.restrictionType === "TIME") {
        return data.startTime && data.endTime;
      }
      return true;
    },
    {
      message: "Start time and end time are required for time restrictions",
      path: ["startTime"],
    },
  )
  .refine(
    (data) => {
      if (data.restrictionType === "FREQUENCY") {
        return data.maxCount && data.periodDays;
      }
      return true;
    },
    {
      message:
        "Max count and period days are required for frequency restrictions",
      path: ["maxCount"],
    },
  )
  .refine(
    (data) => {
      if (data.restrictionCategory === "LOTTERY") {
        return data.restrictionType === "FREQUENCY";
      }
      return true;
    },
    {
      message: "Lottery restrictions must use FREQUENCY type",
      path: ["restrictionType"],
    },
  )
  .refine(
    (data) => {
      if (data.restrictionCategory === "LOTTERY") {
        return data.memberClassIds && data.memberClassIds.length > 0;
      }
      return true;
    },
    {
      message: "Lottery restrictions must specify at least one member class",
      path: ["memberClassIds"],
    },
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
