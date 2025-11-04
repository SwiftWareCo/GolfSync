"use server";

import { db } from "~/server/db";
import { eq, and, or, isNull, sql, gte, lte, desc } from "drizzle-orm";

import { revalidatePath } from "next/cache";
import {
  timeblockRestrictions,
  timeblockOverrides,
  timeBlockMembers,
} from "~/server/db/schema";
import { auth } from "@clerk/nextjs/server";
import {
  formatDisplayDate,
  formatDateToYYYYMMDD,
  formatDisplayTime,
  formatCalendarDate,
  preserveDate,
} from "~/lib/utils";
import { format } from "date-fns";
import {
  getTimeblockRestrictions,
  getTimeblockRestrictionsByCategory,
  getTimeblockRestrictionById,
  getTimeblockOverrides,
} from "./data";

// Query actions for client components
export async function getTimeblockRestrictionsAction() {
  try {
    const result = await getTimeblockRestrictions();
    // Handle ResultType<any[]> return type
    if (result && typeof result === 'object' && 'success' in result && !result.success) {
      return { success: false, error: result.error || "Failed to load restrictions", data: [] };
    }
    return { success: true, data: result };
  } catch (error) {
    console.error("Error fetching restrictions:", error);
    return { success: false, error: "Failed to fetch restrictions", data: [] };
  }
}

export async function getTimeblockRestrictionsByCategoryAction(
  category: "MEMBER_CLASS" | "GUEST" | "COURSE_AVAILABILITY"
) {
  try {
    const result = await getTimeblockRestrictionsByCategory(category);
    if (result && typeof result === 'object' && 'success' in result && !result.success) {
      return { success: false, error: result.error || "Failed to load restrictions", data: [] };
    }
    return { success: true, data: result };
  } catch (error) {
    console.error("Error fetching restrictions by category:", error);
    return { success: false, error: "Failed to fetch restrictions", data: [] };
  }
}

export async function getTimeblockRestrictionByIdAction(id: number) {
  try {
    const result = await getTimeblockRestrictionById(id);
    if (result && typeof result === 'object' && 'success' in result && !result.success) {
      return { success: false, error: result.error || "Failed to load restriction" };
    }
    return { success: true, data: result };
  } catch (error) {
    console.error("Error fetching restriction:", error);
    return { success: false, error: "Failed to fetch restriction" };
  }
}

export async function getTimeblockOverridesAction(params?: {
  restrictionId?: number;
  timeBlockId?: number;
  memberId?: number;
  guestId?: number;
  startDate?: Date;
  endDate?: Date;
  searchTerm?: string;
}) {
  try {
    const result = await getTimeblockOverrides(params);
    if (result && typeof result === 'object' && 'success' in result && !result.success) {
      return { success: false, error: result.error || "Failed to load overrides", data: [] };
    }
    return { success: true, data: result };
  } catch (error) {
    console.error("Error fetching overrides:", error);
    return { success: false, error: "Failed to fetch overrides", data: [] };
  }
}

export async function createTimeblockRestriction(data: any) {
  try {
    if (!data?.name || !data.restrictionCategory || !data.restrictionType) {
      console.error("Missing required data for creation:", data);
      return { error: "Missing required fields for restriction creation" };
    }

    // Get the user information for audit
    const authData = await auth();
    const lastUpdatedBy = authData.userId || "Unknown";

    // Process the form data
    const processedData = { ...data };

    // Clean up undefined values that can cause database errors
    Object.keys(processedData).forEach((key) => {
      if (processedData[key] === undefined) {
        processedData[key] = null;
      }
    });

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

export async function updateTimeblockRestriction(data: {
  id: number;
  [key: string]: any;
}) {
  try {
    if (!data?.id) {
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
    revalidatePath("/members");
    revalidatePath("/teesheet");
    revalidatePath("/admin");

    return { success: true };
  } catch (error) {
    console.error("Error deleting timeblock restriction:", error);
    return { error: "Failed to delete restriction" };
  }
}

// Add a restriction override feature
export async function recordTimeblockRestrictionOverride(params: {
  restrictionId: number;
  restrictionCategory: "MEMBER_CLASS" | "GUEST" | "COURSE_AVAILABILITY";
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
 * More efficient version of restriction checking that only queries the necessary restrictions
 * This is optimized for checking one timeblock at a time using local date from client
 */
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

export async function checkTimeblockRestrictionsAction(params: {
  memberId?: number;
  memberClass?: string;
  guestId?: number;
  timeBlockId?: number;
  bookingDateString?: string;
  bookingTime?: string; // Changed to string HH:MM format
}) {
  try {
    const { memberId, memberClass, guestId, bookingDateString, bookingTime } =
      params;

    // Use the bookingDateString if provided (this comes directly from the client's local date)
    // otherwise fallback to previous behavior
    let bookingDateStr = "";
    let bookingTimeLocal = "";
    let dayOfWeek = 0;

    if (bookingDateString) {
      // bookingDateString should now be in YYYY-MM-DD format directly from client
      bookingDateStr = bookingDateString; // Can use directly since it's already in YYYY-MM-DD format

      // For time-based restrictions, we need the time component
      bookingTimeLocal = bookingTime || "00:00";

      // Parse date to get day of week - ensure correct UTC handling
      const dateParts = bookingDateStr.split("-");
      if (dateParts.length !== 3) {
        return { success: false, error: "Invalid date format" };
      }

      const year = parseInt(dateParts[0] || "0", 10);
      const month = parseInt(dateParts[1] || "0", 10) - 1; // JS months are 0-indexed
      const day = parseInt(dateParts[2] || "0", 10);

      // Create date with explicit year/month/day to avoid timezone issues
      const localDate = new Date(year, month, day);
      dayOfWeek = localDate.getDay(); // 0=Sunday, 1=Monday, etc.
    } else {
      return { success: false, error: "No booking date provided" };
    }

    const violations: any[] = [];

    // Check course availability restrictions (if any)
    const courseRestrictions = await db.query.timeblockRestrictions.findMany({
      where: and(
        eq(timeblockRestrictions.restrictionCategory, "COURSE_AVAILABILITY"),
        eq(timeblockRestrictions.isActive, true),
      ),
    });

    // Check course availability (date-based) restrictions
    for (const restriction of courseRestrictions) {
      if (restriction.startDate && restriction.endDate) {
        // Convert restriction dates to YYYY-MM-DD format for consistent comparison
        const startDateStr = formatDateToYYYYMMDD(restriction.startDate);
        const endDateStr = formatDateToYYYYMMDD(restriction.endDate);

        // Compare the date strings (no time component)
        const bookingDate = new Date(bookingDateStr);
        const restrictionStart = new Date(startDateStr);
        const restrictionEnd = new Date(endDateStr);

        if (bookingDate >= restrictionStart && bookingDate <= restrictionEnd) {
          // Format dates directly from the strings to avoid timezone issues
          const startYear = parseInt(startDateStr.substring(0, 4));
          const startMonth = parseInt(startDateStr.substring(5, 7)) - 1; // 0-indexed
          const startDay = parseInt(startDateStr.substring(8, 10));

          const endYear = parseInt(endDateStr.substring(0, 4));
          const endMonth = parseInt(endDateStr.substring(5, 7)) - 1; // 0-indexed
          const endDay = parseInt(endDateStr.substring(8, 10));

          const displayStartDate = new Date(startYear, startMonth, startDay);
          const displayEndDate = new Date(endYear, endMonth, endDay);

          const startDateFormatted = format(displayStartDate, "MMMM do, yyyy");
          const endDateFormatted = format(displayEndDate, "MMMM do, yyyy");

          violations.push({
            restrictionId: restriction.id,
            restrictionName: restriction.name,
            restrictionDescription: restriction.description,
            restrictionCategory: "COURSE_AVAILABILITY",
            entityId: null,
            type: "AVAILABILITY",
            message: `Course is restricted (${restriction.name}) from ${startDateFormatted} to ${endDateFormatted}`,
            canOverride: restriction.canOverride,
          });
        }
      }
    }

    // Check member class restrictions if relevant
    if (memberId && memberClass) {
      const memberRestrictions = await db.query.timeblockRestrictions.findMany({
        where: and(
          eq(timeblockRestrictions.restrictionCategory, "MEMBER_CLASS"),
          eq(timeblockRestrictions.isActive, true),
        ),
        orderBy: [desc(timeblockRestrictions.priority)],
      });

      for (const restriction of memberRestrictions) {
        // Check if this restriction applies to the member class
        // Either memberClasses includes the member's class or the memberClasses array is empty/null (applies to all)
        const memberClassesApplies =
          !restriction.memberClasses?.length ||
          restriction.memberClasses?.includes(memberClass);

        if (!memberClassesApplies) {
          continue; // Skip this restriction if it doesn't apply to this member class
        }

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
              // Check date range if applicable
              let dateRangeApplies = true;
              if (restriction.startDate && restriction.endDate) {
                const startDateStr = formatDateToYYYYMMDD(
                  restriction.startDate,
                );
                const endDateStr = formatDateToYYYYMMDD(restriction.endDate);

                dateRangeApplies =
                  bookingDateStr >= startDateStr &&
                  bookingDateStr <= endDateStr;
              }

              if (dateRangeApplies) {
                violations.push({
                  restrictionId: restriction.id,
                  restrictionName: restriction.name,
                  restrictionDescription: restriction.description,
                  restrictionCategory: "MEMBER_CLASS",
                  entityId: memberId.toString(),
                  memberClass,
                  type: "TIME",
                  message: `Booking time (${formatDisplayTime(bookingTimeLocal)}) is within restricted hours (${restriction.startTime ? formatDisplayTime(restriction.startTime) : "00:00"} - ${restriction.endTime ? formatDisplayTime(restriction.endTime) : "23:59"})`,
                  canOverride: restriction.canOverride,
                });
              }
            }
          }
        } else if (restriction.restrictionType === "FREQUENCY") {
          // Check frequency restrictions
          if (restriction.maxCount && restriction.periodDays) {
            // Calculate the current calendar month range
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

            // Count existing bookings for this member in the current month
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
            const newTotalCount = currentBookingCount + 1; // Including this new booking

            if (newTotalCount > restriction.maxCount) {
              const monthName = format(currentDate, "MMMM yyyy");
              violations.push({
                restrictionId: restriction.id,
                restrictionName: restriction.name,
                restrictionDescription: restriction.description,
                restrictionCategory: "MEMBER_CLASS",
                entityId: memberId.toString(),
                memberClass,
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
        // Note: Other restriction types can be added here
      }
    }

    // Check guest restrictions if relevant
    if (guestId) {
      const guestRestrictions = await db.query.timeblockRestrictions.findMany({
        where: and(
          eq(timeblockRestrictions.restrictionCategory, "GUEST"),
          eq(timeblockRestrictions.isActive, true),
        ),
      });

      for (const restriction of guestRestrictions) {
        if (restriction.restrictionType === "TIME") {
          if (restriction.daysOfWeek?.includes(dayOfWeek)) {
            if (
              bookingTimeLocal >= (restriction.startTime || "00:00") &&
              bookingTimeLocal <= (restriction.endTime || "23:59")
            ) {
              // Check date range if applicable
              let dateRangeApplies = true;
              if (restriction.startDate && restriction.endDate) {
                const startDateStr = formatDateToYYYYMMDD(
                  restriction.startDate,
                );
                const endDateStr = formatDateToYYYYMMDD(restriction.endDate);

                dateRangeApplies =
                  bookingDateStr >= startDateStr &&
                  bookingDateStr <= endDateStr;
              }

              if (dateRangeApplies) {
                violations.push({
                  restrictionId: restriction.id,
                  restrictionName: restriction.name,
                  restrictionDescription: restriction.description,
                  restrictionCategory: "GUEST",
                  entityId: guestId.toString(),
                  type: "TIME",
                  message: `Guest booking time (${formatDisplayTime(bookingTimeLocal)}) is within restricted hours (${restriction.startTime ? formatDisplayTime(restriction.startTime) : "00:00"} - ${restriction.endTime ? formatDisplayTime(restriction.endTime) : "23:59"})`,
                  canOverride: restriction.canOverride,
                });
              }
            }
          }
        }
        // Note: Frequency restrictions would be checked here
      }
    }

    // Determine preferred reason: prioritize AVAILABILITY > TIME > FREQUENCY regardless of priority
    let preferredReason = "";
    if (violations.length > 0) {
      // Look for AVAILABILITY violation first (highest priority)
      const availabilityViolation = violations.find(
        (v) => v.type === "AVAILABILITY",
      );
      if (availabilityViolation) {
        preferredReason =
          availabilityViolation.restrictionDescription &&
          availabilityViolation.restrictionDescription.trim() !== ""
            ? availabilityViolation.restrictionDescription
            : availabilityViolation.message;
      } else {
        // Look for TIME violation second
        const timeViolation = violations.find((v) => v.type === "TIME");
        if (timeViolation) {
          preferredReason =
            timeViolation.restrictionDescription &&
            timeViolation.restrictionDescription.trim() !== ""
              ? timeViolation.restrictionDescription
              : timeViolation.message;
        } else {
          // Fall back to first violation if no AVAILABILITY or TIME violation
          preferredReason =
            violations[0].restrictionDescription &&
            violations[0].restrictionDescription.trim() !== ""
              ? violations[0].restrictionDescription
              : violations[0].message;
        }
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
