import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Maps member classes and user types to their color schemes and descriptions
 * @param className the class name or user type to get styling for
 * @returns object containing color information and description
 */
export function getMemberClassStyling(className?: string | null) {
  // Default styling for unknown classes
  const defaultStyle = {
    bg: "bg-gray-100",
    text: "text-gray-800",
    border: "border-gray-200",
    description: "Regular member",
    badgeVariant: "secondary",
  };

  if (!className) return defaultStyle;

  // Standardize input to uppercase for consistent matching
  const classUpper = className.toUpperCase();

  // System for Golf Club Member Classes
  const classMap: Record<string, typeof defaultStyle> = {
    // Unlimited Play
    "UNLIMITED PLAY MALE": {
      bg: "bg-blue-50",
      text: "text-blue-700",
      border: "border-blue-100",
      description: "Unlimited Play Male Member",
      badgeVariant: "default",
    },
    "UNLIMITED PLAY FEMALE": {
      bg: "bg-purple-50",
      text: "text-purple-700",
      border: "border-purple-100",
      description: "Unlimited Play Female Member",
      badgeVariant: "default",
    },

    // Full Play
    "FULL PLAY MALE": {
      bg: "bg-blue-100",
      text: "text-blue-800",
      border: "border-blue-200",
      description: "Full Play Male Member",
      badgeVariant: "default",
    },
    "FULL PLAY FEMALE": {
      bg: "bg-purple-100",
      text: "text-purple-800",
      border: "border-purple-200",
      description: "Full Play Female Member",
      badgeVariant: "default",
    },

    // Social
    "SOCIAL MALE": {
      bg: "bg-orange-50",
      text: "text-orange-700",
      border: "border-orange-100",
      description: "Social Male Member",
      badgeVariant: "secondary",
    },
    "SOCIAL FEMALE": {
      bg: "bg-orange-50",
      text: "text-orange-700",
      border: "border-orange-100",
      description: "Social Female Member",
      badgeVariant: "secondary",
    },

    // Intermediate
    "INTERMEDIATE MALE": {
      bg: "bg-cyan-50",
      text: "text-cyan-700",
      border: "border-cyan-100",
      description: "Intermediate Male Member",
      badgeVariant: "default",
    },
    "INTERMEDIATE FEMALE": {
      bg: "bg-pink-50",
      text: "text-pink-700",
      border: "border-pink-100",
      description: "Intermediate Female Member",
      badgeVariant: "default",
    },

    // Jr Intermediate
    "JR INTERMEDIATE MALE": {
      bg: "bg-sky-100",
      text: "text-sky-800",
      border: "border-sky-200",
      description: "Jr Intermediate Male Member",
      badgeVariant: "default",
    },
    "JR INTERMEDIATE FEMALE": {
      bg: "bg-fuchsia-100",
      text: "text-fuchsia-800",
      border: "border-fuchsia-200",
      description: "Jr Intermediate Female Member",
      badgeVariant: "default",
    },

    // Junior
    "JUNIOR BOY": {
      bg: "bg-blue-100",
      text: "text-blue-800",
      border: "border-blue-200",
      description: "Junior Boy Member",
      badgeVariant: "default",
    },
    "JUNIOR GIRL": {
      bg: "bg-purple-100",
      text: "text-purple-800",
      border: "border-purple-200",
      description: "Junior Girl Member",
      badgeVariant: "default",
    },

    // Weekday Play
    "WEEKDAY PLAY MALE": {
      bg: "bg-lime-50",
      text: "text-lime-700",
      border: "border-lime-100",
      description: "Weekday Play Male Member",
      badgeVariant: "secondary",
    },
    "WEEKDAY PLAY FEMALE": {
      bg: "bg-lime-50",
      text: "text-lime-700",
      border: "border-lime-100",
      description: "Weekday Play Female Member",
      badgeVariant: "secondary",
    },

    // Non-Resident
    "NON-RESIDENT MALE": {
      bg: "bg-yellow-50",
      text: "text-yellow-700",
      border: "border-yellow-100",
      description: "Non-Resident Male Member",
      badgeVariant: "secondary",
    },
    "NON-RESIDENT FEMALE": {
      bg: "bg-yellow-50",
      text: "text-yellow-700",
      border: "border-yellow-100",
      description: "Non-Resident Female Member",
      badgeVariant: "secondary",
    },

    // Staff
    "STAFF PLAY": {
      bg: "bg-indigo-100",
      text: "text-indigo-800",
      border: "border-indigo-200",
      description: "Staff Play Member",
      badgeVariant: "outline",
    },
    "MGMT / PRO": {
      bg: "bg-blue-200",
      text: "text-blue-900",
      border: "border-blue-300",
      description: "Management or Pro Staff Member",
      badgeVariant: "outline",
    },

    // Dining
    DINING: {
      bg: "bg-amber-50",
      text: "text-amber-700",
      border: "border-amber-100",
      description: "Dining Member",
      badgeVariant: "secondary",
    },

    // Privileged
    "PRIVILEGED MALE": {
      bg: "bg-green-50",
      text: "text-green-700",
      border: "border-green-100",
      description: "Privileged Male Member",
      badgeVariant: "secondary",
    },
    "PRIVILEGED FEMALE": {
      bg: "bg-green-50",
      text: "text-green-700",
      border: "border-green-100",
      description: "Privileged Female Member",
      badgeVariant: "secondary",
    },

    // Senior
    "SENIOR RETIRED MALE": {
      bg: "bg-amber-100",
      text: "text-amber-800",
      border: "border-amber-200",
      description: "Senior Retired Male Member",
      badgeVariant: "default",
    },
    "SENIOR RETIRED FEMALE": {
      bg: "bg-amber-100",
      text: "text-amber-800",
      border: "border-amber-200",
      description: "Senior Retired Female Member",
      badgeVariant: "default",
    },

    // Honorary
    "HONORARY MALE": {
      bg: "bg-green-100",
      text: "text-green-800",
      border: "border-green-200",
      description: "Honorary Male Member",
      badgeVariant: "secondary",
    },
    "HONORARY FEMALE": {
      bg: "bg-green-100",
      text: "text-green-800",
      border: "border-green-200",
      description: "Honorary Female Member",
      badgeVariant: "secondary",
    },

    // Other status types
    REGULAR: {
      bg: "bg-gray-100",
      text: "text-gray-800",
      border: "border-gray-200",
      description: "Regular Member",
      badgeVariant: "secondary",
    },
    SENIOR: {
      bg: "bg-amber-100",
      text: "text-amber-800",
      border: "border-amber-200",
      description: "Senior Member",
      badgeVariant: "default",
    },
    HONORARY: {
      bg: "bg-green-100",
      text: "text-green-800",
      border: "border-green-200",
      description: "Honorary Member",
      badgeVariant: "secondary",
    },
    RESIGNED: {
      bg: "bg-rose-100",
      text: "text-rose-800",
      border: "border-rose-200",
      description: "Resigned Member",
      badgeVariant: "destructive",
    },

    // Special user types
    GUEST: {
      bg: "bg-lime-200",
      text: "text-lime-800",
      border: "border-lime-200",
      description: "Guest",
      badgeVariant: "outline",
    },
    STAFF: {
      bg: "bg-indigo-100",
      text: "text-indigo-800",
      border: "border-indigo-200",
      description: "Staff Member",
      badgeVariant: "outline",
    },
  };

  // Return the styling for the class or default if not found
  return classMap[classUpper] || defaultStyle;
}

export function generateTimeBlocks(
  startTime: string,
  endTime: string,
  intervalMinutes: number,
): string[] {
  const [startHour, startMin] = startTime.split(":").map(Number);
  const [endHour, endMin] = endTime.split(":").map(Number);

  if (
    startHour === undefined ||
    startMin === undefined ||
    endHour === undefined ||
    endMin === undefined
  ) {
    throw new Error("Time must be in HH:MM format");
  }

  // Validate by checking if parsing succeeded
  if (isNaN(startHour) || isNaN(startMin) || isNaN(endHour) || isNaN(endMin)) {
    throw new Error("Time must be in HH:MM format");
  }

  // 9 *60 = 540
  //end hour = 19 * 60 = 1140
  const blocks: string[] = [];
  let totalMinutes = startHour * 60 + startMin;
  const endTotalMinutes = endHour * 60 + endMin;

  while (totalMinutes <= endTotalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    blocks.push(
      `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
    );
    totalMinutes += intervalMinutes;
  }
  return blocks;
}

/**
 * Formats a date in YYYY-MM-DD format
 */
export function formatDateToYYYYMMDD(date: Date | string): string {
  if (typeof date === "string") {
    // If it's already in YYYY-MM-DD format, return it
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    // Otherwise, parse the string to a date
    return format(new Date(date), "yyyy-MM-dd");
  }
  return format(date, "yyyy-MM-dd");
}

/**
 * Formats a date for display in user-friendly format (e.g., "May 7th, 2025")
 */
export function formatDisplayDate(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return format(dateObj, "MMMM do, yyyy");
}

export function getOrganizationColors(theme?: {
  primary?: string;
  secondary?: string;
  tertiary?: string;
  ["--org-primary"]?: string;
  ["--org-secondary"]?: string;
  ["--org-tertiary"]?: string;
}) {
  // Handle both formats of theme properties
  const primaryColor = theme?.primary || theme?.["--org-primary"] || "#000000";
  const secondaryColor =
    theme?.secondary || theme?.["--org-secondary"] || "#f3f4f6";
  const tertiaryColor =
    theme?.tertiary || theme?.["--org-tertiary"] || "#9ca3af";

  return {
    primary: primaryColor,
    secondary: secondaryColor,
    tertiary: tertiaryColor,
    text: {
      primary: primaryColor,
      secondary: "#4B5563",
    },
    background: {
      primary: "#FFFFFF",
      secondary: secondaryColor,
    },
  };
}

/**
 * Checks if two dates are on the same day (ignoring time) using UTC components
 * This is useful for server-side date comparisons
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getUTCFullYear() === date2.getUTCFullYear() &&
    date1.getUTCMonth() === date2.getUTCMonth() &&
    date1.getUTCDate() === date2.getUTCDate()
  );
}

/**
 * Checks if two dates are on the same LOCAL day (ignoring time)
 * This is useful for client-side date comparisons in the user's timezone
 */
export function isSameLocalDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Formats an array of day numbers (0-6) to readable text representation
 * 0 = Sunday, 1 = Monday, etc.
 */
export function formatDaysOfWeek(days: number[]): string {
  if (!days || days.length === 0) return "None";

  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const sortedDays = [...days].sort((a, b) => a - b);

  if (sortedDays.length === 7) return "Every day";
  if (
    sortedDays.length === 5 &&
    sortedDays.includes(1) &&
    sortedDays.includes(2) &&
    sortedDays.includes(3) &&
    sortedDays.includes(4) &&
    sortedDays.includes(5)
  )
    return "Weekdays";
  if (
    sortedDays.length === 2 &&
    sortedDays.includes(0) &&
    sortedDays.includes(6)
  )
    return "Weekends";

  return sortedDays.map((day) => dayNames[day]).join(", ");
}

/**
 * Universal date formatter that reliably displays a calendar date without time components
 * This function handles any date input (string or Date object) and ensures the correct date
 * is displayed regardless of timezone.
 *
 * @param date - A Date object, ISO string, or YYYY-MM-DD string
 * @param formatString - Optional date-fns format string (default: "yyyy-MM-dd")
 * @returns Formatted date string
 */
export function formatCalendarDate(
  date: Date | string | null,
  formatString = "yyyy-MM-dd",
): string {
  if (!date) return "";

  try {
    // For string dates, first validate if it's a valid date string
    if (typeof date === "string") {
      // If it's already in YYYY-MM-DD format and valid, just format it directly
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const parts = date.split("-");
        const yearStr = parts[0] || "0";
        const monthStr = parts[1] || "0";
        const dayStr = parts[2] || "0";

        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10) - 1; // JS months are 0-indexed
        const day = parseInt(dayStr, 10);

        // Validate the date components
        if (
          isNaN(year) ||
          isNaN(month) ||
          isNaN(day) ||
          month < 0 ||
          month > 11 ||
          day < 1 ||
          day > 31 ||
          year < 1000 ||
          year > 9999
        ) {
          return date; // Return the original string if it's an invalid date
        }

        // Create a new date in local time and format it
        const safeDate = new Date(year, month, day);
        if (isNaN(safeDate.getTime())) {
          return date; // Return original if it results in invalid date
        }
        const result = format(safeDate, formatString);
        return result;
      }

      // For ISO strings, parse carefully
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        return date; // Return the original string if parsing fails
      }

      // Extract components from the valid date
      const year = parsedDate.getFullYear();
      const month = parsedDate.getMonth();
      const day = parsedDate.getDate();

      // Create a new date using just the year, month, day (no time)
      const safeDate = new Date(year, month, day);
      const result = format(safeDate, formatString);
      return result;
    }

    // For Date objects, first check if it's a valid date
    if (isNaN(date.getTime())) {
      return String(date); // Return string representation of invalid date
    }

    // Extract date components from the valid Date object
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();

    // Create a new date with just the date portion
    const safeDate = new Date(year, month, day);
    const result = format(safeDate, formatString);
    return result;
  } catch (error) {
    console.error("[FORMAT] Error formatting calendar date:", error);
    return String(date);
  }
}

/**
 * Formats a YYYY-MM-DD date string to words WITHOUT using Date objects to avoid timezone issues
 * This is crucial for displaying dates that are stored in the database without timezone shifts
 * @param dateString A date string in YYYY-MM-DD format
 * @returns A formatted date string like "Friday, May 9, 2025"
 */
export function formatDateStringToWords(
  dateString: string | undefined,
): string {
  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString || ""; // Return original or empty string if undefined
  }

  // Extract components from the date string
  const parts = dateString.split("-");
  const year = parts[0] || "";
  const monthStr = parts[1] || "";
  const dayStr = parts[2] || "";

  if (!year || !monthStr || !dayStr) {
    return dateString; // Return original if any part is missing
  }

  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  // Month names
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  // Day of week calculation (Zeller's Congruence)
  // This is a direct algorithm to calculate day of week without Date objects
  const m = month < 3 ? month + 12 : month;
  const y = month < 3 ? parseInt(year) - 1 : parseInt(year);
  let h =
    (day +
      Math.floor((13 * (m + 1)) / 5) +
      y +
      Math.floor(y / 4) -
      Math.floor(y / 100) +
      Math.floor(y / 400)) %
    7;
  // Adjust h to make 0 = Sunday, 1 = Monday, etc.
  h = (h + 6) % 7;

  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  // Format the date
  return `${dayNames[h]}, ${monthNames[month - 1]} ${day}, ${year}`;
}


export function formatTimeString(time: string): string {
  if (!time) {
    return "";
  }

  const parts = time.split(":");
  if (parts.length !== 2) {
    return time; // Not HH:MM format, return as-is
  }

  const [hoursStr = "0", minutesStr = "0"] = parts;

  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);

  // If parsing failed, return original
  if (isNaN(hours) || isNaN(minutes)) {
    return time;
  }

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return format(date, "h:mm a");
}

/**
 * Safely formats a database timestamp for pace of play display
 * Handles null values and ensures proper local time display
 * @param timestamp Database timestamp that might be null
 * @param includeDate Whether to include the date in the output
 * @returns Formatted time string or placeholder if timestamp is null
 */
export function formatPaceOfPlayTimestamp(
  timestamp: Date | string | null | undefined,
  includeDate = false,
): string {
  if (!timestamp) return "—";

  try {
    const date =
      typeof timestamp === "string" ? new Date(timestamp) : timestamp;

    // Validate the date is not invalid
    if (isNaN(date.getTime())) return "Invalid Date";

    // Format with or without date
    return includeDate ? format(date, "MMM d, h:mm a") : format(date, "h:mm a");
  } catch (error) {
    console.error("Error formatting timestamp:", error);
    return "Invalid Date";
  }
}

/**
 * Preserves date without timezone issues, used in date pickers and form processing
 * @param date Date object, string, or null/undefined
 * @returns A clean Date object with consistent timezone handling or undefined if input is invalid
 */
export function preserveDate(
  date: Date | string | null | undefined,
): Date | undefined {
  if (!date) return undefined;

  // If it's already a Date object, use it directly
  if (date instanceof Date) {
    // Create a new date at noon of the same day to avoid timezone issues
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      12,
      0,
      0,
      0,
    );
  }

  // If date is a string like "2025-05-05", parse it directly
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.exec(date)) {
    // Split the date string into year, month, day
    const parts = date.split("-").map(Number);
    const year = parts[0] || 2000;
    const month = (parts[1] || 1) - 1; // 0-indexed in JS
    const day = parts[2] || 1;

    // Create date with the correct local date
    return new Date(year, month, day, 12, 0, 0);
  }

  try {
    // Otherwise, parse the string
    const d = new Date(date);

    // Check if the date is valid
    if (isNaN(d.getTime())) {
      console.warn("Invalid date provided to preserveDate:", date);
      return undefined;
    }

    // Create a new date using local time components to prevent timezone shifts
    return new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      12, // Use noon to avoid any DST issues
      0,
      0,
      0,
    );
  } catch (error) {
    console.error("Error parsing date in preserveDate:", error);
    return undefined;
  }
}

export function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
