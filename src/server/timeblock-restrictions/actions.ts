"use server";

import { db } from "~/server/db";
import { eq, and, or, sql, gte, lte, desc } from "drizzle-orm";

import { revalidatePath } from "next/cache";
import {
  timeblockRestrictions,
  timeblockOverrides,
  timeBlockMembers,
} from "~/server/db/schema";
import { auth } from "@clerk/nextjs/server";
import {
  formatDateToYYYYMMDD,
  formatTimeString,
  preserveDate,
} from "~/lib/utils";
import { format } from "date-fns";

export async function createTimeblockRestriction(
  previousState: any,
  data: any,
) {
  try {
    if (!data?.name || !data.restrictionCategory || !data.restrictionType) {
      console.error("Missing required data for creation:", data);
      return { error: "Missing required fields for restriction creation" };
    }

    // Get the user information for audit
    const authData = await auth();
    const lastUpdatedBy = authData.userId || "Unknown";

    // Process the form data
    const { id, ...processedData } = data;

    // Clean up undefined values that can cause database errors
    Object.keys(processedData).forEach((key) => {
      if (processedData[key] === undefined) {
        processedData[key] = null;
      }
    });

    // Remove id field as it's auto-generated
    delete processedData.id;

    // Handle date fields properly using preserveDate utility
    if (processedData.startDate) {
      processedData.startDate = preserveDate(processedData.startDate);
      if (!processedData.startDate) {
        processedData.startDate = null;
      }
    } else {
      processedData.startDate = null;
    }

    if (processedData.endDate) {
      processedData.endDate = preserveDate(processedData.endDate);
      if (!processedData.endDate) {
        processedData.endDate = null;
      }
    } else {
      processedData.endDate = null;
    }

    // Insert the new restriction
    const result = await db
      .insert(timeblockRestrictions)
      .values({
        ...processedData,
        lastUpdatedBy,
      })
      .returning();

    if (!result || result.length === 0) {
      return { error: "Failed to create restriction" };
    }

    // Revalidate the settings page
    revalidatePath("/admin/settings");

    return result[0];
  } catch (error) {
    console.error("Error creating timeblock restriction:", error);
    return { error: "Failed to create restriction" };
  }
}

export async function updateTimeblockRestriction(
  previousState: any,
  data: {
    id: number;
    [key: string]: any;
  },
) {
  try {
    if (!data?.id || data.id <= 0) {
      console.error("Missing required data for update:", data);
      return { error: "Missing required data for update" };
    }

    // Get the user information for audit
    const authData = await auth();
    const lastUpdatedBy = authData.userId || "Unknown";

    // Extract the ID and remove it from the data to update
    const { id, ...updateData } = data;

    // Clean up undefined values that can cause database errors
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) {
        updateData[key] = null;
      }
    });

    // Handle date fields properly using preserveDate utility
    if (updateData.startDate) {
      updateData.startDate = preserveDate(updateData.startDate);
      if (!updateData.startDate) {
        updateData.startDate = null;
      }
    } else {
      updateData.startDate = null;
    }

    if (updateData.endDate) {
      updateData.endDate = preserveDate(updateData.endDate);
      if (!updateData.endDate) {
        updateData.endDate = null;
      }
    } else {
      updateData.endDate = null;
    }

    // Update the restriction
    const result = await db
      .update(timeblockRestrictions)
      .set({
        ...updateData,
        lastUpdatedBy,
        updatedAt: new Date(),
      })
      .where(eq(timeblockRestrictions.id, id))
      .returning();

    if (!result || result.length === 0) {
      console.error("Failed to update restriction or restriction not found");
      return { error: "Failed to update restriction or restriction not found" };
    }

    // Revalidate the settings page
    revalidatePath("/admin/settings");

    return result[0];
  } catch (error) {
    console.error("Error updating timeblock restriction:", error);
    return { error: "Failed to update restriction" };
  }
}

export async function deleteTimeblockRestriction(id: number) {
  try {
    // First, delete any override records that reference this restriction
    await db
      .delete(timeblockOverrides)
      .where(eq(timeblockOverrides.restrictionId, id));

    // Now delete the restriction
    const result = await db
      .delete(timeblockRestrictions)
      .where(eq(timeblockRestrictions.id, id))
      .returning();

    if (!result || result.length === 0) {
      return { error: "Failed to delete restriction or restriction not found" };
    }

    // Revalidate the settings page
    revalidatePath("/admin/settings");
    return { success: true };
  } catch (error) {
    console.error("Error deleting timeblock restriction:", error);
    return { error: "Failed to delete restriction" };
  }
}

// Add a restriction override feature
export async function recordTimeblockRestrictionOverride(params: {
  restrictionId: number;
  restrictionCategory: "MEMBER_CLASS" | "GUEST" | "LOTTERY";
  entityId?: string | null;
  reason: string;
}) {
  try {
    const authData = await auth();
    const userId = authData.userId;

    if (!userId) {
      return { error: "Unauthorized" };
    }

    // Insert the override into the database
    const result = await db
      .insert(timeblockOverrides)
      .values({
        restrictionId: params.restrictionId,
        // Convert entity ID to member or guest ID based on category
        memberId:
          params.restrictionCategory === "MEMBER_CLASS"
            ? parseInt(params.entityId || "0", 10) || null
            : null,
        guestId:
          params.restrictionCategory === "GUEST"
            ? parseInt(params.entityId || "0", 10) || null
            : null,
        overriddenBy: userId,
        reason: params.reason,
      })
      .returning();

    if (!result || result.length === 0) {
      return { error: "Failed to record override" };
    }

    return { success: true, override: result[0] };
  } catch (error) {
    console.error("Error in recordTimeblockRestrictionOverride:", error);
    return { error: "Failed to record override" };
  }
}

/**
 * Get timeblock restriction overrides with optional filtering
 */
export async function getTimeblockOverrides(params?: {
  restrictionId?: number;
  timeBlockId?: number;
  memberId?: number;
  guestId?: number;
  startDate?: Date;
  endDate?: Date;
  searchTerm?: string;
}) {
  try {
    // Start with the base query conditions
    const conditions = [];

    // Add optional filters
    if (params?.restrictionId) {
      conditions.push(
        eq(timeblockOverrides.restrictionId, params.restrictionId),
      );
    }

    if (params?.timeBlockId) {
      conditions.push(eq(timeblockOverrides.timeBlockId, params.timeBlockId));
    }

    if (params?.memberId) {
      conditions.push(eq(timeblockOverrides.memberId, params.memberId));
    }

    if (params?.guestId) {
      conditions.push(eq(timeblockOverrides.guestId, params.guestId));
    }

    // Date range filter
    if (params?.startDate) {
      conditions.push(gte(timeblockOverrides.createdAt, params.startDate));
    }

    if (params?.endDate) {
      const endOfDay = new Date(params.endDate);
      endOfDay.setHours(23, 59, 59, 999);
      conditions.push(lte(timeblockOverrides.createdAt, endOfDay));
    }

    // Text search for reason field
    if (params?.searchTerm) {
      conditions.push(
        or(
          sql`${timeblockOverrides.reason} ILIKE ${"%" + params.searchTerm + "%"}`,
          sql`${timeblockOverrides.overriddenBy} ILIKE ${"%" + params.searchTerm + "%"}`,
        ),
      );
    }

    // Execute the query with relations
    const overrides = await db.query.timeblockOverrides.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        restriction: true,
        timeBlock: true,
        member: true,
        guest: true,
      },
      orderBy: [desc(timeblockOverrides.createdAt)],
    });

    return overrides;
  } catch (error) {
    console.error("Error getting timeblock overrides:", error);
    return { error: "Failed to get overrides" };
  }
}

/**
 * Internal helper: Check member class restrictions
 */
async function checkMemberClassRestrictions(
  memberId: number,
  memberClassId: number,
  bookingDateStr: string,
  bookingTimeLocal: string,
  dayOfWeek: number,
): Promise<any[]> {
  const violations: any[] = [];

  const memberRestrictions = await db.query.timeblockRestrictions.findMany({
    where: and(
      eq(timeblockRestrictions.restrictionCategory, "MEMBER_CLASS"),
      eq(timeblockRestrictions.isActive, true),
    ),
    orderBy: [desc(timeblockRestrictions.priority)],
  });

  for (const restriction of memberRestrictions) {
    // Check if restriction applies to this member class using integer IDs
    const memberClassesApplies =
      !restriction.memberClassIds?.length ||
      restriction.memberClassIds?.includes(memberClassId);

    if (!memberClassesApplies) {
      continue;
    }

    if (restriction.restrictionType === "TIME") {
      // Check day of week
      const dayApplies =
        !restriction.daysOfWeek?.length ||
        restriction.daysOfWeek?.includes(dayOfWeek);

      if (dayApplies) {
        if (
          bookingTimeLocal >= (restriction.startTime || "00:00") &&
          bookingTimeLocal <= (restriction.endTime || "23:59")
        ) {
          // Check date range
          let dateRangeApplies = true;
          if (restriction.startDate && restriction.endDate) {
            const startDateStr = formatDateToYYYYMMDD(restriction.startDate);
            const endDateStr = formatDateToYYYYMMDD(restriction.endDate);

            dateRangeApplies =
              bookingDateStr >= startDateStr && bookingDateStr <= endDateStr;
          }

          if (dateRangeApplies) {
            violations.push({
              restrictionId: restriction.id,
              restrictionName: restriction.name,
              restrictionDescription: restriction.description,
              restrictionCategory: "MEMBER_CLASS",
              entityId: memberId.toString(),
              memberClassId,
              type: "TIME",
              message: `Booking time (${formatTimeString(bookingTimeLocal)}) is within restricted hours (${restriction.startTime ? formatTimeString(restriction.startTime) : "00:00"} - ${restriction.endTime ? formatTimeString(restriction.endTime) : "23:59"})`,
              canOverride: restriction.canOverride,
            });
          }
        }
      }
    } else if (restriction.restrictionType === "FREQUENCY") {
      if (restriction.maxCount && restriction.periodDays) {
        const currentDate = new Date(bookingDateStr);
        const monthStart = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          1,
        );
        const monthEnd = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() + 1,
          0,
        );

        const monthStartStr = formatDateToYYYYMMDD(monthStart);
        const monthEndStr = formatDateToYYYYMMDD(monthEnd);

        const existingBookings = await db
          .select({ count: sql<number>`cast(count(*) as integer)` })
          .from(timeBlockMembers)
          .where(
            and(
              eq(timeBlockMembers.memberId, memberId),
              gte(timeBlockMembers.bookingDate, monthStartStr),
              lte(timeBlockMembers.bookingDate, monthEndStr),
            ),
          );

        const currentBookingCount = Number(existingBookings[0]?.count || 0);
        const newTotalCount = currentBookingCount + 1;

        if (newTotalCount > restriction.maxCount) {
          const monthName = format(currentDate, "MMMM yyyy");
          violations.push({
            restrictionId: restriction.id,
            restrictionName: restriction.name,
            restrictionDescription: restriction.description,
            restrictionCategory: "MEMBER_CLASS",
            entityId: memberId.toString(),
            memberClassId,
            type: "FREQUENCY",
            message: `Member has exceeded frequency limit (${currentBookingCount}/${restriction.maxCount} bookings in ${monthName})`,
            canOverride: restriction.canOverride,
            frequencyInfo: {
              currentCount: currentBookingCount,
              maxCount: restriction.maxCount,
              monthName,
              willCreateCharge: restriction.applyCharge,
              chargeAmount: restriction.chargeAmount,
            },
          });
        }
      }
    }
  }

  return violations;
}

/**
 * Internal helper: Check guest restrictions
 */
async function checkGuestRestrictions(
  guestId: number,
  bookingDateStr: string,
  bookingTimeLocal: string,
  dayOfWeek: number,
): Promise<any[]> {
  const violations: any[] = [];

  const guestRestrictions = await db.query.timeblockRestrictions.findMany({
    where: and(
      eq(timeblockRestrictions.restrictionCategory, "GUEST"),
      eq(timeblockRestrictions.isActive, true),
    ),
  });

  for (const restriction of guestRestrictions) {
    if (restriction.restrictionType === "TIME") {
      // Check day of week - empty array or null means apply to all days
      const dayApplies =
        !restriction.daysOfWeek?.length ||
        restriction.daysOfWeek?.includes(dayOfWeek);

      if (dayApplies) {
        if (
          bookingTimeLocal >= (restriction.startTime || "00:00") &&
          bookingTimeLocal <= (restriction.endTime || "23:59")
        ) {
          // Check date range
          let dateRangeApplies = true;
          if (restriction.startDate && restriction.endDate) {
            const startDateStr = formatDateToYYYYMMDD(restriction.startDate);
            const endDateStr = formatDateToYYYYMMDD(restriction.endDate);

            dateRangeApplies =
              bookingDateStr >= startDateStr && bookingDateStr <= endDateStr;
          }

          if (dateRangeApplies) {
            violations.push({
              restrictionId: restriction.id,
              restrictionName: restriction.name,
              restrictionDescription: restriction.description,
              restrictionCategory: "GUEST",
              entityId: guestId.toString(),
              type: "TIME",
              message: `Guest booking time (${formatTimeString(bookingTimeLocal)}) is within restricted hours (${restriction.startTime ? formatTimeString(restriction.startTime) : "00:00"} - ${restriction.endTime ? formatTimeString(restriction.endTime) : "23:59"})`,
              canOverride: restriction.canOverride,
            });
          }
        }
      }
    }
  }

  return violations;
}

/**
 * Check all applicable timeblock restrictions for a booking
 * This orchestrates the internal helper functions to check different restriction types
 */
export async function checkTimeblockRestrictionsAction(params: {
  memberId?: number;
  memberClassId?: number; // Changed from memberClass string to memberClassId number
  guestId?: number;
  timeBlockId?: number;
  bookingDateString?: string;
  bookingTime?: string;
}) {
  try {
    const { memberId, memberClassId, guestId, bookingDateString, bookingTime } =
      params;

    // Validate booking date
    if (!bookingDateString) {
      return { success: false, error: "No booking date provided" };
    }

    // Parse date to get day of week
    const dateParts = bookingDateString.split("-");
    if (dateParts.length !== 3) {
      return { success: false, error: "Invalid date format" };
    }

    const year = parseInt(dateParts[0] || "0", 10);
    const month = parseInt(dateParts[1] || "0", 10) - 1;
    const day = parseInt(dateParts[2] || "0", 10);

    const localDate = new Date(year, month, day);
    const dayOfWeek = localDate.getDay();
    const bookingTimeLocal = bookingTime || "00:00";

    // Collect all violations
    let violations: any[] = [];

    // Course availability restrictions are no longer used

    // Check member class restrictions
    if (memberId && memberClassId) {
      const memberViolations = await checkMemberClassRestrictions(
        memberId,
        memberClassId,
        bookingDateString,
        bookingTimeLocal,
        dayOfWeek,
      );
      violations = violations.concat(memberViolations);
    }

    // Check guest restrictions
    if (guestId) {
      const guestViolations = await checkGuestRestrictions(
        guestId,
        bookingDateString,
        bookingTimeLocal,
        dayOfWeek,
      );
      violations = violations.concat(guestViolations);
    }

    // Determine preferred reason: prioritize TIME > FREQUENCY
    let preferredReason = "";
    if (violations.length > 0) {
      const timeViolation = violations.find((v) => v.type === "TIME");
      if (timeViolation) {
        preferredReason =
          timeViolation.restrictionDescription &&
          timeViolation.restrictionDescription.trim() !== ""
            ? timeViolation.restrictionDescription
            : timeViolation.message;
      } else {
        preferredReason =
          violations[0].restrictionDescription &&
          violations[0].restrictionDescription.trim() !== ""
            ? violations[0].restrictionDescription
            : violations[0].message;
      }
    }

    return {
      hasViolations: violations.length > 0,
      violations,
      preferredReason,
    };
  } catch (error) {
    console.error("Error checking timeblock restrictions:", error);
    return { success: false, error: "Failed to check restrictions" };
  }
}
