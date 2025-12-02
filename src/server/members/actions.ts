"use server";

import { db } from "~/server/db";
import {
  members,
  timeBlockMembers,
  timeBlocks,
  teesheets,
} from "~/server/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { searchMembers, getMemberBookingHistory } from "./data";
import { formatDateToYYYYMMDD } from "~/lib/utils";
import { formatTime12Hour, formatDate } from "~/lib/dates";
import { sendNotificationToMember } from "~/server/pwa/actions";

// Time block related functions
export async function addMemberToTimeBlock(
  timeBlockId: number,
  memberId: number,
) {
  try {
    // Check if member is already in the time block
    const existingMember = await db.query.timeBlockMembers.findFirst({
      where: and(
        eq(timeBlockMembers.timeBlockId, timeBlockId),
        eq(timeBlockMembers.memberId, memberId),
      ),
    });

    if (existingMember) {
      return { success: false, error: "Member is already in this time block" };
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

    // Add member to time block
    await db.insert(timeBlockMembers).values({
      timeBlockId,
      memberId,
      bookingDate,
      bookingTime,
    });

    // Send push notification to the member (for admin bookings)
    try {
      if (memberId && bookingTime) {
        // Use BC timezone date utility functions for proper formatting
        const formattedTime = formatTime12Hour(bookingTime);
        const formattedDate = formatDate(bookingDate, "EEEE, MMMM do");

        const notificationResult = await sendNotificationToMember(
          memberId,
          "Tee Time Confirmed! ⛳",
          `Your tee time has been booked for ${formattedDate} at ${formattedTime}. See you on the course!`,
        );

        if (!notificationResult.success) {
          if (notificationResult.expired) {
            console.log(
              `Push subscription expired for member ${memberId} - cleaned up automatically`,
            );
          } else if (notificationResult.shouldRetry) {
            console.warn(
              `Failed to send admin booking notification to member ${memberId}: ${notificationResult.error}`,
            );
          } else {
            console.log(
              `Member ${memberId} not subscribed to push notifications`,
            );
          }
        } else {
          console.log(
            `Successfully sent booking notification to member ${memberId}`,
          );
        }
      }
    } catch (notificationError) {
      // Don't fail the booking if notification fails - just log it
      console.error(
        "Unexpected error sending admin booking notification:",
        notificationError,
      );
    }

    revalidatePath(`/admin/timeblock/${timeBlockId}`);
    revalidatePath("/members/teesheet");
    return { success: true };
  } catch (error) {
    console.error("Error adding member to time block:", error);
    return { success: false, error: "Failed to add member to time block" };
  }
}

/*
 * Note: Member removal from timeblock functionality has been consolidated into
 * the removeTimeBlockMember function in src/server/teesheet/actions.ts
 */

// Member management functions
export async function createMember(data: {
  memberNumber: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  classId: number;
  gender?: string;
  dateOfBirth?: string;
  handicap?: string;
  bagNumber?: string;
}) {
  // Handle empty date string by converting it to null
  const processedData = {
    ...data,
    dateOfBirth: data.dateOfBirth === "" ? null : data.dateOfBirth,
  };

  await db.insert(members).values({
    ...processedData,
  });

  revalidatePath("/admin/members");
}

export async function updateMember(
  id: number,
  data: {
    memberNumber: string;
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    classId: number;
    gender?: string;
    dateOfBirth?: string;
    handicap?: string;
    bagNumber?: string;
  },
) {
  // Handle empty date string by converting it to null
  const processedData = {
    ...data,
    dateOfBirth: data.dateOfBirth === "" ? null : data.dateOfBirth,
  };

  await db.update(members).set(processedData).where(eq(members.id, id));

  revalidatePath("/admin/members");
}

export async function deleteMember(id: number) {
  await db.delete(members).where(eq(members.id, id));

  revalidatePath("/admin/members");
}

export async function searchMembersAction(query = "") {
  const { results } = await searchMembers(query, 1, 10);
  return results.map((member) => ({
    ...member,
    dateOfBirth: member.dateOfBirth ? new Date(member.dateOfBirth) : null,
    createdAt: new Date(member.createdAt),
    updatedAt: member.updatedAt ? new Date(member.updatedAt) : null,
  }));
}

// Get members by their IDs
export async function getMembersByIds(memberIds: number[]) {
  if (!memberIds || memberIds.length === 0) {
    return [];
  }

  try {
    const results = await db.query.members.findMany({
      where: (members, { inArray }) => inArray(members.id, memberIds),
      with: {
        memberClass: true,
      },
    });

    return results.map((member) => ({
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      memberNumber: member.memberNumber,
      class: member.memberClass?.label ?? '',
    }));
  } catch (error) {
    console.error("Error fetching members by IDs:", error);
    return [];
  }
}

export async function getMemberBookingHistoryAction(
  memberId: number,
  year?: number,
  month?: number,
) {
  const bookings = await getMemberBookingHistory(memberId, { year, month });
  return bookings;
}
