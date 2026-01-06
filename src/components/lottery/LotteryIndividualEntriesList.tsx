"use client";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Clock, Edit, Trash2 } from "lucide-react";
import { formatTime12Hour } from "~/lib/dates";

interface IndividualEntry {
  id: number;
  status: string;
  organizer: {
    firstName: string;
    lastName: string;
    memberClass?: {
      label: string;
    } | null;
  };
  preferredWindow: string;
  assignedTimeBlock?: {
    startTime: string;
  } | null;
  guestFillCount?: number;
  guests?: Array<{
    id: number;
    firstName: string;
    lastName: string;
  }>;
}

interface LotteryIndividualEntriesListProps {
  entries: IndividualEntry[];
  onCancelEntry: (entryId: number, isGroup: boolean) => void;
  onEditEntry: (entry: IndividualEntry) => void;
  getTimeWindowLabel: (window: string) => string;
}

export function LotteryIndividualEntriesList({
  entries,
  onCancelEntry,
  onEditEntry,
  getTimeWindowLabel,
}: LotteryIndividualEntriesListProps) {
  if (entries.length === 0) {
    return (
      <div>
        <h4 className="mb-2 font-medium">Individual Entries (0)</h4>
        <div className="py-8 text-center text-sm text-gray-500">
          No individual entries found
        </div>
      </div>
    );
  }

  return (
    <div>
      <h4 className="mb-2 font-medium">
        Individual Entries ({entries.length})
      </h4>
      <div className="space-y-2">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center justify-between rounded border p-3"
          >
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-green-500" />
              <div>
                <span className="font-medium">
                  {entry.organizer.firstName} {entry.organizer.lastName}
                </span>
                <div className="text-sm text-gray-500">
                  {entry.organizer.memberClass?.label || "No Class"} •{" "}
                  {getTimeWindowLabel(entry.preferredWindow)}
                </div>
                {((entry.guests && entry.guests.length > 0) ||
                  (entry.guestFillCount && entry.guestFillCount > 0)) && (
                  <div className="mt-1 text-xs text-blue-600">
                    {entry.guests && entry.guests.length > 0 && (
                      <span>
                        +{entry.guests.length} guest
                        {entry.guests.length > 1 ? "s" : ""} (
                        {entry.guests
                          .map((g) => `${g.firstName} ${g.lastName}`)
                          .join(", ")}
                        )
                      </span>
                    )}
                    {entry.guests &&
                      entry.guests.length > 0 &&
                      entry.guestFillCount &&
                      entry.guestFillCount > 0 &&
                      " • "}
                    {entry.guestFillCount && entry.guestFillCount > 0 && (
                      <span>
                        +{entry.guestFillCount} fill
                        {entry.guestFillCount > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <Badge
                variant={entry.status === "ASSIGNED" ? "default" : "secondary"}
              >
                {entry.status}
              </Badge>
              {entry.assignedTimeBlock && (
                <Badge variant="outline">
                  {formatTime12Hour(entry.assignedTimeBlock.startTime)}
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onEditEntry(entry)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              {entry.status === "PENDING" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onCancelEntry(entry.id, false)}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
