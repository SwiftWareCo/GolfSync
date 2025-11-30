"use client";

import { formatTime12Hour } from "~/lib/dates";
import {
  PlayerBadge,
  type TimeBlockPlayer,
  type PlayerType,
} from "./PlayerBadge";
import { AddPlayerPlaceholder } from "./AddPlayerPlaceholder";
import type { Member, Guest, Fill } from "~/server/db/schema";

// Separate typed interfaces for each entity
export type TimeBlockMemberFull = {
  id: number;
  timeBlockId: number;
  memberId: number;
  checkedIn: boolean;
  checkedInAt: Date | null;
  bookingDate: string;
  bookingTime: string;
  bagNumber: string | null;
  createdAt: Date;
  member: Member;
};

export type TimeBlockGuestFull = {
  id: number;
  timeBlockId: number;
  guestId: number;
  invitedByMemberId: number;
  checkedIn: boolean;
  checkedInAt: Date | null;
  bookingDate: string;
  bookingTime: string;
  createdAt: Date;
  guest: Guest;
  invitedByMember: Member;
};

interface TimeBlockRowProps {
  timeBlockId: number;
  startTime: string;
  members: TimeBlockMemberFull[];
  guests: TimeBlockGuestFull[];
  fills: Fill[];
  maxPlayers?: number;
  onAddPlayer: () => void;
  onRemovePlayer: (id: number, type: PlayerType) => void;
  onCheckInPlayer: (id: number, type: PlayerType, isCheckedIn: boolean) => void;
  onPlayerClick: (player: TimeBlockPlayer) => void;
  onAssignPowerCart?: (memberId: number) => void;
  otherMembers?: Array<{ id: number; firstName: string; lastName: string }>;
  onTimeClick?: () => void;
}

export function TimeBlockRow({
  startTime,
  members,
  guests,
  fills,
  maxPlayers = 4,
  onAddPlayer,
  onRemovePlayer,
  onCheckInPlayer,
  onPlayerClick,
  onAssignPowerCart,
  otherMembers = [],
  onTimeClick,
}: TimeBlockRowProps) {
  const totalPlayers = members.length + guests.length + fills.length;
  const slotsAvailable = maxPlayers - totalPlayers;

  return (
    <tr className="transition-colors hover:bg-gray-50">
      {/* Time Column */}
      <td
        className="cursor-pointer px-3 py-3 align-top text-sm font-medium whitespace-nowrap text-gray-900 hover:text-blue-600 hover:underline"
        onClick={onTimeClick}
      >
        {formatTime12Hour(startTime)}
      </td>

      {/* Players Column */}
      <td className="px-3 py-2 align-middle">
        <div className="flex flex-wrap items-center gap-2">
          {/* Render members */}
          {members.map((tbm) => (
            <PlayerBadge
              key={`member-${tbm.member.id}`}
              player={{
                type: "member",
                data: {
                  ...tbm.member,
                  bagNumber: tbm.bagNumber,
                  checkedIn: tbm.checkedIn,
                  checkedInAt: tbm.checkedInAt,
                },
              }}
              onRemove={onRemovePlayer}
              onCheckIn={onCheckInPlayer}
              onClick={onPlayerClick}
              onAssignPowerCart={onAssignPowerCart}
              otherMembers={otherMembers}
            />
          ))}

          {/* Render guests */}
          {guests.map((tbg) => (
            <PlayerBadge
              key={`guest-${tbg.guest.id}`}
              player={{
                type: "guest",
                data: {
                  ...tbg.guest,
                  invitedByMemberId: tbg.invitedByMemberId,
                  invitedByMember: tbg.invitedByMember,
                  checkedIn: tbg.checkedIn,
                  checkedInAt: tbg.checkedInAt,
                },
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

      {/* Actions Column (Placeholder for now, can be expanded) */}
      <td className="px-2 py-3 text-center align-middle">
        {/* Additional row actions can go here */}
      </td>
    </tr>
  );
}
