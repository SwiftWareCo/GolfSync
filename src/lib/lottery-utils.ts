import type { TeesheetConfigWithBlocks } from "~/server/db/schema/teesheetConfigs.schema";

// Updated time window enum to use consistent naming
export type TimeWindow = "MORNING" | "MIDDAY" | "AFTERNOON" | "EVENING";

// Time window display information with dynamic calculation
export interface DynamicTimeWindowInfo {
  value: TimeWindow;
  label: string;
  description: string;
  timeRange: string;
  icon: string;
  startMinutes: number; // Minutes from midnight
  endMinutes: number; // Minutes from midnight
}

/**
 * Calculate dynamic time windows based on teesheet config blocks
 * Divides the time range into 4 equal windows: MORNING, MIDDAY, AFTERNOON, EVENING
 */
export function calculateDynamicTimeWindows(
  config: TeesheetConfigWithBlocks | null,
): DynamicTimeWindowInfo[] {
  if (!config || !config.blocks || config.blocks.length === 0) {
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

  // If there's no range, can't create windows
  if (startTime === endTime) {
    return [];
  }

  // Calculate total duration and divide into 4 equal windows
  const totalMinutes = endTime - startTime;
  const windowDuration = Math.floor(totalMinutes / 4);

  const windows: DynamicTimeWindowInfo[] = [
    {
      value: "MORNING",
      label: "Morning",
      description: "Early times",
      timeRange: formatTimeRange(startTime, startTime + windowDuration),
      icon: "☀️",
      startMinutes: startTime,
      endMinutes: startTime + windowDuration,
    },
    {
      value: "MIDDAY",
      label: "Midday",
      description: "Mid-day times",
      timeRange: formatTimeRange(
        startTime + windowDuration,
        startTime + windowDuration * 2,
      ),
      icon: "🌞",
      startMinutes: startTime + windowDuration,
      endMinutes: startTime + windowDuration * 2,
    },
    {
      value: "AFTERNOON",
      label: "Afternoon",
      description: "Later times",
      timeRange: formatTimeRange(
        startTime + windowDuration * 2,
        startTime + windowDuration * 3,
      ),
      icon: "🌤️",
      startMinutes: startTime + windowDuration * 2,
      endMinutes: startTime + windowDuration * 3,
    },
    {
      value: "EVENING",
      label: "Evening",
      description: "Latest times",
      timeRange: formatTimeRange(startTime + windowDuration * 3, endTime),
      icon: "🌅",
      startMinutes: startTime + windowDuration * 3,
      endMinutes: endTime,
    },
  ];

  return windows;
}

/**
 * Parse time string like "09:30" to minutes since midnight
 */
function parseTimeToMinutes(timeStr: string): number | null {
  if (!timeStr) return null;

  const parts = timeStr.split(":");
  if (parts.length !== 2) return null;

  const hours = parseInt(parts[0] || "0", 10);
  const minutes = parseInt(parts[1] || "0", 10);

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
function formatMinutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const period = hours < 12 ? "AM" : "PM";

  return `${hour12}:${mins.toString().padStart(2, "0")} ${period}`;
}
