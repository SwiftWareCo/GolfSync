"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "~/lib/utils";
import { buttonVariants } from "~/components/ui/button";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  isToday,
  isWithinInterval,
  parse,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { type DateRange } from "~/app/types/UITypes";

export interface DatePickerCalendarRangeProps {
  selected?: DateRange;
  onSelect: (dateRange: DateRange | undefined) => void;
  className?: string;
  showOutsideDays?: boolean;
}

export function DatePickerCalendarRange({
  selected,
  onSelect,
  className,
  showOutsideDays = true,
}: DatePickerCalendarRangeProps) {
  const [currentMonth, setCurrentMonth] = React.useState(
    format(new Date(), "MMM-yyyy"),
  );
  const firstDayCurrentMonth = parse(currentMonth, "MMM-yyyy", new Date());

  const days = React.useMemo(() => {
    return eachDayOfInterval({
      start: startOfWeek(startOfMonth(firstDayCurrentMonth)),
      end: endOfWeek(endOfMonth(firstDayCurrentMonth)),
    });
  }, [firstDayCurrentMonth]);

  // Navigation handlers
  const previousMonth = () => {
    const firstDayPreviousMonth = subMonths(firstDayCurrentMonth, 1);
    setCurrentMonth(format(firstDayPreviousMonth, "MMM-yyyy"));
  };

  const nextMonth = () => {
    const firstDayNextMonth = addMonths(firstDayCurrentMonth, 1);
    setCurrentMonth(format(firstDayNextMonth, "MMM-yyyy"));
  };

  // Handle date selection for range
  const handleSelect = (day: Date) => {
    if (!selected) {
      // No dates selected yet, set as start date
      onSelect({ from: day });
      return;
    }

    const { from, to } = selected;

    // If start date is selected but no end date
    if (from && !to) {
      // If clicking on a date before the start date, make it the new start date
      if (isBefore(day, from)) {
        onSelect({ from: day });
        return;
      }

      // Otherwise set as end date
      onSelect({ from, to: day });
      return;
    }

    // If both dates are selected, start a new range
    onSelect({ from: day });
  };

  // Check if a day is within the selected range
  const isInRange = (day: Date): boolean => {
    if (!selected?.from || !selected?.to) return false;
    return isWithinInterval(day, { start: selected.from, end: selected.to });
  };

  // Check if day is start or end of range
  const isRangeStart = (day: Date): boolean => {
    return !!selected?.from && isSameDay(day, selected.from);
  };

  const isRangeEnd = (day: Date): boolean => {
    return !!selected?.to && isSameDay(day, selected.to);
  };

  return (
    <div className={cn("p-3", className)}>
      <div className="relative flex items-center justify-center pt-1">
        <button
          onClick={previousMonth}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "hover:bg-opacity-20 absolute left-1 h-7 w-7 cursor-pointer bg-transparent p-0 !text-black opacity-50 hover:border-org-primary hover:bg-org-secondary hover:opacity-100",
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="text-sm font-medium">
          {format(firstDayCurrentMonth, "MMMM yyyy")}
        </h2>
        <button
          onClick={nextMonth}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "hover:bg-opacity-20 absolute right-1 h-7 w-7 cursor-pointer bg-transparent p-0 !text-black opacity-50 hover:border-org-primary hover:bg-org-secondary hover:opacity-100",
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 text-center">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="text-muted-foreground text-xs">
            {day}
          </div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1">
        {days.map((day, dayIdx) => {
          const isCurrentMonth = isSameMonth(day, firstDayCurrentMonth);
          const isCurrentDay = isToday(day);
          const isStart = isRangeStart(day);
          const isEnd = isRangeEnd(day);
          const isWithinSelectedRange = isInRange(day);

          // Skip rendering days from other months if showOutsideDays is false
          if (!showOutsideDays && !isCurrentMonth) {
            return <div key={dayIdx} />;
          }

          return (
            <button
              key={dayIdx}
              type="button"
              onClick={() => handleSelect(day)}
              className={cn(
                "relative h-9 w-9 cursor-pointer p-0 text-center text-sm font-normal",
                isCurrentMonth
                  ? "text-foreground"
                  : "text-muted-foreground opacity-50",
                isStart && "rounded-l-md bg-org-primary text-white",
                isEnd && "rounded-r-md bg-org-primary text-white",
                isWithinSelectedRange &&
                  !isStart &&
                  !isEnd &&
                  "text-foreground bg-opacity-30 bg-org-secondary",
                isCurrentDay &&
                  !isWithinSelectedRange &&
                  !isStart &&
                  !isEnd &&
                  "border border-org-secondary",
                !isWithinSelectedRange &&
                  !isStart &&
                  !isEnd &&
                  "hover:text-foreground hover:bg-opacity-20 hover:bg-org-secondary",
                // Add extra styling to create connected range appearance
                isWithinSelectedRange && "rounded-none",
              )}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}
