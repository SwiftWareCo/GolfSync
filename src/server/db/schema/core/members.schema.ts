import { sql } from "drizzle-orm";
import {
  index,
  integer,
  timestamp,
  varchar,
  char,
  date,
  unique,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import {
  createInsertSchema,
  createUpdateSchema,
  createSelectSchema,
} from "drizzle-zod";
import { z } from "zod";
import { createTable } from "../../helpers";

// Member Classes table
export const memberClasses = createTable(
  "member_classes",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    label: varchar("label", { length: 100 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    isSystemGenerated: boolean("is_system_generated").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [
    unique("member_classes_label_unq").on(table.label),
    index("member_classes_sort_order_idx").on(table.sortOrder),
    index("member_classes_active_idx").on(table.isActive),
  ],
);

// Members table
export const members = createTable(
  "members",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    classId: integer("class_id").references(() => memberClasses.id).notNull(),
    memberNumber: varchar("member_number", { length: 20 }).notNull(),
    firstName: varchar("first_name", { length: 50 }).notNull(),
    lastName: varchar("last_name", { length: 50 }).notNull(),
    username: varchar("username", { length: 50 }).notNull(),
    email: varchar("email", { length: 100 }).notNull(),
    gender: char("gender", { length: 1 }),
    dateOfBirth: date("date_of_birth"),
    handicap: varchar("handicap", { length: 20 }),
    bagNumber: varchar("bag_number", { length: 10 }),
    // Push notification fields
    pushNotificationsEnabled: boolean("push_notifications_enabled").default(
      false,
    ),
    pushSubscription: jsonb("push_subscription"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [
    // Unique constraints for single-tenant
    unique("members_member_number_unq").on(table.memberNumber),
    unique("members_username_unq").on(table.username),
    // Indexes
    index("members_first_name_idx").on(table.firstName),
    index("members_last_name_idx").on(table.lastName),
  ],
);

// Auto-generated schemas for memberClasses
export const memberClassesSelectSchema = createSelectSchema(memberClasses);
export const memberClassesInsertSchema = createInsertSchema(memberClasses);
export const memberClassesUpdateSchema = createUpdateSchema(memberClasses);

// Auto-generated schemas for members
export const membersSelectSchema = createSelectSchema(members);
export const membersInsertSchema = createInsertSchema(members);
export const membersUpdateSchema = createUpdateSchema(members);

// Relations for members are defined in schema.ts to avoid circular imports
// (they reference tables from other domains)

// Type exports
export type MemberClass = z.infer<typeof memberClassesSelectSchema>;
export type MemberClassInsert = z.infer<typeof memberClassesInsertSchema>;
export type MemberClassUpdate = z.infer<typeof memberClassesUpdateSchema>;

export type Member = z.infer<typeof membersSelectSchema>;
export type MemberInsert = z.infer<typeof membersInsertSchema>;
export type MemberUpdate = z.infer<typeof membersUpdateSchema>;
