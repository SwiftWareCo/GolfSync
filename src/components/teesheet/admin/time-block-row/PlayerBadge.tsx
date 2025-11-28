"use client";

import { cn } from "~/lib/utils";
import { getMemberClassStyling } from "~/lib/utils";
import { getFillLabel } from "~/lib/fills";
import { UserCheck, UserX, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import type {
  Member,
  Guest,
  Fill,
  TimeBlockMember,
} from "~/server/db/schema";

export type PlayerType = "member" | "guest" | "fill";

// Component-specific discriminated union type using schema types
export type TimeBlockPlayer =
  | {
      type: "member";
      data: Member &
        Pick<TimeBlockMember, "bagNumber" | "checkedIn" | "checkedInAt">;
    }
  | {
      type: "guest";
      data: Guest & {
        invitedByMemberId: number;
        invitedByMember?: Pick<
          Member,
          "id" | "firstName" | "lastName" | "memberNumber"
        >;
        checkedIn?: boolean;
        checkedInAt?: Date | null;
      };
    }
  | {
      type: "fill";
      data: Fill;
    };

interface PlayerBadgeProps {
  player: TimeBlockPlayer;
  onRemove?: (id: number, type: PlayerType) => void;
  onCheckIn?: (id: number, type: PlayerType, isCheckedIn: boolean) => void;
  onClick?: (player: TimeBlockPlayer) => void;
  onAssignPowerCart?: (player: TimeBlockPlayer) => void;
}

export function PlayerBadge({
  player,
  onRemove,
  onCheckIn,
  onClick,
  onAssignPowerCart,
}: PlayerBadgeProps) {
  // Extract common data based on discriminated union type
  const id = player.data.id;
  const checkedIn =
    player.type === "member"
      ? (player.data.checkedIn ?? false)
      : player.type === "guest"
        ? (player.data.checkedIn ?? false)
        : false;

  const name =
    player.type === "member"
      ? `${player.data.firstName} ${player.data.lastName}`
      : player.type === "guest"
        ? `${player.data.firstName} ${player.data.lastName}`
        : getFillLabel(player.data);

  // Determine styling based on player type and status
  let badgeStyle = "";
  if (checkedIn) {
    badgeStyle = "border-green-300 bg-green-100 text-green-800";
  } else if (player.type === "member") {
    const style = getMemberClassStyling(player.data.class);
    badgeStyle = `${style.bg} ${style.text} ${style.border}`;
  } else if (player.type === "guest") {
    badgeStyle = "border-purple-200 bg-purple-50 text-purple-700";
  } else if (player.type === "fill") {
    badgeStyle = "border-gray-200 bg-gray-100 text-gray-700";
  } else {
    // Default fallback
    badgeStyle = "border-gray-200 bg-gray-50 text-gray-700";
  }

  const handleCheckIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCheckIn?.(id, player.type, checkedIn);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove?.(id, player.type);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClick?.(player);
  };

  const handleAssignPowerCart = () => {};

  return (
    <TooltipProvider>
      <div
        className={cn(
          "flex items-center gap-2 rounded-md border px-8 py-1.5 transition-colors",
          badgeStyle,
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                "cursor-pointer truncate text-sm font-medium hover:underline",
                player.type === "fill" ? "min-w-[80px]" : "min-w-[100px]",
              )}
              onClick={handleClick}
            >
              {name}
              {player.type === "guest" && (
                <span className="ml-1 text-xs opacity-70">G</span>
              )}
              {player.type === "fill" && (
                <span className="ml-1 text-xs opacity-70">F</span>
              )}
              {checkedIn && <span className="ml-1 text-green-700">✓</span>}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {name}
              {player.type === "member" && (
                <span className="text-xs"> #{player.data.memberNumber}</span>
              )}
              {player.type === "guest" && (
                <span className="text-xs"> (Guest)</span>
              )}
            </p>
            {player.type === "guest" && player.data.invitedByMember && (
              <p className="text-xs">
                Invited By: {player.data.invitedByMember.firstName}{" "}
                {player.data.invitedByMember.lastName}
              </p>
            )}
            {player.type === "member" && (
              <p className="text-xs">Class: {player.data.class}</p>
            )}
            {player.type === "fill" && (
              <p className="text-xs">Type: {getFillLabel(player.data)}</p>
            )}
          </TooltipContent>
        </Tooltip>

        {/* Actions */}
        <div className="ml-auto flex items-center gap-1">
          {player.type !== "fill" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCheckIn}
              className={cn(
                "h-6 w-6 p-0",
                checkedIn
                  ? "text-green-700 hover:bg-red-100 hover:text-red-600"
                  : "text-gray-500 hover:bg-green-100 hover:text-green-600",
              )}
            >
              {checkedIn ? (
                <UserX className="h-3.5 w-3.5" />
              ) : (
                <UserCheck className="h-3.5 w-3.5" />
              )}
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            className="h-6 w-6 p-0 text-gray-500 hover:bg-red-100 hover:text-red-600"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}
