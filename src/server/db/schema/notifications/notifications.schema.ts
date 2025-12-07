import { sql } from "drizzle-orm";
import {
  index,
  integer,
  timestamp,
  varchar,
  text,
  pgEnum,
} from "drizzle-orm/pg-core";
import {
  createInsertSchema,
  createUpdateSchema,
  createSelectSchema,
} from "drizzle-zod";
import { createTable } from "../../helpers";
import { members } from "../core/members.schema";

// Notification types enum
export const notificationTypeEnum = pgEnum("notification_type", [
  "lottery_result",
  "tee_time_reminder",
  "event",
  "system",
  "broadcast",
]);

// Notifications table
export const notifications = createTable(
  "notifications",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    // NULL member_id means broadcast to all members
    memberId: integer("member_id").references(() => members.id, {
      onDelete: "cascade",
    }),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body").notNull(),
    type: notificationTypeEnum("type").notNull().default("system"),
    // Optional JSON payload (e.g., { eventId: 5, timeBlockId: 12 })
    data: text("data"),
    // NULL = unread, set when member views the notification
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("notifications_member_id_idx").on(table.memberId),
    index("notifications_created_at_idx").on(table.createdAt),
    index("notifications_type_idx").on(table.type),
    // Composite index for efficient member-specific queries
    index("notifications_member_read_idx").on(table.memberId, table.readAt),
  ],
);

// Zod schemas for validation
export const notificationsInsertSchema = createInsertSchema(notifications);
export const notificationsUpdateSchema = createUpdateSchema(notifications);
export const notificationsSelectSchema = createSelectSchema(notifications);

// TypeScript types
export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = typeof notifications.$inferInsert;
export type NotificationType =
  | "lottery_result"
  | "tee_time_reminder"
  | "event"
  | "system"
  | "broadcast";
