"use server";

import { db } from "~/server/db";
import {
  timeBlockMembers,
  timeBlocks,
  timeBlockGuests,
  members,
  teesheets,
} from "~/server/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { formatDateToYYYYMMDD } from "~/lib/utils";
import { checkTimeblockRestrictionsAction } from "~/server/timeblock-restrictions/actions";
import { createGuest } from "~/server/guests/actions";

type ActionResult = {
  success: boolean;
  error?: string;
  violations?: any[];
};

// Player types for multi-player booking
type BookingMember = {
  type: "member";
  id: number;
  firstName: string;
  lastName: string;
  memberNumber?: string;
};

type BookingGuest = {
  type: "guest";
  id: number;
  firstName: string;
  lastName: string;
  isNew?: boolean;
};

type BookingPlayer = BookingMember | BookingGuest;

/**
 * Book a tee time for multiple players (members and guests)
 * This replaces the single-player bookTeeTime for member-side booking
 */
export async function bookMultiplePlayersAction(
  timeBlockId: number,
  players: BookingPlayer[],
  currentMemberId: number,
): Promise<ActionResult> {
  try {
    // Authenticate
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: "Not authenticated" };
    }

    // Get time block with teesheet relation
    const timeBlock = await db.query.timeBlocks.findFirst({
      where: eq(timeBlocks.id, timeBlockId),
      with: { teesheet: true },
    });

    if (!timeBlock || !timeBlock.teesheet) {
      return { success: false, error: "Time block not found" };
    }

    const bookingDate = formatDateToYYYYMMDD(timeBlock.teesheet.date);
    const bookingTime = timeBlock.startTime;

    // Separate members and guests
    const memberPlayers = players.filter(
      (p) => p.type === "member",
    ) as BookingMember[];
    const guestPlayers = players.filter(
      (p) => p.type === "guest",
    ) as BookingGuest[];
    const memberIds = memberPlayers.map((m) => m.id);
    const guestIds = guestPlayers.map((g) => g.id);

    // Get all time blocks for this date to check for duplicates
    const teesheet = await db.query.teesheets.findFirst({
      where: eq(teesheets.date, bookingDate),
    });

    if (!teesheet) {
      return { success: false, error: "Teesheet not found" };
    }

    const allTimeBlocksForDate = await db.query.timeBlocks.findMany({
      where: eq(timeBlocks.teesheetId, teesheet.id),
    });

    const allTimeBlockIds = allTimeBlocksForDate.map((tb) => tb.id);

    // Check for existing member bookings on the same DATE (any time block)
    if (memberIds.length > 0) {
      const existingMemberBookings = await db.query.timeBlockMembers.findMany({
        where: and(
          inArray(timeBlockMembers.timeBlockId, allTimeBlockIds),
          inArray(timeBlockMembers.memberId, memberIds),
        ),
      });

      if (existingMemberBookings.length > 0) {
        // Find which members are already booked
        const bookedMemberIds = existingMemberBookings.map((b) => b.memberId);
        const bookedMembers = memberPlayers.filter((m) =>
          bookedMemberIds.includes(m.id),
        );
        const names = bookedMembers
          .map((m) => `${m.firstName} ${m.lastName}`)
          .join(", ");
        return {
          success: false,
          error: `${names} already ${bookedMembers.length === 1 ? "has" : "have"} a booking on this date`,
        };
      }
    }

    // Check for existing guest bookings on the same DATE
    if (guestIds.length > 0) {
      const existingGuestBookings = await db.query.timeBlockGuests.findMany({
        where: and(
          inArray(timeBlockGuests.timeBlockId, allTimeBlockIds),
          inArray(timeBlockGuests.guestId, guestIds),
        ),
      });

      if (existingGuestBookings.length > 0) {
        const bookedGuestIds = existingGuestBookings.map((b) => b.guestId);
        const bookedGuests = guestPlayers.filter((g) =>
          bookedGuestIds.includes(g.id),
        );
        const names = bookedGuests
          .map((g) => `${g.firstName} ${g.lastName}`)
          .join(", ");
        return {
          success: false,
          error: `Guest${bookedGuests.length === 1 ? "" : "s"} ${names} already ${bookedGuests.length === 1 ? "has" : "have"} a booking on this date`,
        };
      }
    }

    // CAPACITY VALIDATION: Prevent race conditions by checking current capacity
    const timeBlockWithRelations = await db.query.timeBlocks.findFirst({
      where: eq(timeBlocks.id, timeBlockId),
      with: {
        timeBlockMembers: true,
        timeBlockGuests: true,
        fills: true,
      },
    });

    if (!timeBlockWithRelations) {
      return { success: false, error: "Time block not found" };
    }

    const currentCapacity =
      (timeBlockWithRelations.timeBlockMembers?.length || 0) +
      (timeBlockWithRelations.timeBlockGuests?.length || 0) +
      (timeBlockWithRelations.fills?.length || 0);

    const maxPlayers = timeBlockWithRelations.maxMembers || 4;
    const availableSlots = maxPlayers - currentCapacity;
    const requestedSlots = players.length;

    if (requestedSlots > availableSlots) {
      return {
        success: false,
        error: `Not enough slots available. Only ${availableSlots} slot${availableSlots === 1 ? "" : "s"} remaining, but you're trying to book ${requestedSlots} player${requestedSlots === 1 ? "" : "s"}.`,
      };
    }

    // Check restrictions for all members
    for (const member of memberPlayers) {
      // Get member details for class ID
      const memberDetails = await db.query.members.findFirst({
        where: eq(members.id, member.id),
      });

      if (!memberDetails) {
        return {
          success: false,
          error: `Member ${member.firstName} ${member.lastName} not found`,
        };
      }

      const restrictionResult = await checkTimeblockRestrictionsAction({
        memberId: member.id,
        memberClassId: memberDetails.classId,
        bookingDateString: bookingDate,
        bookingTime: bookingTime,
      });

      if (
        "hasViolations" in restrictionResult &&
        restrictionResult.hasViolations
      ) {
        // Check for blocking restrictions (TIME)
        const blockingViolations = restrictionResult.violations.filter(
          (v: any) => v.type === "TIME",
        );

        if (blockingViolations.length > 0) {
          return {
            success: false,
            error: `${member.firstName} ${member.lastName}: ${restrictionResult.preferredReason || "Cannot book this time slot"}`,
            violations: restrictionResult.violations,
          };
        }
      }
    }

    // Book all members (with bookedByMemberId tracking)
    if (memberIds.length > 0) {
      await db.insert(timeBlockMembers).values(
        memberPlayers.map((m) => ({
          timeBlockId,
          memberId: m.id,
          bookedByMemberId: currentMemberId,
          bookingDate,
          bookingTime,
          checkedIn: false,
        })),
      );
    }

    // Book all guests (current member as inviter)
    if (guestIds.length > 0) {
      await db.insert(timeBlockGuests).values(
        guestPlayers.map((g) => ({
          timeBlockId,
          guestId: g.id,
          invitedByMemberId: currentMemberId,
          bookingDate,
          bookingTime,
        })),
      );
    }

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

    // Get the booking to check authorization
    const booking = await db.query.timeBlockMembers.findFirst({
      where: and(
        eq(timeBlockMembers.timeBlockId, timeBlockId),
        eq(timeBlockMembers.memberId, member.id),
      ),
    });

    if (!booking) {
      return {
        success: false,
        error: "Booking not found",
      };
    }

    // Authorization: Allow if user is canceling their own slot OR if user booked them
    const isSelfCancellation = booking.memberId === member.id;
    const isBookerCancellation = booking.bookedByMemberId === member.id;

    if (!isSelfCancellation && !isBookerCancellation) {
      return {
        success: false,
        error: "You don't have permission to cancel this booking",
      };
    }

    // Delete the time block member
    await db
      .delete(timeBlockMembers)
      .where(
        and(
          eq(timeBlockMembers.timeBlockId, timeBlockId),
          eq(timeBlockMembers.memberId, member.id),
        ),
      );

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

/**
 * Remove a member from the party (booker can remove members they booked)
 */
export async function removeMemberFromParty(
  timeBlockId: number,
  memberIdToRemove: number,
  currentMemberId: number,
): Promise<ActionResult> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return {
        success: false,
        error: "Not authenticated",
      };
    }

    // Get the booking to check authorization
    const booking = await db.query.timeBlockMembers.findFirst({
      where: and(
        eq(timeBlockMembers.timeBlockId, timeBlockId),
        eq(timeBlockMembers.memberId, memberIdToRemove),
      ),
    });

    if (!booking) {
      return {
        success: false,
        error: "Member not found in time block",
      };
    }

    // Authorization: Allow if current user booked this member OR if removing themselves
    const isRemovingSelf = memberIdToRemove === currentMemberId;
    const isBooker = booking.bookedByMemberId === currentMemberId;

    if (!isRemovingSelf && !isBooker) {
      return {
        success: false,
        error: "You can only remove yourself or members you booked",
      };
    }

    // Check if this member booked others in this timeblock
    const membersBookedByThisMember = await db.query.timeBlockMembers.findMany({
      where: and(
        eq(timeBlockMembers.timeBlockId, timeBlockId),
        eq(timeBlockMembers.bookedByMemberId, memberIdToRemove),
      ),
    });

    // If this member booked others, set their bookedByMemberId to null (admin)
    if (membersBookedByThisMember.length > 0) {
      await db
        .update(timeBlockMembers)
        .set({ bookedByMemberId: null })
        .where(
          and(
            eq(timeBlockMembers.timeBlockId, timeBlockId),
            eq(timeBlockMembers.bookedByMemberId, memberIdToRemove),
          ),
        );
    }

    // Delete the time block member
    await db
      .delete(timeBlockMembers)
      .where(
        and(
          eq(timeBlockMembers.timeBlockId, timeBlockId),
          eq(timeBlockMembers.memberId, memberIdToRemove),
        ),
      );

    revalidatePath("/members/teesheet");
    return { success: true };
  } catch (error) {
    console.error("Error removing member from party:", error);
    return {
      success: false,
      error: "Failed to remove member from party",
    };
  }
}

/**
 * Remove a guest from the party (member can remove guests they invited)
 */
export async function removeGuestFromParty(
  timeBlockId: number,
  guestIdToRemove: number,
  currentMemberId: number,
): Promise<ActionResult> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return {
        success: false,
        error: "Not authenticated",
      };
    }

    // Get the guest booking to check authorization
    const guestBooking = await db.query.timeBlockGuests.findFirst({
      where: and(
        eq(timeBlockGuests.timeBlockId, timeBlockId),
        eq(timeBlockGuests.guestId, guestIdToRemove),
      ),
    });

    if (!guestBooking) {
      return {
        success: false,
        error: "Guest not found in time block",
      };
    }

    // Authorization: Allow if current user invited this guest
    if (guestBooking.invitedByMemberId !== currentMemberId) {
      return {
        success: false,
        error: "You can only remove guests you invited",
      };
    }

    // Delete the time block guest
    await db
      .delete(timeBlockGuests)
      .where(
        and(
          eq(timeBlockGuests.timeBlockId, timeBlockId),
          eq(timeBlockGuests.guestId, guestIdToRemove),
        ),
      );

    revalidatePath("/members/teesheet");
    return { success: true };
  } catch (error) {
    console.error("Error removing guest from party:", error);
    return {
      success: false,
      error: "Failed to remove guest from party",
    };
  }
}
