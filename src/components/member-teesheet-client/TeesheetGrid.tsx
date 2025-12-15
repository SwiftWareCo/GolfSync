"use client";

import { useRef, useEffect, useMemo, useCallback } from "react";
import { AlertCircle, CalendarIcon, ClockIcon } from "lucide-react";
import { formatDateWithDay } from "~/lib/dates";
import { TimeBlockItem, type TimeBlockItemProps } from "./TimeBlockItem";
import type { Fill } from "~/server/db/schema";

// Member type for client-side usage
type ClientMember = {
  id: number;
  classId: number;
  firstName: string;
  lastName: string;
  memberClass?: { id: number; label: string } | null;
  [key: string]: any;
};

// View types matching TimeBlockItem expectations
type TimeBlockMemberView = {
  id: number;
  firstName: string;
  lastName: string;
  checkedIn: boolean | null;
  checkedInAt?: Date | null;
  memberClass?: { label: string } | null;
  [key: string]: any;
};

// Define proper types that match TimeBlockItem requirements
type ClientTimeBlock = {
  id: number;
  startTime: string;
  endTime: string;
  members: TimeBlockMemberView[];
  fills: Fill[];
  maxMembers: number;
  restriction?: {
    isRestricted: boolean;
    reason: string;
    violations: any[];
  };
  [key: string]: any;
};

interface TeesheetGridProps {
  date: Date;
  timeBlocks: ClientTimeBlock[];
  config: any;
  member: ClientMember;
  loading: boolean;
  selectedDate: string | Date;
  onBook: (timeBlockId: number) => void;
  onCancel: (timeBlockId: number) => void;
  onEdit: (timeBlockId: number) => void;
  onShowDetails: (timeBlock: ClientTimeBlock) => void;
  isTimeBlockBooked: (timeBlock: ClientTimeBlock) => boolean;
  isTimeBlockAvailable: (timeBlock: ClientTimeBlock) => boolean;
  isTimeBlockInPast: (timeBlock: ClientTimeBlock) => boolean;
  hasExistingBookingOnDay?: boolean;
}

export function TeesheetGrid({
  date,
  timeBlocks,
  config,
  member,
  loading,
  selectedDate,
  onBook,
  onCancel,
  onEdit,
  onShowDetails,
  isTimeBlockBooked,
  isTimeBlockAvailable,
  isTimeBlockInPast,
  hasExistingBookingOnDay = false,
}: TeesheetGridProps) {
  const timeBlocksContainerRef = useRef<HTMLDivElement>(null);

  // Deduplicate time blocks by ID to prevent duplicate rendering
  const uniqueTimeBlocks = useMemo(() => {
    const uniqueBlocks = new Map<number, ClientTimeBlock>();
    timeBlocks.forEach((block) => {
      if (!uniqueBlocks.has(block.id)) {
        uniqueBlocks.set(block.id, block);
      }
    });
    return Array.from(uniqueBlocks.values());
  }, [timeBlocks]);

  const hasTimeBlocks = uniqueTimeBlocks.length > 0;

  // Simple utility to scroll to a time block on today's date
  const scrollToClosestTime = useCallback(
    (now: Date, selectedDate: Date | string, timeBlocks: ClientTimeBlock[]) => {
      // Parse the date properly
      let parsedSelectedDate: Date;
      if (typeof selectedDate === "string") {
        const parts = selectedDate.split("-");
        if (parts.length === 3) {
          const year = parseInt(parts[0] || "0");
          const month = parseInt(parts[1] || "0") - 1;
          const day = parseInt(parts[2] || "0");
          parsedSelectedDate = new Date(year, month, day);
        } else {
          parsedSelectedDate = new Date(selectedDate);
        }
      } else {
        parsedSelectedDate = selectedDate;
      }

      // Only proceed if we're on today's date
      if (
        now.getDate() !== parsedSelectedDate.getDate() ||
        now.getMonth() !== parsedSelectedDate.getMonth() ||
        now.getFullYear() !== parsedSelectedDate.getFullYear()
      ) {
        return;
      }

      // Get current time
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      // Skip if no timeblocks
      if (!timeBlocks.length) return;

      // Find timeblock closest to current time
      const currentTimeMinutes = currentHour * 60 + currentMinute;

      let bestBlock = timeBlocks[0];
      let bestDiff = Infinity;

      for (let i = 0; i < timeBlocks.length; i++) {
        const block = timeBlocks[i];
        if (!block?.startTime) continue;

        // Parse time from HH:MM format
        const timeParts = block.startTime.split(":");
        if (timeParts.length !== 2) continue;

        const blockHour = parseInt(timeParts[0] || "0", 10);
        const blockMinute = parseInt(timeParts[1] || "0", 10);
        const blockMinutes = blockHour * 60 + blockMinute;
        const diff = Math.abs(blockMinutes - currentTimeMinutes);

        if (diff < bestDiff) {
          bestDiff = diff;
          bestBlock = block;
        }
      }

      // Scroll to element with a small delay to ensure DOM is ready
      setTimeout(() => {
        const element = document.getElementById(`time-block-${bestBlock?.id}`);
        if (element) {
          element.scrollIntoView({ behavior: "auto", block: "center" });
        }
      }, 100);
    },
    [],
  );

  // Auto-scroll to current time once when time blocks load
  useEffect(() => {
    if (uniqueTimeBlocks.length > 0) {
      scrollToClosestTime(new Date(), selectedDate, uniqueTimeBlocks);
    }
  }, [uniqueTimeBlocks, selectedDate, scrollToClosestTime]);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="bg-org-primary/5 border-b border-gray-100 p-3 sm:p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900 sm:text-base md:text-lg">
          <ClockIcon className="text-org-primary h-5 w-5 flex-shrink-0 sm:h-6 sm:w-6" />
          <span className="min-w-0 flex-1 truncate">
            Tee Sheet - {formatDateWithDay(date)}
          </span>
        </h3>
        {config?.disallowMemberBooking && (
          <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mr-2 inline-block h-4 w-4" />
            Member booking is currently disabled
          </div>
        )}
      </div>

      <div
        ref={timeBlocksContainerRef}
        className="px-4 pb-4"
        aria-live="polite"
      >
        {hasTimeBlocks ? (
          <div className="space-y-2">
            {uniqueTimeBlocks.map((timeBlock) => (
              <TimeBlockItem
                key={timeBlock.id}
                timeBlock={
                  timeBlock as unknown as TimeBlockItemProps["timeBlock"]
                }
                isBooked={isTimeBlockBooked(timeBlock)}
                isAvailable={isTimeBlockAvailable(timeBlock)}
                isPast={isTimeBlockInPast(timeBlock)}
                onBook={() => onBook(timeBlock.id)}
                onCancel={() => onCancel(timeBlock.id)}
                onEdit={() => onEdit(timeBlock.id)}
                onShowDetails={() => onShowDetails(timeBlock)}
                disabled={loading || config?.disallowMemberBooking}
                member={member}
                id={`time-block-${timeBlock.id}`}
                isRestricted={timeBlock.restriction?.isRestricted || false}
                hasExistingBookingOnDay={hasExistingBookingOnDay}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CalendarIcon className="mb-4 h-16 w-16 text-gray-300" />
            <p className="mb-2 text-lg font-medium text-gray-500">
              No tee times available
            </p>
            <p className="text-sm text-gray-400">
              Try selecting a different date to see available times.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
