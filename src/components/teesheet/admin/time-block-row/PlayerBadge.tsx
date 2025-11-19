"use client";

import { cn } from "~/lib/utils";
import { getMemberClassStyling } from "~/lib/utils";
import { UserCheck, UserX, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

export type PlayerType = "member" | "guest" | "fill";

export interface PlayerData {
  id: number;
  name: string;
  type: PlayerType;
  memberNumber?: string;
  class?: string;
  checkedIn?: boolean;
  fillType?: string;
  invitedBy?: string;
}

interface PlayerBadgeProps {
  player: PlayerData;
  onRemove?: (id: number, type: PlayerType) => void;
  onCheckIn?: (id: number, type: PlayerType, isCheckedIn: boolean) => void;
  onClick?: (player: PlayerData) => void;
  onAssignPowerCart?: (player: PlayerData) => void;
}

export function PlayerBadge({
  player,
  onRemove,
  onCheckIn,
  onClick,
  onAssignPowerCart,
}: PlayerBadgeProps) {
  // Determine styling based on player type and status
  let badgeStyle = "";
  if (player.checkedIn) {
    badgeStyle = "border-green-300 bg-green-100 text-green-800";
  } else if (player.type === "member" && player.class) {
    const style = getMemberClassStyling(player.class);
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
    onCheckIn?.(player.id, player.type, !!player.checkedIn);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove?.(player.id, player.type);
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
              {player.name}
              {player.type === "guest" && (
                <span className="ml-1 text-xs opacity-70">G</span>
              )}
              {player.type === "fill" && (
                <span className="ml-1 text-xs opacity-70">F</span>
              )}
              {player.checkedIn && (
                <span className="ml-1 text-green-700">✓</span>
              )}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {player.name}
              {player.memberNumber && (
                <span className="text-xs">#{player.memberNumber}</span>
              )}
              {player.type === "guest" && (
                <span className="text-xs"> (Guest) </span>
              )}
            </p>
            {player.invitedBy && (
              <p className="text-xs">Invited By: {player.invitedBy}</p>
            )}
            {player.class && <p className="text-xs">Class: {player.class}</p>}
            {player.fillType && (
              <p className="text-xs">Type: {player.fillType}</p>
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
                player.checkedIn
                  ? "text-green-700 hover:bg-red-100 hover:text-red-600"
                  : "text-gray-500 hover:bg-green-100 hover:text-green-600",
              )}
            >
              {player.checkedIn ? (
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
