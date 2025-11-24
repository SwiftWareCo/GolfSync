"use client";

import { useState, useRef } from "react";
import { useTeesheet } from "~/services/teesheet/hooks";
import { TimeBlockRow } from "./time-block-row/TimeBlockRow";
import { type PlayerData, type PlayerType } from "./time-block-row/PlayerBadge";
import { AddPlayerModal } from "~/components/timeblock/AddPlayerModal";
import { AccountDialog } from "~/components/member-teesheet-client/AccountDialog";
import {
  removeTimeBlockMember,
  removeTimeBlockGuest,
  removeFillFromTimeBlock,
  checkInMember,
  checkInGuest,
} from "~/server/teesheet/actions";
import { toast } from "react-hot-toast";
import { type Member, type Guest } from "~/server/db/schema";
import { Settings } from "lucide-react";
import Link from "next/link";

interface TeesheetTableProps {
  dateString: string;
}

type TimeBlockMemberFull = {
  id: number;
  timeBlockId: number;
  memberId: number;
  checkedIn: boolean;
  bookingDate: string;
  bookingTime: string;
  bagNumber: string | null;
  createdAt: Date;
  member: Member;  
};

type TimeBlockGuestFull = {
  id: number;
  timeBlockId: number;
  guestId: number;
  invitedByMemberId: number;
  checkedIn: boolean;
  bookingDate: string;
  bookingTime: string;
  createdAt: Date;
  guest: Guest;  
  invitedByMember: Member;  
};

export function TeesheetTable({ dateString }: TeesheetTableProps) {
  const { data: queryResult } = useTeesheet(dateString);
  // State for modals
  const [selectedTimeBlockId, setSelectedTimeBlockId] = useState<number | null>(
    null,
  );
  const [isAddPlayerModalOpen, setIsAddPlayerModalOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);

  // Use the fresh data from the query if available, otherwise fall back to initial server props
  const timeBlocks = queryResult?.timeBlocks ?? [];

 // ✅ Properly typed Map with composite keys
  const playerDataRef = useRef<Map<string, TimeBlockMemberFull | TimeBlockGuestFull>>(
    new Map()
  );

  const getPlayersForBlock = (block: any): PlayerData[] => {
    const players: PlayerData[] = [];

    block.timeBlockMembers?.forEach((tbm: TimeBlockMemberFull) => {
      // Store full TimeBlockMember
      playerDataRef.current.set(`member-${tbm.member.id}`, tbm);
      
      // Return display data
      players.push({
        id: tbm.member.id,
        name: `${tbm.member.firstName} ${tbm.member.lastName}`,
        type: "member",
        memberNumber: tbm.member.memberNumber,
        class: tbm.member.class,
        checkedIn: tbm.checkedIn,
      });
    });

    block.timeBlockGuests?.forEach((tbg: TimeBlockGuestFull) => {
      // Store full TimeBlockGuest
      playerDataRef.current.set(`guest-${tbg.guest.id}`, tbg);
      
      // Return display data
      players.push({
        id: tbg.guest.id,
        name: `${tbg.guest.firstName} ${tbg.guest.lastName}`,
        type: "guest",
        checkedIn: tbg.checkedIn,
      });
    });

    block.fills?.forEach((fill: any) => {
      players.push({
        id: fill.id,
        name: fill.fillType === "custom_fill" ? fill.customName || "Custom Fill" : "Fill",
        type: "fill",
        fillType: fill.fillType,
      });
    });

    return players;
  };

  const handleAddPlayer = (timeBlockId: number) => {
    setSelectedTimeBlockId(timeBlockId);
    setIsAddPlayerModalOpen(true);
  };

  const handleRemovePlayer = async (
    timeBlockId: number,
    playerId: number,
    type: PlayerType,
  ) => {
    let result;
    try {
      if (type === "member") {
        result = await removeTimeBlockMember(timeBlockId, playerId);
      } else if (type === "guest") {
        result = await removeTimeBlockGuest(timeBlockId, playerId);
      } else if (type === "fill") {
        result = await removeFillFromTimeBlock(timeBlockId, playerId);
      }

      if (result && !result.success) {
        toast.error(result.error || "Failed to remove player");
      } else if (result && result.success) {
        toast.success("Player removed");
        // Query invalidation is handled by the hook/polling or we could manually invalidate here
      }
    } catch (error) {
      console.error("Error removing player:", error);
      toast.error("An error occurred");
    }
  };

  const handleCheckInPlayer = async (
    timeBlockId: number,
    playerId: number,
    type: PlayerType,
    isCheckedIn: boolean,
  ) => {
    let result;
    try {
      if (type === "member") {
        result = await checkInMember(timeBlockId, playerId, !isCheckedIn);
      } else if (type === "guest") {
        result = await checkInGuest(timeBlockId, playerId, !isCheckedIn);
      }

      if (result && !result.success) {
        toast.error(result.error || "Failed to update check-in status");
      }
    } catch (error) {
      console.error("Error checking in player:", error);
      toast.error("An error occurred");
    }
  };

  const handlePlayerClick = (player: PlayerData) => {
    console.log(player);
const fullData = playerDataRef.current.get(`${player.type}-${player.id}`);
    console.log("fullData", fullData);
    if (player.type === "member" || player.type === "guest") {
      setIsAccountDialogOpen(true);
      setSelectedPlayer(fullData);
    }
  };

  const selectedTimeBlock = timeBlocks.find(
    (b: any) => b.id === selectedTimeBlockId,
  );

  if (timeBlocks.length === 0) {
    return (
      <div className="rounded-lg bg-white shadow">
        <div className="flex flex-col items-center justify-center py-12">
          <Settings className="mb-4 h-12 w-12 text-gray-400" />
          <h3 className="mb-2 text-lg font-medium text-gray-900">
            No teesheet configuration
          </h3>
          <p className="mb-4 text-sm text-gray-600">
            Create a configuration to start managing this teesheet.
          </p>
          <Link
            href="/admin/settings"
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <Settings className="mr-2 h-4 w-4" />
            Go to Settings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white shadow">
      <div className="rounded-lg border shadow">
        <table className="w-full table-auto">
          <thead className="bg-gray-100 text-xs font-semibold text-gray-600 uppercase">
            <tr>
              <th className="w-[8%] px-3 py-2 text-left whitespace-nowrap">
                Time
              </th>
              <th className="w-[85%] px-3 py-2 text-left">Players</th>
              <th className="w-[7%] px-2 py-2 text-center whitespace-nowrap">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {timeBlocks.map((block: any) => (
              <TimeBlockRow
                key={block.id}
                timeBlockId={block.id}
                startTime={block.startTime}
                players={getPlayersForBlock(block)}
                onAddPlayer={() => handleAddPlayer(block.id)}
                onRemovePlayer={(id, type) =>
                  handleRemovePlayer(block.id, id, type)
                }
                onCheckInPlayer={(id, type, isCheckedIn) =>
                  handleCheckInPlayer(block.id, id, type, isCheckedIn)
                }
                onPlayerClick={handlePlayerClick}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Player Modal */}
      {selectedTimeBlock && (
        <AddPlayerModal
          open={isAddPlayerModalOpen}
          onOpenChange={setIsAddPlayerModalOpen}
          timeBlock={selectedTimeBlock}
          timeBlockGuests={
            selectedTimeBlock.guests ||
            selectedTimeBlock.timeBlockGuests?.map((g: any) => g.guest) ||
            []
          }
        />
      )}

      {/* Account Dialog */}
      {selectedPlayer && (
        <AccountDialog
          isOpen={isAccountDialogOpen}
          onClose={() => setIsAccountDialogOpen(false)}
          player={selectedPlayer}
        />
      )}
    </div>
  );
}
