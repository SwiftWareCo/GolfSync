"use client";

import React from "react";
import { Button } from "~/components/ui/button";
import { Users, Ban, AlertCircle, CheckCircle, ClockIcon } from "lucide-react";
import { formatTime12Hour } from "~/lib/dates";
import type { Fill } from "~/server/db/schema";

// Member type for client-side usage
type ClientMember = {
  id: number;
  classId: number;
  firstName: string;
  lastName: string;
  memberClass?: { id: number; label: string } | null;
  [key: string]: any;
};

// View types for UI state
type TimeBlockMemberView = {
  id: number;
  firstName: string;
  lastName: string;
  checkedIn: boolean | null;
  checkedInAt?: Date | null;
  memberClass?: { label: string } | null;
  [key: string]: any;
};

// Define ClientTimeBlock for client-side usage to avoid type conflicts
type ClientTimeBlock = {
  id: number;
  startTime: string;
  endTime: string;
  members: TimeBlockMemberView[];
  fills: Fill[];
  maxMembers: number;
  [key: string]: any;
};

export interface TimeBlockItemProps {
  timeBlock: ClientTimeBlock;
  isBooked: boolean;
  isAvailable: boolean;
  isPast?: boolean;
  onBook: () => void;
  onCancel: () => void;
  onShowDetails?: () => void;
  disabled?: boolean;
  member?: ClientMember;
  id?: string;
  isRestricted?: boolean;
}

export function TimeBlockItem({
  timeBlock,
  isBooked,
  isAvailable,
  isPast = false,
  onBook,
  onCancel,
  onShowDetails,
  disabled = false,
  member,
  id,
  isRestricted = false,
}: TimeBlockItemProps) {
  // Format the start time for display using our proper date utility function
  const startTimeDisplay = formatTime12Hour(timeBlock.startTime);

  // Calculate total people including fills
  const totalPeople = timeBlock.members.length + (timeBlock.fills?.length || 0);
  const maxPlayers = timeBlock.maxMembers || 4;

  // Check for different types of restrictions
  const hasAvailabilityViolation = timeBlock.restriction?.violations?.some(
    (v: any) => v.type === "AVAILABILITY",
  );
  const hasTimeViolation = timeBlock.restriction?.violations?.some(
    (v: any) => v.type === "TIME",
  );
  const hasFrequencyViolation = timeBlock.restriction?.violations?.some(
    (v: any) => v.type === "FREQUENCY",
  );

  // AVAILABILITY and TIME restrictions completely block booking, FREQUENCY allows booking with warning
  const isAvailabilityRestricted = hasAvailabilityViolation;
  const isTimeRestricted = hasTimeViolation && !hasAvailabilityViolation;
  const isFrequencyRestricted =
    hasFrequencyViolation && !hasTimeViolation && !hasAvailabilityViolation;

  // Determine if the button should be disabled
  const isButtonDisabled =
    disabled || isPast || isAvailabilityRestricted || isTimeRestricted;

  // Check if current member is checked in
  const isMemberCheckedIn =
    isBooked &&
    member &&
    timeBlock.members.some((m) => m.id === member.id && m.checkedIn);

  // Check if all members are checked in
  const allMembersCheckedIn =
    timeBlock.members.length > 0 && timeBlock.members.every((m) => m.checkedIn);

  // Determine cell status and styling
  const getStatusInfo = () => {
    if (isPast)
      return {
        status: "PAST",
        bgColor: "bg-gray-50",
        borderColor: "border-gray-300",
        textColor: "text-gray-500",
        statusBgColor: "bg-gray-100",
        statusTextColor: "text-gray-600",
      };
    if (isAvailabilityRestricted)
      return {
        status: "UNAVAILABLE",
        bgColor: "bg-red-50",
        borderColor: "border-red-400",
        textColor: "text-red-700",
        statusBgColor: "bg-red-100",
        statusTextColor: "text-red-700",
      };
    if (isTimeRestricted)
      return {
        status: "RESTRICTED",
        bgColor: "bg-red-50",
        borderColor: "border-red-400",
        textColor: "text-red-700",
        statusBgColor: "bg-red-100",
        statusTextColor: "text-red-700",
      };
    if (allMembersCheckedIn)
      return {
        status: "CHECKED IN",
        bgColor: "bg-emerald-50",
        borderColor: "border-emerald-400",
        textColor: "text-emerald-700",
        statusBgColor: "bg-emerald-100",
        statusTextColor: "text-emerald-700",
      };
    if (isBooked)
      return {
        status: "BOOKED",
        bgColor: "bg-blue-50",
        borderColor: "border-blue-400",
        textColor: "text-blue-700",
        statusBgColor: "bg-blue-100",
        statusTextColor: "text-blue-700",
      };
    if (!isAvailable)
      return {
        status: "FULL",
        bgColor: "bg-orange-50",
        borderColor: "border-orange-300",
        textColor: "text-orange-700",
        statusBgColor: "bg-orange-100",
        statusTextColor: "text-orange-700",
      };
    if (isFrequencyRestricted)
      return {
        status: "AVAILABLE*",
        bgColor: "bg-yellow-50",
        borderColor: "border-yellow-400",
        textColor: "text-yellow-700",
        statusBgColor: "bg-yellow-100",
        statusTextColor: "text-yellow-700",
      };
    return {
      status: "AVAILABLE",
      bgColor: "bg-green-50",
      borderColor: "border-green-400",
      textColor: "text-green-700",
      statusBgColor: "bg-green-100",
      statusTextColor: "text-green-700",
    };
  };

  const statusInfo = getStatusInfo();

  // Handle click on the main area to show details
  const handleShowDetails = (e: React.MouseEvent) => {
    // Don't open details if clicking on a button
    if ((e.target as HTMLElement).closest("button")) {
      return;
    }
    if (onShowDetails) {
      onShowDetails();
    }
  };

  return (
    <div
      id={id}
      className={`relative flex items-center justify-between rounded-lg border-2 shadow-sm transition-all duration-200 ${statusInfo.bgColor} ${statusInfo.borderColor} cursor-pointer hover:shadow-md active:scale-[0.99]`}
      onClick={handleShowDetails}
    >
      {/* Left Section: Time and Status */}
      <div className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5">
        {/* Time Display */}
        <div className="flex min-w-[70px] items-center">
          <span className="text-sm font-bold whitespace-nowrap text-gray-900">
            {startTimeDisplay}
          </span>
        </div>

        {/* Status Badge */}
        <div
          className={`flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusInfo.statusBgColor} ${statusInfo.statusTextColor}`}
        >
          {statusInfo.status}
        </div>

        {/* Warning Icons */}
        {isMemberCheckedIn && (
          <CheckCircle className="h-4 w-4 text-green-500" />
        )}
        {isAvailabilityRestricted && <Ban className="h-4 w-4 text-red-600" />}
        {isTimeRestricted && <Ban className="h-4 w-4 text-red-500" />}
        {isFrequencyRestricted && (
          <AlertCircle className="h-4 w-4 text-yellow-500" />
        )}
        {isPast && <ClockIcon className="h-4 w-4 text-gray-400" />}
      </div>

      {/* Right Section: Capacity and Actions */}
      <div className="flex flex-shrink-0 items-center gap-2 px-3 py-2.5">
        {/* Capacity Display */}
        <div
          className={`flex items-center justify-center gap-1 rounded-full px-2.5 py-1 font-medium ${
            totalPeople === maxPlayers
              ? "bg-orange-100 text-orange-700"
              : totalPeople > 0
                ? "bg-blue-100 text-blue-700"
                : "bg-gray-100 text-gray-600"
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          <span className="text-sm">
            {totalPeople}/{maxPlayers}
          </span>
        </div>

        {/* Action Buttons */}
        <div
          className="flex items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {isBooked ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={onCancel}
              disabled={isButtonDisabled}
              className="flex h-8 items-center justify-center px-3 text-xs font-medium"
            >
              Cancel
            </Button>
          ) : isAvailabilityRestricted ? (
            <Button
              variant="outline"
              size="sm"
              disabled
              className="flex h-8 items-center justify-center border-red-300 bg-red-50 px-2 text-xs text-red-500 sm:px-2.5"
            >
              <Ban className="h-3 w-3 sm:mr-1" />
              <span className="hidden sm:inline">Unavailable</span>
            </Button>
          ) : isTimeRestricted ? (
            <Button
              variant="outline"
              size="sm"
              disabled
              className="flex h-8 items-center justify-center border-red-300 bg-red-50 px-2 text-xs text-red-500 sm:px-2.5"
            >
              <Ban className="h-3 w-3 sm:mr-1" />
              <span className="hidden sm:inline">Restricted</span>
            </Button>
          ) : isPast ? (
            <Button
              variant="outline"
              size="sm"
              disabled
              className="flex h-8 items-center justify-center border-gray-300 bg-gray-50 px-3 text-xs text-gray-500"
            >
              Past
            </Button>
          ) : !isAvailable ? (
            <Button
              variant="outline"
              size="sm"
              disabled
              className="flex h-8 items-center justify-center border-orange-300 bg-orange-50 px-3 text-xs text-orange-600"
            >
              Full
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={onBook}
              className="bg-org-primary hover:bg-org-primary/90 flex h-8 items-center justify-center px-3 text-xs font-medium"
              disabled={isButtonDisabled}
            >
              {isFrequencyRestricted ? "Book*" : "Book"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
