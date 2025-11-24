import "server-only";

import { db } from "~/server/db";
import { eq, and, gte, lte, ilike, desc, sql } from "drizzle-orm";

import {
  timeblockRestrictions,
  members,
  timeblockOverrides,
  timeBlockMembers,
} from "~/server/db/schema";
import { formatDateToYYYYMMDD, formatTimeString } from "~/lib/utils";
import { format } from "date-fns";

type ResultType<T> = { success: false; error: string } | T;

// Get all timeblock restrictions for the current organization
export async function getTimeblockRestrictions(): Promise<ResultType<any[]>> {
  try {
    const restrictions = await db.query.timeblockRestrictions.findMany({
      orderBy: [
        timeblockRestrictions.restrictionCategory,
        timeblockRestrictions.name,
      ],
    });

    return restrictions;
  } catch (error) {
    console.error("Error getting timeblock restrictions:", error);
    return { success: false, error: "Failed to get restrictions" };
  }
}

// Get timeblock restrictions by category
export async function getTimeblockRestrictionsByCategory(
  category: "MEMBER_CLASS" | "GUEST" | "COURSE_AVAILABILITY",
): Promise<ResultType<any[]>> {
  try {
    const restrictions = await db.query.timeblockRestrictions.findMany({
      where: eq(timeblockRestrictions.restrictionCategory, category),
      orderBy: [timeblockRestrictions.name],
    });

    return restrictions;
  } catch (error) {
    console.error("Error getting timeblock restrictions by category:", error);
    return { success: false, error: "Failed to get restrictions" };
  }
}

// Get timeblock restriction by ID
export async function getTimeblockRestrictionById(
  id: number,
): Promise<ResultType<any>> {
  try {
    const restriction = await db.query.timeblockRestrictions.findFirst({
      where: eq(timeblockRestrictions.id, id),
    });

    if (!restriction) {
      return { success: false, error: "Restriction not found" };
    }

    return restriction;
  } catch (error) {
    console.error("Error getting timeblock restriction by ID:", error);
    return { success: false, error: "Failed to get restriction" };
  }
}

/**
 * Check restrictions for multiple timeblocks in a batch to improve performance
 */
export async function checkBatchTimeblockRestrictions(params: {
  timeBlocks: Array<{
    id: number;
    startTime: string; // Updated to only accept string (HH:MM format)
    date: string; // Add date parameter in YYYY-MM-DD format
  }>;
  memberId?: number;
  memberClass?: string;
  guestId?: number;
}): Promise<
  ResultType<
    Array<{
      timeBlockId: number;
      hasViolations: boolean;
      violations: any[];
      preferredReason: string;
    }>
  >
> {
  try {
    const { timeBlocks, memberId, memberClass, guestId } = params;
    const results: Array<{
      timeBlockId: number;
      hasViolations: boolean;
      violations: any[];
      preferredReason: string;
    }> = [];

    // Fetch all restrictions upfront to minimize database queries
    const courseRestrictionsResult = await getTimeblockRestrictionsByCategory(
      "COURSE_AVAILABILITY",
    );
    if ("error" in courseRestrictionsResult) {
      return { success: false, error: courseRestrictionsResult.error };
    }
    const courseRestrictions = courseRestrictionsResult.filter(
      (r) => r.isActive,
    );

    // Get member class restrictions if needed
    let memberRestrictions: any[] = [];
    if (memberId && memberClass) {
      const memberRestrictionsResult =
        await getTimeblockRestrictionsByCategory("MEMBER_CLASS");
      if ("error" in memberRestrictionsResult) {
        return { success: false, error: memberRestrictionsResult.error };
      }
      memberRestrictions = memberRestrictionsResult
        .filter(
          (r) =>
            r.isActive &&
            (!r.memberClasses?.length || r.memberClasses.includes(memberClass)),
        )
        .sort((a, b) => (b.priority || 0) - (a.priority || 0)); // Sort by priority DESC
    }

    // Get guest restrictions if needed
    let guestRestrictions: any[] = [];
    if (guestId) {
      const guestRestrictionsResult =
        await getTimeblockRestrictionsByCategory("GUEST");
      if ("error" in guestRestrictionsResult) {
        return { success: false, error: guestRestrictionsResult.error };
      }
      guestRestrictions = guestRestrictionsResult.filter((r) => r.isActive);
    }

    // Process each timeblock against the pre-fetched restrictions
    for (const timeBlock of timeBlocks) {
      const violations: any[] = [];
      const bookingTime = timeBlock.startTime; // HH:MM format
      const bookingDateStr = timeBlock.date; // Use the provided date string

      // Parse date to get day of week - ensure correct UTC handling
      // Use the same date parsing approach as in getConfigForDate
      if (!bookingDateStr) {
        console.error("Missing booking date string");
        continue; // Skip this timeblock
      }

      const dateParts = bookingDateStr.split("-");
      if (dateParts.length !== 3) {
        console.error("Invalid date format:", bookingDateStr);
        continue; // Skip this timeblock
      }

      const year = parseInt(dateParts[0] || "0", 10);
      const month = parseInt(dateParts[1] || "0", 10) - 1; // JS months are 0-indexed
      const day = parseInt(dateParts[2] || "0", 10);

      // Create date with explicit year/month/day to avoid timezone issues
      const bookingDate = new Date(year, month, day);
      const dayOfWeek = bookingDate.getDay(); // 0=Sunday, 1=Monday, etc.

      // Check course availability restrictions
      for (const restriction of courseRestrictions) {
        if (restriction.startDate && restriction.endDate) {
          // Convert restriction dates to YYYY-MM-DD format
          const startDateStr = formatDateToYYYYMMDD(restriction.startDate);
          const endDateStr = formatDateToYYYYMMDD(restriction.endDate);

          // Check if the BOOKING date falls within the restriction period
          if (bookingDateStr >= startDateStr && bookingDateStr <= endDateStr) {
            // Format dates directly from the strings to avoid timezone issues
            const startYear = parseInt(startDateStr.substring(0, 4));
            const startMonth = parseInt(startDateStr.substring(5, 7)) - 1; // 0-indexed
            const startDay = parseInt(startDateStr.substring(8, 10));

            const endYear = parseInt(endDateStr.substring(0, 4));
            const endMonth = parseInt(endDateStr.substring(5, 7)) - 1; // 0-indexed
            const endDay = parseInt(endDateStr.substring(8, 10));

            const displayStartDate = new Date(startYear, startMonth, startDay);
            const displayEndDate = new Date(endYear, endMonth, endDay);

            const startDateFormatted = format(
              displayStartDate,
              "MMMM do, yyyy",
            );
            const endDateFormatted = format(displayEndDate, "MMMM do, yyyy");

            violations.push({
              restrictionId: restriction.id,
              restrictionName: restriction.name,
              restrictionDescription: restriction.description,
              restrictionCategory: "COURSE_AVAILABILITY",
              type: "AVAILABILITY",
              message: `Course is restricted (${restriction.name}) from ${startDateFormatted} to ${endDateFormatted}`,
              canOverride: restriction.canOverride,
            });
          }
        }
      }

      // Check member class restrictions
      if (memberId && memberClass) {
        for (const restriction of memberRestrictions) {
          if (restriction.restrictionType === "TIME") {
            // Check day of week - empty array means apply to all days
            if (
              restriction.daysOfWeek?.length === 0 ||
              restriction.daysOfWeek?.includes(dayOfWeek)
            ) {
              // Check time range
              if (
                bookingTime >= (restriction.startTime || "00:00") &&
                bookingTime <= (restriction.endTime || "23:59")
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
                    memberClass,
                    type: "TIME",
                    message: `Booking time (${formatTimeString(bookingTime)}) is within restricted hours (${restriction.startTime ? formatTimeString(restriction.startTime) : "00:00"} - ${restriction.endTime ? formatTimeString(restriction.endTime) : "23:59"})`,
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

              const currentBookingCount = Number(
                existingBookings[0]?.count || 0,
              );
              const newTotalCount = currentBookingCount + 1; // Including this new booking

              if (newTotalCount > restriction.maxCount) {
                const monthName = format(currentDate, "MMMM yyyy");
                violations.push({
                  restrictionId: restriction.id,
                  restrictionName: restriction.name,
                  restrictionDescription: restriction.description,
                  restrictionCategory: "MEMBER_CLASS",
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
        }
      }

      // Check guest restrictions
      if (guestId) {
        for (const restriction of guestRestrictions) {
          if (restriction.restrictionType === "TIME") {
            // Empty array means apply to all days of the week
            if (
              restriction.daysOfWeek?.length === 0 ||
              restriction.daysOfWeek?.includes(dayOfWeek)
            ) {
              if (
                bookingTime >= (restriction.startTime || "00:00") &&
                bookingTime <= (restriction.endTime || "23:59")
              ) {
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
                    type: "TIME",
                    message: `Guest booking time (${formatTimeString(bookingTime)}) is within restricted hours (${restriction.startTime ? formatTimeString(restriction.startTime) : "00:00"} - ${restriction.endTime ? formatTimeString(restriction.endTime) : "23:59"})`,
                    canOverride: restriction.canOverride,
                  });
                }
              }
            }
          }
        }
      }

      // Add the prepared results for this timeblock
      const timeBlockViolations = violations.length > 0;

      // Determine preferred reason: prioritize AVAILABILITY > TIME > FREQUENCY regardless of priority
      let preferredReason = "";
      if (timeBlockViolations) {
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

      results.push({
        timeBlockId: timeBlock.id,
        hasViolations: timeBlockViolations,
        violations,
        preferredReason,
      });
    }

    return results;
  } catch (error) {
    console.error("Error checking batch timeblock restrictions:", error);
    return { success: false, error: "Failed to check restrictions" };
  }
}

// Get timeblock restriction overrides with optional filtering
export async function getTimeblockOverrides(params?: {
  restrictionId?: number;
  timeBlockId?: number;
  memberId?: number;
  guestId?: number;
  startDate?: Date;
  endDate?: Date;
  searchTerm?: string;
}): Promise<ResultType<any[]>> {
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
        ilike(timeblockOverrides.reason, `%${params.searchTerm}%`),
      );
    }

    // Execute the query with relations
    const overrides = await db.query.timeblockOverrides.findMany({
      where: and(...conditions),
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
    return { success: false, error: "Failed to get overrides" };
  }
}
