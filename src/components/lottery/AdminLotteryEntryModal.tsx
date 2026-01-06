"use client";

import { useState, useMemo, useCallback } from "react";
import { toast } from "react-hot-toast";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDebounce } from "use-debounce";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import {
  Clock,
  Dice1,
  CheckCircle,
  Users,
  X,
  Search,
  UserPlus,
  Loader2,
} from "lucide-react";
import { formatDate } from "~/lib/dates";
import { submitLotteryEntry } from "~/server/lottery/actions";
import { MemberSearchInput } from "~/components/members/MemberSearchInput";
import { guestQueryOptions } from "~/server/query-options";
import { createGuest } from "~/server/guests/actions";
import { calculateDynamicTimeWindows } from "~/lib/lottery-utils";
import type { Teesheet, TeesheetConfigWithBlocks } from "~/server/db/schema";
import {
  lotteryEntryWithFillsSchema,
  type LotteryFormInput,
} from "~/server/db/schema/lottery";

// Types
interface SearchMember {
  id: number;
  firstName: string;
  lastName: string;
  memberNumber: string;
}

interface Guest {
  id: number;
  firstName: string;
  lastName: string;
}

interface AdminLotteryEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teesheet: Teesheet;
  config: TeesheetConfigWithBlocks | null;
  onSuccess?: () => void;
}

export function AdminLotteryEntryModal({
  open,
  onOpenChange,
  teesheet,
  config,
  onSuccess,
}: AdminLotteryEntryModalProps) {
  const queryClient = useQueryClient();

  // Form management with React Hook Form
  const {
    handleSubmit,
    setValue,
    watch,
    setError,
    reset,
    formState: { errors },
  } = useForm<LotteryFormInput>({
    resolver: zodResolver(lotteryEntryWithFillsSchema),
    mode: "onChange",
    defaultValues: {
      organizerId: 0,
      preferredWindow: "",
      alternateWindow: "",
      fills: [],
      memberIds: [],
      lotteryDate: teesheet.date,
    },
  });

  // Display state for member information
  const [selectedMembersDisplay, setSelectedMembersDisplay] = useState<
    SearchMember[]
  >([]);
  const [organizerDisplay, setOrganizerDisplay] = useState<SearchMember | null>(
    null,
  );

  // Guest state - matching BookingPartyModal pattern
  const [selectedGuests, setSelectedGuests] = useState<Guest[]>([]);
  const [guestSearch, setGuestSearch] = useState("");
  const [debouncedGuestSearch] = useDebounce(guestSearch, 300);
  const [showCreateGuest, setShowCreateGuest] = useState(false);
  const [newGuestFirstName, setNewGuestFirstName] = useState("");
  const [newGuestLastName, setNewGuestLastName] = useState("");
  const [isCreatingGuest, setIsCreatingGuest] = useState(false);

  // Guest fills (placeholder slots)
  const [guestFillCount, setGuestFillCount] = useState(0);

  // Derived state from form
  const timeWindows = calculateDynamicTimeWindows(config);
  const isLotteryAvailable = teesheet.lotteryEnabled;
  const organizerId = watch("organizerId");
  const memberIds = watch("memberIds");
  const formFills = watch("fills") || [];
  const preferredWindow = watch("preferredWindow");
  const alternateWindow = watch("alternateWindow");
  const totalPlayers =
    (organizerId ? 1 : 0) +
    memberIds.length +
    selectedGuests.length +
    guestFillCount;

  // Guest search query
  const guestSearchQuery = useQuery({
    ...guestQueryOptions.search(debouncedGuestSearch),
    enabled: debouncedGuestSearch.length >= 2,
  });

  const guestResults = useMemo(() => {
    return guestSearchQuery.data || [];
  }, [guestSearchQuery.data]);

  const showCreateGuestOption =
    debouncedGuestSearch.length >= 2 &&
    !guestSearchQuery.isLoading &&
    guestResults.length === 0;

  const isFull = totalPlayers >= 4;

  // Mutation for submitting lottery entry
  const submitMutation = useMutation({
    mutationFn: async (formData: LotteryFormInput) => {
      return submitLotteryEntry(organizerId, formData);
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Lottery entry created successfully!");
        onSuccess?.();
        handleClose();
      } else {
        toast.error(result.error || "Failed to create lottery entry");
      }
    },
    onError: (error) => {
      console.error(error);
      toast.error("An unexpected error occurred");
    },
  });

  const handleClose = () => {
    reset();
    setOrganizerDisplay(null);
    setSelectedMembersDisplay([]);
    setSelectedGuests([]);
    setGuestFillCount(0);
    setGuestSearch("");
    setShowCreateGuest(false);
    setNewGuestFirstName("");
    setNewGuestLastName("");
    onOpenChange(false);
  };

  const handleOrganizerSelect = (selectedMember: SearchMember | null) => {
    if (!selectedMember) return;

    setValue("organizerId", selectedMember.id);
    setOrganizerDisplay(selectedMember);

    // Remove organizer from additional members if they were added
    const newMemberIds = memberIds.filter((id) => id !== selectedMember.id);
    setValue("memberIds", newMemberIds);
    setSelectedMembersDisplay(
      selectedMembersDisplay.filter((m) => m.id !== selectedMember.id),
    );

    // Reset guests when organizer changes
    setSelectedGuests([]);
    setGuestFillCount(0);
  };

  const handleMemberSelect = (selectedMember: SearchMember | null) => {
    if (!selectedMember) return;

    if (organizerId && selectedMember.id === organizerId) {
      setError("memberIds", {
        message: "This member is already the organizer",
      });
      return;
    }

    if (memberIds.find((id) => id === selectedMember.id)) {
      setError("memberIds", {
        message: "Member already added",
      });
      return;
    }

    if (totalPlayers >= 4) {
      setError("memberIds", {
        message: "Maximum 4 players per group (including organizer)",
      });
      return;
    }

    setValue("memberIds", [...memberIds, selectedMember.id]);
    setSelectedMembersDisplay([...selectedMembersDisplay, selectedMember]);
  };

  const removeMember = (memberId: number) => {
    setValue(
      "memberIds",
      memberIds.filter((id) => id !== memberId),
    );
    setSelectedMembersDisplay(
      selectedMembersDisplay.filter((m) => m.id !== memberId),
    );
  };

  const removeOrganizer = () => {
    setValue("organizerId", 0);
    setOrganizerDisplay(null);
    setSelectedGuests([]);
    setGuestFillCount(0);
  };

  // Guest handlers - matching BookingPartyModal
  const handleAddGuest = useCallback(
    (guest: Guest) => {
      if (isFull) {
        toast.error("Maximum 4 players per group");
        return;
      }

      if (selectedGuests.find((g) => g.id === guest.id)) {
        toast.error("Guest already added");
        return;
      }

      setSelectedGuests((prev) => [...prev, guest]);
      setGuestSearch("");
    },
    [isFull, selectedGuests],
  );

  const handleRemoveGuest = (guestId: number) => {
    setSelectedGuests((prev) => prev.filter((g) => g.id !== guestId));
  };

  const handleAddGuestFill = useCallback(() => {
    if (isFull) {
      toast.error("Maximum 4 players per group");
      return;
    }
    setGuestFillCount((prev) => prev + 1);
  }, [isFull]);

  const handleRemoveGuestFill = () => {
    if (guestFillCount > 0) {
      setGuestFillCount((prev) => prev - 1);
    }
  };

  // Create guest handler
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
        await queryClient.invalidateQueries({ queryKey: ["guests"] });
        setSelectedGuests((prev) => [...prev, result.data!]);
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

  const handleShowCreateGuest = useCallback(() => {
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

  const onSubmit = async (data: LotteryFormInput) => {
    if (!organizerId) {
      setError("organizerId", { message: "Please select an organizer" });
      return;
    }

    // Build fills array from guest fills
    const fills: { fillType: string; customName?: string }[] = [];
    for (let i = 0; i < guestFillCount; i++) {
      fills.push({ fillType: "guest" });
    }

    const formData: LotteryFormInput = {
      organizerId: organizerId,
      lotteryDate: teesheet.date,
      preferredWindow: data.preferredWindow,
      alternateWindow: data.alternateWindow || undefined,
      memberIds: data.memberIds,
      fills: fills.length > 0 ? fills : undefined,
      // Note: Guest IDs would need to be handled by the server action
      // For now, we're passing fills as guest placeholders
    };

    await submitMutation.mutateAsync(formData);
  };

  if (!isLotteryAvailable || timeWindows.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lottery Not Available</DialogTitle>
            <DialogDescription>
              {formatDate(teesheet.date, "EEEE, MMMM do")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-center">
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <div className="mb-2 font-medium text-yellow-800">
                Custom Teesheet Configuration
              </div>
              <p className="text-sm text-yellow-700">
                This date uses a custom teesheet configuration. Lottery entries
                are only available for regular scheduled dates.
              </p>
            </div>
            <Button variant="outline" onClick={handleClose} className="w-full">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dice1 className="h-5 w-5" />
            Create Lottery Entry
          </DialogTitle>
          <DialogDescription>
            {formatDate(teesheet.date, "EEEE, MMMM do")}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col overflow-hidden"
        >
          <div className="space-y-6 overflow-y-auto px-6">
            {/* Organizer Selection */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <h3 className="font-medium">Entry Organizer</h3>
              </div>

              {!organizerDisplay ? (
                <div className="space-y-2">
                  <div className="text-sm text-gray-600">
                    Select the member who will organize this entry:
                  </div>
                  <MemberSearchInput
                    onSelect={handleOrganizerSelect}
                    placeholder="Search for organizer..."
                  />
                </div>
              ) : (
                <div className="border-org-primary/20 bg-org-primary/5 flex items-center gap-3 rounded-lg border p-3">
                  <div className="bg-org-primary/20 flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium">
                    {organizerDisplay.firstName[0]}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">
                      {organizerDisplay.firstName} {organizerDisplay.lastName}
                    </div>
                    <div className="text-sm text-gray-500">
                      Organizer • #{organizerDisplay.memberNumber}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={removeOrganizer}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Additional Players Section */}
            {!!organizerId && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <h3 className="font-medium">Additional Players</h3>
                  <Badge variant="outline" className="ml-auto">
                    {totalPlayers} player{totalPlayers !== 1 ? "s" : ""}
                  </Badge>
                </div>

                {/* Add Member Search - Show only if space available */}
                {!isFull && (
                  <div className="space-y-2">
                    <div className="text-sm text-gray-600">
                      Add additional members (optional):
                    </div>
                    <MemberSearchInput
                      onSelect={handleMemberSelect}
                      placeholder="Search for members to add..."
                    />
                    {errors.memberIds && (
                      <p className="text-sm text-red-600">
                        {errors.memberIds.message}
                      </p>
                    )}
                  </div>
                )}

                {/* Display all players (members, guests, fills) */}
                <div className="space-y-2">
                  {/* Members */}
                  {selectedMembersDisplay.map((selectedMember) => (
                    <div
                      key={selectedMember.id}
                      className="flex items-center gap-3 rounded-lg border px-3 py-2"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-medium">
                        {selectedMember.firstName[0]}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">
                          {selectedMember.firstName} {selectedMember.lastName}
                        </div>
                        <div className="text-sm text-gray-500">
                          #{selectedMember.memberNumber}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMember(selectedMember.id)}
                        className="h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  {/* Guests */}
                  {selectedGuests.map((guest) => (
                    <div
                      key={guest.id}
                      className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700">
                        {guest.firstName[0]}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">
                          {guest.firstName} {guest.lastName}
                        </div>
                        <div className="text-sm text-blue-600">Guest</div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveGuest(guest.id)}
                        className="h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  {/* Guest Fills */}
                  {Array.from({ length: guestFillCount }).map((_, index) => (
                    <div
                      key={`fill-${index}`}
                      className="flex items-center gap-3 rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2"
                    >
                      <Badge
                        variant="outline"
                        className="border-amber-400 text-amber-700"
                      >
                        Guest Fill
                      </Badge>
                      <div className="flex-1 text-sm text-amber-600">
                        Placeholder for guest
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveGuestFill}
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Add Guests Section */}
                {!isFull && !showCreateGuest && (
                  <div className="space-y-3 border-t pt-4">
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
                    {guestResults.length > 0 && (
                      <div className="max-h-32 overflow-y-auto rounded-md border">
                        {guestResults.map((guest) => {
                          const isAlreadyAdded = selectedGuests.some(
                            (g) => g.id === guest.id,
                          );
                          return (
                            <button
                              key={guest.id}
                              type="button"
                              onClick={() =>
                                !isAlreadyAdded && handleAddGuest(guest)
                              }
                              disabled={isAlreadyAdded}
                              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                                isAlreadyAdded
                                  ? "cursor-default bg-green-50 text-green-700"
                                  : "hover:bg-gray-100"
                              }`}
                            >
                              <span>
                                {guest.firstName} {guest.lastName}
                              </span>
                              {isAlreadyAdded && (
                                <Badge
                                  variant="secondary"
                                  className="bg-green-100 text-xs text-green-800"
                                >
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
                      className="w-full border-dashed border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-black"
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
            )}

            {!!organizerId && <Separator />}

            {/* Time Preferences */}
            {!!organizerId && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <Clock className="h-4 w-4" />
                    Preferred Time Window
                  </div>
                  <p className="text-muted-foreground text-sm">
                    Choose the preferred part of the day
                  </p>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
                    {timeWindows.map((window) => (
                      <div
                        key={window.index}
                        className={`cursor-pointer rounded-lg border-2 p-3 transition-all ${
                          preferredWindow === window.index.toString()
                            ? "border-org-primary bg-org-primary/5"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                        onClick={() =>
                          setValue("preferredWindow", window.index.toString())
                        }
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{window.icon}</span>
                            <div className="text-sm font-medium">
                              {window.timeRange}
                            </div>
                          </div>
                          <div className="text-xs text-gray-500">
                            {window.description}
                          </div>
                          {preferredWindow === window.index.toString() && (
                            <CheckCircle className="text-org-primary h-4 w-4 self-end" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Backup Window */}
                {preferredWindow && (
                  <div className="space-y-2">
                    <div className="font-medium">Backup Window (Optional)</div>
                    <p className="text-muted-foreground text-sm">
                      Alternative if preferred time isn't available
                    </p>
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
                      {timeWindows
                        .filter((w) => w.index.toString() !== preferredWindow)
                        .map((window) => (
                          <div
                            key={window.index}
                            className={`cursor-pointer rounded-lg border p-2 transition-all ${
                              alternateWindow === window.index.toString()
                                ? "border-org-primary bg-org-primary/5"
                                : "border-gray-200 hover:border-gray-300"
                            }`}
                            onClick={() =>
                              setValue(
                                "alternateWindow",
                                alternateWindow === window.index.toString()
                                  ? ""
                                  : window.index.toString(),
                              )
                            }
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span>{window.icon}</span>
                                <span className="text-sm font-medium">
                                  {window.timeRange}
                                </span>
                              </div>
                              {alternateWindow === window.index.toString() && (
                                <CheckCircle className="text-org-primary h-4 w-4" />
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <Separator />
          </div>

          <DialogFooter className="flex gap-3 pt-6">
            <Button
              type="submit"
              disabled={
                submitMutation.isPending || !organizerId || !preferredWindow
              }
              className="bg-org-primary hover:bg-org-primary/90 flex-1"
              size="lg"
            >
              {submitMutation.isPending ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Creating...
                </>
              ) : (
                <>
                  <Dice1 className="mr-2 h-4 w-4" />
                  Create Entry
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={handleClose}
              disabled={submitMutation.isPending}
              size="lg"
            >
              Cancel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
