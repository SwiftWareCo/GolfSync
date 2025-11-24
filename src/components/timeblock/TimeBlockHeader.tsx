import { format } from "date-fns";
import { Clock } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Card, CardHeader, CardTitle } from "~/components/ui/card";
import type { TimeBlockWithMembers } from "~/app/types/TeeSheetTypes";
import { formatTimeString } from "~/lib/utils";

interface TimeBlockHeaderProps {
  timeBlock: TimeBlockWithMembers;
  guestsCount?: number;
  maxPeople?: number;
}

export function TimeBlockHeader({
  timeBlock,
  guestsCount = 0,
  maxPeople = 4,
}: TimeBlockHeaderProps) {
  const fillsCount = timeBlock.fills?.length || 0;
  const totalPeople = timeBlock.members.length + guestsCount + fillsCount;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="rounded-lg p-2">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="text-xl">
              {formatTimeString(timeBlock.startTime)}
            </CardTitle>
            <p className="text-sm text-gray-500">
              {totalPeople} / {maxPeople} people booked
              {totalPeople > 0 &&
                ` (${timeBlock.members.length} members, ${guestsCount} guests${fillsCount > 0 ? `, ${fillsCount} fills` : ""}`}
            </p>
          </div>
        </div>
        <Badge
          variant={totalPeople >= maxPeople ? "destructive" : "default"}
          style={
            totalPeople >= maxPeople
              ? { backgroundColor: "#FEE2E2", color: "#B91C1C" }
              : { backgroundColor: "#D1FAE5", color: "#065F46" }
          }
        >
          {totalPeople >= maxPeople ? "Full" : "Available"}
        </Badge>
      </CardHeader>
    </Card>
  );
}
