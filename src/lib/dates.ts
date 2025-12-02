/**
 * Standardized Date Handling for Golf Course (BC, Canada)
 *
 * Core Principles:
 * - Database: Store everything in UTC
 * - Display: Always show in BC time (America/Vancouver)
 * - Calculations: Use BC timezone for "today", business logic, etc.
 *
 * This replaces the mess of date functions in utils.ts with a clean, consistent API
 */

import { addDays as dateFnsAddDays } from "date-fns";
import { toZonedTime, fromZonedTime, formatInTimeZone } from "date-fns-tz";

// Hardcoded timezone for BC, Canada (handles PST/PDT automatically)
const BC_TIMEZONE = "America/Vancouver";

// ============================================================================
// CORE TIMEZONE FUNCTIONS
// ============================================================================

/**
 * Gets today's date in BC timezone as YYYY-MM-DD string
 * This is what should be used for "today" calculations
 *
 * Example: If it's 1am UTC on Jan 2nd but still 5pm Jan 1st in BC,
 * this will return Jan 1st as the BC date.
 */
export function getBCToday(): string {
  // First get current time in UTC
  const utcNow = new Date();

  // Format it in BC timezone to get the correct local date
  return formatInTimeZone(utcNow, BC_TIMEZONE, "yyyy-MM-dd");
}

/**
 * Gets current time as a Date object representing BC local time
 * The Date object will have UTC time internally that represents the BC local time
 */
export function getBCNow(): Date {
  const utcNow = new Date();
  return toZonedTime(utcNow, BC_TIMEZONE);
}

// ============================================================================
// PARSING & CREATING DATES
// ============================================================================

/**
 * Parses a YYYY-MM-DD string into a Date object
 * The input string is assumed to be in BC timezone
 * Returns a Date object with the UTC time that corresponds to midnight in BC
 */
export function parseDate(dateString: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    throw new Error(`Invalid date format: ${dateString}. Expected YYYY-MM-DD`);
  }

  // Parse the date components
  const [yearStr, monthStr, dayStr] = dateString.split("-");
  if (!yearStr || !monthStr || !dayStr) {
    throw new Error(`Invalid date components in: ${dateString}`);
  }

  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1; // JS months are 0-indexed
  const day = parseInt(dayStr, 10);

  // Create a Date representing midnight in BC timezone
  // We'll use formatInTimeZone to get the exact UTC time that represents midnight in BC
  const bcMidnight = `${dateString}T00:00:00`;

  // This gives us the UTC time that represents midnight in BC
  return fromZonedTime(bcMidnight, BC_TIMEZONE);
}

/**
 * Parses a YYYY-MM-DD and HH:mm into a Date object
 * The input is assumed to be in BC timezone
 * Returns a Date object with the UTC time that corresponds to the BC local time
 */
export function parseDateTime(dateString: string, timeString: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    throw new Error(`Invalid date format: ${dateString}. Expected YYYY-MM-DD`);
  }
  if (!/^\d{2}:\d{2}$/.test(timeString)) {
    throw new Error(`Invalid time format: ${timeString}. Expected HH:MM`);
  }

  // Create an ISO string in BC timezone
  const bcDateTime = `${dateString}T${timeString}:00`;

  // Convert BC time to UTC
  return fromZonedTime(bcDateTime, BC_TIMEZONE);
}

// ============================================================================
// FORMATTING FOR DISPLAY (Always in BC time)
// ============================================================================

/**
 * Formats a date for display in BC timezone
 */
export function formatDate(
  date: Date | string,
  formatString = "MMMM do, yyyy",
): string {
  if (typeof date === "string") {
    // If it's a YYYY-MM-DD string, parse it to UTC first
    const utcDate = parseDate(date);
    return formatInTimeZone(utcDate, BC_TIMEZONE, formatString);
  }

  return formatInTimeZone(date, BC_TIMEZONE, formatString);
}

/**
 * Formats time for display in BC timezone
 */
export function formatTime(time: string | Date): string {
  if (typeof time === "string") {
    // Handle HH:MM format
    if (!/^\d{2}:\d{2}$/.test(time)) {
      throw new Error(`Invalid time format: ${time}. Expected HH:MM`);
    }
    return time; // Already in HH:MM format
  }

  return formatInTimeZone(time, BC_TIMEZONE, "HH:mm");
}

/**
 * Formats time for display in 12-hour format
 * Handles: HH:MM strings, ISO timestamps, and Date objects
 */
export function formatTime12Hour(time: string | Date): string {
  if (typeof time === "string") {
    // Check if it's an ISO timestamp (contains 'T' or full date format)
    if (time.includes("T") || /^\d{4}-\d{2}-\d{2}/.test(time)) {
      // It's an ISO timestamp, convert to Date and format in BC timezone
      return formatInTimeZone(new Date(time), BC_TIMEZONE, "h:mm a");
    }

    // Handle HH:MM format - convert to 12-hour
    if (!/^\d{2}:\d{2}$/.test(time)) {
      throw new Error(
        `Invalid time format: ${time}. Expected HH:MM or ISO timestamp`,
      );
    }

    const parts = time.split(":");
    const hourStr = parts[0] || "";
    const minuteStr = parts[1] || "";

    if (!hourStr || !minuteStr) {
      return time; // Return original if any part is missing
    }

    const hour = parseInt(hourStr, 10);

    // Convert to 12-hour format
    const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const ampm = hour >= 12 ? "PM" : "AM";

    return `${hour12}:${minuteStr} ${ampm}`;
  }

  return formatInTimeZone(time, BC_TIMEZONE, "h:mm a");
}

/**
 * Formats date and time together for display in BC timezone
 */
export function formatDateTime(date: Date | string, time?: string): string {
  if (time) {
    // Handle separate date and time
    return `${formatDate(date, "MMMM do")} at ${formatTime(time)}, ${formatDate(date, "yyyy")}`;
  }

  // Handle Date object with time component
  if (typeof date === "string") {
    return formatDate(date);
  }

  return formatInTimeZone(date, BC_TIMEZONE, "MMMM do 'at' h:mm a, yyyy");
}

/**
 * Formats date as day of week + date (e.g., "Monday, January 15, 2024")
 */
export function formatDateWithDay(date: Date | string): string {
  return formatDate(date, "EEEE, MMMM do, yyyy");
}

// ============================================================================
// DATABASE HELPERS
// ============================================================================

/**
 * Converts a Date object to YYYY-MM-DD string for database storage
 * If the input is already a YYYY-MM-DD string, validates and returns it
 * The output string represents the date in BC timezone
 */
export function getDateForDB(date: Date | string): string {
  if (typeof date === "string") {
    // Already in YYYY-MM-DD format, just validate
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error(`Invalid date format: ${date}. Expected YYYY-MM-DD`);
    }
    return date;
  }

  // Convert the UTC Date to BC timezone and format as YYYY-MM-DD
  return formatInTimeZone(date, BC_TIMEZONE, "yyyy-MM-dd");
}

/**
 * Converts a BC local time to UTC for database timestamp storage
 */
export function getDateTimeForDB(date: Date): Date {
  return fromZonedTime(date, BC_TIMEZONE);
}

// ============================================================================
// BUSINESS LOGIC HELPERS
// ============================================================================

/**
 * Checks if a date is today in BC timezone
 */
export function isToday(date: Date | string): boolean {
  const today = getBCToday();
  const dateString = typeof date === "string" ? date : getDateForDB(date);
  return dateString === today;
}

/**
 * Checks if a date/time is in the past in BC timezone
 * Returns true only if the specific date/time has actually passed
 * For same-day bookings, allows booking for any future time
 */
export function isPast(date: Date | string, time?: string): boolean {
  const now = getBCNow();

  if (typeof date === "string") {
    if (time) {
      // Compare date + time - this is the main use case for tee time booking
      const dateTime = parseDateTime(date, time);
      return dateTime < now;
    } else {
      // For date-only comparison, only consider it past if it's a previous date
      // Same day should never be considered "past" when no time is specified
      const today = getBCToday();
      const dateString = date;

      // Only consider dates before today as "past"
      return dateString < today;
    }
  }

  // For Date objects, simple comparison
  return date < now;
}

/**
 * Checks if two dates are the same day in BC timezone
 */
export function isSameDay(date1: Date | string, date2: Date | string): boolean {
  const dateString1 = typeof date1 === "string" ? date1 : getDateForDB(date1);
  const dateString2 = typeof date2 === "string" ? date2 : getDateForDB(date2);
  return dateString1 === dateString2;
}

/**
 * Gets day of week (0 = Sunday, 6 = Saturday) for date in BC timezone
 */
export function getDayOfWeek(date: Date | string): number {
  const utcDate = typeof date === "string" ? parseDate(date) : date;
  const bcDate = toZonedTime(utcDate, BC_TIMEZONE);
  return bcDate.getDay();
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Formats an array of day numbers (0-6) to readable text
 */
export function formatDaysOfWeek(days: number[]): string {
  if (!days?.length) return "None";

  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  if (days.length === 7) return "Every day";
  if (days.length === 5 && !days.includes(0) && !days.includes(6))
    return "Weekdays";
  if (days.length === 2 && days.includes(0) && days.includes(6))
    return "Weekends";

  return days
    .sort((a, b) => a - b)
    .map((day) => dayNames[day])
    .join(", ");
}

/**
 * Adds days to a date and returns a new Date object
 * Handles both Date objects and YYYY-MM-DD strings
 */
export function addDays(date: Date | string, days: number): Date {
  if (typeof date === "string") {
    const parsedDate = parseDate(date);
    return dateFnsAddDays(parsedDate, days);
  }
  return dateFnsAddDays(date, days);
}

/**
 * Formats a date to YYYY-MM-DD string for database storage
 * Works with both Date objects and YYYY-MM-DD strings
 * Always returns the date in BC timezone
 */
export function formatDateToYYYYMMDD(date: Date | string): string {
  if (typeof date === "string") {
    // If it's already in YYYY-MM-DD format, validate and return
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    // Otherwise, parse the string to a date
    const parsedDate = new Date(date);
    return formatInTimeZone(parsedDate, BC_TIMEZONE, "yyyy-MM-dd");
  }
  return formatInTimeZone(date, BC_TIMEZONE, "yyyy-MM-dd");
}
