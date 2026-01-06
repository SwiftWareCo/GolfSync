"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useDebounce } from "use-debounce";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { LoadingSpinner } from "~/components/ui/loading-spinner";
import { Badge } from "~/components/ui/badge";
import { calculateDynamicTimeWindows } from "~/lib/lottery-utils";
import type { TeesheetConfigWithBlocks } from "~/server/db/schema";
import {
  updateLotteryEntryAdmin,
  updateLotteryGroupAdmin,
} from "~/server/lottery/actions";
import { toast } from "react-hot-toast";
import { MemberSearchInput } from "~/components/members/MemberSearchInput";
import { X, Search, UserPlus, Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { guestQueryOptions } from "~/server/query-options";
import { createGuest } from "~/server/guests/actions";

interface Member {
  id: number;
  firstName: string;
  lastName: string;
  class: string;
  memberNumber?: string;
}

interface Guest {
  id: number;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
}

interface IndividualEntry {
  id: number;
  member: {
    id: number;
    firstName: string;
    lastName: string;
    class: string;
  };
  preferredWindow: string;
  alternateWindow?: string;
  status: string;
  guestIds?: number[];
  guestFillCount?: number;
  guests?: Guest[];
}

interface GroupEntry {
  id: number;
  leader: {
    id: number;
    firstName: string;
    lastName: string;
    class: string;
  };
  members?: Array<{
    id: number;
    firstName: string;
    lastName: string;
    class: string;
  }>;
  memberIds: number[];
  preferredWindow: string;
  alternateWindow?: string;
  status: string;
  guestIds?: number[];
  guestFillCount?: number;
  guests?: Guest[];
}

interface LotteryEditDialogProps {
  open: boolean;
  onClose: () => void;
  entry: IndividualEntry | GroupEntry | null;
  isGroup: boolean;
  members: Member[];
  config: TeesheetConfigWithBlocks;
}

export function LotteryEditDialog({
  open,
  onClose,
  entry,
  isGroup,
  members,
  config,
}: LotteryEditDialogProps) {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  // Calculate dynamic time windows from config
  const timeWindows = calculateDynamicTimeWindows(config);

  // Form state
  const [preferredWindow, setPreferredWindow] = useState<string>("MORNING");
  const [alternateWindow, setAlternateWindow] = useState<string | "">("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [selectedGuests, setSelectedGuests] = useState<Guest[]>([]);
  const [guestFillCount, setGuestFillCount] = useState<number>(0);

  // Guest search state (matching BookingPartyModal)
  const [guestSearch, setGuestSearch] = useState("");
  const [debouncedGuestSearch] = useDebounce(guestSearch, 300);
  const [showCreateGuest, setShowCreateGuest] = useState(false);
  const [newGuestFirstName, setNewGuestFirstName] = useState("");
  const [newGuestLastName, setNewGuestLastName] = useState("");
  const [isCreatingGuest, setIsCreatingGuest] = useState(false);

  // Guest search query
  const guestSearchQuery = useQuery({
    ...guestQueryOptions.search(debouncedGuestSearch),
    enabled: debouncedGuestSearch.length >= 2 && open,
  });

  const guestResults = useMemo(() => {
    return guestSearchQuery.data || [];
  }, [guestSearchQuery.data]);

  const showCreateGuestOption =
    debouncedGuestSearch.length >= 2 &&
    !guestSearchQuery.isLoading &&
    guestResults.length === 0;

  // Calculate total players
  const totalPlayers = useMemo(() => {
    const memberCount = isGroup ? selectedMemberIds.length : 1;
    return memberCount + selectedGuests.length + guestFillCount;
  }, [
    isGroup,
    selectedMemberIds.length,
    selectedGuests.length,
    guestFillCount,
  ]);

  const isFull = totalPlayers >= 4;

  // Initialize form when entry changes
  useEffect(() => {
    if (entry) {
      setPreferredWindow(entry.preferredWindow);
      setAlternateWindow(entry.alternateWindow || "");
      setSelectedGuests(entry.guests || []);
      setGuestFillCount(entry.guestFillCount || 0);
      setGuestSearch("");
      setShowCreateGuest(false);

      if (isGroup && "memberIds" in entry) {
        setSelectedMemberIds(entry.memberIds);
      }
    }
  }, [entry, isGroup]);

  // Guest handlers
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entry) return;

    setIsLoading(true);
    try {
      const updateData = {
        preferredWindow,
        alternateWindow: alternateWindow || undefined,
        guestIds: selectedGuests.map((g) => g.id),
        guestFillCount,
      };

      let result;
      if (isGroup && "memberIds" in entry) {
        result = await updateLotteryGroupAdmin(entry.id, {
          ...updateData,
          memberIds: selectedMemberIds,
        });
      } else {
        result = await updateLotteryEntryAdmin(entry.id, updateData);
      }

      if (result.success) {
        toast.success(
          `${isGroup ? "Group" : "Individual"} entry updated successfully`,
        );
        onClose();
      } else {
        toast.error(result.error || "Failed to update entry");
      }
    } catch (error) {
      toast.error("An error occurred while updating the entry");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Edit {isGroup ? "Group" : "Individual"} Entry
          </DialogTitle>
        </DialogHeader>

        {entry && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Entry Info */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Entry Details</Label>
              <div className="rounded border bg-gray-50 p-3">
                {isGroup && "leader" in entry ? (
                  <>
                    <div className="font-medium">
                      {entry.leader.firstName} {entry.leader.lastName} (Group
                      Leader)
                    </div>
                    <div className="text-sm text-gray-600">
                      {entry.leader.class} • {entry.memberIds.length} members
                    </div>
                  </>
                ) : (
                  <>
                    <div className="font-medium">
                      {"member" in entry ? entry.member.firstName : ""}{" "}
                      {"member" in entry ? entry.member.lastName : ""}
                    </div>
                    <div className="text-sm text-gray-600">
                      {"member" in entry ? entry.member.class : ""}
                    </div>
                  </>
                )}
                <Badge variant="outline" className="mt-1">
                  {entry.status}
                </Badge>
              </div>
            </div>

            {/* Preferred Time Window */}
            <div className="space-y-2">
              <Label htmlFor="preferredWindow">Preferred Time Window</Label>
              <Select
                value={preferredWindow}
                onValueChange={(value) => setPreferredWindow(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeWindows.map((window) => (
                    <SelectItem
                      key={window.index}
                      value={window.index.toString()}
                    >
                      {window.timeRange}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Alternate Window */}
            <div className="space-y-2">
              <Label htmlFor="alternateWindow">
                Alternate Time Window (Optional)
              </Label>
              <Select
                value={alternateWindow || "NONE"}
                onValueChange={(value) =>
                  setAlternateWindow(value === "NONE" ? "" : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select alternate window" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">None</SelectItem>
                  {timeWindows.map((window) => (
                    <SelectItem
                      key={window.index}
                      value={window.index.toString()}
                    >
                      {window.timeRange}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Group Members (only for groups) */}
            {isGroup && (
              <div className="space-y-2">
                <Label>Group Members</Label>
                {selectedMemberIds.length < 4 && (
                  <MemberSearchInput
                    onSelect={(searchMember: any) => {
                      if (
                        searchMember &&
                        !selectedMemberIds.includes(searchMember.id)
                      ) {
                        setSelectedMemberIds((prev) => [
                          ...prev,
                          searchMember.id,
                        ]);
                      }
                    }}
                    placeholder="Search and add members..."
                  />
                )}
                {selectedMemberIds.length >= 4 && (
                  <div className="text-sm text-gray-500 italic">
                    Maximum group size of 4 members reached
                  </div>
                )}

                {/* Selected Members List */}
                {selectedMemberIds.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">
                      Selected Members ({selectedMemberIds.length})
                    </div>
                    <div className="space-y-1">
                      {selectedMemberIds.map((memberId) => {
                        const member = members.find((m) => m.id === memberId);
                        if (!member) return null;

                        return (
                          <div
                            key={memberId}
                            className="flex items-center justify-between rounded border bg-gray-50 p-2"
                          >
                            <div>
                              <div className="font-medium">
                                {member.firstName} {member.lastName}
                              </div>
                              <div className="text-sm text-gray-600">
                                {member.class}
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setSelectedMemberIds((prev) =>
                                  prev.filter((id) => id !== memberId),
                                )
                              }
                              className="h-8 w-8 text-red-500 hover:bg-red-50"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Guests Section - matching BookingPartyModal pattern */}
            <div className="space-y-3">
              <Label>Guests ({selectedGuests.length})</Label>

              {/* Selected Guests List */}
              {selectedGuests.length > 0 && (
                <div className="space-y-1">
                  {selectedGuests.map((guest) => (
                    <div
                      key={guest.id}
                      className="flex items-center justify-between rounded border border-blue-200 bg-blue-50 p-2"
                    >
                      <div>
                        <div className="font-medium">
                          {guest.firstName} {guest.lastName}
                        </div>
                        <div className="text-sm text-blue-600">Guest</div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveGuest(guest.id)}
                        className="h-8 w-8 text-red-500 hover:bg-red-50"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Guest Fills */}
              {guestFillCount > 0 && (
                <div className="space-y-1">
                  {Array.from({ length: guestFillCount }).map((_, index) => (
                    <div
                      key={`fill-${index}`}
                      className="flex items-center justify-between rounded border border-dashed border-amber-300 bg-amber-50 p-2"
                    >
                      <Badge
                        variant="outline"
                        className="border-amber-400 text-amber-700"
                      >
                        Guest Fill
                      </Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleRemoveGuestFill}
                        className="h-8 w-8 text-red-500 hover:bg-red-50"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Guests */}
              {!isFull && !showCreateGuest && (
                <>
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
                </>
              )}

              {/* Create Guest Form */}
              {showCreateGuest && (
                <div className="space-y-3 rounded-md border bg-gray-50 p-3">
                  <Label className="text-xs text-gray-500">
                    Create New Guest
                  </Label>
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

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <LoadingSpinner className="mr-2 h-4 w-4" />
                    Updating...
                  </>
                ) : (
                  "Update Entry"
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
