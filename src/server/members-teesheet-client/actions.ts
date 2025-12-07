"use server";

import { db } from "~/server/db";
import { timeBlockMembers, timeBlocks } from "~/server/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { auth } from "@clerk/nextjs/server";
import { formatDateToYYYYMMDD } from "~/lib/utils";

type ActionResult = {
  success: boolean;
  error?: string;
  violations?: any[];
};

/**
 * Book a tee time for a member
 */
export async function bookTeeTime(
  timeBlockId: number,
  member: { id: number },
): Promise<ActionResult> {
  try {
    // Get member data
    const { userId } = await auth();

    if (!userId) {
      return {
        success: false,
        error: "Not authenticated",
      };
    }

    // Get time block with teesheet relation
    const timeBlock = await db.query.timeBlocks.findFirst({
      where: eq(timeBlocks.id, timeBlockId),
      with: { teesheet: true },
    });

    if (!timeBlock || !timeBlock.teesheet) {
      return {
        success: false,
        error: "Time block not found",
      };
    }

    // Format the booking date and save the booking time
    const bookingDate = formatDateToYYYYMMDD(timeBlock.teesheet.date);
    const bookingTime = timeBlock.startTime;

    // Check for existing booking on the same time block
    const existingBooking = await db.query.timeBlockMembers.findFirst({
      where: and(
        eq(timeBlockMembers.timeBlockId, timeBlockId),
        eq(timeBlockMembers.memberId, member.id),
      ),
    });

    if (existingBooking) {
      return {
        success: false,
        error: "You have already booked this time slot",
      };
    }

    // Book the time slot
    await db.insert(timeBlockMembers).values({
      timeBlockId,
      memberId: member.id,
      bookingDate,
      bookingTime,
      checkedIn: false,
    });

    revalidatePath("/members/teesheet");
    return { success: true };
  } catch (error) {
    console.error("Error booking tee time:", error);
    return {
      success: false,
      error: "Failed to book tee time",
    };
  }
}

/**
 * Cancel a member's tee time booking
 */
export async function cancelTeeTime(
  timeBlockId: number,
  member: { id: number },
): Promise<ActionResult> {
  try {
    // Get member data
    const { userId } = await auth();

    if (!userId) {
      return {
        success: false,
        error: "Not authenticated",
      };
    }

    // Delete the time block member
    const result = await db
      .delete(timeBlockMembers)
      .where(
        and(
          eq(timeBlockMembers.timeBlockId, timeBlockId),
          eq(timeBlockMembers.memberId, member.id),
        ),
      )
      .returning();

    if (!result || result.length === 0) {
      return {
        success: false,
        error: "Booking not found",
      };
    }

    revalidatePath("/members/teesheet");
    return { success: true };
  } catch (error) {
    console.error("Error canceling tee time:", error);
    return {
      success: false,
      error: "Failed to cancel tee time",
    };
  }
}
