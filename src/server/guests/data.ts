import "server-only";
import { db } from "~/server/db";
import { guests, timeBlockGuests, members } from "~/server/db/schema";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";

import { formatDateToYYYYMMDD } from "~/lib/utils";

export async function getGuests() {

  return db.query.guests.findMany({
    orderBy: [guests.lastName, guests.firstName],
  });
}

export async function getGuestById(id: number) {

  return db.query.guests.findFirst({
    where: (guest) => eq(guest.id, id),
  });
}

export async function getTimeBlockGuests(timeBlockId: number) {

  const result = await db.query.timeBlockGuests.findMany({
    where: (tbg) => eq(tbg.timeBlockId, timeBlockId),
    with: {
      guest: true,
      invitedByMember: true,
    },
  });

  return result;
}

export async function getGuestBookingHistory(
  guestId: number,
  options: {
    limit?: number;
    year?: number;
    month?: number; // 0-based month (0 = January, 11 = December)
  } = {},
): Promise<any[]> {
  try {
    const { limit = 50, year, month } = options;

    let whereConditions = and(eq(timeBlockGuests.guestId, guestId));

    // Add month filtering if specified
    if (year !== undefined && month !== undefined) {
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0);

      const monthStartStr = formatDateToYYYYMMDD(monthStart);
      const monthEndStr = formatDateToYYYYMMDD(monthEnd);

      whereConditions = and(
        whereConditions,
        gte(timeBlockGuests.bookingDate, monthStartStr),
        lte(timeBlockGuests.bookingDate, monthEndStr),
      );
    }

    const bookings = await db.query.timeBlockGuests.findMany({
      where: whereConditions,
      with: {
        timeBlock: true,
        invitedByMember: true,
      },
      orderBy: [
        desc(timeBlockGuests.bookingDate),
        desc(timeBlockGuests.bookingTime),
      ],
      limit,
    });

    return bookings.map((booking) => ({
      id: booking.id,
      date: booking.bookingDate,
      time: booking.bookingTime,
      teesheetId: booking.timeBlock.teesheetId,
      timeBlockId: booking.timeBlockId,
      invitedBy: `${booking.invitedByMember.firstName} ${booking.invitedByMember.lastName}`,
      invitedByMemberId: booking.invitedByMemberId,
      createdAt: booking.createdAt,
    }));
  } catch (error) {
    console.error("Error getting guest booking history:", error);
    return [];
  }
}

/**
 * Get guests that a member has played with frequently (2+ times by default)
 * Used for the "buddy system" in booking modal
 */
export async function getMemberFrequentGuests(
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
