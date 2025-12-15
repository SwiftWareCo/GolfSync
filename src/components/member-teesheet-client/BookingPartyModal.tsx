"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { useDebounce } from "use-debounce";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Loader2, Search, UserPlus, X, Lock } from "lucide-react";
import toast from "react-hot-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { memberQueryOptions, guestQueryOptions } from "~/server/query-options";
import { createGuest } from "~/server/guests/actions";
import {
  bookMultiplePlayersAction,
  removeMemberFromParty,
  removeGuestFromParty,
} from "~/server/members-teesheet-client/actions";

// Types for the booking party
type PartyMember = {
  type: "member";
  id: number;
  firstName: string;
  lastName: string;
  memberNumber?: string;
  isLocked?: boolean; // Current user is locked
};

type PartyGuest = {
  type: "guest";
  id: number;
  firstName: string;
  lastName: string;
  isNew?: boolean; // Newly created guest
};

type PartyPlayer = PartyMember | PartyGuest;

interface BookingPartyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentMember: {
    id: number;
    firstName: string;
    lastName: string;
    memberNumber?: string;
  };
  maxPlayers: number;
  timeBlockCurrentCapacity?: number; // Total players already in timeblock (not just your party)
  onConfirm: (players: PartyPlayer[]) => Promise<void>;
  mode?: "create" | "edit";
  timeBlockId?: number;
  existingParty?: {
    members: Array<{
      id: number;
      firstName: string;
      lastName: string;
      memberNumber?: string;
      bookedByMemberId?: number | null;
    }>;
    guests?: Array<{
      id: number;
      firstName: string;
      lastName: string;
      invitedByMemberId?: number;
    }>;
  };
}

export function BookingPartyModal({
  open,
  onOpenChange,
  currentMember,
  maxPlayers,
  timeBlockCurrentCapacity = 0,
  onConfirm,
  mode = "create",
  timeBlockId,
  existingParty,
}: BookingPartyModalProps) {
  const queryClient = useQueryClient();

  // Track pending changes (not yet submitted)
  const [pendingAdditions, setPendingAdditions] = useState<PartyPlayer[]>([]);
  const [pendingRemovals, setPendingRemovals] = useState<
    Array<{ id: number; type: string }>
  >([]);

  // Compute display party from source of truth (existingParty) - pending removals + pending additions
  const displayParty = useMemo(() => {
    if (mode === "edit" && existingParty) {
      // Edit mode: Map existing party - pending removals + pending additions
      const members: PartyPlayer[] = existingParty.members
        .filter(
          (m) =>
            !pendingRemovals.some((r) => r.id === m.id && r.type === "member"),
        )
        .map((m) => ({
          type: "member" as const,
          id: m.id,
          firstName: m.firstName,
          lastName: m.lastName,
          memberNumber: m.memberNumber,
          isLocked: m.id === currentMember.id,
        }));

      const guests: PartyPlayer[] = (existingParty.guests || [])
        .filter(
          (g) =>
            !pendingRemovals.some((r) => r.id === g.id && r.type === "guest"),
        )
        .map((g) => ({
          type: "guest" as const,
          id: g.id,
          firstName: g.firstName,
          lastName: g.lastName,
        }));

      return [...members, ...guests, ...pendingAdditions];
    } else {
      // Create mode: Current member (locked) + pending additions
      return [
        {
          type: "member" as const,
          id: currentMember.id,
          firstName: currentMember.firstName,
          lastName: currentMember.lastName,
          memberNumber: currentMember.memberNumber,
          isLocked: true,
        },
        ...pendingAdditions,
      ];
    }
  }, [mode, existingParty, pendingAdditions, pendingRemovals, currentMember]);

  // Calculate how many slots are available in the timeblock
  // In edit mode, we need to account for players we might remove
  const currentPartySize =
    mode === "edit" && existingParty
      ? existingParty.members.length + (existingParty.guests?.length || 0)
      : 0;

  // Available slots = maxPlayers - (current capacity - your current party size)
  // This way if you have 3 players and there are 4 total, you have 1 slot available
  const otherPlayersInTimeBlock = timeBlockCurrentCapacity - currentPartySize;
  const availableSlots = maxPlayers - otherPlayersInTimeBlock;

  // Search states
  const [memberSearch, setMemberSearch] = useState("");
  const [guestSearch, setGuestSearch] = useState("");
  const [debouncedMemberSearch] = useDebounce(memberSearch, 300);
  const [debouncedGuestSearch] = useDebounce(guestSearch, 300);

  // Guest creation state
  const [showCreateGuest, setShowCreateGuest] = useState(false);
  const [newGuestFirstName, setNewGuestFirstName] = useState("");
  const [newGuestLastName, setNewGuestLastName] = useState("");
  const [isCreatingGuest, setIsCreatingGuest] = useState(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Member search query
  const memberSearchQuery = useQuery({
    ...memberQueryOptions.search(debouncedMemberSearch),
    enabled: debouncedMemberSearch.length >= 2,
  });

  // Guest search query
  const guestSearchQuery = useQuery({
    ...guestQueryOptions.search(debouncedGuestSearch),
    enabled: debouncedGuestSearch.length >= 2,
  });

  const isFull = displayParty.length >= availableSlots;

  // Filter out already-added players from search results
  const filteredMemberResults = useMemo(() => {
    if (!memberSearchQuery.data) return [];
    const partyMemberIds = displayParty
      .filter((p) => p.type === "member")
      .map((p) => p.id);
    return memberSearchQuery.data.filter((m) => !partyMemberIds.includes(m.id));
  }, [memberSearchQuery.data, displayParty]);

  const filteredGuestResults = useMemo(() => {
    if (!guestSearchQuery.data) return [];
    const partyGuestIds = displayParty
      .filter((p) => p.type === "guest")
      .map((p) => p.id);
    return guestSearchQuery.data.filter((g) => !partyGuestIds.includes(g.id));
  }, [guestSearchQuery.data, displayParty]);

  // Show create guest option when no results match
  const showCreateGuestOption =
    debouncedGuestSearch.length >= 2 &&
    !guestSearchQuery.isLoading &&
    filteredGuestResults.length === 0;

  // Add member to party
  const handleAddMember = useCallback(
    (member: (typeof filteredMemberResults)[0]) => {
      if (isFull) {
        toast.error(
          `No slots available in this tee time (${availableSlots} max for your party)`,
        );
        return;
      }

      setPendingAdditions((prev) => [
        ...prev,
        {
          type: "member",
          id: member.id,
          firstName: member.firstName,
          lastName: member.lastName,
          memberNumber: member.memberNumber,
        },
      ]);
      setMemberSearch("");
    },
    [isFull, availableSlots],
  );

  // Add guest to party
  const handleAddGuest = useCallback(
    (guest: (typeof filteredGuestResults)[0]) => {
      if (isFull) {
        toast.error(
          `No slots available in this tee time (${availableSlots} max for your party)`,
        );
        return;
      }

      setPendingAdditions((prev) => [
        ...prev,
        {
          type: "guest",
          id: guest.id,
          firstName: guest.firstName,
          lastName: guest.lastName,
        },
      ]);
      setGuestSearch("");
    },
    [isFull, availableSlots],
  );

  // Determine if current member is the booker
  const isBooker =
    mode === "edit" && existingParty
      ? existingParty.members.some(
          (m) =>
            m.id === currentMember.id &&
            m.bookedByMemberId === currentMember.id,
        )
      : true; // In create mode, user is always the booker

  // Remove player from party (deferred - only updates state, submitted on confirm)
  const handleRemovePlayer = useCallback(
    (playerId: number, type: string) => {
      // Check if this player is in existingParty (defer removal) or pendingAdditions (remove immediately)
      if (mode === "edit" && existingParty) {
        const isExistingMember = existingParty.members.some(
          (m) => m.id === playerId,
        );
        const isExistingGuest = existingParty.guests?.some(
          (g) => g.id === playerId,
        );

        if (isExistingMember || isExistingGuest) {
          // Existing player - add to pending removals
          setPendingRemovals((prev) => [...prev, { id: playerId, type }]);
          return;
        }
      }

      // Pending addition - remove from pending additions
      setPendingAdditions((prev) =>
        prev.filter((p) => !(p.id === playerId && p.type === type)),
      );
    },
    [mode, existingParty],
  );

  // Create new guest handler
  const handleCreateGuest = async () => {
    if (!newGuestFirstName.trim() || !newGuestLastName.trim()) {
      toast.error("Please enter first and last name");
      return;
    }

    setIsCreatingGuest(true);
    try {
      const result = await createGuest({
        firstName: newGuestFirstName.trim(),
        lastName: newGuestLastName.trim(),
      });

      if (result.success && result.data) {
        // Invalidate guest cache so new guest appears in search
        await queryClient.invalidateQueries({ queryKey: ["guests"] });

        // Add to pending additions
        setPendingAdditions((prev) => [
          ...prev,
          {
            type: "guest",
            id: result.data!.id,
            firstName: result.data!.firstName,
            lastName: result.data!.lastName,
            isNew: true,
          },
        ]);
        toast.success("Guest created and added");
        setShowCreateGuest(false);
        setNewGuestFirstName("");
        setNewGuestLastName("");
        setGuestSearch("");
      } else {
        toast.error(result.error || "Failed to create guest");
      }
    } catch (error) {
      console.error("Error creating guest:", error);
      toast.error("Failed to create guest");
    } finally {
      setIsCreatingGuest(false);
    }
  };

  // Pre-fill create guest form with search query
  const handleShowCreateGuest = useCallback(() => {
    // Try to split the search query into first/last name
    const parts = debouncedGuestSearch.trim().split(/\s+/);
    if (parts.length >= 2) {
      setNewGuestFirstName(parts[0] || "");
      setNewGuestLastName(parts.slice(1).join(" ") || "");
    } else {
      setNewGuestFirstName(debouncedGuestSearch.trim());
      setNewGuestLastName("");
    }
    setShowCreateGuest(true);
  }, [debouncedGuestSearch]);

  // Determine the organizer ID for this party
  const organizerId = useMemo(() => {
    if (mode === "edit" && existingParty) {
      // Find current member's record to get their bookedByMemberId
      const currentMemberRecord = existingParty.members.find(
        (m) => m.id === currentMember.id,
      );

      if (currentMemberRecord) {
        // Use the organizer ID (who booked the current member)
        return currentMemberRecord.bookedByMemberId ?? currentMember.id;
      }

      // Fallback: current member is organizer
      return currentMember.id;
    }

    // Create mode: current member is organizer
    return currentMember.id;
  }, [mode, existingParty, currentMember.id]);

  // Submit booking
  const handleConfirm = async () => {
    // In create mode, must have at least the current member
    // In edit mode, if all existing removed and no pending, error
    const totalPlayers =
      mode === "edit"
        ? (existingParty?.members.length || 0) +
          (existingParty?.guests?.length || 0) +
          pendingAdditions.length
        : 1 + pendingAdditions.length; // Create mode always has current member

    if (totalPlayers === 0) {
      toast.error("Please add at least one player");
      return;
    }

    const displayCount = displayParty.length;
    if (displayCount > availableSlots) {
      toast.error(
        `Only ${availableSlots} slot(s) available in this tee time. Please remove ${displayCount - availableSlots} player(s).`,
      );
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === "edit" && timeBlockId && existingParty) {
        // Process removals first
        for (const removal of pendingRemovals) {
          let result;
          if (removal.type === "member") {
            result = await removeMemberFromParty(
              timeBlockId,
              removal.id,
              currentMember.id,
            );
          } else {
            result = await removeGuestFromParty(
              timeBlockId,
              removal.id,
              currentMember.id,
            );
          }

          if (!result.success) {
            toast.error(result.error || "Failed to remove player");
            setIsSubmitting(false);
            return;
          }
        }

        // Then process additions using organizer ID
        if (pendingAdditions.length > 0) {
          const result = await bookMultiplePlayersAction(
            timeBlockId,
            pendingAdditions as any,
            organizerId, // Use organizer ID, not currentMember.id
          );

          if (!result.success) {
            toast.error(result.error || "Failed to add players");
            setIsSubmitting(false);
            return;
          }
        }

        // Show success message if any changes were made
        if (pendingRemovals.length > 0 || pendingAdditions.length > 0) {
          toast.success("Booking updated successfully");
        }
      } else {
        // Create mode: Submit current member + pending additions
        const allPlayers = [
          {
            type: "member" as const,
            id: currentMember.id,
            firstName: currentMember.firstName,
            lastName: currentMember.lastName,
            memberNumber: currentMember.memberNumber,
          },
          ...pendingAdditions,
        ];
        await onConfirm(allPlayers);
      }

      // Clear pending changes on success
      setPendingAdditions([]);
      setPendingRemovals([]);
      setMemberSearch("");
      setGuestSearch("");

      // Close modal
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset search state when modal closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Clear all modal state on close
      setPendingAdditions([]);
      setPendingRemovals([]);
      setMemberSearch("");
      setGuestSearch("");
      setShowCreateGuest(false);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Edit Tee Time" : "Book Tee Time"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Party */}
          <div className="space-y-2">
            <Label>
              Your Party ({displayParty.length}/{availableSlots} slots available)
            </Label>
            {otherPlayersInTimeBlock > 0 && (
              <p className="text-xs text-gray-500">
                {otherPlayersInTimeBlock} player(s) already in this tee time
              </p>
            )}
            <div className="space-y-2">
              {displayParty.map((player) => {
                const isSelf =
                  player.id === currentMember.id && player.type === "member";
                const canRemove =
                  mode === "create"
                    ? !(
                        player.type === "member" &&
                        (player as PartyMember).isLocked
                      ) // In create mode, can't remove locked player
                    : isBooker || isSelf; // In edit mode, booker can remove anyone, non-booker can only remove self

                return (
                  <div
                    key={`${player.type}-${player.id}`}
                    className="flex items-center justify-between rounded-md border bg-gray-50 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      {isSelf && (
                        <Badge variant="default" className="text-xs">
                          You
                        </Badge>
                      )}
                      <span className="text-sm font-medium">
                        {player.firstName} {player.lastName}
                      </span>
                      {player.type === "member" &&
                        (player as PartyMember).memberNumber && (
                          <Badge variant="secondary" className="text-xs">
                            #{(player as PartyMember).memberNumber}
                          </Badge>
                        )}
                      {player.type === "guest" && (
                        <Badge variant="outline" className="text-xs">
                          Guest
                        </Badge>
                      )}
                      {(player as PartyGuest).isNew && (
                        <Badge variant="default" className="text-xs">
                          New
                        </Badge>
                      )}
                    </div>
                    {canRemove && (
                      <button
                        type="button"
                        onClick={() =>
                          handleRemovePlayer(player.id, player.type)
                        }
                        className="text-red-500 hover:text-red-700"
                        title={isSelf ? "Cancel your booking" : "Remove player"}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add Members Section */}
          {!isFull && (
            <div className="space-y-2">
              <Label>Add Members</Label>
              <div className="relative">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search members..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              {memberSearchQuery.isLoading && (
                <div className="flex items-center justify-center py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              )}
              {filteredMemberResults.length > 0 && (
                <div className="max-h-32 overflow-y-auto rounded-md border">
                  {filteredMemberResults.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => handleAddMember(member)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-100"
                    >
                      <span>
                        {member.firstName} {member.lastName}
                      </span>
                      {member.memberNumber && (
                        <span className="text-gray-500">
                          #{member.memberNumber}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Add Guests Section */}
          {!isFull && !showCreateGuest && (
            <div className="space-y-2">
              <Label>Add Guests</Label>
              <div className="relative">
                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search guests..."
                  value={guestSearch}
                  onChange={(e) => setGuestSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              {guestSearchQuery.isLoading && (
                <div className="flex items-center justify-center py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              )}
              {filteredGuestResults.length > 0 && (
                <div className="max-h-32 overflow-y-auto rounded-md border">
                  {filteredGuestResults.map((guest) => (
                    <button
                      key={guest.id}
                      type="button"
                      onClick={() => handleAddGuest(guest)}
                      className="flex w-full items-center px-3 py-2 text-left text-sm hover:bg-gray-100"
                    >
                      {guest.firstName} {guest.lastName}
                    </button>
                  ))}
                </div>
              )}
              {showCreateGuestOption && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleShowCreateGuest}
                  className="w-full"
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Create Guest "{debouncedGuestSearch}"
                </Button>
              )}
            </div>
          )}

          {/* Create Guest Form */}
          {showCreateGuest && (
            <div className="space-y-3 rounded-md border bg-gray-50 p-4">
              <Label>Create New Guest</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="First Name"
                  value={newGuestFirstName}
                  onChange={(e) => setNewGuestFirstName(e.target.value)}
                  disabled={isCreatingGuest}
                />
                <Input
                  placeholder="Last Name"
                  value={newGuestLastName}
                  onChange={(e) => setNewGuestLastName(e.target.value)}
                  disabled={isCreatingGuest}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCreateGuest}
                  disabled={
                    isCreatingGuest ||
                    !newGuestFirstName.trim() ||
                    !newGuestLastName.trim()
                  }
                >
                  {isCreatingGuest ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create & Add"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateGuest(false)}
                  disabled={isCreatingGuest}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={
              isSubmitting ||
              displayParty.length === 0 ||
              (mode === "edit" &&
                pendingAdditions.length === 0 &&
                pendingRemovals.length === 0)
            }
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {mode === "edit" ? "Saving..." : "Booking..."}
              </>
            ) : mode === "edit" ? (
              "Save Changes"
            ) : (
              `Book for ${displayParty.length} Player${displayParty.length !== 1 ? "s" : ""}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
