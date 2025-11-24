"use client";

import React, { useEffect } from "react";
import { X, UserIcon, Users, CheckCircle } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  type TimeBlockMemberView,
  type TimeBlockFill,
} from "~/app/types/TeeSheetTypes";
import { formatTimeString } from "~/lib/utils";

type ClientTimeBlock = {
  id: number;
  startTime: string;
  endTime: string;
  members: TimeBlockMemberView[];
  fills: TimeBlockFill[];
  [key: string]: any;
};

interface PlayerDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  timeBlock: ClientTimeBlock | null;
}

export function PlayerDetailsDrawer({
  isOpen,
  onClose,
  timeBlock,
}: PlayerDetailsDrawerProps) {
  // Close drawer on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      // Prevent body scroll when drawer is open
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen || !timeBlock) return null;

  const totalPeople = timeBlock.members.length + (timeBlock.fills?.length || 0);
  const maxPlayers = timeBlock.maxMembersPerBlock || 4;
  const startTimeDisplay = formatTimeString(timeBlock.startTime);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed right-0 bottom-0 left-0 z-50 transform rounded-t-xl bg-white shadow-2xl transition-transform duration-300 ease-out ${isOpen ? "translate-y-0" : "translate-y-full"} max-h-[70vh] overflow-hidden`}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="h-1 w-10 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Users className="text-org-primary h-5 w-5" />
              <h3 className="text-lg font-semibold text-gray-900">
                {startTimeDisplay} Tee Time
              </h3>
            </div>
            <Badge variant="outline" className="text-xs">
              {totalPeople}/{maxPlayers} Players
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="max-h-[calc(70vh-80px)] overflow-y-auto">
          <div className="space-y-4 p-4">
            {/* Members Section */}
            {timeBlock.members.length > 0 && (
              <div>
                <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <UserIcon className="h-4 w-4" />
                  Members ({timeBlock.members.length})
                </h4>
                <div className="space-y-2">
                  {timeBlock.members.map((member, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between rounded-lg border p-3 ${
                        member.checkedIn
                          ? "border-green-200 bg-green-50"
                          : "border-gray-200 bg-gray-50"
                      } `}
                    >
                      <div className="flex items-center gap-3">
                        {member.checkedIn ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                        )}
                        <div>
                          <p
                            className={`font-medium ${
                              member.checkedIn
                                ? "text-green-700"
                                : "text-gray-900"
                            }`}
                          >
                            {member.firstName} {member.lastName}
                          </p>
                          {member.class && (
                            <p className="text-xs text-gray-500">
                              {member.class}
                            </p>
                          )}
                        </div>
                      </div>
                      {member.checkedIn && (
                        <Badge className="bg-green-500 text-xs hover:bg-green-600">
                          Checked In
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fills Section */}
            {timeBlock.fills && timeBlock.fills.length > 0 && (
              <div>
                <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Users className="h-4 w-4" />
                  Fills ({timeBlock.fills.length})
                </h4>
                <div className="space-y-2">
                  {timeBlock.fills.map((fill, idx) => (
                    <div
                      key={`fill-${idx}`}
                      className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <UserIcon className="h-5 w-5 text-blue-500" />
                        <div>
                          <p className="font-medium text-blue-700">
                            {fill.fillType === "custom_fill"
                              ? fill.customName || "Custom Fill"
                              : fill.fillType === "guest_fill"
                                ? "Guest Fill"
                                : "Reciprocal Fill"}
                          </p>
                          <p className="text-xs text-blue-600">Fill Player</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        Fill
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {totalPeople === 0 && (
              <div className="py-8 text-center">
                <Users className="mx-auto mb-3 h-12 w-12 text-gray-300" />
                <p className="text-sm text-gray-500">
                  No players in this time slot
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  This tee time is available for booking
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
