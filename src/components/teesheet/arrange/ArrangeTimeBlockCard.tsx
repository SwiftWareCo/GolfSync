"use client";

import { memo } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  ChevronUp,
  ChevronDown,
  Plus,
  Trash2,
  Clock,
  Users,
} from "lucide-react";
import { formatTime12Hour } from "~/lib/dates";
import { ArrangePlayerBadge, type ArrangePlayer } from "./ArrangePlayerBadge";
import { cn } from "~/lib/utils";
import type { TimeBlockWithRelations } from "~/server/db/schema";

interface ArrangeTimeBlockCardProps {
  block: TimeBlockWithRelations;
  onSwapUp?: () => void;
  onSwapDown?: () => void;
  onInsert?: () => void;
  onDelete?: () => void;
  onTimeBlockClick?: () => void;
  onPlayerClick?: (player: ArrangePlayer) => void;
  selectedPlayerId?: number | null;
  selectedPlayerType?: "member" | "guest" | "fill" | null;
  isFirst?: boolean;
  isLast?: boolean;
  disabled?: boolean;
  hasChanges?: boolean;
  isDeleted?: boolean;
}

function ArrangeTimeBlockCardComponent({
  block,
  onSwapUp,
  onSwapDown,
  onInsert,
  onDelete,
  onTimeBlockClick,
  onPlayerClick,
  selectedPlayerId,
  selectedPlayerType,
  isFirst = false,
  isLast = false,
  disabled = false,
  hasChanges = false,
  isDeleted = false,
}: ArrangeTimeBlockCardProps) {
  // Calculate occupancy
  const memberCount = block.members?.length ?? 0;
  const guestCount = block.guests?.length ?? 0;
  const fillCount = block.fills?.length ?? 0;
  const totalOccupancy = memberCount + guestCount + fillCount;
  const maxCapacity = block.maxMembers ?? 4;
  const isFull = totalOccupancy >= maxCapacity;
  const isEmpty = totalOccupancy === 0;

  // Convert members, guests, and fills to ArrangePlayer format
  const players: ArrangePlayer[] = [
    ...(block.members?.map((member) => ({
      type: "member" as const,
      data: member,
    })) ?? []),
    ...(block.guests?.map((guest) => ({
      type: "guest" as const,
      data: guest,
    })) ?? []),
    ...(block.fills?.map((fill) => ({
      type: "fill" as const,
      data: fill,
    })) ?? []),
  ];

  const handleCardClick = (e: React.MouseEvent) => {
    // Only trigger if clicking on the card itself, not on players or buttons
    if (
      (e.target as HTMLElement).closest("[data-player]") ||
      (e.target as HTMLElement).closest("button")
    ) {
      return;
    }
    onTimeBlockClick?.();
  };

  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-lg border bg-white p-3 transition-all",
        hasChanges && "border-yellow-400 bg-yellow-50/30",
        isDeleted && "border-red-300 bg-red-50/30 opacity-60",
        selectedPlayerId &&
          !isFull &&
          !isDeleted &&
          "cursor-pointer hover:border-blue-300",
        disabled && "opacity-50",
      )}
      onClick={handleCardClick}
    >
      {/* Time & Capacity */}
      <div className="flex min-w-[100px] flex-col">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-gray-500" />
          <span className="font-semibold">
            {formatTime12Hour(block.startTime)}
          </span>
        </div>
        {block.displayName && (
          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-700">
            {block.displayName}
          </span>
        )}
        <Badge
          variant={isFull ? "destructive" : isEmpty ? "outline" : "secondary"}
          className="mt-1 w-fit text-xs"
        >
          <Users className="mr-1 h-3 w-3" />
          {totalOccupancy}/{maxCapacity}
        </Badge>
      </div>

      {/* Players Area */}
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {players.length > 0 ? (
          players.map((player) => (
            <div key={`${player.type}-${player.data.id}`} data-player>
              <ArrangePlayerBadge
                player={player}
                isSelected={
                  selectedPlayerId === player.data.id &&
                  selectedPlayerType === player.type
                }
                onClick={onPlayerClick}
              />
            </div>
          ))
        ) : (
          <div className="text-sm text-gray-400">
            {selectedPlayerId
              ? "Click to move player here"
              : "No players assigned"}
          </div>
        )}
      </div>

      {/* Action Buttons - Horizontal */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 hover:bg-blue-100"
          onClick={(e) => {
            e.stopPropagation();
            onSwapUp?.();
          }}
          disabled={disabled || isFirst}
          title="Swap players with previous time slot"
        >
          <ChevronUp className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 hover:bg-blue-100"
          onClick={(e) => {
            e.stopPropagation();
            onSwapDown?.();
          }}
          disabled={disabled || isLast}
          title="Swap players with next time slot"
        >
          <ChevronDown className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 hover:bg-green-100"
          onClick={(e) => {
            e.stopPropagation();
            onInsert?.();
          }}
          disabled={disabled}
          title="Insert new time slot"
        >
          <Plus className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 hover:bg-red-100"
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.();
          }}
          disabled={disabled}
          title="Delete this time slot"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// Helper to compare player arrays by ID
const arePlayersEqual = (
  prev: { id: number }[] | null | undefined,
  next: { id: number }[] | null | undefined,
): boolean => {
  if (!prev && !next) return true;
  if (!prev || !next) return false;
  if (prev.length !== next.length) return false;
  return prev.every((p, i) => p.id === next[i]?.id);
};

// Memoize to prevent unnecessary re-renders
export const ArrangeTimeBlockCard = memo(
  ArrangeTimeBlockCardComponent,
  (prevProps, nextProps) => {
    // Custom comparison - check actual player IDs, not just lengths
    return (
      prevProps.block.id === nextProps.block.id &&
      prevProps.block.startTime === nextProps.block.startTime &&
      arePlayersEqual(prevProps.block.members, nextProps.block.members) &&
      arePlayersEqual(prevProps.block.guests, nextProps.block.guests) &&
      arePlayersEqual(prevProps.block.fills, nextProps.block.fills) &&
      prevProps.selectedPlayerId === nextProps.selectedPlayerId &&
      prevProps.selectedPlayerType === nextProps.selectedPlayerType &&
      prevProps.isFirst === nextProps.isFirst &&
      prevProps.isLast === nextProps.isLast &&
      prevProps.disabled === nextProps.disabled &&
      prevProps.hasChanges === nextProps.hasChanges &&
      prevProps.isDeleted === nextProps.isDeleted
    );
  },
);
