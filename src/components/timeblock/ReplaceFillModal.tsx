"use client";

import { useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { guestQueryOptions } from "~/server/query-options";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { UserPlus, X } from "lucide-react";
import toast from "react-hot-toast";
import type { Fill, Member, Guest } from "~/server/db/schema";
import { EntitySearchCard } from "~/components/ui/entity-search-card";
import { teesheetKeys } from "~/services/teesheet/keys";
import { createGuest } from "~/server/guests/actions";
import { replaceFillWithGuest } from "~/server/fills/actions";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

interface ReplaceFillModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fill: Fill;
  timeBlockId: number;
  dateString: string;
  members: Member[];
}

export function ReplaceFillModal({
  open,
  onOpenChange,
  fill,
  timeBlockId,
  dateString,
  members,
}: ReplaceFillModalProps) {
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [showCreateGuest, setShowCreateGuest] = useState(false);
  const [newGuestFirstName, setNewGuestFirstName] = useState("");
  const [newGuestLastName, setNewGuestLastName] = useState("");
  const [isCreatingGuest, setIsCreatingGuest] = useState(false);

  // Guest search query
  const guestSearch = useQuery({
    ...guestQueryOptions.search(searchQuery),
    enabled: searchQuery.length >= 2,
  });

  const searchResults = guestSearch.data || [];
  const isLoading = guestSearch.isLoading;

  // Debounced search handler
  const debouncedSearch = useDebouncedCallback((query: string) => {
    setSearchQuery(query);
  }, 300);

  // Replace fill mutation
  const replaceMutation = useMutation({
    mutationFn: ({
      guestId,
      invitedByMemberId,
    }: {
      guestId: number;
      invitedByMemberId: number;
    }) =>
      replaceFillWithGuest(fill.id, guestId, invitedByMemberId, timeBlockId),

    onSuccess: (result) => {
      if (result.success) {
        toast.success("Fill replaced with guest");
        onOpenChange(false);
        resetState();
      } else {
        toast.error(result.error || "Failed to replace fill");
      }
    },

    onError: () => {
      toast.error("Failed to replace fill");
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: teesheetKeys.detail(dateString),
      });
    },
  });

  const handleAddGuest = async (guestId: number) => {
    if (!selectedMemberId) {
      toast.error("Please select who is inviting the guest");
      return;
    }

    replaceMutation.mutate({
      guestId,
      invitedByMemberId: selectedMemberId,
    });
  };

  const handleMemberSelect = (memberId: number) => {
    setSelectedMemberId(memberId);
  };

  const handleCreateGuest = async () => {
    if (!newGuestFirstName.trim() || !newGuestLastName.trim()) {
      toast.error("Please enter first and last name");
      return;
    }

    if (!selectedMemberId) {
      toast.error("Please select who is inviting the guest");
      return;
    }

    setIsCreatingGuest(true);
    try {
      const result = await createGuest({
        firstName: newGuestFirstName.trim(),
        lastName: newGuestLastName.trim(),
      });

      if (result.success && result.data) {
        toast.success("Guest created");
        // Automatically add the new guest
        replaceMutation.mutate({
          guestId: result.data.id,
          invitedByMemberId: selectedMemberId,
        });
      } else {
        toast.error(result.error || "Failed to create guest");
      }
    } catch {
      toast.error("Failed to create guest");
    } finally {
      setIsCreatingGuest(false);
    }
  };

  const resetState = () => {
    setSearchQuery("");
    setSelectedMemberId(null);
    setShowCreateGuest(false);
    setNewGuestFirstName("");
    setNewGuestLastName("");
  };

  // Convert members to select options format, including Course Sponsored
  const courseSponsoredOption = {
    id: -1,
    label: "Course Sponsored (Reciprocals, Gift Certificates, etc.)",
    value: "-1",
  };

  const memberOptions = [
    courseSponsoredOption,
    ...members.map((member) => ({
      id: member.id,
      label: `${member.firstName} ${member.lastName} (${member.memberNumber})`,
      value: member.id.toString(),
    })),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Replace Fill with Guest</DialogTitle>
        </DialogHeader>

        {showCreateGuest ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Create New Guest</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCreateGuest(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-3">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={newGuestFirstName}
                  onChange={(e) => setNewGuestFirstName(e.target.value)}
                  placeholder="Enter first name"
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={newGuestLastName}
                  onChange={(e) => setNewGuestLastName(e.target.value)}
                  placeholder="Enter last name"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowCreateGuest(false)}
                  disabled={isCreatingGuest}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateGuest}
                  disabled={isCreatingGuest || !selectedMemberId}
                >
                  {isCreatingGuest ? "Creating..." : "Create & Add"}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <EntitySearchCard
            title="Select Guest"
            searchQuery={searchQuery}
            onSearch={debouncedSearch}
            searchResults={searchResults}
            isLoading={isLoading}
            onAddEntity={handleAddGuest}
            isEntityLimitReached={false}
            showSelectFilter={true}
            selectOptions={memberOptions}
            selectedFilterId={selectedMemberId}
            onFilterSelect={handleMemberSelect}
            searchPlaceholder="Search guests by name or email..."
            noResultsMessage="No guests found matching your search"
            itemsPerPage={5}
            showCreateButton={true}
            createButtonText="Create Guest"
            onCreateNew={() => setShowCreateGuest(true)}
            renderEntityCard={(guest: {
              id: number;
              firstName: string;
              lastName: string;
              email: string | null;
              phone: string | null;
            }) => (
              <div
                key={guest.id}
                className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-gray-50"
              >
                <div className="flex items-center space-x-3">
                  <div>
                    <p className="font-medium">
                      {guest.firstName} {guest.lastName}
                    </p>
                    <p className="text-sm text-gray-500">
                      {guest.email || guest.phone || "No contact information"}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleAddGuest(guest.id)}
                  disabled={!selectedMemberId || replaceMutation.isPending}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  {replaceMutation.isPending ? "Adding..." : "Add"}
                </Button>
              </div>
            )}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
