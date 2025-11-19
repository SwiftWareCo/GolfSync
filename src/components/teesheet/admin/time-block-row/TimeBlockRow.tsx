"use client";

import { formatTime12Hour } from "~/lib/dates";
import { PlayerBadge, type PlayerData, type PlayerType } from "./PlayerBadge";
import { AddPlayerPlaceholder } from "./AddPlayerPlaceholder";

interface TimeBlockRowProps {
  timeBlockId: number;
  startTime: string;
  players: PlayerData[];
  maxPlayers?: number;
  onAddPlayer: () => void;
  onRemovePlayer: (id: number, type: PlayerType) => void;
  onCheckInPlayer: (id: number, type: PlayerType, isCheckedIn: boolean) => void;
  onPlayerClick: (player: PlayerData) => void;
}

export function TimeBlockRow({
  startTime,
  players,
  maxPlayers = 4,
  onAddPlayer,
  onRemovePlayer,
  onCheckInPlayer,
  onPlayerClick,
}: TimeBlockRowProps) {
  const slotsAvailable = maxPlayers - players.length;

  return (
    <tr className="transition-colors hover:bg-gray-50">
      {/* Time Column */}
      <td className="px-3 py-3 align-top text-sm font-medium whitespace-nowrap text-gray-900">
        {formatTime12Hour(startTime)}
      </td>

      {/* Players Column */}
      <td className="px-3 py-2 align-middle">
        <div className="flex flex-wrap items-center gap-2">
          {players.map((player) => (
            <PlayerBadge
              key={`${player.type}-${player.id}`}
              player={player}
              onRemove={onRemovePlayer}
              onCheckIn={onCheckInPlayer}
              onClick={onPlayerClick}
            />
          ))}

          {/* Add Player Placeholder if slots available */}
          {slotsAvailable > 0 && (
            <AddPlayerPlaceholder
              onClick={onAddPlayer}
              compact={players.length > 0}
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
