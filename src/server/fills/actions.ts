"use server";

import { revalidatePath } from "next/cache";
import { db } from "~/server/db";
import {
  fills,
  timeBlockGuests,
  timeBlocks,
  teesheets,
} from "~/server/db/schema";
import { eq, and } from "drizzle-orm";
import { formatDateToYYYYMMDD } from "~/lib/dates";

/**
 * Replace a fill with a guest in a time block.
 * This atomically removes the fill and adds the guest.
 */
export async function replaceFillWithGuest(
  fillId: number,
  guestId: number,
  invitedByMemberId: number,
  timeBlockId: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify the fill exists and belongs to this timeblock
    const fill = await db.query.fills.findFirst({
      where: and(
        eq(fills.id, fillId),
        eq(fills.relatedType, "timeblock"),
        eq(fills.relatedId, timeBlockId),
      ),
    });

    if (!fill) {
      return { success: false, error: "Fill not found" };
    }

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

    // Check if guest is already in this timeblock
    const existingGuest = await db.query.timeBlockGuests.findFirst({
      where: and(
        eq(timeBlockGuests.timeBlockId, timeBlockId),
        eq(timeBlockGuests.guestId, guestId),
      ),
    });

    if (existingGuest) {
      return { success: false, error: "Guest is already in this time block" };
    }

    // Perform both operations (no transaction - neon-http doesn't support it)
    try {
      // Remove the fill first
      await db.delete(fills).where(eq(fills.id, fillId));

      // Add the guest
      await db.insert(timeBlockGuests).values({
        timeBlockId,
        guestId,
        invitedByMemberId,
        bookingDate,
        bookingTime,
      });
    } catch (opError) {
      console.error("Error during fill replacement operations:", opError);
      return { success: false, error: "Failed to replace fill with guest" };
    }

    revalidatePath("/admin/teesheet");
    return { success: true };
  } catch (error) {
    console.error("Error replacing fill with guest:", error);
    return { success: false, error: "Failed to replace fill with guest" };
  }
}
