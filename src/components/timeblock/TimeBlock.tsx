"use client";

import { useState, useEffect } from "react";
import type { TimeBlockWithRelations } from "~/server/db/schema";
import { Button } from "~/components/ui/button";
import {
  X,
  UserCheck,
  UserX,
  UserPlus,
  MoreVertical,
  StickyNote,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { type RestrictionViolation } from "~/app/types/RestrictionTypes";
import { formatTimeString, getMemberClassStyling } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import type { PaceOfPlayRecord } from "~/server/pace-of-play/data";
import { QuickCartAssignment } from "./QuickCartAssignment";
import { quickAssignPowerCart } from "~/server/charges/actions";
import { type PowerCartAssignmentData } from "~/app/types/ChargeTypes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "~/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

interface TimeBlockProps {
  timeBlock: TimeBlockWithRelations;
  onRestrictionViolation?: (violations: RestrictionViolation[]) => void;
  setPendingAction?: (action: (() => Promise<void>) | null) => void;
  paceOfPlay?: PaceOfPlayRecord | null;
  showMemberClass?: boolean;
  onRemoveMember?: (memberId: number) => Promise<void>;
  onRemoveGuest?: (guestId: number) => Promise<void>;
  onRemoveFill?: (fillId: number) => Promise<void>;
  onCheckInMember?: (memberId: number, isCheckedIn: boolean) => Promise<void>;
  onCheckInGuest?: (guestId: number, isCheckedIn: boolean) => Promise<void>;
  onCheckInAll?: () => Promise<void>;
  onToggleNoteEdit?: () => void;
  onSaveNotes?: (notes: string) => Promise<boolean>;
}

export function TimeBlock({
  timeBlock,
  paceOfPlay = null,
  showMemberClass = false,
  onRemoveMember,
  onRemoveGuest,
  onRemoveFill,
  onCheckInMember,
  onCheckInGuest,
  onCheckInAll,
  onToggleNoteEdit,
  onSaveNotes,
}: TimeBlockProps) {
  const formattedTime = formatTimeString(timeBlock.startTime);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState(timeBlock.notes || "");

  // Calculate members, guests, and fills
  const members = timeBlock.members || [];
  const guests = timeBlock.guests || [];
  const fills = timeBlock.fills || [];
  const totalPeople = members.length + guests.length + fills.length;

  // Check if any members or guests are present
  const hasParticipants = members.length > 0 || guests.length > 0;

  // Check if all participants are checked in
  const allCheckedIn =
    hasParticipants &&
    members.every((m) => m.checkedIn) &&
    guests.every((g) => g.checkedIn);

  // Disable check-in buttons if no participants
  const checkInDisabled = !hasParticipants || allCheckedIn;

  // Reset notes if they change externally while not editing
  useEffect(() => {
    if (!isEditingNotes && timeBlock.notes !== editedNotes) {
      setEditedNotes(timeBlock.notes || "");
    }
  }, [timeBlock.notes, editedNotes, isEditingNotes]);

  // Map members, guests, and fills with their index as key for stable ordering
  const membersSorted = members
    .sort((a, b) => a.id - b.id)
    .map((member) => ({
      ...member,
      key: `member-${member.id}`,
    }));

  const guestsSorted = guests
    .sort((a, b) => a.id - b.id)
    .map((guest) => ({
      ...guest,
      key: `guest-${guest.id}`,
    }));

  const fillsSorted = fills
    .sort((a, b) => a.id - b.id)
    .map((fill) => ({
      ...fill,
      key: `fill-${fill.id}`,
    }));

  const handleRemoveMember = async (memberId: number) => {
    try {
      if (onRemoveMember) {
        await onRemoveMember(memberId);
      } else {
        toast.error("Remove member function not provided");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    }
  };

  const handleRemoveGuest = async (guestId: number) => {
    try {
      if (onRemoveGuest) {
        await onRemoveGuest(guestId);
      } else {
        toast.error("Remove guest function not provided");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    }
  };

  const handleCheckInMember = async (
    memberId: number,
    isCheckedIn: boolean,
  ) => {
    try {
      if (onCheckInMember) {
        await onCheckInMember(memberId, isCheckedIn);
      } else {
        toast.error("Check-in member function not provided");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    }
  };

  const handleCheckInGuest = async (guestId: number, isCheckedIn: boolean) => {
    try {
      if (onCheckInGuest) {
        await onCheckInGuest(guestId, isCheckedIn);
      } else {
        toast.error("Check-in guest function not provided");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    }
  };

  // Get pace of play status class
  const getPaceOfPlayStatusClass = (status: string | null) => {
    if (!status) return "";

    switch (status.toLowerCase()) {
      case "on time":
        return "bg-green-100 text-green-800 border-green-300";
      case "behind":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "late":
        return "bg-red-100 text-red-800 border-red-300";
      case "completed_late":
      case "completed late":
        return "bg-red-100 text-red-800 border-red-300";
      case "completed_on_time":
      case "completed on time":
        return "bg-green-100 text-green-800 border-green-300";
      case "ahead":
        return "bg-blue-100 text-blue-800 border-blue-300";
      default:
        return "";
    }
  };

  // Format status for display
  const formatStatusForDisplay = (status: string | null): string => {
    if (!status) return "Not Started";

    // Convert snake_case to Title Case
    return status
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  const handleRemoveFill = async (fillId: number) => {
    try {
      if (onRemoveFill) {
        await onRemoveFill(fillId);
      } else {
        toast.error("Remove fill function not provided");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    }
  };

  const handleCartAssign = async (data: PowerCartAssignmentData) => {
    try {
      await quickAssignPowerCart(data);
    } catch (error) {
      console.error("Failed to assign cart:", error);
    }
  };

  // Get all members except the one being assigned a cart
  const getOtherMembers = (currentMemberId: number) => {
    return timeBlock.members
      .filter((m) => m.id !== currentMemberId)
      .map((m) => ({
        id: m.id,
        firstName: m.firstName,
        lastName: m.lastName,
      }));
  };

  return (
    <TooltipProvider>
      <tr className="hover:bg-gray-50">
        {/* Time Column */}
        <td className="px-3 py-1.5 pr-0">
          <div className="flex flex-col">
            {timeBlock.displayName && (
              <span className="text-xs font-medium text-gray-600">
                {timeBlock.displayName}
              </span>
            )}
            <span className="text-sm font-semibold">{formattedTime}</span>
          </div>
        </td>

        {/* Players Column - Horizontal Layout with Quick Actions */}
        <td className="py-1.5">
          {totalPeople > 0 ? (
            <div className="flex flex-wrap items-center gap-1 px-0">
              {/* Members */}
              {membersSorted.map((member) => {
                const memberStyle = getMemberClassStyling(member.memberClass?.label);
                const { key, ...memberData } = member;
                const fullName = `${memberData.firstName} ${memberData.lastName} (${memberData.memberNumber})`;

                return (
                  <div
                    key={key}
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-3 py-1.5",
                      memberData.checkedIn
                        ? "border-green-300 bg-green-100 text-green-800"
                        : memberStyle.bg +
                            " " +
                            memberStyle.text +
                            " " +
                            memberStyle.border,
                    )}
                  >
                    {/* Player Name */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className="min-w-[100px] cursor-pointer truncate text-base font-medium hover:underline"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            window.dispatchEvent(
                              new CustomEvent("open-account-dialog", {
                                detail: { accountData: memberData },
                              }),
                            );
                          }}
                        >
                          {memberData.firstName} {memberData.lastName}
                          {memberData.checkedIn && (
                            <span className="ml-1 text-green-700">✓</span>
                          )}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{fullName}</p>
                        {showMemberClass && memberData.class && (
                          <p className="text-xs opacity-80">
                            Class: {memberData.class}
                          </p>
                        )}
                      </TooltipContent>
                    </Tooltip>

                    {/* Quick Actions */}
                    <div className="ml-auto flex items-center gap-1">
                      <QuickCartAssignment
                        memberId={memberData.id}
                        onAssign={handleCartAssign}
                        otherMembers={getOtherMembers(memberData.id)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          handleCheckInMember(
                            memberData.id,
                            !!memberData.checkedIn,
                          );
                        }}
                        className={`h-6 w-6 p-0 ${
                          memberData.checkedIn
                            ? "text-green-700 hover:bg-red-100 hover:text-red-600"
                            : "text-gray-500 hover:bg-green-100 hover:text-green-600"
                        }`}
                      >
                        {memberData.checkedIn ? (
                          <UserX className="h-4 w-4" />
                        ) : (
                          <UserCheck className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          handleRemoveMember(memberData.id);
                        }}
                        className="h-6 w-6 p-0 text-gray-500 hover:bg-red-100 hover:text-red-600"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}

              {/* Guests */}
              {guestsSorted.map((guest) => {
                const { key, ...guestData } = guest;
                const fullName = `${guestData.firstName} ${guestData.lastName} (Guest)`;

                return (
                  <div
                    key={key}
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-3 py-1.5",
                      guestData.checkedIn
                        ? "border-green-300 bg-green-100 text-green-800"
                        : "border-purple-200 bg-purple-50 text-purple-700",
                    )}
                  >
                    {/* Guest Name */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className="min-w-[180px] cursor-pointer truncate text-base font-medium hover:underline"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            window.dispatchEvent(
                              new CustomEvent("open-account-dialog", {
                                detail: { accountData: guestData },
                              }),
                            );
                          }}
                        >
                          {guestData.firstName} {guestData.lastName}
                          <span className="ml-1 text-sm opacity-70">G</span>
                          {guestData.checkedIn && (
                            <span className="ml-1 text-green-700">✓</span>
                          )}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{fullName}</p>
                        <p className="text-xs opacity-80">
                          Invited by: {guestData.invitedByMember?.firstName}{" "}
                          {guestData.invitedByMember?.lastName}
                        </p>
                      </TooltipContent>
                    </Tooltip>

                    {/* Quick Actions */}
                    <div className="ml-auto flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          handleCheckInGuest(
                            guestData.id,
                            !!guestData.checkedIn,
                          );
                        }}
                        className={`h-6 w-6 p-0 ${
                          guestData.checkedIn
                            ? "text-green-700 hover:bg-red-100 hover:text-red-600"
                            : "text-gray-500 hover:bg-green-100 hover:text-green-600"
                        }`}
                      >
                        {guestData.checkedIn ? (
                          <UserX className="h-4 w-4" />
                        ) : (
                          <UserCheck className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          handleRemoveGuest(guestData.id);
                        }}
                        className="h-6 w-6 p-0 text-gray-500 hover:bg-red-100 hover:text-red-600"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}

              {/* Fills */}
              {fillsSorted.map((fill) => (
                <div
                  key={fill.key}
                  className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-100 px-3 py-1.5 text-gray-700"
                >
                  <span className="min-w-[180px] text-base font-medium">
                    {fill.fillType === "custom_fill"
                      ? fill.customName || "Custom"
                      : fill.fillType === "guest_fill"
                        ? "Guest"
                        : "Reciprocal"}
                    <span className="ml-1 text-sm opacity-70">F</span>
                  </span>

                  {/* Fill Actions */}
                  {onRemoveFill && (
                    <div className="ml-auto flex items-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRemoveFill(fill.id);
                        }}
                        className="h-6 w-6 p-0 text-gray-500 hover:bg-red-100 hover:text-red-600"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}

              {/* Add Player button when slots are available */}
              {totalPeople < 4 && (
                <button
                  className="flex min-w-[120px] items-center gap-2 rounded-md border border-dashed border-blue-300 px-3 py-1.5 text-base font-medium text-blue-600 hover:cursor-pointer hover:bg-blue-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.dispatchEvent(
                      new CustomEvent("open-add-player-modal", {
                        detail: { timeBlockId: timeBlock.id },
                      }),
                    );
                  }}
                >
                  <UserPlus className="h-4 w-4" />
                  Add Player
                </button>
              )}
            </div>
          ) : (
            <button
              className="flex items-center gap-2 rounded-md border border-dashed border-blue-300 px-4 py-2 text-base font-medium text-blue-600 hover:cursor-pointer hover:bg-blue-50"
              onClick={(e) => {
                e.stopPropagation();
                window.dispatchEvent(
                  new CustomEvent("open-add-player-modal", {
                    detail: { timeBlockId: timeBlock.id },
                  }),
                );
              }}
            >
              <UserPlus className="h-5 w-5" />
              Add Players
            </button>
          )}
        </td>

        {/* Combined Actions + Status Column */}
        <td className="py-1.5">
          <div className="flex flex-col items-center gap-1">
            {/* Status Badge */}
            <Badge
              variant="outline"
              className={cn(
                "px-2 py-0.5 text-xs whitespace-nowrap",
                getPaceOfPlayStatusClass(paceOfPlay?.status || null),
              )}
            >
              {formatStatusForDisplay(paceOfPlay?.status || null)}
            </Badge>

            {/* Bulk Actions Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => onToggleNoteEdit?.()}>
                  <StickyNote className="mr-2 h-4 w-4" />
                  Add Note
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onCheckInAll?.()}
                  disabled={checkInDisabled}
                >
                  <UserCheck className="mr-2 h-4 w-4" />
                  Check In All
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </td>
      </tr>
    </TooltipProvider>
  );
}
