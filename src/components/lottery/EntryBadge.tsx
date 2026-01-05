"use client";

import React from "react";
import { Users, User } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { calculateDynamicTimeWindows } from "~/lib/lottery-utils";
import type { TeesheetConfigWithBlocks } from "~/server/db/schema";

// Helper types for lottery entry display
export interface LotteryEntryDisplay {
  id: string;
  name: string;
  isGroup: boolean;
  memberClass?: string;
  members?: Array<{ name: string; class: string }>;
  preferredWindow?: string;
  alternateWindow?: string;
  assignmentQuality?: "preferred" | "alternate" | "fallback";
  timeBlockId?: number;
}

interface EntryBadgeProps {
  entry: LotteryEntryDisplay;
  config?: TeesheetConfigWithBlocks;
}

// Cached member class mapping to prevent recalculation
const memberClassMap: Record<string, string> = {
  REGULAR: "REG",
  SENIOR: "SR",
  JUNIOR: "JR",
  STUDENT: "STU",
  CORPORATE: "CORP",
  HONORARY: "HON",
  MILITARY: "MIL",
  CLERGY: "CLG",
  INTERMEDIATE: "INT",
  OVERSEAS: "OVS",
};

const getShortMemberClass = (memberClass: string) => {
  return (
    memberClassMap[memberClass] || memberClass.substring(0, 3).toUpperCase()
  );
};

const getAssignmentQuality = (
  assignedTime: string,
  preferredWindow: string | null,
  alternateWindow: string | null,
  config?: TeesheetConfigWithBlocks,
): "preferred" | "alternate" | "fallback" => {
  if (!config) return "fallback";

  // Get dynamic time windows based on config
  const timeWindows = calculateDynamicTimeWindows(config);

  // Convert time to minutes for comparison
  const timeParts = assignedTime.split(":");
  const hours = parseInt(timeParts[0] || "0", 10);
  const minutes = parseInt(timeParts[1] || "0", 10);
  const assignedMinutes = hours * 60 + minutes;

  // Check if it falls within preferred window
  if (preferredWindow) {
    const preferredIndex = parseInt(preferredWindow, 10);
    const preferredWindowInfo = timeWindows.find(
      (w) => w.index === preferredIndex,
    );
    if (
      preferredWindowInfo &&
      assignedMinutes >= preferredWindowInfo.startMinutes &&
      assignedMinutes < preferredWindowInfo.endMinutes
    ) {
      return "preferred";
    }
  }

  // Check if it falls within alternate window
  if (alternateWindow) {
    const alternateIndex = parseInt(alternateWindow, 10);
    const alternateWindowInfo = timeWindows.find(
      (w) => w.index === alternateIndex,
    );
    if (
      alternateWindowInfo &&
      assignedMinutes >= alternateWindowInfo.startMinutes &&
      assignedMinutes < alternateWindowInfo.endMinutes
    ) {
      return "alternate";
    }
  }

  return "fallback";
};

// Cached quality color mapping
const qualityColorMap = {
  preferred: "border-green-400 bg-green-50 text-green-800",
  alternate: "border-yellow-400 bg-yellow-50 text-yellow-800",
  fallback: "border-red-400 bg-red-50 text-red-800",
} as const;

const getAssignmentQualityColor = (
  quality: "preferred" | "alternate" | "fallback",
) => {
  return qualityColorMap[quality];
};

// Memoized EntryBadge component
export const EntryBadge = React.memo<EntryBadgeProps>(({ entry, config }) => {
  const qualityColor = entry.assignmentQuality
    ? getAssignmentQualityColor(entry.assignmentQuality)
    : "border-gray-300 bg-gray-50 text-gray-700";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`inline-flex cursor-default items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${qualityColor} `}
        >
          {entry.isGroup ? (
            <Users className="h-3 w-3" />
          ) : (
            <User className="h-3 w-3" />
          )}
          <span className="max-w-[120px] truncate">
            {entry.name.replace(" (Group)", "")}
          </span>
          {entry.isGroup && (
            <span className="text-xs opacity-70">
              ({entry.members?.length || 0})
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-[300px]">
        <div className="space-y-2">
          <div className="font-medium">{entry.name}</div>

          {/* Member class info */}
          {entry.memberClass && (
            <div className="text-xs text-gray-600">
              Class: {entry.memberClass}
            </div>
          )}

          {/* Group member details */}
          {entry.isGroup && entry.members && (
            <div className="text-xs">
              <div className="mb-1 font-medium">Members:</div>
              {entry.members.map((member, idx) => (
                <div key={idx} className="text-gray-600">
                  {member.name} ({getShortMemberClass(member.class)})
                </div>
              ))}
            </div>
          )}

          {/* Time preferences */}
          {entry.preferredWindow && (
            <div className="text-xs">
              <span className="font-medium">Preferred:</span>{" "}
              {entry.preferredWindow}
              {entry.alternateWindow && (
                <>
                  <br />
                  <span className="font-medium">Alternate:</span>{" "}
                  {entry.alternateWindow}
                </>
              )}
            </div>
          )}

          {/* Assignment quality */}
          {entry.assignmentQuality && (
            <div className="text-xs">
              <span className="font-medium">Got:</span>{" "}
              <span
                className={
                  entry.assignmentQuality === "preferred"
                    ? "text-green-600"
                    : entry.assignmentQuality === "alternate"
                      ? "text-yellow-600"
                      : "text-red-600"
                }
              >
                {entry.assignmentQuality === "preferred"
                  ? "✅ Preferred time"
                  : entry.assignmentQuality === "alternate"
                    ? "⚠️ Alternate time"
                    : "❌ Fallback time"}
              </span>
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
});

EntryBadge.displayName = "EntryBadge";
