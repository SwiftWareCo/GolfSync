import { sql } from "drizzle-orm";
import {
  index,
  integer,
  timestamp,
  varchar,
  date,
  boolean,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import {
  createInsertSchema,
  createUpdateSchema,
  createSelectSchema,
} from "drizzle-zod";
import { z } from "zod";
import { createTable, WithRelations } from "../helpers";

// Teesheet configurations

export const teesheetConfigs = createTable(
  "teesheet_configs",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    name: varchar("name", { length: 50 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    // Lottery: max duration for auto-generated time windows (default 60 = 1 hour)
    maxWindowDurationMinutes: integer("max_window_duration_minutes")
      .default(60)
      .notNull(),
    // Scheduling: when this config applies
    daysOfWeek: integer("days_of_week").array(), // [1,2,3,4,5] for Mon-Fri, null = always
    startDate: date("start_date"), // null = no start limit
    endDate: date("end_date"), // null = no end limit
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [
    index("teesheet_configs_days_of_week_idx").on(table.daysOfWeek),
    index("teesheet_configs_active_idx").on(table.isActive),
  ],
);

export const configBlocks = createTable(
  "config_blocks",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    configId: integer("config_id")
      .references(() => teesheetConfigs.id, { onDelete: "cascade" })
      .notNull(),
    displayName: varchar("display_name", { length: 100 }),
    startTime: varchar("start_time", { length: 5 }).notNull(),
    maxPlayers: integer("max_players").notNull().default(4),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [
    index("config_blocks_config_id_idx").on(table.configId),
    index("config_blocks_start_time_idx").on(table.startTime),
    unique("config_blocks_config_sort_unq").on(table.configId, table.sortOrder),
  ],
);

// Define relations for config blocks
export const configBlocksRelations = relations(configBlocks, ({ one }) => ({
  config: one(teesheetConfigs, {
    fields: [configBlocks.configId],
    references: [teesheetConfigs.id],
  }),
}));

// Define relations
export const teesheetConfigsRelations = relations(
  teesheetConfigs,
  ({ many }) => ({
    blocks: many(configBlocks),
  }),
);

export const teesheetConfigSelectSchema = createSelectSchema(teesheetConfigs);
export const teesheetConfigInsertSchema = createInsertSchema(teesheetConfigs);
export const teesheetConfigUpdateSchema = createUpdateSchema(teesheetConfigs);

export const configBlockSelectSchema = createSelectSchema(configBlocks);
export const configBlockInsertSchema = createInsertSchema(configBlocks);
export const configBlockUpdateSchema = createUpdateSchema(configBlocks);

export type TeesheetConfig = z.infer<typeof teesheetConfigSelectSchema>;
export type ConfigBlock = z.infer<typeof configBlockSelectSchema>;

export type TeesheetConfigInsert = z.infer<typeof teesheetConfigInsertSchema>;
export type ConfigBlockInsert = z.infer<typeof configBlockInsertSchema>;

export type TeesheetConfigWithBlocks = WithRelations<
  TeesheetConfig,
  { blocks: ConfigBlock[] }
>;

// Schema for blocks with string or number IDs (for UI editing/generation)
export const configBlockWithIdSchema = configBlockInsertSchema
  .omit({ id: true })
  .extend({
    id: z.union([z.string(), z.number()]),
  });

export const TeesheetConfigWithBlocksInsertSchema = teesheetConfigInsertSchema
  .extend({
    blocks: z.array(configBlockWithIdSchema).min(1, {
      message: "At least one time block is required",
    }),
    name: z.string().min(1, {
      message: "Configuration name is required",
    }),
    daysOfWeek: z.array(z.number()).min(1, {
      message: "At least one day of week must be selected",
    }),
  })
  .required({
    name: true,
    blocks: true,
    daysOfWeek: true,
  });

export type TeesheetConfigWithBlocksInsert = z.infer<
  typeof TeesheetConfigWithBlocksInsertSchema
>;
