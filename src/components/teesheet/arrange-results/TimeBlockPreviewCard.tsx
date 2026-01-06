"use client";

import React, { useCallback, useMemo } from "react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { ChevronUp, ChevronDown, Plus, Trash2 } from "lucide-react";
import { formatTime12Hour } from "~/lib/dates";
import { EntryBadge, type LotteryEntryDisplay } from "../../lottery/EntryBadge";
import type {
  TimeBlockWithRelations,
  TeesheetConfigWithBlocks,
} from "~/server/db/schema";

// Client-side assignment interface matching TeesheetPreviewAndArrange
interface ClientSideAssignment {
  id: string;
  name: string;
  entryId: number;
  isGroup: boolean;
  members?: string[];
  memberIds?: number[];
  memberClasses?: { name: string; class: string; id: number }[];
  memberClass?: string;
  preferredWindow?: string;
  alternateWindow?: string | null;
  size: number;
  assignmentQuality?: "preferred" | "alternate" | "fallback" | null;
  originalTimeBlockId?: number | null;
  currentTimeBlockId?: number | null;
  hasChanges?: boolean;
  // Guest data
  guests?: { name: string }[];
  guestFillCount?: number;
}

interface TimeBlockPreviewCardProps {
  block: TimeBlockWithRelations;
  assignedEntries?: ClientSideAssignment[];
  onMoveUp: () => void;
  onMoveDown: () => void;
  onInsert: () => void;
  onDelete?: () => void;
  onTimeBlockClick?: () => void;
  onEntryClick?: (entryId: string) => void;
  selectedEntryId?: string;
  disabled: boolean;
  config?: TeesheetConfigWithBlocks;
}

// Memoized component to render individual member entries within groups
const MemoizedMemberEntry = React.memo<{
  entry: ClientSideAssignment;
  memberIndex: number;
  config?: TeesheetConfigWithBlocks;
}>(({ entry, memberIndex, config }) => {
  const member = entry.memberClasses?.[memberIndex];
  if (!member) return null;

  const memberEntry: LotteryEntryDisplay = {
    id: `${entry.id}-member-${memberIndex}`,
    name: member.name,
    isGroup: false,
    memberClass: member.class,
    members: [],
    preferredWindow: entry.preferredWindow,
    alternateWindow: entry.alternateWindow || undefined,
    assignmentQuality: entry.assignmentQuality || undefined,
    timeBlockId: entry.currentTimeBlockId || undefined,
  };

  return (
    <EntryBadge
      key={`${entry.id}-member-${memberIndex}`}
      entry={memberEntry}
      config={config}
    />
  );
});

MemoizedMemberEntry.displayName = "MemoizedMemberEntry";

// Memoized group rendering component to batch tooltip optimizations
const MemoizedGroupEntry = React.memo<{
  entry: ClientSideAssignment;
  onEntryClick: (entryId: string) => void;
  selectedEntryId?: string;
  config?: TeesheetConfigWithBlocks;
  isUnassigned?: boolean;
}>(({ entry, onEntryClick, selectedEntryId, config, isUnassigned = false }) => {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onEntryClick(entry.id);
    },
    [onEntryClick, entry.id],
  );

  const borderColor = isUnassigned
    ? "border-orange-300 bg-orange-50/30"
    : "border-blue-300 bg-blue-50/30";
  const hoverColor = isUnassigned
    ? "hover:bg-orange-100/50"
    : "hover:bg-blue-100/50";
  const titleText = isUnassigned
    ? "Unassigned group - Click to select"
    : "Group booking - Click to select";

  return (
    <div
      onClick={handleClick}
      className={`flex min-h-[32px] min-w-[60px] cursor-pointer flex-wrap gap-1 rounded-md border-2 border-dashed ${borderColor} p-2 ${
        selectedEntryId === entry.id ? "ring-2 ring-blue-500" : hoverColor
      }`}
      title={titleText}
    >
      {/* Members */}
      {entry.memberClasses?.map((_, idx) => (
        <MemoizedMemberEntry
          key={`${entry.id}-member-${idx}`}
          entry={entry}
          memberIndex={idx}
          config={config}
        />
      ))}
      {/* Guests */}
      {entry.guests?.map((guest, index) => (
        <Badge
          key={`guest-${index}`}
          variant="outline"
          className="border-purple-400 bg-purple-50 text-xs text-purple-700"
        >
          {guest.name}
        </Badge>
      ))}
      {/* Guest Fills - render each as individual badge */}
      {Array.from({ length: entry.guestFillCount ?? 0 }).map((_, index) => (
        <Badge
          key={`fill-${index}`}
          variant="outline"
          className="border-amber-400 bg-amber-50 text-xs text-amber-700"
        >
          Guest Fill
        </Badge>
      ))}
    </div>
  );
});

MemoizedGroupEntry.displayName = "MemoizedGroupEntry";

// Memoized individual entry component
const MemoizedIndividualEntry = React.memo<{
  entry: ClientSideAssignment;
  onEntryClick: (entryId: string) => void;
  selectedEntryId?: string;
  config?: TeesheetConfigWithBlocks;
  isUnassigned?: boolean;
}>(({ entry, onEntryClick, selectedEntryId, config, isUnassigned = false }) => {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onEntryClick(entry.id);
    },
    [onEntryClick, entry.id],
  );

  const convertToLotteryDisplay = useMemo(
    (): LotteryEntryDisplay => ({
      id: entry.id,
      name: entry.name,
      isGroup: entry.isGroup,
      memberClass: entry.memberClass,
      members:
        entry.memberClasses?.map((m) => ({ name: m.name, class: m.class })) ||
        [],
      preferredWindow: entry.preferredWindow,
      alternateWindow: entry.alternateWindow || undefined,
      assignmentQuality: entry.assignmentQuality || undefined,
      timeBlockId: entry.currentTimeBlockId || undefined,
    }),
    [entry],
  );

  const borderColor = isUnassigned
    ? "border-gray-300 bg-gray-50/30"
    : "border-green-300 bg-green-50/30";
  const hoverColor = isUnassigned
    ? "hover:bg-gray-100/50"
    : "hover:bg-green-100/50";
  const titleText = isUnassigned
    ? "Unassigned individual - Click to select"
    : "Individual booking - Click to select";

  return (
    <div
      onClick={handleClick}
      className={`flex min-h-[32px] min-w-[60px] cursor-pointer rounded-md border-2 border-dashed ${borderColor} p-2 ${
        selectedEntryId === entry.id ? "ring-2 ring-blue-500" : hoverColor
      }`}
      title={titleText}
    >
      <EntryBadge entry={convertToLotteryDisplay} config={config} />
    </div>
  );
});

MemoizedIndividualEntry.displayName = "MemoizedIndividualEntry";

// Main component with React.memo and proper comparison
export const TimeBlockPreviewCard = React.memo<TimeBlockPreviewCardProps>(
  ({
    block,
    assignedEntries = [],
    onMoveUp,
    onMoveDown,
    onInsert,
    onDelete,
    onTimeBlockClick,
    onEntryClick,
    selectedEntryId,
    disabled,
    config,
  }) => {
    // Memoized calculations
    const totalMembers = useMemo(() => {
      return assignedEntries.reduce((sum, entry) => sum + entry.size, 0);
    }, [assignedEntries]);

    const maxMembers = block.maxMembers || 4;

    // Memoized entry click handler
    const handleEntryClick = useCallback(
      (entryId: string) => {
        onEntryClick?.(entryId);
      },
      [onEntryClick],
    );

    return (
      <div className="flex items-center gap-4 rounded border p-3">
        {/* Time and Capacity */}
        <div className="flex min-w-[120px] flex-col">
          <div className="flex items-center gap-2">
            <span className="font-semibold">
              {formatTime12Hour(block.startTime)}
            </span>
            <Badge variant="outline" className="text-xs">
              {totalMembers}/{maxMembers}
            </Badge>
          </div>
          {block.displayName && (
            <span className="text-xs text-gray-500">{block.displayName}</span>
          )}
        </div>

        {/* Lottery Entries */}
        <div className="flex-1 cursor-pointer" onClick={onTimeBlockClick}>
          <div className="flex flex-wrap gap-1">
            {assignedEntries.map((entry) => {
              if (
                entry.isGroup &&
                entry.memberClasses &&
                entry.memberClasses.length > 0
              ) {
                return (
                  <MemoizedGroupEntry
                    key={entry.id}
                    entry={entry}
                    onEntryClick={handleEntryClick}
                    selectedEntryId={selectedEntryId}
                    config={config}
                  />
                );
              } else {
                return (
                  <MemoizedIndividualEntry
                    key={entry.id}
                    entry={entry}
                    onEntryClick={handleEntryClick}
                    selectedEntryId={selectedEntryId}
                    config={config}
                  />
                );
              }
            })}
            {assignedEntries.length === 0 && (
              <span className="text-xs text-gray-500">No lottery entries</span>
            )}
          </div>
        </div>

        {/* Arrange Controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onMoveUp}
            disabled={disabled}
            className="h-6 w-6 p-0 hover:bg-blue-100"
            title="Swap players with time block above"
          >
            <ChevronUp className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onMoveDown}
            disabled={disabled}
            className="h-6 w-6 p-0 hover:bg-blue-100"
            title="Swap players with time block below"
          >
            <ChevronDown className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onInsert}
            disabled={disabled}
            className="h-6 w-6 p-0 hover:bg-green-100"
            title="Insert timeblock after this one"
          >
            <Plus className="h-3 w-3" />
          </Button>
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              disabled={disabled}
              className="h-6 w-6 p-0 hover:bg-red-100"
              title="Delete timeblock"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function for optimal re-rendering
    return (
      prevProps.block.id === nextProps.block.id &&
      prevProps.block.startTime === nextProps.block.startTime &&
      prevProps.block.maxMembers === nextProps.block.maxMembers &&
      prevProps.block.displayName === nextProps.block.displayName &&
      prevProps.assignedEntries?.length === nextProps.assignedEntries?.length &&
      prevProps.selectedEntryId === nextProps.selectedEntryId &&
      prevProps.disabled === nextProps.disabled &&
      prevProps.config === nextProps.config &&
      prevProps.onDelete === nextProps.onDelete &&
      // Deep comparison for assigned entries if lengths are equal
      (prevProps.assignedEntries?.every((entry, idx) => {
        const nextEntry = nextProps.assignedEntries?.[idx];
        return (
          nextEntry &&
          entry.id === nextEntry.id &&
          entry.hasChanges === nextEntry.hasChanges &&
          entry.currentTimeBlockId === nextEntry.currentTimeBlockId
        );
      }) ??
        true)
    );
  },
);

TimeBlockPreviewCard.displayName = "TimeBlockPreviewCard";
