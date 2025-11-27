import { sql } from "drizzle-orm";
import {
  index,
  integer,
  timestamp,
  varchar,
  date,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import {
  createInsertSchema,
  createUpdateSchema,
  createSelectSchema,
} from "drizzle-zod";
import { z } from "zod";
import { createTable } from "../../helpers";

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
    memberId: integer("member_id").references(() => {
      return (require("../../schema") as any).members.id;
    }, {
      onDelete: "set null",
    }),
    guestId: integer("guest_id").references(() => {
      return (require("../../schema") as any).guests.id;
    }, {
      onDelete: "set null",
    }),
    date: date("date").notNull(),
    numHoles: integer("num_holes").notNull(), // 9 or 18
    isSplit: boolean("is_split").notNull().default(false),
    splitWithMemberId: integer("split_with_member_id").references(
      () => {
        return (require("../../schema") as any).members.id;
      },
      { onDelete: "set null" }
    ),
    isMedical: boolean("is_medical").notNull().default(false),
    charged: boolean("charged").notNull().default(false),
    staffInitials: varchar("staff_initials", { length: 10 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date()
    ),
  },
  (table) => [
    index("power_cart_charges_date_idx").on(table.date),
    index("power_cart_charges_member_id_idx").on(table.memberId),
    index("power_cart_charges_guest_id_idx").on(table.guestId),
  ]
);

// General Charges table
export const generalCharges = createTable(
  "general_charges",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    memberId: integer("member_id").references(() => {
      return (require("../../schema") as any).members.id;
    }, {
      onDelete: "cascade",
    }),
    guestId: integer("guest_id").references(() => {
      return (require("../../schema") as any).guests.id;
    }, {
      onDelete: "cascade",
    }),
    sponsorMemberId: integer("sponsor_member_id").references(() => {
      return (require("../../schema") as any).members.id;
    }, {
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
      () => new Date()
    ),
  },
  (table) => [
    index("general_charges_date_idx").on(table.date),
    index("general_charges_member_id_idx").on(table.memberId),
    index("general_charges_guest_id_idx").on(table.guestId),
    index("general_charges_sponsor_member_id_idx").on(table.sponsorMemberId),
    index("general_charges_charge_type_idx").on(table.chargeType),
  ]
);

// Auto-generated schemas for powerCartCharges
export const powerCartChargesSelectSchema = createSelectSchema(powerCartCharges);
export const powerCartChargesInsertSchema = createInsertSchema(powerCartCharges);
export const powerCartChargesUpdateSchema = createUpdateSchema(powerCartCharges);

// Auto-generated schemas for generalCharges
export const generalChargesSelectSchema = createSelectSchema(generalCharges);
export const generalChargesInsertSchema = createInsertSchema(generalCharges);
export const generalChargesUpdateSchema = createUpdateSchema(generalCharges);

// Relations are defined in schema.ts to avoid circular imports
// (they reference tables from other domains)

// Type exports
export type PowerCartCharge = z.infer<typeof powerCartChargesSelectSchema>;
export type PowerCartChargeInsert = z.infer<typeof powerCartChargesInsertSchema>;
export type PowerCartChargeUpdate = z.infer<typeof powerCartChargesUpdateSchema>;

export type GeneralCharge = z.infer<typeof generalChargesSelectSchema>;
export type GeneralChargeInsert = z.infer<typeof generalChargesInsertSchema>;
export type GeneralChargeUpdate = z.infer<typeof generalChargesUpdateSchema>;
