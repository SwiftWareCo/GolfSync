"use client";

import { useMemo } from "react";
import { Button } from "~/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarIcon, Loader2 } from "lucide-react";
import { formatDate } from "~/lib/dates";

interface DateNavigationHeaderProps {
  date: Date;
  onPreviousDay: () => void;
  onNextDay: () => void;
  onDatePickerToggle: () => void;
  loading?: boolean;
  swipeLoading?: boolean;
}

export function DateNavigationHeader({
  date,
  onPreviousDay,
  onNextDay,
  onDatePickerToggle,
  loading = false,
  swipeLoading = false,
}: DateNavigationHeaderProps) {
  // Format dates for different screen sizes
  const shortDate = useMemo(() => formatDate(date, "MMMM do, yyyy"), [date]);
  const fullDate = useMemo(() => formatDate(date, "EEEE, MMMM do, yyyy"), [date]);

  return (
    <div className="sticky top-2 z-30 mb-4 rounded-xl border border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onPreviousDay}
          disabled={loading || swipeLoading}
          className="hover:bg-org-primary/10 hover:text-org-primary h-9 w-9 flex-shrink-0 rounded-full sm:h-10 sm:w-10"
          aria-label="Previous day"
        >
          {swipeLoading ? (
            <Loader2 className="h-4 w-4 animate-spin sm:h-5 sm:w-5" />
          ) : (
            <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          )}
        </Button>

        <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5">
          {/* Mobile/Tablet: Short date without day */}
          <h2 className="truncate text-sm font-bold text-gray-900 sm:text-base md:hidden">
            {shortDate}
          </h2>
          {/* Desktop: Full date with day */}
          <h2 className="hidden truncate text-lg font-bold text-gray-900 md:block">
            {fullDate}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDatePickerToggle}
            disabled={loading || swipeLoading}
            className="hover:bg-org-primary/10 hover:text-org-primary h-8 w-8 flex-shrink-0 rounded-full"
            aria-label="Open date picker"
          >
            <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onNextDay}
          disabled={loading || swipeLoading}
          className="hover:bg-org-primary/10 hover:text-org-primary h-9 w-9 flex-shrink-0 rounded-full sm:h-10 sm:w-10"
          aria-label="Next day"
        >
          {swipeLoading ? (
            <Loader2 className="h-4 w-4 animate-spin sm:h-5 sm:w-5" />
          ) : (
            <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
          )}
        </Button>
      </div>

      {/* Swipe Loading Indicator */}
      {swipeLoading && (
        <div className="mt-2 flex items-center justify-center">
          <div className="text-org-primary flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading new date...</span>
          </div>
        </div>
      )}
    </div>
  );
}
