"use client";

import { Calendar } from "~/components/ui/calendar";
import { Card, CardContent } from "~/components/ui/card";
import { parseDate } from "~/lib/dates";
import { useRouter } from "next/navigation";

interface CalendarPickerProps {
  dateString: string;
}

export function CalendarPicker({ dateString }: CalendarPickerProps) {
  const router = useRouter();
  const selectedDate = parseDate(dateString);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const newDateString = `${year}-${month}-${day}`;

    router.push(`/admin/${newDateString}`);
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex justify-center">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            disabled={(date) => {
              // Optionally disable certain dates
              return false;
            }}
            className="rounded-md border"
          />
        </div>
      </CardContent>
    </Card>
  );
}
