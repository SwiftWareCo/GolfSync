"use client";

import { useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { TimeBlockHeader } from "./TimeBlockHeader";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { memberQueryOptions, guestQueryOptions } from "~/server/query-options";
import { checkTimeblockRestrictionsAction } from "~/server/timeblock-restrictions/actions";
import type { TimeBlockWithRelations } from "~/server/db/schema";
import {
  TimeBlockMemberSearch,
  TimeBlockGuestSearch,
  TimeBlockPeopleList,
} from "./TimeBlockPeopleList";
import { FillForm } from "./fills/FillForm";
import toast from "react-hot-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { type RestrictionViolation } from "~/app/types/RestrictionTypes";
import { RestrictionViolationAlert } from "~/components/settings/timeblock-restrictions/RestrictionViolationAlert";
import { AddGuestDialog } from "~/components/guests/AddGuestDialog";
import { createGuest } from "~/server/guests/actions";
import type { GuestFormValues } from "~/app/types/GuestTypes";
import { removeTimeBlockMember, removeTimeBlockGuest, addFillToTimeBlock, removeFillFromTimeBlock } from "~/server/teesheet/actions";
import { addMemberToTimeBlock } from "~/server/members/actions";
import { addGuestToTimeBlock } from "~/server/guests/actions";
import { teesheetKeys } from "~/services/teesheet/keys";

interface TimeBlockMemberManagerProps {
  timeBlock: TimeBlockWithRelations;
  dateString: string;
}

export function TimeBlockMemberManager({
  timeBlock,
  dateString,
}: TimeBlockMemberManagerProps) {
  const queryClient = useQueryClient();

  // Mutation for adding members with cache optimism
  const addMemberMutation = useMutation({
    mutationFn: (memberId: number) =>
      addMemberToTimeBlock(timeBlock.id as number, memberId),

    onMutate: async (memberId: number) => {
      await queryClient.cancelQueries({ queryKey: teesheetKeys.detail(dateString) });
      const previous = queryClient.getQueryData(teesheetKeys.detail(dateString));

      queryClient.setQueryData(teesheetKeys.detail(dateString), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          timeBlocks: old.timeBlocks.map((block: any) =>
            block.id === timeBlock.id
              ? {
                  ...block,
                  members: [
                    ...(block.members || []),
                    {
                      id: memberId,
                      firstName: "",
                      lastName: "",
                      memberNumber: "",
                      username: "",
                      email: "",
                      bagNumber: null,
                      checkedIn: false,
                      checkedInAt: null,
                    },
                  ],
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
      toast.error("Failed to add member");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: teesheetKeys.detail(dateString) });
      toast.success("Member added");
    },
  });

  // Mutation for removing members with cache optimism
  const removeMemberMutation = useMutation({
    mutationFn: (memberId: number) =>
      removeTimeBlockMember(timeBlock.id as number, memberId),

    onMutate: async (memberId: number) => {
      await queryClient.cancelQueries({ queryKey: teesheetKeys.detail(dateString) });
      const previous = queryClient.getQueryData(teesheetKeys.detail(dateString));

      queryClient.setQueryData(teesheetKeys.detail(dateString), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          timeBlocks: old.timeBlocks.map((block: any) =>
            block.id === timeBlock.id
              ? { ...block, members: (block.members || []).filter((m: any) => m.id !== memberId) }
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
      toast.error("Failed to remove member");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: teesheetKeys.detail(dateString) });
      toast.success("Member removed");
    },
  });

  // Mutation for adding guests with cache optimism
  const addGuestMutation = useMutation({
    mutationFn: ({ guestId, invitingMemberId }: { guestId: number; invitingMemberId: number }) =>
      addGuestToTimeBlock(timeBlock.id as number, guestId, invitingMemberId),

    onMutate: async ({ guestId, invitingMemberId }: { guestId: number; invitingMemberId: number }) => {
      await queryClient.cancelQueries({ queryKey: teesheetKeys.detail(dateString) });
      const previous = queryClient.getQueryData(teesheetKeys.detail(dateString));

      queryClient.setQueryData(teesheetKeys.detail(dateString), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          timeBlocks: old.timeBlocks.map((block: any) =>
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
                      invitedByMemberId: invitingMemberId,
                      invitedByMember: {},
                    },
                  ],
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
      toast.error("Failed to add guest");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: teesheetKeys.detail(dateString) });
      toast.success("Guest added");
      setSelectedMemberId(null);
    },
  });

  // Mutation for removing guests with cache optimism
  const removeGuestMutation = useMutation({
    mutationFn: (guestId: number) =>
      removeTimeBlockGuest(timeBlock.id as number, guestId),

    onMutate: async (guestId: number) => {
      await queryClient.cancelQueries({ queryKey: teesheetKeys.detail(dateString) });
      const previous = queryClient.getQueryData(teesheetKeys.detail(dateString));

      queryClient.setQueryData(teesheetKeys.detail(dateString), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          timeBlocks: old.timeBlocks.map((block: any) =>
            block.id === timeBlock.id
              ? { ...block, guests: (block.guests || []).filter((g: any) => g.id !== guestId) }
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
      toast.error("Failed to remove guest");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: teesheetKeys.detail(dateString) });
      toast.success("Guest removed");
    },
  });

  // Mutation for adding fills with cache optimism
  const addFillMutation = useMutation({
    mutationFn: ({ fillType, customName }: { fillType: string; customName?: string }) =>
      addFillToTimeBlock(timeBlock.id as number, fillType, 1, customName),

    onMutate: async ({ fillType, customName }: { fillType: string; customName?: string }) => {
      await queryClient.cancelQueries({ queryKey: teesheetKeys.detail(dateString) });
      const previous = queryClient.getQueryData(teesheetKeys.detail(dateString));

      queryClient.setQueryData(teesheetKeys.detail(dateString), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          timeBlocks: old.timeBlocks.map((block: any) =>
            block.id === timeBlock.id
              ? {
                  ...block,
                  fills: [
                    ...(block.fills || []),
                    {
                      id: -Date.now(),
                      relatedType: "timeblock" as const,
                      relatedId: timeBlock.id,
                      fillType,
                      customName: customName || null,
                      createdAt: new Date(),
                      updatedAt: null,
                    },
                  ],
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
      toast.error("Failed to add fill");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: teesheetKeys.detail(dateString) });
      toast.success("Fill added");
    },
  });

  // Mutation for removing fills with cache optimism
  const removeFillMutation = useMutation({
    mutationFn: (fillId: number) =>
      removeFillFromTimeBlock(timeBlock.id as number, fillId),

    onMutate: async (fillId: number) => {
      await queryClient.cancelQueries({ queryKey: teesheetKeys.detail(dateString) });
      const previous = queryClient.getQueryData(teesheetKeys.detail(dateString));

      queryClient.setQueryData(teesheetKeys.detail(dateString), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          timeBlocks: old.timeBlocks.map((block: any) =>
            block.id === timeBlock.id
              ? { ...block, fills: (block.fills || []).filter((f: any) => f.id !== fillId) }
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
      toast.error("Failed to remove fill");
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: teesheetKeys.detail(dateString) });
      toast.success("Fill removed");
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

  // Calculate current people count
  const currentPeople = members.length + guests.length + fills.length;
  const isTimeBlockFull = currentPeople >= MAX_PEOPLE;

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
    memberClass: string,
  ) => {
    try {
      // Use the dateString parameter passed to component
      const bookingDateString = dateString;

      // Check for restrictions first
      const checkResult = await checkTimeblockRestrictionsAction({
        memberId,
        memberClass,
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
        memberToAdd.class || "",
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

  return (
    <div className="space-y-6">
      <TimeBlockHeader
        timeBlock={timeBlock}
        guestsCount={guests.length}
        maxPeople={MAX_PEOPLE}
      />

      {/* Combined People List - always visible at top */}
      <TimeBlockPeopleList
        key={`people-${timeBlock.id}-${members.length}-${guests.length}-${fills.length}`}
        members={members}
        guests={guests}
        fills={fills}
        onRemoveMember={handleRemoveMember}
        onRemoveGuest={handleRemoveGuest}
        onRemoveFill={handleRemoveFill}
        maxPeople={MAX_PEOPLE}
      />

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
            />
          </div>
        </TabsContent>

        <TabsContent value="fills">
          <FillForm
            onAddFill={handleAddFill}
            isTimeBlockFull={isTimeBlockFull}
          />
        </TabsContent>
      </Tabs>

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
      <AddGuestDialog
        open={showAddGuestDialog}
        onOpenChange={setShowAddGuestDialog}
        onSubmit={handleCreateGuest}
      />
    </div>
  );
}
