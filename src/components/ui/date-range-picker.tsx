"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";
import { type DateRange } from "~/app/types/UITypes";
import { DatePickerCalendarRange } from "./date-picker-calendar-range";

export interface DateRangePickerProps {
  dateRange: DateRange;
  setDateRange: (dateRange: DateRange) => void;
  placeholder?: string;
  className?: string;
}

export function DateRangePicker({
  dateRange,
  setDateRange,
  placeholder = "Select date range",
  className,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  // Helper to format the date range display
  const formatDateRange = () => {
    const fromDate = dateRange.from
      ? format(dateRange.from, "MMM d, yyyy")
      : "";
    const toDate = dateRange.to ? format(dateRange.to, "MMM d, yyyy") : "";

    if (fromDate && toDate) {
      return `${fromDate} - ${toDate}`;
    } else if (fromDate) {
      return `${fromDate} - Select end date`;
    }

    return placeholder;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal",
            !dateRange.from && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">{formatDateRange()}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <DatePickerCalendarRange
          selected={dateRange}
          onSelect={(range) => {
            if (range) {
              setDateRange(range);
              // Automatically close the popover once a complete range is selected
              if (range.to) {
                setIsOpen(false);
              }
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
