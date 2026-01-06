"use client";

import { useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { memberQueryOptions, guestQueryOptions } from "~/server/query-options";
import { checkTimeblockRestrictionsAction } from "~/server/timeblock-restrictions/actions";
import type {
  TimeBlockWithRelations,
  Teesheet,
  Member,
  Guest,
  Fill,
} from "~/server/db/schema";
import { formatTime12Hour } from "~/lib/dates";

// Type for teesheet query data
type TeesheetData = {
  teesheet: Teesheet;
  config: any;
  timeBlocks: TimeBlockWithRelations[];
  occupiedSpots: number;
  totalCapacity: number;
};

// Type for member with bookedByMemberId
type MemberWithBookedBy = Member & {
  bookedByMemberId?: number | null;
};

// Type for guest with invitedByMemberId
type GuestWithInvitedBy = Guest & {
  invitedByMemberId: number;
  invitedByMember?: Member;
};
import {
  TimeBlockMemberSearch,
  TimeBlockGuestSearch,
  TimeBlockPeopleList,
} from "./TimeBlockPeopleList";
import toast from "react-hot-toast";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { type RestrictionViolation } from "~/app/types/RestrictionTypes";
import { RestrictionViolationAlert } from "~/components/settings/timeblock-restrictions/RestrictionViolationAlert";
import { createGuest } from "~/server/guests/actions";
import type { GuestFormValues } from "~/app/types/GuestTypes";
import {
  removeTimeBlockMember,
  removeTimeBlockGuest,
  addFillToTimeBlock,
  removeFillFromTimeBlock,
  updateMemberBookedBy,
  batchMoveChanges,
} from "~/server/teesheet/actions";
import { addMemberToTimeBlock } from "~/server/members/actions";
import { addGuestToTimeBlock } from "~/server/guests/actions";
import { useTeesheet } from "~/services/teesheet/hooks";
import { teesheetKeys } from "~/services/teesheet/keys";
import { GuestForm } from "../guests/GuestForm";

interface TimeBlockMemberManagerProps {
  timeBlock: TimeBlockWithRelations;
  dateString: string;
}

export function TimeBlockMemberManager({
  timeBlock,
  dateString,
}: TimeBlockMemberManagerProps) {
  const queryClient = useQueryClient();
  const { data: teesheetData } = useTeesheet(dateString) as {
    data: TeesheetData | undefined;
  };

  // Mutation for adding members with cache optimism
  const addMemberMutation = useMutation({
    mutationFn: (memberId: number) =>
      addMemberToTimeBlock(timeBlock.id as number, memberId),

    onMutate: async (memberId: number) => {
      await queryClient.cancelQueries({
        queryKey: teesheetKeys.detail(dateString),
      });
      const previous = queryClient.getQueryData(
        teesheetKeys.detail(dateString),
      );

      queryClient.setQueryData(
        teesheetKeys.detail(dateString),
        (old: TeesheetData | undefined) => {
          if (!old) return old;
          return {
            ...old,
            timeBlocks: old.timeBlocks.map((block) =>
              block.id === timeBlock.id
                ? {
                    ...block,
                    members: [
                      ...(block.members || []),
                      {
                        id: memberId,
                        classId: 0,
                        firstName: "",
                        lastName: "",
                        memberNumber: "",
                        username: "",
                        email: "",
                        gender: null,
                        dateOfBirth: null,
                        handicap: null,
                        bagNumber: null,
                        phone: null,
                        address: null,
                        pushNotificationsEnabled: false,
                        pushSubscription: null,
                        createdAt: new Date(),
                        updatedAt: null,
                        checkedIn: false,
                        checkedInAt: null,
                        bookedByMemberId: null,
                      } as MemberWithBookedBy,
                    ],
                  }
                : block,
            ),
          };
        },
      );

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          teesheetKeys.detail(dateString),
          context.previous,
        );
      }
      toast.error("Failed to add member");
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: teesheetKeys.detail(dateString),
      });
      toast.success("Member added");
    },
  });

  // Mutation for removing members with cache optimism
  const removeMemberMutation = useMutation({
    mutationFn: (memberId: number) =>
      removeTimeBlockMember(timeBlock.id as number, memberId),

    onMutate: async (memberId: number) => {
      await queryClient.cancelQueries({
        queryKey: teesheetKeys.detail(dateString),
      });
      const previous = queryClient.getQueryData(
        teesheetKeys.detail(dateString),
      );

      queryClient.setQueryData(
        teesheetKeys.detail(dateString),
        (old: TeesheetData | undefined) => {
          if (!old) return old;
          return {
            ...old,
            timeBlocks: old.timeBlocks.map((block) =>
              block.id === timeBlock.id
                ? {
                    ...block,
                    members: (block.members || []).filter(
                      (m) => m.id !== memberId,
                    ),
                  }
                : block,
            ),
          };
        },
      );

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          teesheetKeys.detail(dateString),
          context.previous,
        );
      }
      toast.error("Failed to remove member");
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: teesheetKeys.detail(dateString),
      });
      toast.success("Member removed");
    },
  });

  // Mutation for adding guests with cache optimism
  const addGuestMutation = useMutation({
    mutationFn: ({
      guestId,
      invitingMemberId,
    }: {
      guestId: number;
      invitingMemberId: number;
    }) =>
      addGuestToTimeBlock(timeBlock.id as number, guestId, invitingMemberId),

    onMutate: async ({
      guestId,
      invitingMemberId,
    }: {
      guestId: number;
      invitingMemberId: number;
    }) => {
      await queryClient.cancelQueries({
        queryKey: teesheetKeys.detail(dateString),
      });
      const previous = queryClient.getQueryData(
        teesheetKeys.detail(dateString),
      );

      queryClient.setQueryData(
        teesheetKeys.detail(dateString),
        (old: TeesheetData | undefined) => {
          if (!old) return old;
          return {
            ...old,
            timeBlocks: old.timeBlocks.map((block) =>
              block.id === timeBlock.id
                ? {
                    ...block,
                    guests: [
                      ...(block.guests || []),
                      {
                        id: guestId,
                        firstName: "",
                        lastName: "",
                        email: null,
                        phone: null,
                        createdAt: new Date(),
                        updatedAt: null,
                        invitedByMemberId: invitingMemberId,
                        invitedByMember: undefined,
                      } as GuestWithInvitedBy,
                    ],
                  }
                : block,
            ),
          };
        },
      );

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          teesheetKeys.detail(dateString),
          context.previous,
        );
      }
      toast.error("Failed to add guest");
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: teesheetKeys.detail(dateString),
      });
      toast.success("Guest added");
      setSelectedMemberId(null);
    },
  });

  // Mutation for removing guests with cache optimism
  const removeGuestMutation = useMutation({
    mutationFn: (guestId: number) =>
      removeTimeBlockGuest(timeBlock.id as number, guestId),

    onMutate: async (guestId: number) => {
      await queryClient.cancelQueries({
        queryKey: teesheetKeys.detail(dateString),
      });
      const previous = queryClient.getQueryData(
        teesheetKeys.detail(dateString),
      );

      queryClient.setQueryData(
        teesheetKeys.detail(dateString),
        (old: TeesheetData | undefined) => {
          if (!old) return old;
          return {
            ...old,
            timeBlocks: old.timeBlocks.map((block) =>
              block.id === timeBlock.id
                ? {
                    ...block,
                    guests: (block.guests || []).filter(
                      (g) => g.id !== guestId,
                    ),
                  }
                : block,
            ),
          };
        },
      );

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          teesheetKeys.detail(dateString),
          context.previous,
        );
      }
      toast.error("Failed to remove guest");
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: teesheetKeys.detail(dateString),
      });
      toast.success("Guest removed");
    },
  });

  // Mutation for adding fills with cache optimism
  const addFillMutation = useMutation({
    mutationFn: ({
      fillType,
      customName,
    }: {
      fillType: string;
      customName?: string;
    }) => addFillToTimeBlock(timeBlock.id as number, fillType, 1, customName),

    onMutate: async ({
      fillType,
      customName,
    }: {
      fillType: string;
      customName?: string;
    }) => {
      await queryClient.cancelQueries({
        queryKey: teesheetKeys.detail(dateString),
      });
      const previous = queryClient.getQueryData(
        teesheetKeys.detail(dateString),
      );

      queryClient.setQueryData(
        teesheetKeys.detail(dateString),
        (old: TeesheetData | undefined) => {
          if (!old) return old;
          return {
            ...old,
            timeBlocks: old.timeBlocks.map((block) =>
              block.id === timeBlock.id
                ? {
                    ...block,
                    fills: [
                      ...(block.fills || []),
                      {
                        id: -Date.now(),
                        relatedType: "timeblock" as const,
                        relatedId: timeBlock.id as number,
                        fillType,
                        customName: customName || null,
                        createdAt: new Date(),
                        updatedAt: null,
                      } as Fill,
                    ],
                  }
                : block,
            ),
          };
        },
      );

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          teesheetKeys.detail(dateString),
          context.previous,
        );
      }
      toast.error("Failed to add fill");
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: teesheetKeys.detail(dateString),
      });
      toast.success("Fill added");
    },
  });

  // Mutation for removing fills with cache optimism
  const removeFillMutation = useMutation({
    mutationFn: (fillId: number) =>
      removeFillFromTimeBlock(timeBlock.id as number, fillId),

    onMutate: async (fillId: number) => {
      await queryClient.cancelQueries({
        queryKey: teesheetKeys.detail(dateString),
      });
      const previous = queryClient.getQueryData(
        teesheetKeys.detail(dateString),
      );

      queryClient.setQueryData(
        teesheetKeys.detail(dateString),
        (old: TeesheetData | undefined) => {
          if (!old) return old;
          return {
            ...old,
            timeBlocks: old.timeBlocks.map((block) =>
              block.id === timeBlock.id
                ? {
                    ...block,
                    fills: (block.fills || []).filter((f) => f.id !== fillId),
                  }
                : block,
            ),
          };
        },
      );

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          teesheetKeys.detail(dateString),
          context.previous,
        );
      }
      toast.error("Failed to remove fill");
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: teesheetKeys.detail(dateString),
      });
      toast.success("Fill removed");
    },
  });

  // Mutation for updating bookedByMemberId with cache optimism
  const updateBookedByMutation = useMutation({
    mutationFn: ({
      memberId,
      bookedByMemberId,
    }: {
      memberId: number;
      bookedByMemberId: number | null;
    }) =>
      updateMemberBookedBy(timeBlock.id as number, memberId, bookedByMemberId),

    onMutate: async ({
      memberId,
      bookedByMemberId,
    }: {
      memberId: number;
      bookedByMemberId: number | null;
    }) => {
      await queryClient.cancelQueries({
        queryKey: teesheetKeys.detail(dateString),
      });
      const previous = queryClient.getQueryData(
        teesheetKeys.detail(dateString),
      );

      queryClient.setQueryData(
        teesheetKeys.detail(dateString),
        (old: TeesheetData | undefined) => {
          if (!old) return old;
          return {
            ...old,
            timeBlocks: old.timeBlocks.map((block) =>
              block.id === timeBlock.id
                ? {
                    ...block,
                    members: (block.members || []).map((m) =>
                      m.id === memberId ? { ...m, bookedByMemberId } : m,
                    ),
                  }
                : block,
            ),
          };
        },
      );

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          teesheetKeys.detail(dateString),
          context.previous,
        );
      }
      toast.error("Failed to update booked by");
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: teesheetKeys.detail(dateString),
      });
      toast.success("Booked by updated");
    },
  });

  // Extract members and guests from flattened structure
  const members = timeBlock.members || [];
  const guests = timeBlock.guests || [];
  const fills = timeBlock.fills || [];

  // Member search state and query
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const memberSearchQuery_ = useQuery(
    memberQueryOptions.search(memberSearchQuery),
  );

  // Guest search state and query
  const [guestSearchQuery, setGuestSearchQuery] = useState("");
  const guestSearchQuery_ = useQuery(
    guestQueryOptions.search(guestSearchQuery),
  );
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [moveTargetId, setMoveTargetId] = useState<string | undefined>(
    undefined,
  );

  // Restriction violation state
  const [restrictionViolations, setRestrictionViolations] = useState<
    RestrictionViolation[]
  >([]);
  const [showViolationAlert, setShowViolationAlert] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    (() => Promise<void>) | null
  >(null);

  // Guest creation state
  const [showAddGuestDialog, setShowAddGuestDialog] = useState(false);

  // Constants
  const MAX_PEOPLE = 4;
  const maxPeople = timeBlock.maxMembers ?? MAX_PEOPLE;

  // Calculate current people count
  const currentPeople = members.length + guests.length + fills.length;
  const isTimeBlockFull = currentPeople >= maxPeople;

  const getBlockPeopleCount = (block: TimeBlockWithRelations) =>
    (block.members?.length || 0) +
    (block.guests?.length || 0) +
    (block.fills?.length || 0);

  const timeBlocks = (teesheetData?.timeBlocks ?? [])
    .slice()
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const moveTargets = timeBlocks.filter((block) => block.id !== timeBlock.id);
  const selectedMoveTarget = moveTargetId
    ? moveTargets.find((block) => block.id === Number(moveTargetId))
    : null;
  const selectedMoveTargetCapacity = selectedMoveTarget
    ? (selectedMoveTarget.maxMembers ?? MAX_PEOPLE)
    : MAX_PEOPLE;
  const selectedMoveTargetAvailable = selectedMoveTarget
    ? selectedMoveTargetCapacity - getBlockPeopleCount(selectedMoveTarget)
    : 0;
  const canMoveToSelectedTarget =
    !!selectedMoveTarget &&
    currentPeople > 0 &&
    selectedMoveTargetAvailable >= currentPeople;

  const movePlayersMutation = useMutation({
    mutationFn: async (targetTimeBlockId: number) => {
      const changes = [
        ...members.map((member) => ({
          playerId: member.id,
          playerType: "member" as const,
          sourceTimeBlockId: timeBlock.id as number,
          targetTimeBlockId,
        })),
        ...guests.map((guest) => ({
          playerId: guest.id,
          playerType: "guest" as const,
          sourceTimeBlockId: timeBlock.id as number,
          targetTimeBlockId,
          invitedByMemberId: guest.invitedByMemberId,
        })),
        ...fills.map((fill) => ({
          playerId: fill.id,
          playerType: "fill" as const,
          sourceTimeBlockId: timeBlock.id as number,
          targetTimeBlockId,
          fillType: fill.fillType,
          fillCustomName: fill.customName ?? null,
        })),
      ];

      if (changes.length === 0) {
        return { success: false, error: "No players to move" };
      }

      return batchMoveChanges(timeBlock.teesheetId as number, changes);
    },

    onError: () => {
      toast.error("Failed to move players");
    },

    onSuccess: (result, targetTimeBlockId) => {
      if (!result?.success) {
        toast.error(result?.error || "Failed to move players");
        return;
      }

      const targetBlock = timeBlocks.find(
        (block) => block.id === targetTimeBlockId,
      );
      const targetLabel = targetBlock
        ? formatTime12Hour(targetBlock.startTime)
        : "target time block";
      const movedLabel =
        currentPeople === 1 ? "1 player" : `${currentPeople} players`;
      toast.success(`Moved ${movedLabel} to ${targetLabel}`);
      setMoveTargetId(undefined);
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: teesheetKeys.detail(dateString),
      });
    },
  });

  // Get search results from TanStack Query
  const memberSearchResults = memberSearchQuery_.data || [];
  const guestSearchResults = guestSearchQuery_.data || [];
  const isMemberSearching = memberSearchQuery_.isLoading;
  const isGuestSearching = guestSearchQuery_.isLoading;

  // Simple debounced handlers that just update the search query state
  const debouncedMemberSearch = useDebouncedCallback((query: string) => {
    setMemberSearchQuery(query);
  }, 300);

  const debouncedGuestSearch = useDebouncedCallback((query: string) => {
    setGuestSearchQuery(query);
  }, 300);

  // Check for restrictions before adding a member
  const checkMemberRestrictions = async (
    memberId: number,
    memberClassId: number,
  ) => {
    try {
      // Use the dateString parameter passed to component
      const bookingDateString = dateString;

      // Check for restrictions first
      const checkResult = await checkTimeblockRestrictionsAction({
        memberId,
        memberClassId,
        bookingDateString,
        bookingTime: timeBlock.startTime,
      });

      if ("success" in checkResult && !checkResult.success) {
        toast.error(checkResult.error || "Failed to check restrictions");
        return false;
      }

      if ("hasViolations" in checkResult && checkResult.hasViolations) {
        setRestrictionViolations(checkResult.violations);
        setShowViolationAlert(true);
        return true;
      }

      return false;
    } catch (error) {
      console.error("Error checking restrictions:", error);
      toast.error("Error checking restrictions");
      return false;
    }
  };

  // Check for restrictions before adding a guest
  const checkGuestRestrictions = async (guestId: number) => {
    try {
      // Use the dateString parameter passed to component
      const bookingDateString = dateString;

      // Check for restrictions
      const checkResult = await checkTimeblockRestrictionsAction({
        guestId,
        bookingDateString,
        bookingTime: timeBlock.startTime,
      });

      if ("success" in checkResult && !checkResult.success) {
        toast.error(checkResult.error || "Failed to check restrictions");
        return false;
      }

      if ("hasViolations" in checkResult && checkResult.hasViolations) {
        setRestrictionViolations(checkResult.violations);
        setShowViolationAlert(true);
        return true;
      }

      return false;
    } catch (error) {
      console.error("Error checking restrictions:", error);
      toast.error("Failed to check restrictions");
      return false;
    }
  };

  const handleAddMember = async (memberId: number) => {
    if (isTimeBlockFull) return;

    const memberToAdd = memberSearchResults.find((m) => m.id === memberId);
    if (!memberToAdd) return;

    try {
      // Check for restrictions first
      const hasViolations = await checkMemberRestrictions(
        memberId,
        memberToAdd.classId,
      );

      if (hasViolations) {
        // Save the action for later if admin overrides
        setPendingAction(() => {
          return async () => {
            await performAddMember(memberId);
          };
        });
        return;
      }

      // No violations, proceed immediately
      await performAddMember(memberId);
    } catch (error) {
      console.error("Error adding member:", error);
      toast.error("An error occurred while adding the member");
    }
  };

  const performAddMember = async (memberId: number) => {
    addMemberMutation.mutate(memberId);
  };

  const handleRemoveMember = async (memberId: number) => {
    removeMemberMutation.mutate(memberId);
  };

  const handleAddGuest = async (guestId: number) => {
    if (isTimeBlockFull) return;

    const guestToAdd = guestSearchResults.find((g) => g.id === guestId);
    if (!guestToAdd) return;

    // Determine the inviting member - use Course Sponsored if selectedMemberId is -1 or null
    let invitingMemberId: number;

    if (!selectedMemberId || selectedMemberId === -1) {
      invitingMemberId = -1; // Course Sponsored
    } else {
      const foundMember = members.find((m) => m.id === selectedMemberId);
      if (!foundMember) {
        toast.error("Selected member not found");
        return;
      }
      invitingMemberId = selectedMemberId;
    }

    try {
      // Check for restrictions
      const hasViolations = await checkGuestRestrictions(guestId);

      if (hasViolations) {
        // Save the action for later if admin overrides
        setPendingAction(() => {
          return async () => {
            await performAddGuest(guestId, invitingMemberId);
          };
        });
        return;
      }

      // No violations, proceed immediately
      await performAddGuest(guestId, invitingMemberId);
    } catch (error) {
      toast.error("An error occurred while adding the guest");
      console.error(error);
    }
  };

  const performAddGuest = async (guestId: number, invitingMemberId: number) => {
    addGuestMutation.mutate({ guestId, invitingMemberId });
  };

  const handleRemoveGuest = async (guestId: number) => {
    removeGuestMutation.mutate(guestId);
  };

  const handleMemberSelect = (memberId: number) => {
    setSelectedMemberId(memberId);
  };

  const handleOverrideAndContinue = async () => {
    if (pendingAction) {
      await pendingAction();
      setPendingAction(null);
    }
    setShowViolationAlert(false);
  };

  const handleCreateGuest = async (values: GuestFormValues) => {
    try {
      const result = await createGuest(values);
      if (result.success && result.data) {
        toast.success("Guest created successfully");

        // Close the dialog first
        setShowAddGuestDialog(false);

        // Add the new guest to the timeblock if a member is selected
        if (selectedMemberId) {
          await handleAddGuest(result.data.id);
        }

        // If no search query was active, set it to the new guest's name to show it in results
        if (!guestSearchQuery) {
          setGuestSearchQuery(`${values.firstName} ${values.lastName}`);
        }
      } else {
        toast.error(result.error || "Failed to create guest");
      }
    } catch (error) {
      toast.error("An error occurred while creating the guest");
      console.error(error);
    }
  };

  const handleShowCreateGuestDialog = () => {
    setShowAddGuestDialog(true);
  };

  const handleAddFill = async (fillType: string, customName?: string) => {
    if (isTimeBlockFull) return;
    addFillMutation.mutate({ fillType, customName });
  };

  const handleRemoveFill = async (fillId: number) => {
    removeFillMutation.mutate(fillId);
  };

  const handleUpdateBookedBy = async (
    memberId: number,
    bookedByMemberId: number | null,
  ) => {
    updateBookedByMutation.mutate({ memberId, bookedByMemberId });
  };

  const handleMovePlayers = () => {
    if (!selectedMoveTarget || !selectedMoveTarget.id) return;
    movePlayersMutation.mutate(selectedMoveTarget.id);
  };

  return (
    <>
      <div className="flex h-full gap-6">
        <div className="flex w-1/3 flex-col gap-6">
          <div className="rounded-lg border border-dashed bg-gray-50 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-medium text-gray-900">
                  Move players
                </p>
                <p className="text-[11px] text-gray-500">
                  Move all to another tee time
                </p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <Select
                  value={moveTargetId}
                  onValueChange={setMoveTargetId}
                  disabled={
                    moveTargets.length === 0 ||
                    currentPeople === 0 ||
                    movePlayersMutation.isPending
                  }
                >
                  <SelectTrigger className="h-8 w-full text-xs sm:w-48">
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    {moveTargets.map((block) => {
                      const blockPeople = getBlockPeopleCount(block);
                      const blockCapacity = block.maxMembers ?? MAX_PEOPLE;
                      const canFit =
                        currentPeople === 0 ||
                        blockCapacity - blockPeople >= currentPeople;
                      const blockLabel = block.displayName
                        ? ` - ${block.displayName}`
                        : "";

                      return (
                        <SelectItem
                          key={block.id}
                          value={block.id!.toString()}
                          disabled={!canFit}
                        >
                          {`${formatTime12Hour(block.startTime)}${blockLabel} (${blockPeople}/${blockCapacity})`}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={handleMovePlayers}
                  disabled={
                    !canMoveToSelectedTarget || movePlayersMutation.isPending
                  }
                >
                  {movePlayersMutation.isPending ? "Moving..." : "Move"}
                </Button>
              </div>
            </div>
            {moveTargets.length === 0 && (
              <p className="mt-1 text-[11px] text-gray-500">
                No other time blocks available.
              </p>
            )}
            {currentPeople === 0 && (
              <p className="mt-1 text-[11px] text-gray-500">
                No players to move.
              </p>
            )}
            {selectedMoveTarget &&
              !canMoveToSelectedTarget &&
              currentPeople > 0 && (
                <p className="mt-1 text-[11px] text-red-600">
                  Not enough space in selected time block.
                </p>
              )}
          </div>

          <Tabs defaultValue="members" className="mt-6 w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="members">Add Members</TabsTrigger>
              <TabsTrigger value="guests">Add Guests</TabsTrigger>
              <TabsTrigger value="fills">Add Fills</TabsTrigger>
            </TabsList>

            <TabsContent value="members" className="space-y-6">
              <TimeBlockMemberSearch
                searchQuery={memberSearchQuery}
                onSearch={debouncedMemberSearch}
                searchResults={memberSearchResults}
                isLoading={isMemberSearching}
                onAddMember={handleAddMember}
                isTimeBlockFull={isTimeBlockFull}
                existingMembers={members}
                autoFocus={true}
              />
            </TabsContent>

            <TabsContent value="guests">
              <div className="space-y-4">
                <TimeBlockGuestSearch
                  searchQuery={guestSearchQuery}
                  onSearch={debouncedGuestSearch}
                  searchResults={guestSearchResults}
                  isLoading={isGuestSearching}
                  onAddGuest={handleAddGuest}
                  isTimeBlockFull={isTimeBlockFull}
                  members={members}
                  onMemberSelect={handleMemberSelect}
                  selectedMemberId={selectedMemberId}
                  onCreateGuest={handleShowCreateGuestDialog}
                  existingGuests={guests}
                  autoFocus={true}
                />
              </div>
            </TabsContent>

            <TabsContent value="fills">
              <div className="flex flex-wrap gap-2 p-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddFill("guest_fill")}
                  disabled={isTimeBlockFull}
                  className="border-amber-300 text-amber-700 hover:bg-amber-50"
                >
                  + Guest Fill
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddFill("reciprocal")}
                  disabled={isTimeBlockFull}
                >
                  + Reciprocal
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex h-full w-2/3 flex-col">
          <TimeBlockPeopleList
            key={`people-${timeBlock.id}-${members.length}-${guests.length}-${fills.length}`}
            className="mt-0 h-full"
            members={members}
            guests={guests}
            fills={fills}
            onRemoveMember={handleRemoveMember}
            onRemoveGuest={handleRemoveGuest}
            onRemoveFill={handleRemoveFill}
            onUpdateBookedBy={handleUpdateBookedBy}
            maxPeople={maxPeople}
          />
        </div>
      </div>

      {/* Restriction Violation Alert */}
      <RestrictionViolationAlert
        open={showViolationAlert}
        onOpenChange={setShowViolationAlert}
        violations={restrictionViolations}
        onContinue={handleOverrideAndContinue}
        onCancel={() => {
          setShowViolationAlert(false);
          setPendingAction(null);
        }}
      />

      {/* Add Guest Dialog */}
      <Dialog open={showAddGuestDialog} onOpenChange={setShowAddGuestDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Guest</DialogTitle>
          </DialogHeader>
          <GuestForm
            mode="create"
            onSuccess={() => setShowAddGuestDialog(false)}
            onCancel={() => setShowAddGuestDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
