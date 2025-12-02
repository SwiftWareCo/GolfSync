"use client";

import { UserMinus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { getMemberClassStyling } from "~/lib/utils";
import type { Member, Guest } from "~/server/db/schema";

type PersonType = "member" | "guest";

// Type for guest as it comes from TimeBlockWithRelations
type TimeBlockGuest = Guest & {
  invitedByMemberId: number;
  invitedByMember?: Member;
};

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
    const member = person as Member & { memberClass?: { label: string } | null };
    firstName = member.firstName;
    lastName = member.lastName;
    subtitle = `#${member.memberNumber}`;
    memberClass = member.memberClass?.label || "";

    // Get specific styling for this member class
    personStyle = getMemberClassStyling(member.memberClass?.label);
  } else {
    const guest = person as TimeBlockGuest;
    firstName = guest.firstName;
    lastName = guest.lastName;
    subtitle = guest.email || guest.phone || "No contact";

    // Handle invited by display - check for Course Sponsored (-1) or regular member
    if (guest.invitedByMemberId === -1) {
      memberInfo = (
        <div>
          <p className="font-medium">Invited by</p>
          <p className="text-sm text-gray-500">Course Sponsored</p>
        </div>
      );
    } else if (guest.invitedByMember) {
      memberInfo = (
        <div>
          <p className="font-medium">Invited by</p>
          <p className="text-sm text-gray-500">
            {guest.invitedByMember.firstName} {guest.invitedByMember.lastName} (
            {guest.invitedByMember.memberNumber})
          </p>
        </div>
      );
    }
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
