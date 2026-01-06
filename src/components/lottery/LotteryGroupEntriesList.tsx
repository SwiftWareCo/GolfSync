"use client";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Users, Edit, Trash2 } from "lucide-react";

interface GroupMember {
  firstName: string;
  lastName: string;
  memberClass?: {
    label: string;
  } | null;
}

interface GroupEntry {
  id: number;
  status: string;
  organizer: {
    firstName: string;
    lastName: string;
    memberClass?: {
      label: string;
    } | null;
  };
  memberIds: number[];
  preferredWindow: string;
  members?: GroupMember[];
  guestFillCount?: number;
  guests?: Array<{
    id: number;
    firstName: string;
    lastName: string;
  }>;
}

interface LotteryGroupEntriesListProps {
  entries: GroupEntry[];
  onCancelEntry: (entryId: number, isGroup: boolean) => void;
  onEditEntry: (entry: GroupEntry) => void;
  getTimeWindowLabel: (window: string) => string;
}

export function LotteryGroupEntriesList({
  entries,
  onCancelEntry,
  onEditEntry,
  getTimeWindowLabel,
}: LotteryGroupEntriesListProps) {
  if (entries.length === 0) {
    return (
      <div>
        <h4 className="mb-2 font-medium">Group Entries (0)</h4>
        <div className="py-8 text-center text-sm text-gray-500">
          No group entries found
        </div>
      </div>
    );
  }

  return (
    <div>
      <h4 className="mb-2 font-medium">Group Entries ({entries.length})</h4>
      <div className="space-y-2">
        {entries.map((group) => (
          <div
            key={group.id}
            className="flex items-center justify-between rounded border p-3"
          >
            <div className="flex items-center gap-3">
              <Users className="h-4 w-4 text-blue-500" />
              <div>
                <span className="font-medium">
                  {group.organizer.firstName} {group.organizer.lastName} (Group)
                </span>
                <div className="text-sm text-gray-500">
                  {group.organizer.memberClass?.label || "No Class"} • {group.memberIds.length} members •{" "}
                  {getTimeWindowLabel(group.preferredWindow)}
                </div>
                {group.members && (
                  <div className="text-xs text-gray-400">
                    Members:{" "}
                    {group.members
                      .map((m) => `${m.firstName} ${m.lastName}`)
                      .join(", ")}
                  </div>
                )}
                {((group.guests && group.guests.length > 0) ||
                  (group.guestFillCount && group.guestFillCount > 0)) && (
                  <div className="text-xs text-blue-600">
                    {group.guests && group.guests.length > 0 && (
                      <span>
                        +{group.guests.length} guest
                        {group.guests.length > 1 ? "s" : ""} (
                        {group.guests
                          .map((g) => `${g.firstName} ${g.lastName}`)
                          .join(", ")}
                        )
                      </span>
                    )}
                    {group.guests &&
                      group.guests.length > 0 &&
                      group.guestFillCount &&
                      group.guestFillCount > 0 &&
                      " • "}
                    {group.guestFillCount && group.guestFillCount > 0 && (
                      <span>
                        +{group.guestFillCount} fill
                        {group.guestFillCount > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <Badge
                variant={group.status === "ASSIGNED" ? "default" : "secondary"}
              >
                {group.status}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onEditEntry(group)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              {group.status === "PENDING" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onCancelEntry(group.id, true)}
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
