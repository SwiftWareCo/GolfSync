"use client";

import { UserMinus, UserPlus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { EntitySearchCard } from "~/components/ui/entity-search-card";
import { Badge } from "~/components/ui/badge";
import { type TimeBlockGuest } from "~/app/types/GuestTypes";
import { getMemberClassStyling } from "~/lib/utils";
import { type Member, type Fill, type Guest } from "~/server/db/schema";

type PersonType = "member" | "guest" | "fill";

// Type alias for Member when used in timeblock context
type TimeBlockMemberView = Member;

// Type alias for Fill when used in timeblock context
type TimeBlockFill = Fill;

interface TimeBlockPersonItemProps {
  type: PersonType;
  person: Member | TimeBlockGuest;
  onRemove: (id: number, type: PersonType) => Promise<void>;
}

export const TimeBlockPersonItem = ({
  type,
  person,
  onRemove,
}: TimeBlockPersonItemProps) => {
  const handleRemove = () => {
    if (type === "member") {
      onRemove((person as Member).id, "member");
    } else {
      onRemove((person as TimeBlockGuest).id, "guest");
    }
  };

  let firstName = "";
  let lastName = "";
  let subtitle = "";
  let memberInfo = null;
  let memberClass = "";

  // Get styling according to the person type and class
  let personStyle = getMemberClassStyling(type === "guest" ? "GUEST" : null);

  if (type === "member") {
    const member = person as Member;
    firstName = member.firstName;
    lastName = member.lastName;
    subtitle = `#${member.memberNumber}`;
    memberClass = member.class || "";

    // Get specific styling for this member class
    personStyle = getMemberClassStyling(member.class);
  } else {
    const guest = person as TimeBlockGuest;
    firstName = guest.firstName;
    lastName = guest.lastName;
    subtitle = guest.email || guest.phone || "No contact";
    memberInfo = (
      <div>
        <p className="font-medium">Invited by</p>
        <p className="text-sm text-gray-500">
          {guest.invitedByMember?.firstName} {guest.invitedByMember?.lastName} (
          {guest.invitedByMember?.memberNumber})
        </p>
      </div>
    );

    // Guest styling is already set above
  }

  return (
    <div
      className={`flex items-center justify-between rounded-lg border ${personStyle.border} p-3 transition-colors hover:${personStyle.bg}`}
    >
      <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-1">
        <div>
          <div className="flex items-center space-x-2">
            <p className={`font-medium ${personStyle.text}`}>
              {firstName} {lastName}
            </p>
            <Badge
              variant={
                type === "guest" ? "outline" : (personStyle.badgeVariant as any)
              }
              className="text-xs"
            >
              {type === "member" ? memberClass || "Member" : "Guest"}
            </Badge>
          </div>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
        {memberInfo}
      </div>
      <Button variant="destructive" size="sm" onClick={handleRemove}>
        <UserMinus className="mr-2 h-4 w-4" />
        Remove
      </Button>
    </div>
  );
};

// New component for displaying fills
interface TimeBlockFillItemProps {
  fill: Fill;
  onRemove: (fillId: number) => Promise<void>;
}

export const TimeBlockFillItem = ({
  fill,
  onRemove,
}: TimeBlockFillItemProps) => {
  const handleRemove = () => {
    onRemove(fill.id);
  };

  const getFillLabel = () => {
    switch (fill.fillType) {
      case "guest_fill":
        return "Guest Fill";
      case "reciprocal_fill":
        return "Reciprocal Fill";
      case "custom_fill":
        return fill.customName || "Custom Fill";
      default:
        return "Fill";
    }
  };

  // Use a neutral style for fills
  const fillStyle = {
    border: "border-gray-200",
    bg: "bg-gray-50",
    text: "text-gray-700",
    badgeVariant: "secondary",
  };

  return (
    <div
      className={`flex items-center justify-between rounded-lg border ${fillStyle.border} p-3 transition-colors hover:${fillStyle.bg}`}
    >
      <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-1">
        <div>
          <div className="flex items-center space-x-2">
            <p className={`font-medium ${fillStyle.text}`}>{getFillLabel()}</p>
            <Badge variant={fillStyle.badgeVariant as any} className="text-xs">
              Fill
            </Badge>
          </div>
        </div>
      </div>
      <Button variant="destructive" size="sm" onClick={handleRemove}>
        <UserMinus className="mr-2 h-4 w-4" />
        Remove
      </Button>
    </div>
  );
};

// Update the props interface to include fills
interface TimeBlockPeopleListProps {
  members: TimeBlockMemberView[];
  guests: TimeBlockGuest[];
  fills: TimeBlockFill[];
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

  const handleRemove = async (id: number, type: PersonType) => {
    if (type === "member") {
      await onRemoveMember(id);
    } else if (type === "guest") {
      await onRemoveGuest(id);
    } else {
      await onRemoveFill(id);
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
      type: "member" as PersonType,
      data: member,
    })),
    ...guests.map((guest) => ({
      type: "guest" as PersonType,
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
    id: number;
    firstName: string;
    lastName: string;
    memberNumber: string;
  }>;
  isLoading: boolean;
  onAddMember: (memberId: number) => Promise<void>;
  isTimeBlockFull: boolean;
  existingMembers?: Array<{ id: number }>;
}

export function TimeBlockMemberSearch({
  searchQuery,
  onSearch,
  searchResults,
  isLoading,
  onAddMember,
  isTimeBlockFull,
  existingMembers = [],
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
      renderEntityCard={(member) => {
        const isAlreadyAdded = existingMembers.some(m => m.id === member.id);
        return (
          <div
            key={member.id}
            className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
              isAlreadyAdded ? 'bg-green-50 border-green-200' : 'hover:bg-gray-50'
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
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                ✓ Added
              </Badge>
            ) : (
              <Button
                size="sm"
                onClick={() => onAddMember(member.id)}
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
      renderEntityCard={(guest) => {
        const isAlreadyAdded = existingGuests.some(g => g.id === guest.id);
        return (
          <div
            key={guest.id}
            className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
              isAlreadyAdded ? 'bg-green-50 border-green-200' : 'hover:bg-gray-50'
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
              <Badge variant="secondary" className="bg-green-100 text-green-800">
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
