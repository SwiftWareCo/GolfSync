"use client";

import { Timeblocks } from "~/server/db/schema";
import { formatTime12Hour } from "~/lib/dates";
import { useTeesheet } from "~/services/teesheet/hooks";

interface TeesheetTableProps {
  teesheetId: number;
  dateString: string;
  TimeBlocks: Timeblocks[];
}

export function TeesheetTable({
  teesheetId,
  dateString,
  TimeBlocks: initialTimeBlocks,
}: TeesheetTableProps) {
  const { data: queryResult } = useTeesheet(dateString);

  // Use the fresh data from the query if available, otherwise fall back to initial server props
  const timeBlocks =
    queryResult?.success && queryResult.data?.timeBlocks
      ? queryResult.data.timeBlocks
      : initialTimeBlocks;

  console.log(timeBlocks);
  return (
    <div className="rounded-lg bg-white shadow">
      <div className="rounded-lg border shadow">
        <table className="w-full table-auto">
          <thead className="bg-gray-100 text-xs font-semibold text-gray-600 uppercase">
            <tr>
              <th className="w-[8%] px-3 py-2 text-left whitespace-nowrap">
                Time
              </th>
              <th className="w-[85%] px-3 py-2 text-left">Players</th>
              <th className="w-[7%] px-2 py-2 text-center whitespace-nowrap">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {timeBlocks.map((block: any) => (
              <tr key={block.id} className="transition-colors hover:bg-gray-50">
                <td className="px-3 py-3 text-sm font-medium whitespace-nowrap text-gray-900">
                  {formatTime12Hour(block.startTime)}
                </td>
                <td className="px-3 py-3 text-sm text-gray-600">
                  <div className="text-gray-400 italic">
                    {block.members && block.members.length > 0
                      ? `${block.members.length} players assigned`
                      : "No players assigned yet"}
                  </div>
                </td>
                <td className="px-2 py-3 text-center">
                  <button className="text-sm font-medium text-blue-600 hover:text-blue-800">
                    Add
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
