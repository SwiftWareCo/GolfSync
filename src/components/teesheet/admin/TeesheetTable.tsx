"use client";

import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTeesheet } from "~/services/teesheet/hooks";
import { TimeBlockRow } from "./time-block-row/TimeBlockRow";
import {
  type PlayerType,
  type TimeBlockPlayer,
} from "./time-block-row/PlayerBadge";
import { AddPlayerModal } from "~/components/timeblock/AddPlayerModal";
import { AccountDialog } from "~/components/member-teesheet-client/AccountDialog";
import {
  removeTimeBlockMember,
  removeTimeBlockGuest,
  removeFillFromTimeBlock,
  checkInMember,
  checkInGuest,
} from "~/server/teesheet/actions";
import { quickAssignPowerCart } from "~/server/charges/actions";
import { toast } from "react-hot-toast";
import { type Member, type Guest } from "~/server/db/schema";
import { Settings } from "lucide-react";
import Link from "next/link";
import { useTeeblockOptimisticUpdate } from "~/hooks/useTeeblockOptimisticUpdate";
import { teesheetKeys } from "~/services/teesheet/keys";

interface TeesheetTableProps {
  dateString: string;
}

type TimeBlockMemberFull = {
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

type TimeBlockGuestFull = {
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

export function TeesheetTable({ dateString }: TeesheetTableProps) {
  const { data: queryResult } = useTeesheet(dateString);
  const queryClient = useQueryClient();

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
  const playerDataRef = useRef<
    Map<string, TimeBlockMemberFull | TimeBlockGuestFull>
  >(new Map());

  // Mutation for power cart assignment
  const assignPowerCartMutation = useMutation({
    mutationFn: quickAssignPowerCart,
    onMutate: () => {
      toast.success("Power cart assigned");
    },
    onError: () => {
      toast.error("Failed to assign power cart");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: teesheetKeys.list(dateString) });
    },
  });

  // Mutation for removing players
  const removePlayerMutation = useMutation({
    mutationFn: async ({
      timeBlockId,
      playerId,
      type,
    }: {
      timeBlockId: number;
      playerId: number;
      type: PlayerType;
    }) => {
      if (type === "member") {
        return removeTimeBlockMember(timeBlockId, playerId);
      } else if (type === "guest") {
        return removeTimeBlockGuest(timeBlockId, playerId);
      } else if (type === "fill") {
        return removeFillFromTimeBlock(timeBlockId, playerId);
      }
    },
    onError: () => {
      toast.error("Failed to remove player");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: teesheetKeys.list(dateString) });
    },
  });

  // Mutation for checking in/out players
  const checkInPlayerMutation = useMutation({
    mutationFn: async ({
      timeBlockId,
      playerId,
      type,
      isCheckedIn,
    }: {
      timeBlockId: number;
      playerId: number;
      type: PlayerType;
      isCheckedIn: boolean;
    }) => {
      if (type === "member") {
        return checkInMember(timeBlockId, playerId, !isCheckedIn);
      } else if (type === "guest") {
        return checkInGuest(timeBlockId, playerId, !isCheckedIn);
      }
    },
    onError: () => {
      toast.error("Failed to update check-in status");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: teesheetKeys.list(dateString) });
    },
  });

  const getPlayersForBlock = (block: any): TimeBlockPlayer[] => {
    const players: TimeBlockPlayer[] = [];

    block.timeBlockMembers?.forEach((tbm: TimeBlockMemberFull) => {
      // Store full TimeBlockMember
      playerDataRef.current.set(`member-${tbm.member.id}`, tbm);

      // Return display data with proper discriminated union structure
      players.push({
        type: "member",
        data: {
          ...tbm.member,
          bagNumber: tbm.bagNumber,
          checkedIn: tbm.checkedIn,
          checkedInAt: tbm.checkedInAt,
        },
      });
    });

    block.timeBlockGuests?.forEach((tbg: TimeBlockGuestFull) => {
      // Store full TimeBlockGuest
      playerDataRef.current.set(`guest-${tbg.guest.id}`, tbg);

      // Return display data with proper discriminated union structure
      players.push({
        type: "guest",
        data: {
          ...tbg.guest,
          invitedByMemberId: tbg.invitedByMemberId,
          invitedByMember: tbg.invitedByMember,
          checkedIn: tbg.checkedIn,
          checkedInAt: tbg.checkedInAt,
        },
      });
    });

    block.fills?.forEach((fill: any) => {
      players.push({
        type: "fill",
        data: fill,
      });
    });

    return players;
  };

  const getOtherMembers = (
    block: any,
  ): Array<{ id: number; firstName: string; lastName: string }> => {
    return (
      block.timeBlockMembers?.map(
        (tbm: TimeBlockMemberFull) => ({
          id: tbm.member.id,
          firstName: tbm.member.firstName,
          lastName: tbm.member.lastName,
        }),
      ) || []
    );
  };

  const handleAddPlayer = (timeBlockId: number) => {
    setSelectedTimeBlockId(timeBlockId);
    setIsAddPlayerModalOpen(true);
  };

  const handleRemovePlayer = (
    timeBlockId: number,
    playerId: number,
    type: PlayerType,
  ) => {
    removePlayerMutation.mutate({ timeBlockId, playerId, type });
  };

  const handleCheckInPlayer = (
    timeBlockId: number,
    playerId: number,
    type: PlayerType,
    isCheckedIn: boolean,
  ) => {
    checkInPlayerMutation.mutate({
      timeBlockId,
      playerId,
      type,
      isCheckedIn,
    });
  };

  const handleAssignPowerCart = (memberId: number) => {
    assignPowerCartMutation.mutate({
      memberId,
      numHoles: 18,
      isSplit: false,
      isMedical: false,
      staffInitials: "",
      date: new Date(),
    });
  };

  const handlePlayerClick = (player: TimeBlockPlayer) => {
    const fullData = playerDataRef.current.get(
      `${player.type}-${player.data.id}`,
    );
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
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
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
                onAssignPowerCart={handleAssignPowerCart}
                otherMembers={getOtherMembers(block)}
                onTimeClick={() => handleAddPlayer(block.id)}
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
          dateString={dateString}
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
