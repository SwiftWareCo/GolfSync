import Link from "next/link";
import {
  formatDate,
  formatTime12Hour,
  getBCToday,
  getDateForDB,
} from "~/lib/dates";

type UpcomingTeeTime = {
  id: number;
  timeBlockId: number;
  memberId: number;
  checkedIn: boolean | null;
  checkedInAt: Date | null;
  startTime: string;
  endTime: string;
  date: string;
  teesheetId: number;
};

interface UpcomingTeeTimesProps {
  teeTimes: UpcomingTeeTime[];
}

export function UpcomingTeeTimes({ teeTimes }: UpcomingTeeTimesProps) {
  if (!teeTimes || teeTimes.length === 0) {
    return (
      <div>
        <p className="text-gray-500">No upcoming tee times found.</p>
        <Link
          href="/members/teesheet"
          className="mt-4 inline-block text-sm text-green-700 hover:underline"
        >
          View Tee Sheet →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {teeTimes.map((teeTime) => {
        // Use the date string directly from the database - avoid creating Date objects
        const bookingDateStr = teeTime.date;

        // Get today and tomorrow's date strings in BC timezone
        const today = getBCToday();

        // Calculate tomorrow in BC timezone
        const todayDate = new Date();
        const tomorrow = new Date(todayDate);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = getDateForDB(tomorrow);

        // Compare date strings directly to avoid timezone issues
        let dateDisplay;
        if (bookingDateStr === today) {
          dateDisplay = "Today";
        } else if (bookingDateStr === tomorrowStr) {
          dateDisplay = "Tomorrow";
        } else {
          // Use BC timezone-aware date formatting
          dateDisplay = formatDate(bookingDateStr, "EEEE, MMMM do");
        }

        // Format the time using BC timezone-aware 12-hour format
        const displayTime = formatTime12Hour(teeTime.startTime);

        return (
          <div
            key={teeTime.id}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div>
              <p className="font-medium text-gray-900">
                {dateDisplay}, {displayTime}
              </p>
              <p className="text-sm text-gray-500">Tee time confirmed</p>
            </div>
          </div>
        );
      })}

      <Link
        href="/members/teesheet"
        className="mt-2 inline-block text-sm text-green-700 hover:underline"
      >
        View Tee Sheet →
      </Link>
    </div>
  );
}
