"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "react-hot-toast";
import { useDebounce } from "use-debounce";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import {
  Clock,
  Dice1,
  CheckCircle,
  Users,
  X,
  UserPlus,
  Search,
  Loader2,
  Flame,
  Leaf,
} from "lucide-react";
import { formatDate } from "~/lib/dates";
import {
  submitLotteryEntry,
  getLotteryWindowPopularity,
} from "~/server/lottery/actions";
import { MemberSearchInput } from "~/components/members/MemberSearchInput";
import { calculateDynamicTimeWindows } from "~/lib/lottery-utils";
import { checkLotteryTimeWindowRestrictions } from "~/server/timeblock-restrictions/actions";
import { createGuest } from "~/server/guests/actions";
import { guestQueryOptions } from "~/server/query-options";
import {
  TeesheetConfigWithBlocks,
  type LotteryEntry,
} from "~/server/db/schema";
import { type LotteryFormInput } from "~/server/db/schema/lottery";

// Member type for client-side usage
type ClientMember = {
  id: number;
  classId: number;
  firstName: string;
  lastName: string;
  memberClass?: { id: number; label: string } | null;
  [key: string]: any;
};

// For the member search results
interface SearchMember {
  id: number;
  firstName: string;
  lastName: string;
  memberNumber: string;
  classId?: number;
}

// Guest type
interface SearchGuest {
  id: number;
  firstName: string;
  lastName: string;
}

// Guest fill placeholder
interface GuestFill {
  tempId: string;
}

const lotteryEntrySchema = z.object({
  preferredWindow: z.string().min(1, "Please select a preferred time window"),
  alternateWindow: z.string().optional(),
  memberIds: z.array(z.number()).optional(),
  guestIds: z.array(z.number()).optional(),
  guestFillCount: z.number().optional(),
});

type FormData = z.infer<typeof lotteryEntrySchema>;

interface LotteryEntryFormProps {
  lotteryDate: string;
  member: ClientMember;
  config: TeesheetConfigWithBlocks;
  existingEntry?: LotteryEntry | null;
  onSuccess?: () => void;
  initialWindowRestrictions?: Array<{
    windowIndex: number;
    isFullyRestricted: boolean;
    reasons: string[];
  }>;
}

export function MemberLotteryEntryForm({
  lotteryDate,
  member,
  config,
  existingEntry,
  onSuccess,
  initialWindowRestrictions = [],
}: LotteryEntryFormProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<SearchMember[]>([]);
  const [selectedGuests, setSelectedGuests] = useState<SearchGuest[]>([]);
  const [guestFills, setGuestFills] = useState<GuestFill[]>([]);

  // Guest search state
  const [guestSearch, setGuestSearch] = useState("");
  const [debouncedGuestSearch] = useDebounce(guestSearch, 300);
  const [showCreateGuest, setShowCreateGuest] = useState(false);
  const [newGuestFirstName, setNewGuestFirstName] = useState("");
  const [newGuestLastName, setNewGuestLastName] = useState("");
  const [isCreatingGuest, setIsCreatingGuest] = useState(false);

  // Window restrictions state - initialize from server-provided data
  const [windowRestrictions, setWindowRestrictions] = useState<
    Map<number, { isFullyRestricted: boolean; reasons: string[] }>
  >(() => {
    const initial = new Map<
      number,
      { isFullyRestricted: boolean; reasons: string[] }
    >();
    initialWindowRestrictions.forEach((r) => {
      initial.set(r.windowIndex, {
        isFullyRestricted: r.isFullyRestricted,
        reasons: r.reasons,
      });
    });
    return initial;
  });
  const [isCheckingRestrictions, setIsCheckingRestrictions] = useState(false);

  // Window popularity state
  const [windowPopularity, setWindowPopularity] = useState<
    Map<number, { count: number; demandLevel: "high" | "regular" | "low" }>
  >(new Map());

  // Fetch window popularity on mount
  useEffect(() => {
    async function fetchPopularity() {
      try {
        const result = await getLotteryWindowPopularity(lotteryDate);
        if (result.success && result.data) {
          const map = new Map<
            number,
            { count: number; demandLevel: "high" | "regular" | "low" }
          >();
          result.data.forEach((item) => {
            map.set(item.windowIndex, {
              count: item.count,
              demandLevel: item.demandLevel,
            });
          });
          setWindowPopularity(map);
        }
      } catch (error) {
        console.error("Error fetching window popularity:", error);
      }
    }
    fetchPopularity();
  }, [lotteryDate]);

  // Calculate dynamic time windows based on config
  const timeWindows = calculateDynamicTimeWindows(config);
  const isLotteryAvailable = true;

  const form = useForm<FormData>({
    resolver: zodResolver(lotteryEntrySchema),
    defaultValues: {
      preferredWindow: existingEntry?.preferredWindow || "",
      alternateWindow: existingEntry?.alternateWindow || "",
      memberIds: [],
      guestIds: [],
      guestFillCount: 0,
    },
  });

  const isEditing = !!existingEntry;
  const selectedWindow = form.watch("preferredWindow");
  const alternateWindow = form.watch("alternateWindow");

  // Guest search query
  const guestSearchQuery = useQuery({
    ...guestQueryOptions.search(debouncedGuestSearch),
    enabled: debouncedGuestSearch.length >= 2,
  });

  // Calculate total party size
  const totalPlayers =
    1 + selectedMembers.length + selectedGuests.length + guestFills.length;
  const canAddMore = totalPlayers < 4;

  // Check if party has guests or guest fills
  const hasGuestsOrGuestFills =
    selectedGuests.length > 0 || guestFills.length > 0;

  // Get all member class IDs in party (for restriction checking)
  const partyMemberClassIds = useMemo(() => {
    const classIds = [member.classId];
    selectedMembers.forEach((m) => {
      if (m.classId) classIds.push(m.classId);
    });
    return classIds;
  }, [member.classId, selectedMembers]);

  // Check restrictions when party composition changes
  // Accepts optional hasGuestsOverride to handle async state updates
  const checkRestrictions = useCallback(
    async (hasGuestsOverride?: boolean) => {
      if (timeWindows.length === 0) return;

      // Use override if provided, otherwise use current state
      const hasGuests =
        hasGuestsOverride !== undefined
          ? hasGuestsOverride
          : hasGuestsOrGuestFills;

      setIsCheckingRestrictions(true);
      try {
        const result = await checkLotteryTimeWindowRestrictions({
          lotteryDate,
          memberClassIds: partyMemberClassIds,
          hasGuestsOrGuestFills: hasGuests,
          timeWindows: timeWindows.map((w) => ({
            index: w.index,
            // Convert minutes to HH:MM format
            startTime: `${String(Math.floor(w.startMinutes / 60)).padStart(2, "0")}:${String(w.startMinutes % 60).padStart(2, "0")}`,
            endTime: `${String(Math.floor(w.endMinutes / 60)).padStart(2, "0")}:${String(w.endMinutes % 60).padStart(2, "0")}`,
          })),
        });

        if (result.success) {
          const newRestrictions = new Map<
            number,
            { isFullyRestricted: boolean; reasons: string[] }
          >();
          result.restrictions.forEach((r) => {
            newRestrictions.set(r.windowIndex, {
              isFullyRestricted: r.isFullyRestricted,
              reasons: r.reasons,
            });
          });
          setWindowRestrictions(newRestrictions);
        }
      } catch (error) {
        console.error("Error checking restrictions:", error);
      } finally {
        setIsCheckingRestrictions(false);
      }
    },
    [lotteryDate, partyMemberClassIds, hasGuestsOrGuestFills, timeWindows],
  );

  // No need for useEffect - initial restrictions come from server props

  const handleMemberSelect = (selectedMember: SearchMember | null) => {
    if (!selectedMember) return;

    if (selectedMember.id === member.id) {
      toast.error("You're already included in the entry", {
        position: "top-center",
      });
      return;
    }

    if (selectedMembers.find((m) => m.id === selectedMember.id)) {
      toast.error("Member already added", { position: "top-center" });
      return;
    }

    if (!canAddMore) {
      toast.error("Maximum 4 players per group", { position: "top-center" });
      return;
    }

    setSelectedMembers([...selectedMembers, selectedMember]);
    form.setValue("memberIds", [
      ...selectedMembers.map((m) => m.id),
      selectedMember.id,
    ]);
    // Re-check restrictions after adding member
    checkRestrictions();
  };

  const removeMember = (memberId: number) => {
    const newMembers = selectedMembers.filter((m) => m.id !== memberId);
    setSelectedMembers(newMembers);
    form.setValue(
      "memberIds",
      newMembers.map((m) => m.id),
    );
    // Re-check restrictions after removing member
    checkRestrictions();
  };

  const handleAddGuest = (guest: SearchGuest) => {
    if (!canAddMore) {
      toast.error("Maximum 4 players per group", { position: "top-center" });
      return;
    }
    if (selectedGuests.find((g) => g.id === guest.id)) {
      toast.error("Guest already added", { position: "top-center" });
      return;
    }
    setSelectedGuests([...selectedGuests, guest]);
    setGuestSearch("");
    // Re-check restrictions after adding guest - pass true since we now have guests
    checkRestrictions(true);
  };

  const removeGuest = (guestId: number) => {
    const newGuests = selectedGuests.filter((g) => g.id !== guestId);
    setSelectedGuests(newGuests);
    // Re-check restrictions - pass whether we still have guests or fills
    checkRestrictions(newGuests.length > 0 || guestFills.length > 0);
  };

  const handleAddGuestFill = () => {
    if (!canAddMore) {
      toast.error("Maximum 4 players per group", { position: "top-center" });
      return;
    }
    const tempId = `fill-${Date.now()}`;
    setGuestFills([...guestFills, { tempId }]);
    // Re-check restrictions after adding guest fill - pass true since we now have fills
    checkRestrictions(true);
  };

  const removeGuestFill = (tempId: string) => {
    const newFills = guestFills.filter((f) => f.tempId !== tempId);
    setGuestFills(newFills);
    // Re-check restrictions - pass whether we still have guests or fills
    checkRestrictions(selectedGuests.length > 0 || newFills.length > 0);
  };

  const handleCreateGuest = async () => {
    if (!newGuestFirstName.trim() || !newGuestLastName.trim()) {
      toast.error("Please enter first and last name", {
        position: "top-center",
      });
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
        handleAddGuest({
          id: result.data.id,
          firstName: result.data.firstName,
          lastName: result.data.lastName,
        });
        toast.success("Guest created and added", { position: "top-center" });
        setShowCreateGuest(false);
        setNewGuestFirstName("");
        setNewGuestLastName("");
      } else {
        toast.error(result.error || "Failed to create guest", {
          position: "top-center",
        });
      }
    } catch (error) {
      toast.error("Failed to create guest", { position: "top-center" });
    } finally {
      setIsCreatingGuest(false);
    }
  };

  const handleWindowClick = (
    windowIndex: number,
    onChange: (value: string) => void,
  ) => {
    const restriction = windowRestrictions.get(windowIndex);
    if (restriction?.isFullyRestricted) {
      toast.error(
        `This time window is restricted: ${restriction.reasons.join(", ")}`,
        { position: "top-center" },
      );
      return;
    }
    onChange(windowIndex.toString());
  };

  const onSubmit = async (data: FormData) => {
    // Check if selected window is restricted
    const selectedIdx = parseInt(data.preferredWindow, 10);
    const restriction = windowRestrictions.get(selectedIdx);
    if (restriction?.isFullyRestricted) {
      toast.error("Selected time window is restricted", {
        position: "top-center",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const formData: LotteryFormInput = {
        organizerId: member.id,
        lotteryDate,
        preferredWindow: data.preferredWindow,
        alternateWindow: data.alternateWindow || undefined,
        memberIds: [member.id, ...selectedMembers.map((m) => m.id)],
        guestIds: selectedGuests.map((g) => g.id),
        guestFillCount: guestFills.length,
      };

      const result = await submitLotteryEntry(member.id, formData);

      if (result.success) {
        toast.success(
          isEditing
            ? "Lottery entry updated successfully!"
            : "Lottery entry submitted successfully!",
          { position: "top-center" },
        );
        onSuccess?.();
      } else {
        toast.error(result.error || "Failed to submit lottery entry", {
          position: "top-center",
        });
      }
    } catch (error) {
      toast.error("An unexpected error occurred", { position: "top-center" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show message if lottery is not available for this config
  if (!isLotteryAvailable || timeWindows.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100">
              <Dice1 className="h-6 w-6 text-gray-600" />
            </div>
            <div>
              <CardTitle className="text-xl">Lottery Not Available</CardTitle>
              <CardDescription>
                {formatDate(lotteryDate, "EEEE, MMMM do")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <div className="mb-2 font-medium text-yellow-800">
              Custom Teesheet Configuration
            </div>
            <p className="text-sm text-yellow-700">
              This date uses a custom teesheet configuration. Lottery entries
              are only available for regular scheduled dates.
            </p>
          </div>
          <Button variant="outline" onClick={onSuccess} className="w-full">
            Back to Teesheet
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="w-full">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="bg-org-primary/10 flex h-12 w-12 items-center justify-center rounded-lg">
              <Dice1 className="text-org-primary h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl">
                {isEditing ? "Edit Lottery Entry" : "Submit Lottery Entry"}
              </CardTitle>
              <CardDescription>
                {formatDate(lotteryDate, "EEEE, MMMM do")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Players Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <h3 className="font-medium">Players</h3>
                  <Badge variant="outline" className="ml-auto">
                    {totalPlayers} player{totalPlayers !== 1 ? "s" : ""}
                  </Badge>
                </div>

                {/* Current User */}
                <div className="border-org-primary/20 bg-org-primary/5 flex items-center gap-3 rounded-lg border p-3">
                  <div className="bg-org-primary/20 flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium">
                    {member.firstName[0]}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">
                      {member.firstName} {member.lastName}
                    </div>
                    <div className="text-sm text-gray-500">You (organizer)</div>
                  </div>
                </div>

                {/* Selected Members */}
                {selectedMembers.map((selectedMember) => (
                  <div
                    key={`member-${selectedMember.id}`}
                    className="flex items-center gap-3 rounded-lg border p-3"
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

                {/* Selected Guests */}
                {selectedGuests.map((guest) => (
                  <div
                    key={`guest-${guest.id}`}
                    className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-medium">
                      {guest.firstName[0]}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">
                        {guest.firstName} {guest.lastName}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        Guest
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeGuest(guest.id)}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                {/* Guest Fills */}
                {guestFills.map((fill) => (
                  <div
                    key={fill.tempId}
                    className="flex items-center gap-3 rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-sm font-medium">
                      ?
                    </div>
                    <div className="flex-1">
                      <Badge
                        variant="outline"
                        className="border-amber-400 text-xs text-amber-700"
                      >
                        Guest Fill
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeGuestFill(fill.tempId)}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                {/* Add Players Section */}
                {canAddMore && (
                  <div className="space-y-3">
                    <div className="text-sm text-gray-600">Add players:</div>

                    {/* Member Search */}
                    <MemberSearchInput
                      onSelect={handleMemberSelect}
                      placeholder="Search for members..."
                    />

                    {/* Guest Search */}
                    <div className="relative">
                      <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <Input
                        placeholder="Search for guests..."
                        value={guestSearch}
                        onChange={(e) => setGuestSearch(e.target.value)}
                        className="pl-10"
                      />
                    </div>

                    {/* Guest Search Results */}
                    {debouncedGuestSearch.length >= 2 && (
                      <div className="rounded-lg border bg-white shadow-sm">
                        {guestSearchQuery.isLoading ? (
                          <div className="flex items-center justify-center p-3">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        ) : guestSearchQuery.data?.length ? (
                          <div className="max-h-40 overflow-y-auto">
                            {guestSearchQuery.data.map((guest: any) => (
                              <button
                                key={guest.id}
                                type="button"
                                onClick={() => handleAddGuest(guest)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-gray-50"
                              >
                                <span className="font-medium">
                                  {guest.firstName} {guest.lastName}
                                </span>
                                {selectedGuests.find(
                                  (g) => g.id === guest.id,
                                ) && (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    Added
                                  </Badge>
                                )}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="p-3 text-center text-sm text-gray-500">
                            No guests found.{" "}
                            <button
                              type="button"
                              className="text-blue-600 hover:underline"
                              onClick={() => {
                                const parts = debouncedGuestSearch
                                  .trim()
                                  .split(/\s+/);
                                setNewGuestFirstName(parts[0] || "");
                                setNewGuestLastName(
                                  parts.slice(1).join(" ") || "",
                                );
                                setShowCreateGuest(true);
                              }}
                            >
                              Create new guest
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Create Guest Form */}
                    {showCreateGuest && (
                      <div className="space-y-2 rounded-lg border bg-gray-50 p-3">
                        <div className="text-sm font-medium">
                          Create New Guest
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            placeholder="First name"
                            value={newGuestFirstName}
                            onChange={(e) =>
                              setNewGuestFirstName(e.target.value)
                            }
                          />
                          <Input
                            placeholder="Last name"
                            value={newGuestLastName}
                            onChange={(e) =>
                              setNewGuestLastName(e.target.value)
                            }
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleCreateGuest}
                            disabled={isCreatingGuest}
                          >
                            {isCreatingGuest ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Create"
                            )}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setShowCreateGuest(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Guest Fill Button */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddGuestFill}
                      className="w-full border-dashed"
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      Add Guest Fill
                    </Button>
                  </div>
                )}
              </div>

              <Separator />

              {/* Time Preferences */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="preferredWindow"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2 font-medium">
                        <Clock className="h-4 w-4" />
                        Preferred Time Window
                        {isCheckingRestrictions && (
                          <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
                        )}
                      </FormLabel>
                      <FormDescription className="text-sm">
                        Choose your preferred part of the day
                      </FormDescription>
                      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
                        {timeWindows.map((window) => {
                          const restriction = windowRestrictions.get(
                            window.index,
                          );
                          const isRestricted = restriction?.isFullyRestricted;
                          const popularity = windowPopularity.get(window.index);
                          const demandLevel = popularity?.demandLevel;

                          return (
                            <div
                              key={window.index}
                              className={`relative rounded-lg border-2 p-3 transition-all ${
                                isRestricted
                                  ? "cursor-not-allowed border-red-300 bg-red-50 opacity-60"
                                  : field.value === window.index.toString()
                                    ? "border-org-primary bg-org-primary/5 cursor-pointer"
                                    : "cursor-pointer border-gray-200 hover:border-gray-300"
                              }`}
                              onClick={() =>
                                handleWindowClick(window.index, field.onChange)
                              }
                            >
                              {/* Restricted badge takes priority */}
                              {isRestricted && (
                                <Badge
                                  variant="destructive"
                                  className="absolute -top-2 -right-2 text-xs"
                                >
                                  Restricted
                                </Badge>
                              )}
                              {/* Popularity indicator - only show for non-restricted, non-regular demand */}
                              {!isRestricted &&
                                demandLevel &&
                                demandLevel !== "regular" && (
                                  <Badge
                                    className={`absolute -top-2 -right-2 text-xs ${
                                      demandLevel === "high"
                                        ? "bg-orange-100 text-orange-800 hover:bg-orange-100"
                                        : "bg-green-100 text-green-800 hover:bg-green-100"
                                    }`}
                                  >
                                    {demandLevel === "high" ? (
                                      <>
                                        <Flame className="mr-1 h-3 w-3" />
                                        Popular
                                      </>
                                    ) : (
                                      <>
                                        <Leaf className="mr-1 h-3 w-3" />
                                        Low demand
                                      </>
                                    )}
                                  </Badge>
                                )}
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
                                {field.value === window.index.toString() &&
                                  !isRestricted && (
                                    <CheckCircle className="text-org-primary h-4 w-4 self-end" />
                                  )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Backup Window */}
                {selectedWindow && (
                  <FormField
                    control={form.control}
                    name="alternateWindow"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Backup Window (Optional)</FormLabel>
                        <FormDescription>
                          Alternative if preferred time isn't available
                        </FormDescription>
                        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
                          {timeWindows
                            .filter(
                              (w) => w.index.toString() !== selectedWindow,
                            )
                            .map((window) => {
                              const restriction = windowRestrictions.get(
                                window.index,
                              );
                              const isRestricted =
                                restriction?.isFullyRestricted;
                              const popularity = windowPopularity.get(
                                window.index,
                              );
                              const demandLevel = popularity?.demandLevel;

                              return (
                                <div
                                  key={window.index}
                                  className={`relative rounded-lg border p-2 transition-all ${
                                    isRestricted
                                      ? "cursor-not-allowed border-red-300 bg-red-50 opacity-60"
                                      : field.value === window.index.toString()
                                        ? "border-org-primary bg-org-primary/5 cursor-pointer"
                                        : "cursor-pointer border-gray-200 hover:border-gray-300"
                                  }`}
                                  onClick={() => {
                                    if (isRestricted) {
                                      toast.error(
                                        `Restricted: ${restriction.reasons.join(", ")}`,
                                        { position: "top-center" },
                                      );
                                      return;
                                    }
                                    field.onChange(
                                      field.value === window.index.toString()
                                        ? ""
                                        : window.index.toString(),
                                    );
                                  }}
                                >
                                  {/* Restricted badge takes priority */}
                                  {isRestricted && (
                                    <Badge
                                      variant="destructive"
                                      className="absolute -top-2 -right-2 px-1 text-[10px]"
                                    >
                                      Restricted
                                    </Badge>
                                  )}
                                  {/* Popularity indicator - only show for non-restricted, non-regular demand */}
                                  {!isRestricted &&
                                    demandLevel &&
                                    demandLevel !== "regular" && (
                                      <Badge
                                        className={`absolute -top-2 -right-2 px-1 text-[10px] ${
                                          demandLevel === "high"
                                            ? "bg-orange-100 text-orange-800 hover:bg-orange-100"
                                            : "bg-green-100 text-green-800 hover:bg-green-100"
                                        }`}
                                      >
                                        {demandLevel === "high" ? (
                                          <>
                                            <Flame className="mr-0.5 h-2.5 w-2.5" />
                                            Popular
                                          </>
                                        ) : (
                                          <>
                                            <Leaf className="mr-0.5 h-2.5 w-2.5" />
                                            Low
                                          </>
                                        )}
                                      </Badge>
                                    )}
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span>{window.icon}</span>
                                      <span className="text-sm font-medium">
                                        {window.timeRange}
                                      </span>
                                    </div>
                                    {field.value === window.index.toString() &&
                                      !isRestricted && (
                                        <CheckCircle className="text-org-primary h-4 w-4" />
                                      )}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <Separator />

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isSubmitting || !selectedWindow}
                className="bg-org-primary hover:bg-org-primary/90 w-full"
                size="lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isEditing ? "Updating..." : "Submitting..."}
                  </>
                ) : (
                  <>
                    <Dice1 className="mr-2 h-4 w-4" />
                    {isEditing ? "Update Entry" : "Submit Entry"}
                  </>
                )}
              </Button>

              <div className="text-center">
                <Badge variant="outline" className="text-xs">
                  Entry can be modified until lottery processing begins
                </Badge>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
