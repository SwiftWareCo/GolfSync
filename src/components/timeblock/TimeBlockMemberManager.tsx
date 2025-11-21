"use client";

import { useState, useCallback, useEffect } from "react";
import { useDebouncedCallback } from "use-debounce";
import { TimeBlockPageHeader } from "./TimeBlockPageHeader";
import { TimeBlockHeader } from "./TimeBlockHeader";
import { useTeesheetMutations } from "~/hooks/useTeesheetMutations";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { memberQueryOptions, guestQueryOptions, queryKeys } from "~/server/query-options";
import {
  searchMembersAction,
  addMemberToTimeBlock,
} from "~/server/members/actions";
import {
  searchGuestsAction,
  addGuestToTimeBlock,
  removeGuestFromTimeBlock,
} from "~/server/guests/actions";
import {
  addFillToTimeBlock,
  removeFillFromTimeBlock,
  removeTimeBlockMember,
} from "~/server/teesheet/actions";
import { checkTimeblockRestrictionsAction } from "~/server/timeblock-restrictions/actions";
import type { Member } from "~/app/types/MemberTypes";
import type {
  TimeBlockWithMembers,
  TimeBlockMemberView,
  TimeBlockFill,
  FillType,
} from "~/app/types/TeeSheetTypes";
import {
  TimeBlockMemberSearch,
  TimeBlockGuestSearch,
  TimeBlockPeopleList,
} from "./TimeBlockPeopleList";
import { TimeBlockFillForm } from "./fills/TimeBlockFillForm";
import toast from "react-hot-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { type RestrictionViolation } from "~/app/types/RestrictionTypes";
import { RestrictionViolationAlert } from "~/components/settings/timeblock-restrictions/RestrictionViolationAlert";
import { formatDateToYYYYMMDD, parseDate, getBCToday, formatDate } from "~/lib/dates";
import { type TimeBlockGuest } from "~/app/types/GuestTypes";
import { AddGuestDialog } from "~/components/guests/AddGuestDialog";
import { createGuest } from "~/server/guests/actions";
import type { GuestFormValues } from "~/app/types/GuestTypes";

type Guest = {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
};

interface TimeBlockMemberManagerProps {
  timeBlock: TimeBlockWithMembers;
  timeBlockGuests?: TimeBlockGuest[];
  // Optional mutations - if not provided, will fall back to direct server actions
  mutations?: any;
}

export function TimeBlockMemberManager({
  timeBlock: initialTimeBlock,
  timeBlockGuests: initialTimeBlockGuests = [],
  mutations: providedMutations,
}: TimeBlockMemberManagerProps) {
  const queryClient = useQueryClient();

  // Use mutations-only hook to avoid redundant data fetching
  const dateForMutations = initialTimeBlock.date
    ? parseDate(initialTimeBlock.date)
    : new Date();
  const { mutations: hookMutations } = useTeesheetMutations(dateForMutations);

  // Use provided mutations if available, otherwise use hook mutations
  const mutations = providedMutations || hookMutations;

  // Subscribe to live data instead of using static initial data
  const dateString = formatDate(dateForMutations, "yyyy-MM-dd");

  // Use reactive query to get live data - this will trigger re-renders when cache updates
  const teesheetQuery = useQuery(teesheetQueryOptions.byDate(dateString));

  // Find the current timeblock from live data, fallback to initial data
  let timeBlock = initialTimeBlock;
  if (teesheetQuery.data?.timeBlocks) {
    const currentTimeBlock = teesheetQuery.data.timeBlocks.find(
      (tb: any) => tb.id === initialTimeBlock.id
    );
    if (currentTimeBlock) {
      timeBlock = currentTimeBlock;
    }
  }

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

  // Course Sponsored member - hard coded
  const courseSponsoredMember = {
    id: -1, // Special ID to distinguish from real members
    username: "course_sponsored",
    firstName: "Course",
    lastName: "Sponsored",
    memberNumber: "CS001",
    class: "COURSE_SPONSORED",
    email: "course@golfsync.com",
  };

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
      // Use the timeblock's date with proper BC timezone handling
      const bookingDateString = timeBlock.date || getBCToday();

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
      // Use the timeblock's date with proper BC timezone handling
      const bookingDateString = timeBlock.date || getBCToday();

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

    // Check if timeblock is full
    if (isTimeBlockFull) {
      return;
    }

    try {
      const memberToAdd = memberSearchResults.find((m) => m.id === memberId);
      if (!memberToAdd) {
        return;
      }


      // Check for restrictions first
      const hasViolations = await checkMemberRestrictions(
        memberId,
        memberToAdd.class || "",
      );

      if (hasViolations) {
        // Save the action for later if admin overrides
        setPendingAction(() => {
          return async () => {
            try {
              await mutations.addMember(timeBlock.id, memberId);
            } catch (error) {
              console.error("Error adding member:", error);
            }
          };
        });
        return;
      }

      // No violations, proceed as normal
      try {
        const result = await mutations.addMember(timeBlock.id, memberId);
      } catch (error) {
        console.error("Error adding member:", error);
      }
    } catch (error) {
      console.error("Error adding member:", error);
      toast.error("An error occurred while adding the member");
    }
  };

  const handleRemoveMember = async (memberId: number) => {
    try {
      await mutations.removeMember(timeBlock.id, memberId);
    } catch (error) {
      console.error("Error removing member:", error);
    }
  };

  const handleAddGuest = async (guestId: number) => {
    // Check if timeblock is full
    if (isTimeBlockFull) {
      return;
    }

    const guestToAdd = guestSearchResults.find((g) => g.id === guestId);
    if (!guestToAdd) {
      return;
    }

    // Determine the inviting member - use Course Sponsored if selectedMemberId is -1 or null
    let invitingMember;
    let invitingMemberId: number;

    if (!selectedMemberId || selectedMemberId === -1) {
      // Use Course Sponsored member
      if (!courseSponsoredMember) {
        toast.error("Course Sponsored member not available");
        return;
      }
      invitingMember = courseSponsoredMember;
      invitingMemberId = courseSponsoredMember.id;
    } else {
      // Use selected member
      invitingMember = members.find((m: any) => m.id === selectedMemberId);
      if (!invitingMember) {
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
            try {
              await mutations.addGuest(timeBlock.id, guestId, invitingMemberId);
              setSelectedMemberId(null);
            } catch (error) {
              console.error("Error adding guest:", error);
            }
          };
        });
        return;
      }

      // No violations, proceed as normal
      await mutations.addGuest(timeBlock.id, guestId, invitingMemberId);
      setSelectedMemberId(null);
    } catch (error) {
      toast.error("An error occurred while adding the guest");
      console.error(error);
    }
  };

  const handleRemoveGuest = async (guestId: number) => {
    try {
      await mutations.removeGuest(timeBlock.id, guestId);
    } catch (error) {
      console.error("Error removing guest:", error);
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

  const handleAddFill = async (fillType: FillType, customName?: string) => {
    // Check if timeblock is full
    if (isTimeBlockFull) {
      return;
    }

    try {
      await mutations.addFill(timeBlock.id, fillType, customName);
    } catch (error) {
      console.error("Error adding fill:", error);
    }
  };

  const handleRemoveFill = async (fillId: number) => {
    try {
      await mutations.removeFill(timeBlock.id, fillId);
    } catch (error) {
      console.error("Error removing fill:", error);
    }
  };

  return (
    <div className="space-y-6">
      <TimeBlockPageHeader timeBlock={timeBlock} />
      <TimeBlockHeader
        timeBlock={timeBlock}
        guestsCount={guests.length}
        maxPeople={MAX_PEOPLE}
      />

      <Tabs defaultValue="members" className="mt-8 w-full">
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
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="text-sm text-blue-800">
                <strong>Guest Hosting:</strong> Select a member from the time
                block to host a guest, or select Course Sponsored guests
                (reciprocals, gift certificates, etc.).
              </p>
            </div>
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
          <TimeBlockFillForm
            onAddFill={handleAddFill}
            isTimeBlockFull={isTimeBlockFull}
            maxPeople={MAX_PEOPLE}
            currentPeopleCount={currentPeople}
          />
        </TabsContent>
      </Tabs>

      {/* Combined People List - always visible */}
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
