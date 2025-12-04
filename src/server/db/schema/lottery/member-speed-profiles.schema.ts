import {
  index,
  integer,
  timestamp,
  varchar,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  createInsertSchema,
  createUpdateSchema,
  createSelectSchema,
} from "drizzle-zod";
import { z } from "zod";
import { createTable } from "../../helpers";

// Member speed profiles for lottery priority
// Note: memberId references members.id which is defined in schema.ts
// The reference uses a function to avoid circular imports
import { members } from "../core/members.schema";

// Define speed tier enum
export const speedTierEnum = pgEnum("speed_tier", ["FAST", "AVERAGE", "SLOW"]);

export const memberSpeedProfiles = createTable(
  "member_speed_profiles",
  {
    memberId: integer("member_id")
      .references(() => members.id, { onDelete: "cascade" })
      .primaryKey(),
    averageMinutes: integer("average_minutes"), // Auto-calculated from pace data (last 3 months)
    speedTier: speedTierEnum("speed_tier").default("AVERAGE").notNull(),
    adminPriorityAdjustment: integer("admin_priority_adjustment")
      .default(0)
      .notNull(), // -10 to +10 points
    manualOverride: boolean("manual_override").default(false).notNull(), // True if admin manually set
    lastCalculated: timestamp("last_calculated", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    notes: varchar("notes", { length: 500 }), // Admin notes for manual adjustments
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [
    index("member_speed_profiles_speed_tier_idx").on(table.speedTier),
    index("member_speed_profiles_last_calculated_idx").on(table.lastCalculated),
  ],
);

// Auto-generated schemas
export const memberSpeedProfilesSelectSchema =
  createSelectSchema(memberSpeedProfiles);
export const memberSpeedProfilesInsertSchema =
  createInsertSchema(memberSpeedProfiles);
export const memberSpeedProfilesUpdateSchema =
  createUpdateSchema(memberSpeedProfiles);

// Type exports
export type MemberSpeedProfile = z.infer<
  typeof memberSpeedProfilesSelectSchema
>;
export type MemberSpeedProfileInsert = z.infer<
  typeof memberSpeedProfilesInsertSchema
>;
export type MemberSpeedProfileUpdate = z.infer<
  typeof memberSpeedProfilesUpdateSchema
>;
