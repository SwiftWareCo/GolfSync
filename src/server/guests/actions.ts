"use server";

import { db } from "~/server/db";
import {
  guests,
  timeBlockGuests,
  timeBlocks,
  teesheets,
} from "~/server/db/schema";
import { eq, and, like, or, ilike, sql, desc } from "drizzle-orm";

import { revalidatePath } from "next/cache";
import { getGuestBookingHistory } from "./data";
import { formatDateToYYYYMMDD } from "~/lib/utils";

export async function searchGuestsAction(searchTerm: string) {
  const lowerSearchTerm = `%${searchTerm.toLowerCase()}%`;
  const searchWords = searchTerm.split(" ");

  try {
    const results = await db.query.guests.findMany({
      where: or(
        ilike(guests.firstName, lowerSearchTerm),
        ilike(guests.lastName, lowerSearchTerm),
        ilike(guests.email, lowerSearchTerm),
        // Support combined search like "omar elsh" or "elsh omar"
        and(
          ilike(guests.firstName, `%${searchWords[0]?.toLowerCase()}%`),
          ilike(
            guests.lastName,
            `%${searchWords.slice(1).join(" ")?.toLowerCase()}%`,
          ),
        ),
        and(
          ilike(guests.lastName, `%${searchWords[0]?.toLowerCase()}%`),
          ilike(
            guests.firstName,
            `%${searchWords.slice(1).join(" ")?.toLowerCase()}%`,
          ),
        ),
      ),
      orderBy: [guests.lastName, guests.firstName],
    });

    return results;
  } catch (error) {
    console.error("Error in searchGuestsAction:", error);
    throw error;
  }
}

export async function createGuest(data: {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
}) {
  try {
    // Check for duplicate guest with same first and last name (case-insensitive)
    const existingGuest = await db.query.guests.findFirst({
      where: and(
        ilike(guests.firstName, data.firstName.trim()),
        ilike(guests.lastName, data.lastName.trim()),
      ),
    });

    if (existingGuest) {
      return {
        success: false,
        error: `A guest with the name "${data.firstName} ${data.lastName}" already exists`,
      };
    }

    const [newGuest] = await db
      .insert(guests)
      .values({
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email: data.email?.trim() || null,
        phone: data.phone?.trim() || null,
      })
      .returning();

    revalidatePath("/admin/members");
    return { success: true, data: newGuest };
  } catch (error) {
    console.error("Error creating guest:", error);
    return { success: false, error: "Failed to create guest" };
  }
}

export async function updateGuest(
  id: number,
  data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  },
) {
  try {
    const [updatedGuest] = await db
      .update(guests)
      .set(data)
      .where(eq(guests.id, id))
      .returning();

    revalidatePath("/admin/members");
    return { success: true, data: updatedGuest };
  } catch (error) {
    console.error("Error updating guest:", error);
    return { success: false, error: "Failed to update guest" };
  }
}

export async function deleteGuest(id: number) {
  try {
    const [deletedGuest] = await db
      .delete(guests)
      .where(eq(guests.id, id))
      .returning();

    revalidatePath("/admin/members");
    return { success: true, data: deletedGuest };
  } catch (error) {
    console.error("Error deleting guest:", error);
    return { success: false, error: "Failed to delete guest" };
  }
}

export async function addGuestToTimeBlock(
  timeBlockId: number,
  guestId: number,
  invitedByMemberId: number,
) {
  try {
    // Get the time block to get its teesheet
    const timeBlock = await db.query.timeBlocks.findFirst({
      where: eq(timeBlocks.id, timeBlockId),
    });

    if (!timeBlock) {
      return { success: false, error: "Time block not found" };
    }

    // Get the teesheet to get its date
    const teesheet = await db.query.teesheets.findFirst({
      where: eq(teesheets.id, timeBlock.teesheetId),
    });

    if (!teesheet) {
      return { success: false, error: "Teesheet not found" };
    }

    // Get the booking date and time
    const bookingDate = formatDateToYYYYMMDD(teesheet.date);
    const bookingTime = timeBlock.startTime;

    // Check if guest is already in the time block
    const existingGuest = await db.query.timeBlockGuests.findFirst({
      where: and(
        eq(timeBlockGuests.timeBlockId, timeBlockId),
        eq(timeBlockGuests.guestId, guestId),
      ),
    });

    if (existingGuest) {
      return { success: false, error: "Guest is already in this time block" };
    }

    // Add guest to time block
    await db.insert(timeBlockGuests).values({
      timeBlockId,
      guestId,
      invitedByMemberId,
      bookingDate,
      bookingTime,
    });

    revalidatePath(`/admin/timeblock/${timeBlockId}`);
    return { success: true };
  } catch (error) {
    console.error("Error adding guest to time block:", error);
    return { success: false, error: "Failed to add guest to time block" };
  }
}

export async function removeGuestFromTimeBlock(
  timeBlockId: number,
  guestId: number,
) {
  try {
    const [removedGuest] = await db
      .delete(timeBlockGuests)
      .where(
        and(
          eq(timeBlockGuests.timeBlockId, timeBlockId),
          eq(timeBlockGuests.guestId, guestId),
        ),
      )
      .returning();

    revalidatePath(`/admin/timeblock/${timeBlockId}`);
    return { success: true, data: removedGuest };
  } catch (error) {
    console.error("Error removing guest from time block:", error);
    return { success: false, error: "Failed to remove guest from time block" };
  }
}

export async function getGuestBookingHistoryAction(
  guestId: number,
  year?: number,
  month?: number,
) {
  const bookings = await getGuestBookingHistory(guestId, { year, month });
  return bookings;
}

/**
 * Get guests that a member has played with frequently (2+ times by default)
 * Used for the "buddy system" in booking modal
 * Server action version for client component usage
 */
export async function getMemberFrequentGuestsAction(
  memberId: number,
  minPlayCount: number = 2,
) {
  const result = await db
    .select({
      guest: guests,
      playCount: sql<number>`cast(count(*) as integer)`,
      lastPlayedDate: sql<string>`max(${timeBlockGuests.bookingDate})`,
    })
    .from(timeBlockGuests)
    .innerJoin(guests, eq(guests.id, timeBlockGuests.guestId))
    .where(eq(timeBlockGuests.invitedByMemberId, memberId))
    .groupBy(
      guests.id,
      guests.firstName,
      guests.lastName,
      guests.email,
      guests.phone,
      guests.createdAt,
      guests.updatedAt,
    )
    .having(sql`count(*) >= ${minPlayCount}`)
    .orderBy(desc(sql`count(*)`), desc(sql`max(${timeBlockGuests.bookingDate})`));

  return result;
}
