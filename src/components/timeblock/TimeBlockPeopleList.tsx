"use client";

import { UserPlus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { EntitySearchCard } from "~/components/ui/entity-search-card";
import { Badge } from "~/components/ui/badge";
import { type Member, type Fill, type Guest } from "~/server/db/schema";
import { TimeBlockPersonItem } from "./TimeBlockPersonItem";
import { TimeBlockFillItem } from "./TimeBlockFillItem";

// Type for guest as it comes from TimeBlockWithRelations
type TimeBlockGuest = Guest & {
  invitedByMemberId: number;
  invitedByMember?: Member;
};

// Update the props interface to include fills
interface TimeBlockPeopleListProps {
  members: Member[];
  guests: TimeBlockGuest[];
  fills: Fill[];
  onRemoveMember: (memberId: number) => Promise<void>;
  onRemoveGuest: (guestId: number) => Promise<void>;
  onRemoveFill: (fillId: number) => Promise<void>;
  title?: string;
  maxPeople?: number;
}

export function TimeBlockPeopleList({
  members,
  guests,
  fills,
  onRemoveMember,
  onRemoveGuest,
  onRemoveFill,
  title = "People",
  maxPeople = 4,
}: TimeBlockPeopleListProps) {
  // Calculate total people including fills
  const totalPeople = members.length + guests.length + fills.length;

  const handleRemove = async (id: number, type: "member" | "guest") => {
    if (type === "member") {
      await onRemoveMember(id);
    } else if (type === "guest") {
      await onRemoveGuest(id);
    }
  };

  if (totalPeople === 0) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed p-4 text-center text-gray-500">
            No people added to this time block
          </div>
        </CardContent>
      </Card>
    );
  }

  // Create combined array of members and guests first
  const allPeople = [
    ...members.map((member) => ({
      type: "member" as const,
      data: member,
    })),
    ...guests.map((guest) => ({
      type: "guest" as const,
      data: guest,
    })),
  ];

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>
          {title} ({totalPeople}/{maxPeople})
        </CardTitle>
        <Badge variant={totalPeople >= maxPeople ? "destructive" : "default"}>
          {totalPeople >= maxPeople ? "Full" : "Available"}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {allPeople.map((person, index) => (
            <TimeBlockPersonItem
              key={`${person.type}-${person.data.id}-${index}`}
              type={person.type}
              person={person.data}
              onRemove={handleRemove}
            />
          ))}
          {/* Render fills separately */}
          {fills.map((fill) => (
            <TimeBlockFillItem
              key={`fill-${fill.id}`}
              fill={fill}
              onRemove={onRemoveFill}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Search component for adding members to a time block
interface TimeBlockMemberSearchProps {
  searchQuery: string;
  onSearch: (query: string) => void;
  searchResults: Array<{
    id: number | undefined;
    firstName: string;
    lastName: string;
    memberNumber: string;
  }>;
  isLoading: boolean;
  onAddMember: (memberId: number) => Promise<void>;
  isTimeBlockFull: boolean;
  existingMembers?: Array<{ id: number }>;
  autoFocus?: boolean;
}

export function TimeBlockMemberSearch({
  searchQuery,
  onSearch,
  searchResults,
  isLoading,
  onAddMember,
  isTimeBlockFull,
  existingMembers = [],
  autoFocus = false,
}: TimeBlockMemberSearchProps) {
  return (
    <EntitySearchCard
      title="Add Member"
      searchQuery={searchQuery}
      onSearch={onSearch}
      searchResults={searchResults}
      isLoading={isLoading}
      onAddEntity={onAddMember}
      isEntityLimitReached={isTimeBlockFull}
      searchPlaceholder="Search members by name or number..."
      limitReachedMessage="This time block is full. Remove a member or guest before adding more."
      noResultsMessage="No members found matching your search"
      itemsPerPage={5}
      autoFocus={autoFocus}
      renderEntityCard={(member) => {
        const isAlreadyAdded = existingMembers.some((m) => m.id === member.id);
        return (
          <div
            key={member.id}
            className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
              isAlreadyAdded
                ? "border-green-200 bg-green-50"
                : "hover:bg-gray-50"
            }`}
          >
            <div className="flex items-center space-x-3">
              <div>
                <p className="font-medium">
                  {member.firstName} {member.lastName}
                </p>
                <p className="text-sm text-gray-500">#{member.memberNumber}</p>
              </div>
            </div>
            {isAlreadyAdded ? (
              <Badge
                variant="secondary"
                className="bg-green-100 text-green-800"
              >
                ✓ Added
              </Badge>
            ) : (
              <Button
                size="sm"
                onClick={() => onAddMember(member.id || 0)}
                disabled={isTimeBlockFull}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Add
              </Button>
            )}
          </div>
        );
      }}
    />
  );
}

// Search component for adding guests to a time block
interface TimeBlockGuestSearchProps {
  searchQuery: string;
  onSearch: (query: string) => void;
  searchResults: Array<{
    id: number;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
  }>;
  isLoading: boolean;
  onAddGuest: (guestId: number) => Promise<void>;
  isTimeBlockFull: boolean;
  members: Member[];
  onMemberSelect: (memberId: number) => void;
  selectedMemberId: number | null;
  onCreateGuest?: () => void;
  existingGuests?: Array<{ id: number }>;
  autoFocus?: boolean;
}

export function TimeBlockGuestSearch({
  searchQuery,
  onSearch,
  searchResults,
  isLoading,
  onAddGuest,
  isTimeBlockFull,
  members,
  onMemberSelect,
  selectedMemberId,
  onCreateGuest,
  existingGuests = [],
  autoFocus = false,
}: TimeBlockGuestSearchProps) {
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
    <EntitySearchCard
      title="Add Guest"
      searchQuery={searchQuery}
      onSearch={onSearch}
      searchResults={searchResults}
      isLoading={isLoading}
      onAddEntity={onAddGuest}
      isEntityLimitReached={isTimeBlockFull}
      showSelectFilter={true}
      selectOptions={memberOptions}
      selectedFilterId={selectedMemberId}
      onFilterSelect={onMemberSelect}
      searchPlaceholder="Search guests by name or email..."
      limitReachedMessage="This time block is full. Remove a member or guest before adding more."
      noResultsMessage="No guests found matching your search"
      itemsPerPage={5}
      showCreateButton={true}
      createButtonText="Create Guest"
      onCreateNew={onCreateGuest}
      autoFocus={autoFocus}
      renderEntityCard={(guest) => {
        const isAlreadyAdded = existingGuests.some((g) => g.id === guest.id);
        return (
          <div
            key={guest.id}
            className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
              isAlreadyAdded
                ? "border-green-200 bg-green-50"
                : "hover:bg-gray-50"
            }`}
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
            {isAlreadyAdded ? (
              <Badge
                variant="secondary"
                className="bg-green-100 text-green-800"
              >
                ✓ Added
              </Badge>
            ) : (
              <Button
                size="sm"
                onClick={() => onAddGuest(guest.id)}
                disabled={isTimeBlockFull || !selectedMemberId}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Add
              </Button>
            )}
          </div>
        );
      }}
    />
  );
}
