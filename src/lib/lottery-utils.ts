import type { TeesheetConfigWithBlocks } from "~/server/db/schema/teesheetConfigs.schema";
import type { WindowPosition } from "~/server/db/schema/lottery/lottery-algorithm-config.schema";

// Dynamic time window information with numeric index
export interface DynamicTimeWindowInfo {
  index: number; // 0, 1, 2, ... (numeric identifier)
  label: string; // Auto-generated: "8:30 - 9:30 AM"
  description: string; // "Window 1 of 8"
  timeRange: string; // Same as label for display
  icon: string; // Based on time of day
  startMinutes: number; // Minutes from midnight
  endMinutes: number; // Minutes from midnight
}

/**
 * Calculate dynamic time windows based on teesheet config blocks and maxWindowDurationMinutes.
 * Auto-generates N windows to ensure no window exceeds the max duration.
 *
 * @param config - Teesheet config with blocks
 * @returns Array of time windows with numeric indexes
 */
export function calculateDynamicTimeWindows(
  config: TeesheetConfigWithBlocks | null,
): DynamicTimeWindowInfo[] {
  if (!config?.blocks?.length) {
    return [];
  }

  // Extract and parse start times from all blocks
  const startTimes = config.blocks
    .map((block) => parseTimeToMinutes(block.startTime))
    .filter((time): time is number => time !== null);

  if (startTimes.length === 0) {
    return [];
  }

  // Find earliest and latest start times
  const startTime = Math.min(...startTimes);
  const endTime = Math.max(...startTimes);
  const totalMinutes = endTime - startTime;

  // If there's no range, can't create windows
  if (totalMinutes <= 0) {
    return [];
  }

  // Use config's maxWindowDurationMinutes, or default to 60
  const maxDuration = config.maxWindowDurationMinutes ?? 60;

  // Calculate number of windows needed to not exceed max duration
  const windowCount = Math.ceil(totalMinutes / maxDuration);
  // Calculate actual duration per window (may be less than max)
  const actualDuration = Math.ceil(totalMinutes / windowCount);

  const windows: DynamicTimeWindowInfo[] = [];

  for (let i = 0; i < windowCount; i++) {
    const windowStart = startTime + i * actualDuration;
    // Last window extends to endTime to avoid rounding gaps
    const windowEnd =
      i === windowCount - 1 ? endTime : windowStart + actualDuration;

    windows.push({
      index: i,
      label: formatTimeRange(windowStart, windowEnd),
      description: `Window ${i + 1} of ${windowCount}`,
      timeRange: formatTimeRange(windowStart, windowEnd),
      icon: getTimeIcon(windowStart),
      startMinutes: windowStart,
      endMinutes: windowEnd,
    });
  }

  return windows;
}

/**
 * Get window position category for a given window index.
 * Used to map windows to position-based speed bonuses.
 *
 * @param windowIndex - The window's numeric index (0-based)
 * @param totalWindows - Total number of windows
 * @returns Position category: "early" (0-25%), "mid_early" (25-50%), "mid_late" (50-75%), "late" (75-100%)
 */
export function getWindowPosition(
  windowIndex: number,
  totalWindows: number,
): WindowPosition {
  if (totalWindows <= 0) return "early";

  const ratio = windowIndex / totalWindows;
  if (ratio < 0.25) return "early";
  if (ratio < 0.5) return "mid_early";
  if (ratio < 0.75) return "mid_late";
  return "late";
}

/**
 * Get icon based on time of day
 */
function getTimeIcon(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  if (hour < 10) return "🌅"; // Early morning
  if (hour < 12) return "☀️"; // Late morning
  if (hour < 15) return "🌞"; // Afternoon
  if (hour < 17) return "🌤️"; // Late afternoon
  return "🌆"; // Evening
}

/**
 * Parse time string like "09:30" to minutes since midnight
 */
export function parseTimeToMinutes(timeStr: string): number | null {
  if (!timeStr) return null;

  const parts = timeStr.split(":");
  if (parts.length !== 2) return null;

  const hours = parseInt(parts[0] ?? "0", 10);
  const minutes = parseInt(parts[1] ?? "0", 10);

  if (isNaN(hours) || isNaN(minutes)) return null;

  return hours * 60 + minutes;
}

/**
 * Format time range from minutes to display string like "9:00 AM - 12:00 PM"
 */
function formatTimeRange(startMinutes: number, endMinutes: number): string {
  return `${formatMinutesToTime(startMinutes)} - ${formatMinutesToTime(endMinutes)}`;
}

/**
 * Convert minutes since midnight to 12-hour format like "9:00 AM"
 */
export function formatMinutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const period = hours < 12 ? "AM" : "PM";

  return `${hour12}:${mins.toString().padStart(2, "0")} ${period}`;
}
