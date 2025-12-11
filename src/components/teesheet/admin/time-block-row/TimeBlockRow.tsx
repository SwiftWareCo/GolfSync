"use client";

import type { PowerCartAssignmentData } from "~/app/types/ChargeTypes";

import { useRef } from "react";
import { formatTime12Hour } from "~/lib/dates";
import {
  PlayerBadge,
  type TimeBlockPlayer,
  type PlayerType,
} from "./PlayerBadge";
import { AddPlayerPlaceholder } from "./AddPlayerPlaceholder";
import type { Member, Guest, Fill, PaceOfPlay } from "~/server/db/schema";
import { MoreVertical } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "~/components/ui/dropdown-menu";
import {
  calculatePaceStatus,
  getPaceBadgeClasses,
  getPaceLabel,
} from "~/lib/pace-helpers";
import { HoleProgressModal } from "~/components/pace-of-play/HoleProgressModal";

// Flattened member type (from TimeBlockWithRelations)
export type TimeBlockMemberFull = Member & {
  bagNumber: string | null;
  checkedIn: boolean;
  checkedInAt: Date | null;
};

// Flattened guest type (from TimeBlockWithRelations)
export type TimeBlockGuestFull = Guest & {
  invitedByMemberId: number;
  invitedByMember?: Member;
  checkedIn?: boolean;
  checkedInAt?: Date | null;
};

interface TimeBlockRowProps {
  timeBlockId: number;
  startTime: string;
  displayName?: string | null;
  members: TimeBlockMemberFull[];
  guests: TimeBlockGuestFull[];
  fills: Fill[];
  paceOfPlay?: PaceOfPlay | null;
  maxPlayers?: number;
  onAddPlayer: () => void;
  onRemovePlayer: (id: number, type: PlayerType) => void;
  onCheckInPlayer: (id: number, type: PlayerType, isCheckedIn: boolean) => void;
  onPlayerClick: (player: TimeBlockPlayer) => void;
  onAssignPowerCart?: (data: PowerCartAssignmentData) => void;
  otherMembers?: Array<{ id: number; firstName: string; lastName: string }>;
  onTimeClick?: () => void;
  onCheckInAll?: (timeBlockId: number, isCheckedIn: boolean) => void;
  onToggleNoteEdit?: (timeBlockId: number) => void;
}

export function TimeBlockRow({
  timeBlockId,
  startTime,
  displayName,
  members,
  guests,
  fills,
  paceOfPlay,
  maxPlayers = 4,
  onAddPlayer,
  onRemovePlayer,
  onCheckInPlayer,
  onPlayerClick,
  onAssignPowerCart,
  otherMembers = [],
  onTimeClick,
  onCheckInAll,
  onToggleNoteEdit,
}: TimeBlockRowProps) {
  const totalPlayers = members.length + guests.length + fills.length;
  const slotsAvailable = maxPlayers - totalPlayers;
  const modalRef = useRef<{ open: () => void }>(null);

  // Calculate pace status
  const paceStatus = calculatePaceStatus(paceOfPlay);
  const badgeClasses = getPaceBadgeClasses(paceStatus);
  const paceLabel = getPaceLabel(paceStatus);

  return (
    <>
      <tr className="transition-colors hover:bg-gray-50">
        {/* Time Column with Pace Badge */}
        <td className="px-3 py-3 align-top whitespace-nowrap">
          <div className="flex flex-col gap-1">
            <span
              className="cursor-pointer text-center text-sm font-medium text-gray-900 hover:text-blue-600 hover:underline"
              onClick={onTimeClick}
            >
              {formatTime12Hour(startTime)}
            </span>
            {displayName && (
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-700">
                {displayName}
              </span>
            )}
            <span
              className={`inline-flex cursor-pointer items-center justify-center rounded border px-2 py-0.5 text-xs font-medium transition-all hover:scale-105 ${badgeClasses}`}
              onClick={(e) => {
                e.stopPropagation();
                modalRef.current?.open();
              }}
            >
              {paceLabel}
            </span>
          </div>
        </td>

        {/* Players Column */}
        <td className="px-3 py-2 align-middle">
          <div className="flex flex-wrap items-center gap-2">
            {/* Render members */}
            {members.map((member) => (
              <PlayerBadge
                key={`member-${member.id}`}
                player={{
                  type: "member",
                  data: member,
                }}
                onRemove={onRemovePlayer}
                onCheckIn={onCheckInPlayer}
                onClick={onPlayerClick}
                onAssignPowerCart={onAssignPowerCart}
                otherMembers={otherMembers}
              />
            ))}

            {/* Render guests */}
            {guests.map((guest) => (
              <PlayerBadge
                key={`guest-${guest.id}`}
                player={{
                  type: "guest",
                  data: guest,
                }}
                onRemove={onRemovePlayer}
                onCheckIn={onCheckInPlayer}
                onClick={onPlayerClick}
              />
            ))}

            {/* Render fills */}
            {fills.map((fill) => (
              <PlayerBadge
                key={`fill-${fill.id}`}
                player={{
                  type: "fill",
                  data: fill,
                }}
                onRemove={onRemovePlayer}
              />
            ))}

            {/* Add Player Placeholder if slots available */}
            {slotsAvailable > 0 && (
              <AddPlayerPlaceholder
                onClick={onAddPlayer}
                compact={totalPlayers > 0}
              />
            )}
          </div>
        </td>

        {/* Actions Column */}
        <td className="px-2 py-3 text-center align-middle">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                title="Time block actions"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => onCheckInAll?.(timeBlockId, false)}
              >
                Check In All
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onToggleNoteEdit?.(timeBlockId)}>
                Add Note
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </td>
      </tr>

      {/* Hole Progress Modal */}
      <HoleProgressModal
        ref={modalRef}
        paceOfPlay={paceOfPlay ?? null}
        startTime={startTime}
      />
    </>
  );
}
