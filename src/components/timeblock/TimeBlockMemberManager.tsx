"use client";

import { useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { TimeBlockHeader } from "./TimeBlockHeader";
import { useQuery } from "@tanstack/react-query";
import { memberQueryOptions, guestQueryOptions } from "~/server/query-options";
import {
  addMemberToTimeBlock,
} from "~/server/members/actions";
import {
  addGuestToTimeBlock,
} from "~/server/guests/actions";
import {
  addFillToTimeBlock,
  removeFillFromTimeBlock,
  removeTimeBlockMember,
  removeTimeBlockGuest,
} from "~/server/teesheet/actions";
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
import {  getBCToday } from "~/lib/dates";
import { AddGuestDialog } from "~/components/guests/AddGuestDialog";
import { createGuest } from "~/server/guests/actions";
import type { GuestFormValues } from "~/app/types/GuestTypes";
import { useTeeblockOptimisticUpdate } from "~/hooks/useTeeblockOptimisticUpdate";

interface TimeBlockMemberManagerProps {
  timeBlock: TimeBlockWithRelations;
  dateString: string;
}

export function TimeBlockMemberManager({
  timeBlock,
  dateString,
}: TimeBlockMemberManagerProps) {
  // Optimistic update hook
  const {
    optimisticallyAddMember,
    optimisticallyRemoveMember,
    optimisticallyAddGuest,
    optimisticallyRemoveGuest,
    optimisticallyAddFill,
    optimisticallyRemoveFill,
    rollback,
  } = useTeeblockOptimisticUpdate(dateString, timeBlock.id as number);

  // Extract members and guests from flattened structure
  const members = timeBlock.members || [];
  const guests = timeBlock.guests || [];
  const fills = timeBlock.fills || [];

  // Member search state and query
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const memberSearchQuery_ = useQuery(memberQueryOptions.search(memberSearchQuery));

  // Guest search state and query
  const [guestSearchQuery, setGuestSearchQuery] = useState("");
  const guestSearchQuery_ = useQuery(guestQueryOptions.search(guestSearchQuery));
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
    const { previousData } = optimisticallyAddMember(memberId, {});

    try {
      const result = await addMemberToTimeBlock(timeBlock.id as number, memberId);

      if (!result.success) {
        toast.error(result.error || "Failed to add member");
        rollback(previousData);
      } else {
        toast.success("Member added");
      }
    } catch (error) {
      console.error("Error adding member:", error);
      toast.error("Error adding member");
      rollback(previousData);
    }
  };

  const handleRemoveMember = async (memberId: number) => {
    const { previousData } = optimisticallyRemoveMember(memberId);

    try {
      const result = await removeTimeBlockMember(timeBlock.id as number, memberId);

      if (!result.success) {
        toast.error(result.error || "Failed to remove member");
        rollback(previousData);
      } else {
        toast.success("Member removed");
      }
    } catch (error) {
      console.error("Error removing member:", error);
      toast.error("Error removing member");
      rollback(previousData);
    }
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
    const { previousData } = optimisticallyAddGuest(guestId, invitingMemberId, {});

    try {
      const result = await addGuestToTimeBlock(
        timeBlock.id as number,
        guestId,
        invitingMemberId,
      );

      if (!result.success) {
        toast.error(result.error || "Failed to add guest");
        rollback(previousData);
      } else {
        toast.success("Guest added");
        setSelectedMemberId(null);
      }
    } catch (error) {
      console.error("Error adding guest:", error);
      toast.error("Error adding guest");
      rollback(previousData);
    }
  };

  const handleRemoveGuest = async (guestId: number) => {
    const { previousData } = optimisticallyRemoveGuest(guestId);

    try {
      const result = await removeTimeBlockGuest(timeBlock.id as number  , guestId);

      if (!result.success) {
        toast.error(result.error || "Failed to remove guest");
        rollback(previousData);
      } else {
        toast.success("Guest removed");
      }
    } catch (error) {
      console.error("Error removing guest:", error);
      toast.error("Error removing guest");
      rollback(previousData);
    }
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

    const { previousData } = optimisticallyAddFill(fillType, customName);

    try {
      const result = await addFillToTimeBlock(
        timeBlock.id as number,
        fillType,
        1, // Add one fill
        customName,
      );

      if (!result.success) {
        toast.error(result.error || "Failed to add fill");
        rollback(previousData);
      } else {
        toast.success("Fill added");
      }
    } catch (error) {
      console.error("Error adding fill:", error);
      toast.error("Error adding fill");
      rollback(previousData);
    }
  };

  const handleRemoveFill = async (fillId: number) => {
    const { previousData } = optimisticallyRemoveFill(fillId);

    try {
      const result = await removeFillFromTimeBlock(timeBlock.id as number, fillId);

      if (!result.success) {
        toast.error(result.error || "Failed to remove fill");
        rollback(previousData);
      } else {
        toast.success("Fill removed");
      }
    } catch (error) {
      console.error("Error removing fill:", error);
      toast.error("Error removing fill");
      rollback(previousData);
    }
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
            onSearch={(query: string) => {
              setMemberSearchQuery(query);
              debouncedMemberSearch(query);
            }}
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
              onSearch={(query: string) => {
                setGuestSearchQuery(query);
                debouncedGuestSearch(query);
              }}
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
