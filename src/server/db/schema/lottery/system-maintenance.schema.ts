import {
  index,
  integer,
  timestamp,
  varchar,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  createInsertSchema,
  createUpdateSchema,
  createSelectSchema,
} from "drizzle-zod";
import { z } from "zod";
import { createTable } from "../../helpers";

// System maintenance tracking
export const systemMaintenance = createTable(
  "system_maintenance",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    maintenanceType: varchar("maintenance_type", { length: 50 }).notNull(), // 'MONTHLY_RESET', 'SPEED_RECALCULATION'
    month: varchar("month", { length: 7 }).notNull(), // "2024-01"
    completedAt: timestamp("completed_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    recordsAffected: integer("records_affected").default(0),
    notes: varchar("notes", { length: 500 }),
  },
  (table) => [
    index("system_maintenance_type_idx").on(table.maintenanceType),
    index("system_maintenance_month_idx").on(table.month),
    unique("system_maintenance_type_month_unq").on(
      table.maintenanceType,
      table.month,
    ),
  ],
);

// Auto-generated schemas
export const systemMaintenanceSelectSchema =
  createSelectSchema(systemMaintenance);
export const systemMaintenanceInsertSchema =
  createInsertSchema(systemMaintenance);
export const systemMaintenanceUpdateSchema =
  createUpdateSchema(systemMaintenance);

// Type exports
export type SystemMaintenance = z.infer<typeof systemMaintenanceSelectSchema>;
export type SystemMaintenanceInsert = z.infer<
  typeof systemMaintenanceInsertSchema
>;
export type SystemMaintenanceUpdate = z.infer<
  typeof systemMaintenanceUpdateSchema
>;
