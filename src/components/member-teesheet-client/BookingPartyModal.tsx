"use client";

import { useState, useCallback, useMemo } from "react";
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
import { Loader2, Search, UserPlus, X } from "lucide-react";
import toast from "react-hot-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { memberQueryOptions, guestQueryOptions } from "~/server/query-options";
import { createGuest } from "~/server/guests/actions";
import {
  bookMultiplePlayersAction,
  removeMemberFromParty,
  removeGuestFromParty,
  addGuestFillAction,
  removeGuestFillAction,
} from "~/server/members-teesheet-client/actions";
import { checkTimeblockRestrictionsAction } from "~/server/timeblock-restrictions/actions";

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

type PartyFill = {
  type: "fill";
  tempId: string; // Client-side ID until saved
  fillId?: number; // Server ID if already saved
};

type PartyPlayer = PartyMember | PartyGuest;
type DisplayPlayer = PartyPlayer | PartyFill;

interface BookingPartyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentMember: {
    id: number;
    firstName: string;
    lastName: string;
    memberNumber?: string;
    classId?: number | null;
  };
  maxPlayers: number;
  timeBlockCurrentCapacity?: number; // Total players already in timeblock (not just your party)
  onConfirm: (players: PartyPlayer[], fillCount?: number) => Promise<void>;
  mode?: "create" | "edit";
  timeBlockId?: number;
  teesheetDate?: string; // Required for restriction checking (YYYY-MM-DD format)
  existingParty?: {
    members: Array<{
      id: number;
      firstName: string;
      lastName: string;
      memberNumber?: string;
      bookedByMemberId?: number | null;
      classId?: number | null;
    }>;
    guests?: Array<{
      id: number;
      firstName: string;
      lastName: string;
      invitedByMemberId?: number;
    }>;
    fills?: Array<{
      id: number;
      fillType: string;
      addedByMemberId?: number | null;
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
  teesheetDate,
  existingParty,
}: BookingPartyModalProps) {
  const queryClient = useQueryClient();

  // Track pending changes (not yet submitted)
  const [pendingAdditions, setPendingAdditions] = useState<PartyPlayer[]>([]);
  const [pendingRemovals, setPendingRemovals] = useState<
    Array<{ id: number; type: string }>
  >([]);
  const [pendingFills, setPendingFills] = useState<PartyFill[]>([]);
  const [pendingFillRemovals, setPendingFillRemovals] = useState<number[]>([]); // fillIds to remove
  const [restrictionErrors, setRestrictionErrors] = useState<Map<number, string>>(new Map());
  const [checkingRestriction, setCheckingRestriction] = useState<number | null>(null);

  // Compute display party from source of truth (existingParty) - pending removals + pending additions
  const displayParty = useMemo((): DisplayPlayer[] => {
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

      // Include existing fills (not pending removal) + pending fills
      const existingFills: PartyFill[] = (existingParty.fills || [])
        .filter((f) => f.fillType === "guest_fill" && !pendingFillRemovals.includes(f.id))
        .map((f) => ({
          type: "fill" as const,
          tempId: `existing-${f.id}`,
          fillId: f.id,
        }));

      return [...members, ...guests, ...pendingAdditions, ...existingFills, ...pendingFills];
    } else {
      // Create mode: Current member (locked) + pending additions + pending fills
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
        ...pendingFills,
      ];
    }
  }, [mode, existingParty, pendingAdditions, pendingRemovals, pendingFills, pendingFillRemovals, currentMember]);

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

  // Frequent guests query (buddy system)
  const frequentGuestsQuery = useQuery({
    ...guestQueryOptions.frequentGuests(currentMember.id),
    enabled: open, // Only fetch when modal is open
  });

  const isFull = displayParty.length >= availableSlots;

  // Get all party member IDs for marking as "Added"
  const partyMemberIds = useMemo(() => {
    return displayParty
      .filter((p) => p.type === "member")
      .map((p) => p.id);
  }, [displayParty]);

  // Don't filter out added members - we'll show them with "Added" badge
  const memberResults = useMemo(() => {
    return memberSearchQuery.data || [];
  }, [memberSearchQuery.data]);

  // Get all party guest IDs for marking as "Added"
  const partyGuestIds = useMemo(() => {
    return displayParty
      .filter((p) => p.type === "guest")
      .map((p) => p.id);
  }, [displayParty]);

  // Don't filter out added guests - we'll show them with "Added" badge
  const guestResults = useMemo(() => {
    return guestSearchQuery.data || [];
  }, [guestSearchQuery.data]);

  // Show create guest option only when there are truly no database results
  const showCreateGuestOption =
    debouncedGuestSearch.length >= 2 &&
    !guestSearchQuery.isLoading &&
    guestResults.length === 0;

  // Check restrictions for a member before adding
  const checkMemberRestrictions = useCallback(
    async (memberId: number, memberClassId: number | null | undefined) => {
      if (!timeBlockId || !teesheetDate) return null;

      setCheckingRestriction(memberId);
      try {
        const result = await checkTimeblockRestrictionsAction({
          memberId,
          memberClassId: memberClassId ?? undefined,
          bookingDateString: teesheetDate,
          bookingTime: "", // We don't have the exact time, but TIME restrictions mainly use date
        });

        if ("hasViolations" in result && result.hasViolations) {
          // Check for TIME violations (blocking)
          const timeViolation = result.violations.find(
            (v: { type: string }) => v.type === "TIME",
          );
          if (timeViolation) {
            return timeViolation.message || "Cannot book this time slot due to restrictions";
          }
        }
        return null;
      } catch (error) {
        console.error("Error checking restrictions:", error);
        return null;
      } finally {
        setCheckingRestriction(null);
      }
    },
    [timeBlockId, teesheetDate],
  );

  // Add member to party (with restriction check)
  const handleAddMember = useCallback(
    async (member: (typeof memberResults)[0]) => {
      if (isFull) {
        toast.error(
          `No slots available in this tee time (${availableSlots} max for your party)`,
          { position: "top-center" },
        );
        return;
      }

      // Check restrictions for this member
      const restrictionError = await checkMemberRestrictions(
        member.id,
        member.classId,
      );

      if (restrictionError) {
        setRestrictionErrors((prev) => new Map(prev).set(member.id, restrictionError));
        toast.error(`${member.firstName} ${member.lastName}: ${restrictionError}`, {
          position: "top-center",
        });
        return;
      }

      // Clear any previous error for this member
      setRestrictionErrors((prev) => {
        const next = new Map(prev);
        next.delete(member.id);
        return next;
      });

      // Check if this member was previously removed (in pendingRemovals)
      const wasRemoved = pendingRemovals.some(
        (r) => r.id === member.id && r.type === "member",
      );

      if (wasRemoved) {
        // Remove from pendingRemovals instead of adding to pendingAdditions
        setPendingRemovals((prev) =>
          prev.filter((r) => !(r.id === member.id && r.type === "member")),
        );
      } else {
        // Add to pending additions
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
      }
      setMemberSearch("");
    },
    [isFull, availableSlots, checkMemberRestrictions, pendingRemovals],
  );

  // Add guest to party
  const handleAddGuest = useCallback(
    (guest: { id: number; firstName: string; lastName: string }) => {
      if (isFull) {
        toast.error(
          `No slots available in this tee time (${availableSlots} max for your party)`,
          { position: "top-center" },
        );
        return;
      }

      // Check if this guest was previously removed (in pendingRemovals)
      const wasRemoved = pendingRemovals.some(
        (r) => r.id === guest.id && r.type === "guest",
      );

      if (wasRemoved) {
        // Remove from pendingRemovals instead of adding to pendingAdditions
        setPendingRemovals((prev) =>
          prev.filter((r) => !(r.id === guest.id && r.type === "guest")),
        );
      } else {
        // Add to pending additions
        setPendingAdditions((prev) => [
          ...prev,
          {
            type: "guest",
            id: guest.id,
            firstName: guest.firstName,
            lastName: guest.lastName,
          },
        ]);
      }
      setGuestSearch("");
    },
    [isFull, availableSlots, pendingRemovals],
  );

  // Add guest fill placeholder
  const handleAddGuestFill = useCallback(() => {
    if (isFull) {
      toast.error(
        `No slots available in this tee time (${availableSlots} max for your party)`,
        { position: "top-center" },
      );
      return;
    }

    const tempId = `fill-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    setPendingFills((prev) => [...prev, { type: "fill", tempId }]);
  }, [isFull, availableSlots]);

  // Remove guest fill
  const handleRemoveFill = useCallback((fill: PartyFill) => {
    if (fill.fillId) {
      // Existing fill - mark for removal
      setPendingFillRemovals((prev) => [...prev, fill.fillId!]);
    } else {
      // Pending fill - remove from pending
      setPendingFills((prev) => prev.filter((f) => f.tempId !== fill.tempId));
    }
  }, []);

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

        // Process fill removals
        for (const fillId of pendingFillRemovals) {
          const result = await removeGuestFillAction(
            fillId,
            currentMember.id,
            timeBlockId,
          );
          if (!result.success) {
            toast.error(result.error || "Failed to remove guest fill", {
              position: "top-center",
            });
            setIsSubmitting(false);
            return;
          }
        }

        // Process fill additions
        for (const fill of pendingFills) {
          const result = await addGuestFillAction(timeBlockId, currentMember.id);
          if (!result.success) {
            toast.error(result.error || "Failed to add guest fill", {
              position: "top-center",
            });
            setIsSubmitting(false);
            return;
          }
        }

        // Show success message if any changes were made
        const hasChanges =
          pendingRemovals.length > 0 ||
          pendingAdditions.length > 0 ||
          pendingFillRemovals.length > 0 ||
          pendingFills.length > 0;
        if (hasChanges) {
          toast.success("Booking updated successfully", { position: "top-center" });
        }
      } else {
        // Create mode: Submit current member + pending additions + fill count
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
        // Pass fill count to parent - parent will add fills after booking
        await onConfirm(allPlayers, pendingFills.length);
      }

      // Clear pending changes on success
      setPendingAdditions([]);
      setPendingRemovals([]);
      setPendingFills([]);
      setPendingFillRemovals([]);
      setRestrictionErrors(new Map());
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
      setPendingFills([]);
      setPendingFillRemovals([]);
      setRestrictionErrors(new Map());
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
              Your Party ({displayParty.length} of {availableSlots} spots)
            </Label>
            {otherPlayersInTimeBlock > 0 && (
              <p className="text-xs text-gray-500">
                {otherPlayersInTimeBlock} other player(s) in this tee time
              </p>
            )}
            <div className="space-y-2">
              {displayParty.map((player) => {
                // Handle fill type separately
                if (player.type === "fill") {
                  const fill = player as PartyFill;
                  return (
                    <div
                      key={fill.tempId}
                      className="flex items-center justify-between rounded-md border border-dashed border-amber-300 bg-amber-50 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="border-amber-400  text-xs text-amber-700">
                          Guest Fill
                        </Badge>
                     
                      </div>
                      {isBooker && (
                        <button
                          type="button"
                          onClick={() => handleRemoveFill(fill)}
                          className="text-red-500 hover:text-red-700"
                          title="Remove guest fill"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  );
                }

                // Member or Guest
                const isSelf =
                  player.type === "member" && player.id === currentMember.id;
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
              {memberResults.length > 0 && (
                <div className="max-h-32 overflow-y-auto rounded-md border">
                  {memberResults.map((member) => {
                    const isAlreadyAdded = partyMemberIds.includes(member.id);
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => !isAlreadyAdded && handleAddMember(member)}
                        disabled={isAlreadyAdded}
                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                          isAlreadyAdded
                            ? "cursor-default bg-green-50 text-green-700"
                            : "hover:bg-gray-100"
                        }`}
                      >
                        <span>
                          {member.firstName} {member.lastName}
                        </span>
                        <div className="flex items-center gap-2">
                          {member.memberNumber && !isAlreadyAdded && (
                            <span className="text-gray-500">
                              #{member.memberNumber}
                            </span>
                          )}
                          {isAlreadyAdded && (
                            <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                              Added
                            </Badge>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {debouncedMemberSearch.length >= 2 &&
                !memberSearchQuery.isLoading &&
                memberResults.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-2">
                    No members found matching &quot;{debouncedMemberSearch}&quot;
                  </p>
                )}
            </div>
          )}

          {/* Add Guests Section */}
          {!isFull && !showCreateGuest && (
            <div className="space-y-3">
              <Label>Add Guests</Label>

              {/* Buddy System - Frequent Guests */}
              {frequentGuestsQuery.data && frequentGuestsQuery.data.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Players you&apos;ve played with before
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {frequentGuestsQuery.data
                      .filter(
                        (item) =>
                          !displayParty.some(
                            (p) => p.type === "guest" && p.id === item.guest.id,
                          ),
                      )
                      .slice(0, 5)
                      .map((item) => (
                        <Button
                          key={item.guest.id}
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddGuest(item.guest)}
                          className="rounded-full"
                        >
                          {item.guest.firstName} {item.guest.lastName}
                        </Button>
                      ))}
                  </div>
                </div>
              )}

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
              {guestResults.length > 0 && (
                <div className="max-h-32 overflow-y-auto rounded-md border">
                  {guestResults.map((guest) => {
                    const isAlreadyAdded = partyGuestIds.includes(guest.id);
                    return (
                      <button
                        key={guest.id}
                        type="button"
                        onClick={() => !isAlreadyAdded && handleAddGuest(guest)}
                        disabled={isAlreadyAdded}
                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                          isAlreadyAdded
                            ? "cursor-default bg-green-50 text-green-700"
                            : "hover:bg-gray-100"
                        }`}
                      >
                        <span>{guest.firstName} {guest.lastName}</span>
                        {isAlreadyAdded && (
                          <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                            Added
                          </Badge>
                        )}
                      </button>
                    );
                  })}
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
                  Create Guest &quot;{debouncedGuestSearch}&quot;
                </Button>
              )}

              {/* Guest Fill Button */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddGuestFill}
                className="w-full border-dashed border-amber-300 hover:text-black text-amber-700 hover:bg-amber-50"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Guest Fill 
              </Button>
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
              // Create mode: need at least 1 player
              (mode === "create" && displayParty.length === 0) ||
              // Edit mode: need at least one pending change
              (mode === "edit" &&
                pendingAdditions.length === 0 &&
                pendingRemovals.length === 0 &&
                pendingFills.length === 0 &&
                pendingFillRemovals.length === 0)
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
