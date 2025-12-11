"use server";

import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";

import {
  powerCartCharges,
  generalCharges,
  type PaymentMethod,
} from "../db/schema";
import { type PowerCartAssignmentData } from "~/app/types/ChargeTypes";
import { revalidatePath } from "next/cache";
import { formatCalendarDate } from "~/lib/utils";
import { getFilteredCharges, type ChargeFilters } from "./data";

// Create power cart charge
export async function createPowerCartCharge(data: PowerCartAssignmentData) {
  const charge = await db
    .insert(powerCartCharges)
    .values({
      ...data,
      date: formatCalendarDate(data.date),
    })
    .returning();

  revalidatePath("/admin/charges");
  return charge[0];
}

// Create general charge
export async function createGeneralCharge(data: any) {
  const charge = await db
    .insert(generalCharges)
    .values({
      ...data,
      date: formatCalendarDate(data.date),
    })
    .returning();

  revalidatePath("/admin/charges");
  return charge[0];
}

// Complete power cart charge
export async function completePowerCartCharge({
  id,
  staffInitials,
}: {
  id: number;
  staffInitials: string;
}) {
  const charge = await db
    .update(powerCartCharges)
    .set({ charged: true, staffInitials })
    .where(eq(powerCartCharges.id, id))
    .returning();

  revalidatePath("/admin/charges");
  return charge[0];
}

// Complete general charge
export async function completeGeneralCharge({
  id,
  staffInitials,
  paymentMethod,
}: {
  id: number;
  staffInitials: string;
  paymentMethod: (typeof PaymentMethod.enumValues)[number];
}) {
  const charge = await db
    .update(generalCharges)
    .set({ charged: true, staffInitials, paymentMethod })
    .where(eq(generalCharges.id, id))
    .returning();

  revalidatePath("/admin/charges");
  return charge[0];
}

// Quick cart assignment from teesheet
export async function quickAssignPowerCart(data: PowerCartAssignmentData) {
  // If staff initials are empty, use a default value
  const staffInitials = data.staffInitials || "STAFF";

  const charge = await db
    .insert(powerCartCharges)
    .values({
      ...data,
      staffInitials,
      date: formatCalendarDate(data.date),
    })
    .returning();

  revalidatePath("/admin/charges");
  return charge[0];
}

// Delete a power cart charge
export async function deletePowerCartCharge(id: number) {
  await db.delete(powerCartCharges).where(eq(powerCartCharges.id, id));

  revalidatePath("/admin/charges");
  return { success: true };
}

// Delete a general charge
export async function deleteGeneralCharge(id: number) {
  await db.delete(generalCharges).where(eq(generalCharges.id, id));

  revalidatePath("/admin/charges");
  return { success: true };
}

export async function fetchFilteredCharges(filters: ChargeFilters) {
  try {
    return await getFilteredCharges(filters);
  } catch (error) {
    console.error("Error fetching filtered charges:", error);
    throw new Error("Failed to fetch charges");
  }
}
