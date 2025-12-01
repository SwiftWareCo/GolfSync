"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTeesheet } from "~/services/teesheet/hooks";
import { TimeBlockRow } from "./time-block-row/TimeBlockRow";
import { type PlayerType } from "./time-block-row/PlayerBadge";
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
import { Settings } from "lucide-react";
import Link from "next/link";
import { teesheetKeys } from "~/services/teesheet/keys";

interface TeesheetTableProps {
  dateString: string;
}

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

  // Use the fresh data from the query if available
  const timeBlocks = queryResult?.timeBlocks ?? [];

  // Mutation for removing members with cache optimism
  const removeMemberMutation = useMutation({
    mutationFn: ({ timeBlockId, memberId }: { timeBlockId: number; memberId: number }) =>
      removeTimeBlockMember(timeBlockId, memberId),

    onMutate: async ({ timeBlockId, memberId }: { timeBlockId: number; memberId: number }) => {
      await queryClient.cancelQueries({ queryKey: teesheetKeys.detail(dateString) });
      const previous = queryClient.getQueryData(teesheetKeys.detail(dateString));

      queryClient.setQueryData(teesheetKeys.detail(dateString), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          timeBlocks: old.timeBlocks.map((block: any) =>
            block.id === timeBlockId
              ? { ...block, members: block.members.filter((m: any) => m.id !== memberId) }
              : block
          ),
        };
      });

      return { previous };
    },

    onError: (err, vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(teesheetKeys.detail(dateString), context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: teesheetKeys.detail(dateString) });
    },
  });

  // Mutation for removing guests with cache optimism
  const removeGuestMutation = useMutation({
    mutationFn: ({ timeBlockId, guestId }: { timeBlockId: number; guestId: number }) =>
      removeTimeBlockGuest(timeBlockId, guestId),

    onMutate: async ({ timeBlockId, guestId }: { timeBlockId: number; guestId: number }) => {
      await queryClient.cancelQueries({ queryKey: teesheetKeys.detail(dateString) });
      const previous = queryClient.getQueryData(teesheetKeys.detail(dateString));

      queryClient.setQueryData(teesheetKeys.detail(dateString), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          timeBlocks: old.timeBlocks.map((block: any) =>
            block.id === timeBlockId
              ? { ...block, guests: block.guests.filter((g: any) => g.id !== guestId) }
              : block
          ),
        };
      });

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(teesheetKeys.detail(dateString), context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: teesheetKeys.detail(dateString) });
    },
  });

  // Mutation for removing fills with cache optimism
  const removeFillMutation = useMutation({
    mutationFn: ({ timeBlockId, fillId }: { timeBlockId: number; fillId: number }) =>
      removeFillFromTimeBlock(timeBlockId, fillId),

    onMutate: async ({ timeBlockId, fillId }: { timeBlockId: number; fillId: number }) => {
      await queryClient.cancelQueries({ queryKey: teesheetKeys.detail(dateString) });
      const previous = queryClient.getQueryData(teesheetKeys.detail(dateString));

      queryClient.setQueryData(teesheetKeys.detail(dateString), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          timeBlocks: old.timeBlocks.map((block: any) =>
            block.id === timeBlockId
              ? { ...block, fills: block.fills.filter((f: any) => f.id !== fillId) }
              : block
          ),
        };
      });

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(teesheetKeys.detail(dateString), context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: teesheetKeys.detail(dateString) });
    },
  });

  // Mutation for checking in/out members with cache optimism
  const checkInMemberMutation = useMutation({
    mutationFn: ({ timeBlockId, playerId, isCheckedIn }: { timeBlockId: number; playerId: number; isCheckedIn: boolean }) =>
      checkInMember(timeBlockId, playerId, !isCheckedIn),

    onMutate: async ({ timeBlockId, playerId, isCheckedIn }: { timeBlockId: number; playerId: number; isCheckedIn: boolean }) => {
      await queryClient.cancelQueries({ queryKey: teesheetKeys.detail(dateString) });
      const previous = queryClient.getQueryData(teesheetKeys.detail(dateString));

      queryClient.setQueryData(teesheetKeys.detail(dateString), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          timeBlocks: old.timeBlocks.map((block: any) =>
            block.id === timeBlockId
              ? {
                  ...block,
                  members: block.members.map((m: any) =>
                    m.id === playerId
                      ? { ...m, checkedIn: !isCheckedIn, checkedInAt: !isCheckedIn ? new Date() : null }
                      : m
                  ),
                }
              : block
          ),
        };
      });

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(teesheetKeys.detail(dateString), context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: teesheetKeys.detail(dateString) });
    },
  });

  // Mutation for checking in/out guests with cache optimism
  const checkInGuestMutation = useMutation({
    mutationFn: ({ timeBlockId, playerId, isCheckedIn }: { timeBlockId: number; playerId: number; isCheckedIn: boolean }) =>
      checkInGuest(timeBlockId, playerId, !isCheckedIn),

    onMutate: async ({ timeBlockId, playerId, isCheckedIn }: { timeBlockId: number; playerId: number; isCheckedIn: boolean }) => {
      await queryClient.cancelQueries({ queryKey: teesheetKeys.detail(dateString) });
      const previous = queryClient.getQueryData(teesheetKeys.detail(dateString));

      queryClient.setQueryData(teesheetKeys.detail(dateString), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          timeBlocks: old.timeBlocks.map((block: any) =>
            block.id === timeBlockId
              ? {
                  ...block,
                  guests: block.guests.map((g: any) =>
                    g.id === playerId
                      ? { ...g, checkedIn: !isCheckedIn, checkedInAt: !isCheckedIn ? new Date() : null }
                      : g
                  ),
                }
              : block
          ),
        };
      });

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(teesheetKeys.detail(dateString), context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: teesheetKeys.detail(dateString) });
    },
  });

  // Mutation for power cart assignment
  const assignPowerCartMutation = useMutation({
    mutationFn: (variables: {
      memberId: number;
      numHoles: 9 | 18;
      isSplit: boolean;
      isMedical: boolean;
      staffInitials: string;
      date: Date;
    }) => quickAssignPowerCart(variables),

    onMutate: async (variables: {
      memberId: number;
      numHoles: 9 | 18;
      isSplit: boolean;
      isMedical: boolean;
      staffInitials: string;
      date: Date;
    }) => {
      await queryClient.cancelQueries({ queryKey: teesheetKeys.detail(dateString) });
      const previous = queryClient.getQueryData(teesheetKeys.detail(dateString));
      return { previous };
    },

    onError: (_err, _variables, context) => {
      toast.error("Failed to assign power cart");
      if (context?.previous) {
        queryClient.setQueryData(teesheetKeys.detail(dateString), context.previous);
      }
    },

    onSettled: (_data, error) => {
      queryClient.invalidateQueries({ queryKey: teesheetKeys.detail(dateString) });
      if (!error) {
        toast.success("Power cart assigned");
      }
    },
  });

  const getOtherMembers = (
    block: any,
  ): Array<{ id: number; firstName: string; lastName: string }> => {
    return (
      block.members?.map((member: any) => ({
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
      })) || []
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
    if (type === "member") {
      removeMemberMutation.mutate({ timeBlockId, memberId: playerId });
    } else if (type === "guest") {
      removeGuestMutation.mutate({ timeBlockId, guestId: playerId });
    } else if (type === "fill") {
      removeFillMutation.mutate({ timeBlockId, fillId: playerId });
    }
  };

  const handleCheckInPlayer = (
    timeBlockId: number,
    playerId: number,
    type: PlayerType,
    isCheckedIn: boolean,
  ) => {
    if (type === "member") {
      checkInMemberMutation.mutate({ timeBlockId, playerId, isCheckedIn });
    } else if (type === "guest") {
      checkInGuestMutation.mutate({ timeBlockId, playerId, isCheckedIn });
    }
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

  const handlePlayerClick = (player: any) => {
    if (player.type === "member" || player.type === "guest") {
      setIsAccountDialogOpen(true);
      setSelectedPlayer({
        member: player.type === "member" ? player.data : undefined,
        guest: player.type === "guest" ? player.data : undefined,
        isMemberAccount: player.type === "member",
      });
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
                members={block.members || []}
                guests={block.guests || []}
                fills={block.fills || []}
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
