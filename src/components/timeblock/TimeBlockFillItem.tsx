"use client";

import { UserMinus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { getFillLabel } from "~/lib/fills";
import type { Fill, Member } from "~/server/db/schema";

interface TimeBlockFillItemProps {
  fill: Fill;
  onRemove: (fillId: number) => Promise<void>;
  allMembers?: Member[];
}

export const TimeBlockFillItem = ({
  fill,
  onRemove,
  allMembers = [],
}: TimeBlockFillItemProps) => {
  const handleRemove = () => {
    onRemove(fill.id);
  };

  const fillLabel = getFillLabel(fill);

  // Find who added this fill
  const addedByMember = fill.addedByMemberId
    ? allMembers.find((m) => m.id === fill.addedByMemberId)
    : null;

  // Use a neutral style for fills
  const fillStyle = {
    border: "border-gray-200",
    bg: "bg-gray-50",
    text: "text-gray-700",
    badgeVariant: "secondary",
  };

  return (
    <div
      className={`flex items-center justify-between rounded-lg border ${fillStyle.border} p-3 transition-colors hover:${fillStyle.bg}`}
    >
      <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-1">
        <div>
          <div className="flex items-center space-x-2">
            <p className={`font-medium ${fillStyle.text}`}>{fillLabel}</p>
            <Badge variant={fillStyle.badgeVariant as any} className="text-xs">
              Fill
            </Badge>
          </div>
          {addedByMember && (
            <p className="text-xs text-gray-500">
              Booked by: {addedByMember.firstName} {addedByMember.lastName}
            </p>
          )}
        </div>
      </div>
      <Button variant="destructive" size="sm" onClick={handleRemove}>
        <UserMinus className="mr-2 h-4 w-4" />
        Remove
      </Button>
    </div>
  );
};
