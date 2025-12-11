"use client";

import { cn } from "~/lib/utils";
import { getMemberClassStyling } from "~/lib/utils";
import { getFillLabel } from "~/lib/fills";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import type {
  Member,
  Guest,
  Fill,
  TimeBlockMember,
} from "~/server/db/schema";

export type PlayerType = "member" | "guest" | "fill";

// Discriminated union for different player types
// Using flexible memberClass type to match TimeBlockWithRelations
export type ArrangePlayer =
  | {
      type: "member";
      data: Member &
        Pick<TimeBlockMember, "checkedIn" | "checkedInAt"> & {
          memberClass?: { label: string } | null;
        };
    }
  | {
      type: "guest";
      data: Guest & {
        invitedByMemberId: number;
        invitedByMember?: Pick<
          Member,
          "id" | "firstName" | "lastName" | "memberNumber"
        >;
      };
    }
  | {
      type: "fill";
      data: Fill;
    };

interface ArrangePlayerBadgeProps {
  player: ArrangePlayer;
  isSelected?: boolean;
  onClick?: (player: ArrangePlayer) => void;
}

export function ArrangePlayerBadge({
  player,
  isSelected = false,
  onClick,
}: ArrangePlayerBadgeProps) {
  const id = player.data.id;

  const name =
    player.type === "member"
      ? `${player.data.firstName} ${player.data.lastName}`
      : player.type === "guest"
        ? `${player.data.firstName} ${player.data.lastName}`
        : getFillLabel(player.data);

  // Determine styling based on player type
  let badgeStyle = "";
  if (player.type === "member") {
    const style = getMemberClassStyling(player.data.memberClass?.label || "");
    badgeStyle = `${style.bg} ${style.text} ${style.border}`;
  } else if (player.type === "guest") {
    badgeStyle = "border-purple-200 bg-purple-50 text-purple-700";
  } else if (player.type === "fill") {
    badgeStyle = "border-gray-200 bg-gray-100 text-gray-700";
  } else {
    badgeStyle = "border-gray-200 bg-gray-50 text-gray-700";
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClick?.(player);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          onClick={handleClick}
          className={cn(
            "flex cursor-pointer items-center gap-1 rounded-md border px-3 py-1.5 transition-all",
            badgeStyle,
            isSelected && "ring-2 ring-blue-500 ring-offset-1",
            "hover:shadow-md",
          )}
        >
          <span
            className={cn(
              "truncate text-sm font-medium",
              player.type === "fill" ? "min-w-[60px]" : "min-w-[80px]",
              "max-w-[120px]",
            )}
          >
            {name}
            {player.type === "guest" && (
              <span className="ml-1 text-xs opacity-70">G</span>
            )}
            {player.type === "fill" && (
              <span className="ml-1 text-xs opacity-70">F</span>
            )}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[250px]">
        <div className="space-y-1">
          <p className="font-medium">
            {name}
            {player.type === "member" && (
              <span className="text-xs font-normal">
                {" "}
                #{player.data.memberNumber}
              </span>
            )}
            {player.type === "guest" && (
              <span className="text-xs font-normal"> (Guest)</span>
            )}
          </p>
          {player.type === "guest" && player.data.invitedByMember && (
            <p className="text-xs text-muted-foreground">
              Invited by: {player.data.invitedByMember.firstName}{" "}
              {player.data.invitedByMember.lastName}
            </p>
          )}
          {player.type === "member" && (
            <p className="text-xs text-muted-foreground">
              Class: {player.data.memberClass?.label || "N/A"}
            </p>
          )}
          {player.type === "fill" && (
            <p className="text-xs text-muted-foreground">
              Type: {getFillLabel(player.data)}
            </p>
          )}
          <p className="mt-1 text-xs italic text-muted-foreground">
            Click to select
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
