"use client";

import { DayPicker, type DayPickerProps } from "react-day-picker";
import { cn } from "~/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";

export interface CalendarProps
  extends Omit<DayPickerProps, "mode" | "selected" | "onSelect"> {
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
}

function Calendar({
  selected,
  onSelect,
  modifiers,
  modifiersClassNames,
}: CalendarProps) {
  const [month, setMonth] = useState<Date>(selected || new Date());
  const [numberOfMonths, setNumberOfMonths] = useState(2);

  useEffect(() => {
    const handleResize = () => {
      setNumberOfMonths(window.innerWidth <= 1024 ? 1 : 2);
    };

    // Set initial value
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="relative w-full max-w-full overflow-hidden">
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => {
            const newMonth = new Date(month);
            newMonth.setMonth(month.getMonth() - 1);
            setMonth(newMonth);
          }}
          className="hover:bg-org-primary inline-flex h-10 w-10 items-center justify-center rounded-md transition-colors hover:cursor-pointer hover:text-white"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <DayPicker
          selected={selected}
          mode="single"
          onSelect={onSelect}
          month={month}
          onMonthChange={setMonth}
          numberOfMonths={numberOfMonths}
          modifiers={modifiers}
          modifiersClassNames={modifiersClassNames}
          hideNavigation
          classNames={{
            months:
              "flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-2",
            month:
              "w-full max-w-[350px] place-items-center space-y-2 space-x-0 border rounded-md p-2 sm:p-3",
            caption: "flex justify-center pt-1 relative items-center",
            caption_label: "text-sm font-medium",
            day: cn(
              "h-7 w-8 sm:h-8 sm:w-10 lg:w-12 p-0 font-normal text-xs sm:text-sm rounded-md",
              "[&:not([data-outside='true'])]:hover:bg-org-primary [&:not([data-outside='true'])]:hover:cursor-pointer [&:not([data-outside='true'])]:hover:text-white",
            ),
            day_button: cn(
              "h-7 w-8 sm:h-8 sm:w-10 lg:w-12 p-0 font-normal text-xs sm:text-sm rounded-md",
              "[&:not([data-outside='true'])]:hover:bg-org-primary [&:not([data-outside='true'])]:hover:cursor-pointer [&:not([data-outside='true'])]:hover:text-white",
            ),
            today:
              "[&:not([data-outside='true'])]:bg-org-secondary [&:not([data-outside='true'])]:text-accent-foreground",
            selected:
              "[&:not([data-outside='true'])]:!bg-org-primary [&:not([data-outside='true'])]:text-white [&:not([data-outside='true'])]:text-primary-foreground",
          }}
        />
        <button
          onClick={() => {
            const newMonth = new Date(month);
            newMonth.setMonth(month.getMonth() + 1);
            setMonth(newMonth);
          }}
          className="hover:bg-org-primary inline-flex h-10 w-10 items-center justify-center rounded-md transition-colors hover:cursor-pointer hover:text-white"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
