// Example model schema from the Drizzle docs
// https://orm.drizzle.team/docs/sql-schema-declaration

import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTableCreator,
  timestamp,
  varchar,
  char,
  date,
  unique,
  boolean,
  text,
  real,
  jsonb,
  pgEnum,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createTable } from "./helpers";
import { teesheetConfigs } from "./schema/teesheetConfigs.schema";

export * from "./schema/teesheetConfigs.schema";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */

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
    class: varchar("class", { length: 50 }).notNull(),
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

// Define relations for members
export const membersRelations = relations(members, ({ many }) => ({
  timeBlockMembers: many(timeBlockMembers),
  eventRegistrations: many(eventRegistrations),
  powerCartCharges: many(powerCartCharges, {
    relationName: "memberPowerCartCharges",
  }),
  splitPowerCartCharges: many(powerCartCharges, {
    relationName: "memberSplitCharges",
  }),
  generalCharges: many(generalCharges, {
    relationName: "memberGeneralCharges",
  }),
  sponsoredCharges: many(generalCharges, {
    relationName: "memberSponsoredCharges",
  }),
}));


// Teesheets table
export const teesheets = createTable(
  "teesheets",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    date: date("date").notNull(),
    configId: integer("config_id").references(() => teesheetConfigs.id, {
      onDelete: "set null",
    }),
    generalNotes: text("general_notes"),
    isPublic: boolean("is_public").default(false).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    publishedBy: varchar("published_by", { length: 100 }),
    privateMessage: text("private_message").default(
      "This teesheet is not yet available for booking.",
    ),
    lotteryEnabled: boolean("lottery_enabled").default(true).notNull(),
    lotteryDisabledMessage: text("lottery_disabled_message").default(
      "Lottery signup is disabled for this date",
    ),
    disallowMemberBooking: boolean("disallow_member_booking")
      .default(false)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [
    unique("teesheets_date_unq").on(table.date),
    index("teesheets_date_idx").on(table.date),
    index("teesheets_is_public_idx").on(table.isPublic),
  ],
);

// Time blocks
export const timeBlocks = createTable(
  "time_blocks",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    teesheetId: integer("teesheet_id")
      .references(() => teesheets.id, { onDelete: "cascade" })
      .notNull(),
    startTime: varchar("start_time", { length: 5 }).notNull(),
    endTime: varchar("end_time", { length: 5 }).notNull(),
    maxMembers: integer("max_members").notNull().default(4),
    displayName: varchar("display_name", { length: 100 }),
    sortOrder: integer("sort_order").notNull().default(0),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [index("timeblocks_teesheet_id_idx").on(table.teesheetId)],
);

// Pace of Play table
export const paceOfPlay = createTable(
  "pace_of_play",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    timeBlockId: integer("time_block_id").references(() => timeBlocks.id, {
      onDelete: "set null",
    }),
    startTime: timestamp("start_time", { withTimezone: true }),
    turn9Time: timestamp("turn9_time", { withTimezone: true }),
    finishTime: timestamp("finish_time", { withTimezone: true }),
    expectedStartTime: timestamp("expected_start_time", {
      withTimezone: true,
    }).notNull(),
    expectedTurn9Time: timestamp("expected_turn9_time", {
      withTimezone: true,
    }).notNull(),
    expectedFinishTime: timestamp("expected_finish_time", {
      withTimezone: true,
    }).notNull(),
    status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, on_time, behind, ahead, completed
    lastUpdatedBy: varchar("last_updated_by", { length: 100 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [
    index("pace_of_play_time_block_id_idx").on(table.timeBlockId),
    index("pace_of_play_status_idx").on(table.status),
    unique("pace_of_play_time_block_id_unq").on(table.timeBlockId),
  ],
);

// Define relations for paceOfPlay
export const paceOfPlayRelations = relations(paceOfPlay, ({ one }) => ({
  timeBlock: one(timeBlocks, {
    fields: [paceOfPlay.timeBlockId],
    references: [timeBlocks.id],
  }),
}));

// Define relations for teesheets
export const teesheetsRelations = relations(teesheets, ({ many, one }) => ({
  timeBlocks: many(timeBlocks),
  config: one(teesheetConfigs, {
    fields: [teesheets.configId],
    references: [teesheetConfigs.id],
  }),
}));

// Time block members (join table)
export const timeBlockMembers = createTable(
  "time_block_members",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    timeBlockId: integer("time_block_id")
      .references(() => timeBlocks.id, { onDelete: "cascade" })
      .notNull(),
    memberId: integer("member_id")
      .references(() => members.id, { onDelete: "cascade" })
      .notNull(),
    bookingDate: date("booking_date").notNull(),
    bookingTime: varchar("booking_time", { length: 5 }).notNull(),
    checkedIn: boolean("checked_in").default(false),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    bagNumber: varchar("bag_number", { length: 10 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("block_members_time_block_id_idx").on(table.timeBlockId),
    index("block_members_member_id_idx").on(table.memberId),
    index("block_members_booking_date_idx").on(table.bookingDate),
    index("block_members_booking_datetime_idx").on(
      table.bookingDate,
      table.bookingTime,
    ),
    index("block_members_member_date_idx").on(
      table.memberId,
      table.bookingDate,
    ),
    index("block_members_created_at_idx").on(table.createdAt),
    index("block_members_member_created_idx").on(
      table.memberId,
      table.createdAt,
    ),
    unique("block_members_time_block_member_unq").on(
      table.timeBlockId,
      table.memberId,
    ),
  ],
);

// Guests table
export const guests = createTable(
  "guests",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    firstName: varchar("first_name", { length: 50 }).notNull(),
    lastName: varchar("last_name", { length: 50 }).notNull(),
    email: varchar("email", { length: 100 }),
    phone: varchar("phone", { length: 20 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [index("guests_name_idx").on(table.firstName, table.lastName)],
);

// Payment Method enum
export const PaymentMethod = pgEnum("payment_method", [
  "VISA",
  "ACCOUNT",
  "MASTERCARD",
  "DEBIT",
  "OTHER",
]);

// Power Cart Charges table
export const powerCartCharges = createTable(
  "power_cart_charges",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    memberId: integer("member_id").references(() => members.id, {
      onDelete: "set null",
    }),
    guestId: integer("guest_id").references(() => guests.id, {
      onDelete: "set null",
    }),
    date: date("date").notNull(),
    numHoles: integer("num_holes").notNull(), // 9 or 18
    isSplit: boolean("is_split").notNull().default(false),
    splitWithMemberId: integer("split_with_member_id").references(
      () => members.id,
      { onDelete: "set null" },
    ),
    isMedical: boolean("is_medical").notNull().default(false),
    charged: boolean("charged").notNull().default(false),
    staffInitials: varchar("staff_initials", { length: 10 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [
    index("power_cart_charges_date_idx").on(table.date),
    index("power_cart_charges_member_id_idx").on(table.memberId),
    index("power_cart_charges_guest_id_idx").on(table.guestId),
  ],
);

// General Charges table
export const generalCharges = createTable(
  "general_charges",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    memberId: integer("member_id").references(() => members.id, {
      onDelete: "cascade",
    }),
    guestId: integer("guest_id").references(() => guests.id, {
      onDelete: "cascade",
    }),
    sponsorMemberId: integer("sponsor_member_id").references(() => members.id, {
      onDelete: "cascade",
    }), // Member who brought guest or is responsible for charge
    date: date("date").notNull(),
    chargeType: varchar("charge_type", { length: 20 }).notNull(), // 'GUEST_FEE', 'MEMBER_FEE', etc
    paymentMethod: PaymentMethod("payment_method"),
    charged: boolean("charged").notNull().default(false),
    staffInitials: varchar("staff_initials", { length: 10 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [
    index("general_charges_date_idx").on(table.date),
    index("general_charges_member_id_idx").on(table.memberId),
    index("general_charges_guest_id_idx").on(table.guestId),
    index("general_charges_sponsor_member_id_idx").on(table.sponsorMemberId),
    index("general_charges_charge_type_idx").on(table.chargeType),
  ],
);

// Relations for charges
export const powerCartChargesRelations = relations(
  powerCartCharges,
  ({ one }) => ({
    member: one(members, {
      fields: [powerCartCharges.memberId],
      references: [members.id],
      relationName: "memberPowerCartCharges",
    }),
    guest: one(guests, {
      fields: [powerCartCharges.guestId],
      references: [guests.id],
    }),
    splitWithMember: one(members, {
      fields: [powerCartCharges.splitWithMemberId],
      references: [members.id],
      relationName: "memberSplitCharges",
    }),
  }),
);

export const generalChargesRelations = relations(generalCharges, ({ one }) => ({
  member: one(members, {
    fields: [generalCharges.memberId],
    references: [members.id],
    relationName: "memberGeneralCharges",
  }),
  guest: one(guests, {
    fields: [generalCharges.guestId],
    references: [guests.id],
  }),
  sponsorMember: one(members, {
    fields: [generalCharges.sponsorMemberId],
    references: [members.id],
    relationName: "memberSponsoredCharges",
  }),
}));

// Type exports for charges
export type PowerCartCharge = typeof powerCartCharges.$inferSelect;
export type PowerCartChargeInsert = typeof powerCartCharges.$inferInsert;
export type GeneralCharge = typeof generalCharges.$inferSelect;
export type GeneralChargeInsert = typeof generalCharges.$inferInsert;

// Time block guests (join table)
export const timeBlockGuests = createTable(
  "time_block_guests",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    timeBlockId: integer("time_block_id")
      .references(() => timeBlocks.id, { onDelete: "cascade" })
      .notNull(),
    guestId: integer("guest_id")
      .references(() => guests.id, { onDelete: "cascade" })
      .notNull(),
    invitedByMemberId: integer("invited_by_member_id")
      .references(() => members.id)
      .notNull(),
    bookingDate: date("booking_date").notNull(),
    bookingTime: varchar("booking_time", { length: 5 }).notNull(),
    checkedIn: boolean("checked_in").default(false),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("block_guests_time_block_id_idx").on(table.timeBlockId),
    index("block_guests_guest_id_idx").on(table.guestId),
    index("block_guests_booking_date_idx").on(table.bookingDate),
    index("block_guests_booking_datetime_idx").on(
      table.bookingDate,
      table.bookingTime,
    ),
    index("block_guests_created_at_idx").on(table.createdAt),
    index("block_guests_guest_created_idx").on(table.guestId, table.createdAt),
    unique("block_guests_time_block_guest_unq").on(
      table.timeBlockId,
      table.guestId,
    ),
  ],
);

// Define relations for timeBlockMembers
export const timeBlockMembersRelations = relations(
  timeBlockMembers,
  ({ one }) => ({
    timeBlock: one(timeBlocks, {
      fields: [timeBlockMembers.timeBlockId],
      references: [timeBlocks.id],
    }),
    member: one(members, {
      fields: [timeBlockMembers.memberId],
      references: [members.id],
    }),
  }),
);

// Define relations for guests and timeBlockGuests
export const guestsRelations = relations(guests, ({ many }) => ({
  timeBlockGuests: many(timeBlockGuests),
}));

export const timeBlockGuestsRelations = relations(
  timeBlockGuests,
  ({ one }) => ({
    guest: one(guests, {
      fields: [timeBlockGuests.guestId],
      references: [guests.id],
    }),
    timeBlock: one(timeBlocks, {
      fields: [timeBlockGuests.timeBlockId],
      references: [timeBlocks.id],
    }),
    invitedByMember: one(members, {
      fields: [timeBlockGuests.invitedByMemberId],
      references: [members.id],
    }),
  }),
);

// Update timeBlocks relations to include timeBlockMembers, timeBlockGuests, and paceOfPlay
export const timeBlocksRelations = relations(timeBlocks, ({ many, one }) => ({
  timeBlockMembers: many(timeBlockMembers),
  timeBlockGuests: many(timeBlockGuests),
  paceOfPlay: one(paceOfPlay, {
    fields: [timeBlocks.id],
    references: [paceOfPlay.timeBlockId],
  }),
  teesheet: one(teesheets, {
    fields: [timeBlocks.teesheetId],
    references: [teesheets.id],
  }),
  fills: many(timeBlockFills),
}));

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
      () => new Date(),
    ),
  },
  (table) => [],
);

// Timeblock restrictions table - combines member class, guest restrictions, and course availability
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

// Define relations for timeblock restrictions
export const timeblockRestrictionsRelations = relations(
  timeblockRestrictions,
  ({ many }) => ({
    overrides: many(timeblockOverrides),
  }),
);

export const timeblockOverridesRelations = relations(
  timeblockOverrides,
  ({ one }) => ({
    restriction: one(timeblockRestrictions, {
      fields: [timeblockOverrides.restrictionId],
      references: [timeblockRestrictions.id],
    }),
    timeBlock: one(timeBlocks, {
      fields: [timeblockOverrides.timeBlockId],
      references: [timeBlocks.id],
    }),
    member: one(members, {
      fields: [timeblockOverrides.memberId],
      references: [members.id],
    }),
    guest: one(guests, {
      fields: [timeblockOverrides.guestId],
      references: [guests.id],
    }),
  }),
);

// Events table
export const events = createTable(
  "events",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description").notNull(),
    eventType: varchar("event_type", { length: 20 }).notNull(), // DINNER, TOURNAMENT, SOCIAL, etc.
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    startTime: varchar("start_time", { length: 5 }),
    endTime: varchar("end_time", { length: 5 }),
    location: varchar("location", { length: 100 }),
    capacity: integer("capacity"),
    requiresApproval: boolean("requires_approval").default(false),
    registrationDeadline: date("registration_deadline"),
    isActive: boolean("is_active").default(true),
    memberClasses: varchar("member_classes", { length: 50 }).array(),
    teamSize: integer("team_size").default(1).notNull(), // 1, 2, or 4 players
    guestsAllowed: boolean("guests_allowed").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [
    index("events_type_idx").on(table.eventType),
    index("events_date_idx").on(table.startDate),
  ],
);

// Event registrations table
export const eventRegistrations = createTable(
  "event_registrations",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    eventId: integer("event_id")
      .references(() => events.id, { onDelete: "cascade" })
      .notNull(),
    memberId: integer("member_id")
      .references(() => members.id, { onDelete: "cascade" })
      .notNull(),
    status: varchar("status", { length: 20 }).default("PENDING").notNull(), // PENDING, APPROVED, REJECTED
    notes: text("notes"),
    teamMemberIds: integer("team_member_ids").array(), // Array of member IDs in team
    fills: jsonb("fills"), // Array of {fillType, customName} objects
    isTeamCaptain: boolean("is_team_captain").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [
    index("event_registrations_event_id_idx").on(table.eventId),
    index("event_registrations_member_id_idx").on(table.memberId),
    unique("event_registrations_event_member_unq").on(
      table.eventId,
      table.memberId,
    ),
  ],
);

// Event Details for tournaments or special events
export const eventDetails = createTable(
  "event_details",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    eventId: integer("event_id")
      .references(() => events.id, { onDelete: "cascade" })
      .notNull(),
    format: varchar("format", { length: 50 }), // For tournaments: Scramble, Stroke Play, etc.
    rules: text("rules"),
    prizes: text("prizes"),
    entryFee: real("entry_fee"),
    additionalInfo: text("additional_info"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [
    index("event_details_event_id_idx").on(table.eventId),
    unique("event_details_event_id_unq").on(table.eventId),
  ],
);

// Define relations
export const eventsRelations = relations(events, ({ many, one }) => ({
  registrations: many(eventRegistrations),
  details: one(eventDetails),
}));

export const eventRegistrationsRelations = relations(
  eventRegistrations,
  ({ one }) => ({
    event: one(events, {
      fields: [eventRegistrations.eventId],
      references: [events.id],
    }),
    member: one(members, {
      fields: [eventRegistrations.memberId],
      references: [members.id],
    }),
  }),
);

export const eventDetailsRelations = relations(eventDetails, ({ one }) => ({
  event: one(events, {
    fields: [eventDetails.eventId],
    references: [events.id],
  }),
}));

export const timeBlockFills = createTable(
  "timeblock_fills",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    timeBlockId: integer("time_block_id")
      .notNull()
      .references(() => timeBlocks.id, { onDelete: "cascade" }),
    fillType: varchar("fill_type", { length: 20 }).notNull(),
    customName: text("custom_name"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [index("timeblock_fills_time_block_id_idx").on(table.timeBlockId)],
);

export const timeBlockFillsRelations = relations(timeBlockFills, ({ one }) => ({
  timeBlock: one(timeBlocks, {
    fields: [timeBlockFills.timeBlockId],
    references: [timeBlocks.id],
  }),
}));

// Lottery system tables

// Core lottery entries
export const lotteryEntries = createTable(
  "lottery_entries",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    memberId: integer("member_id")
      .references(() => members.id, { onDelete: "cascade" })
      .notNull(),
    lotteryDate: date("lottery_date").notNull(), // Date they want to play
    preferredWindow: varchar("preferred_window", { length: 20 }).notNull(), // EARLY_MORNING, MORNING, MIDDAY, AFTERNOON
    alternateWindow: varchar("alternate_window", { length: 20 }), // Backup choice
    status: varchar("status", { length: 20 }).notNull().default("PENDING"), // PENDING, PROCESSING, ASSIGNED, CANCELLED
    submittedBy: integer("submitted_by").references(() => members.id), // Admin who submitted on behalf
    submissionTimestamp: timestamp("submission_timestamp", {
      withTimezone: true,
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    assignedTimeBlockId: integer("assigned_time_block_id").references(
      () => timeBlocks.id,
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [
    index("lottery_entries_member_id_idx").on(table.memberId),
    index("lottery_entries_lottery_date_idx").on(table.lotteryDate),
    index("lottery_entries_status_idx").on(table.status),
    index("lottery_entries_date_status_idx").on(table.lotteryDate, table.status), // Composite index for lottery processing
    unique("lottery_entries_member_date_unq").on(
      table.memberId,
      table.lotteryDate,
    ),
  ],
);

// Group requests within lottery entries
export const lotteryGroups = createTable(
  "lottery_groups",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    leaderId: integer("leader_id")
      .references(() => members.id, { onDelete: "cascade" })
      .notNull(), // Member who submitted for group
    lotteryDate: date("lottery_date").notNull(),
    memberIds: integer("member_ids").array().notNull(), // All members in group including leader
    fills: jsonb("fills").$type<Array<{ fillType: string; customName?: string }>>().default([]), // Array of fills
    preferredWindow: varchar("preferred_window", { length: 20 }).notNull(),
    alternateWindow: varchar("alternate_window", { length: 20 }),
    status: varchar("status", { length: 20 }).notNull().default("PENDING"),
    submissionTimestamp: timestamp("submission_timestamp", {
      withTimezone: true,
    })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    assignedTimeBlockId: integer("assigned_time_block_id").references(
      () => timeBlocks.id,
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (table) => [
    index("lottery_groups_leader_id_idx").on(table.leaderId),
    index("lottery_groups_lottery_date_idx").on(table.lotteryDate),
    index("lottery_groups_status_idx").on(table.status),
    index("lottery_groups_date_status_idx").on(table.lotteryDate, table.status), // Composite index for group lottery processing
    unique("lottery_groups_leader_date_unq").on(
      table.leaderId,
      table.lotteryDate,
    ),
  ],
);

// Member fairness scores (monthly reset system)
export const memberFairnessScores = createTable(
  "member_fairness_scores",
  {
    memberId: integer("member_id")
      .references(() => members.id, { onDelete: "cascade" })
      .notNull(),
    currentMonth: varchar("current_month", { length: 7 }).notNull(), // "2024-01"
    totalEntriesMonth: integer("total_entries_month").notNull().default(0),
    preferencesGrantedMonth: integer("preferences_granted_month")
      .notNull()
      .default(0),
    preferenceFulfillmentRate: real("preference_fulfillment_rate")
      .notNull()
      .default(0), // 0-1
    daysWithoutGoodTime: integer("days_without_good_time").notNull().default(0),
    fairnessScore: real("fairness_score").notNull().default(0), // Final calculated fairness score
    lastUpdated: timestamp("last_updated", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.memberId, table.currentMonth] }),
    index("member_fairness_scores_fairness_idx").on(table.fairnessScore),
    index("member_fairness_scores_updated_idx").on(table.lastUpdated),
    index("member_fairness_scores_month_idx").on(table.currentMonth),
  ],
);

// Define relations for lottery tables
export const lotteryEntriesRelations = relations(lotteryEntries, ({ one }) => ({
  member: one(members, {
    fields: [lotteryEntries.memberId],
    references: [members.id],
  }),
  submittedByMember: one(members, {
    fields: [lotteryEntries.submittedBy],
    references: [members.id],
  }),
  assignedTimeBlock: one(timeBlocks, {
    fields: [lotteryEntries.assignedTimeBlockId],
    references: [timeBlocks.id],
  }),
}));

export const lotteryGroupsRelations = relations(lotteryGroups, ({ one }) => ({
  leader: one(members, {
    fields: [lotteryGroups.leaderId],
    references: [members.id],
  }),
  assignedTimeBlock: one(timeBlocks, {
    fields: [lotteryGroups.assignedTimeBlockId],
    references: [timeBlocks.id],
  }),
}));

export const memberFairnessScoresRelations = relations(
  memberFairnessScores,
  ({ one }) => ({
    member: one(members, {
      fields: [memberFairnessScores.memberId],
      references: [members.id],
    }),
  }),
);

// Member speed profiles for lottery priority
export const memberSpeedProfiles = createTable(
  "member_speed_profiles",
  {
    memberId: integer("member_id")
      .references(() => members.id, { onDelete: "cascade" })
      .primaryKey(),
    averageMinutes: real("average_minutes"), // Auto-calculated from pace data (last 3 months)
    speedTier: varchar("speed_tier", { length: 10 }).default("AVERAGE"), // 'FAST', 'AVERAGE', 'SLOW'
    adminPriorityAdjustment: integer("admin_priority_adjustment").default(0), // -10 to +10 points
    manualOverride: boolean("manual_override").default(false), // True if admin manually set
    lastCalculated: timestamp("last_calculated", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    notes: text("notes"), // Admin notes for manual adjustments
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

export const memberSpeedProfilesRelations = relations(
  memberSpeedProfiles,
  ({ one }) => ({
    member: one(members, {
      fields: [memberSpeedProfiles.memberId],
      references: [members.id],
    }),
  }),
);

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
    notes: text("notes"),
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


export type Teesheet = typeof teesheets.$inferSelect;

export type Timeblocks = typeof timeBlocks.$inferSelect;
export type TimeblockInsert = typeof timeBlocks.$inferInsert;


export type CourseInfo = typeof courseInfo.$inferSelect;
export type CourseInfoInsert = typeof courseInfo.$inferInsert;

export type WeatherCache = typeof weatherCache.$inferSelect;
export type WeatherCacheInsert = typeof weatherCache.$inferInsert;

// Type exports for member classes
export type MemberClass = typeof memberClasses.$inferSelect;
export type MemberClassInsert = typeof memberClasses.$inferInsert;

export type PaceOfPlay = typeof paceOfPlay.$inferSelect;

export type TimeblockFill = typeof timeBlockFills.$inferSelect;
export type TimeblockFillInsert = typeof timeBlockFills.$inferInsert; 

export type TimeblockGuest = typeof timeBlockGuests.$inferSelect;
export type TimeblockGuestInsert = typeof timeBlockGuests.$inferInsert;

export type TimeblockMember = typeof timeBlockMembers.$inferSelect;
export type TimeblockMemberInsert = typeof timeBlockMembers.$inferInsert;

export type Guest = typeof guests.$inferSelect;
export type GuestInsert = typeof guests.$inferInsert;

export type Member = typeof members.$inferSelect;
export type MemberInsert = typeof members.$inferInsert;