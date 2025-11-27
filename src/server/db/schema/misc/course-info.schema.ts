import { sql } from "drizzle-orm";
import {
  index,
  integer,
  timestamp,
  varchar,
  text,
  real,
  jsonb,
} from "drizzle-orm/pg-core";
import {
  createInsertSchema,
  createUpdateSchema,
  createSelectSchema,
} from "drizzle-zod";
import { z } from "zod";
import { createTable } from "../../helpers";

// Course Info table
export const courseInfo = createTable(
  "course_info",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    weatherStatus: varchar("weather_status", { length: 30 }), // Fair, Light Rain, etc.
    forecast: varchar("forecast", { length: 50 }), // e.g. "11°C"
    rainfall: varchar("rainfall", { length: 50 }), // e.g. "24 Hour Rainfall Total: 5mm"
    notes: text("notes"),
    lastUpdatedBy: varchar("last_updated_by", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date()
    ),
  },
  (table) => []
);

// Weather Cache table
export const weatherCache = createTable("weather_cache", {
  id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
  currentTemp: real("current_temp").notNull(),
  feelsLike: real("feels_like"),
  condition: varchar("condition", { length: 50 }).notNull(),
  conditionText: varchar("condition_text", { length: 100 }),
  humidity: integer("humidity"),
  windSpeed: real("wind_speed"),
  todayRainfall: real("today_rainfall").notNull(),
  tomorrowRainfall: real("tomorrow_rainfall").notNull(),
  hourlyForecast: jsonb("hourly_forecast").notNull(), // Array of hourly forecast data
  lastUpdated: timestamp("last_updated", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// Auto-generated schemas for courseInfo
export const courseInfoSelectSchema = createSelectSchema(courseInfo);
export const courseInfoInsertSchema = createInsertSchema(courseInfo);
export const courseInfoUpdateSchema = createUpdateSchema(courseInfo);

// Auto-generated schemas for weatherCache
export const weatherCacheSelectSchema = createSelectSchema(weatherCache);
export const weatherCacheInsertSchema = createInsertSchema(weatherCache);
export const weatherCacheUpdateSchema = createUpdateSchema(weatherCache);

// Type exports
export type CourseInfo = z.infer<typeof courseInfoSelectSchema>;
export type CourseInfoInsert = z.infer<typeof courseInfoInsertSchema>;
export type CourseInfoUpdate = z.infer<typeof courseInfoUpdateSchema>;

export type WeatherCache = z.infer<typeof weatherCacheSelectSchema>;
export type WeatherCacheInsert = z.infer<typeof weatherCacheInsertSchema>;
export type WeatherCacheUpdate = z.infer<typeof weatherCacheUpdateSchema>;
