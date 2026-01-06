"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { LoadingSpinner } from "~/components/ui/loading-spinner";
import { toast } from "react-hot-toast";
import {
  Calendar,
  RotateCw,
  ChevronDown,
  ChevronRight,
  Save,
  Undo,
  Play,
  Sliders,
} from "lucide-react";
import { insertTimeBlock, deleteTimeBlock } from "~/server/teesheet/actions";
import {
  batchUpdateLotteryAssignments,
  assignFairnessScoresForDate,
} from "~/server/lottery/actions";
import { formatDate } from "~/lib/dates";
import { InsertTimeBlockDialog } from "../teesheet/arrange-results/InsertTimeBlockDialog";
import { TimeBlockPreviewCard } from "../teesheet/arrange-results/TimeBlockPreviewCard";
import { EntryBadge, type LotteryEntryDisplay } from "./EntryBadge";
import { calculateDynamicTimeWindows } from "~/lib/lottery-utils";
import { TooltipProvider } from "~/components/ui/tooltip";
import { ConfirmationDialog } from "~/components/ui/confirmation-dialog";
import type {
  TimeBlockWithRelations,
  TeesheetConfigWithBlocks,
} from "~/server/db/schema";

// Client-side assignment tracking (from LotteryConfirmationAndEdit)
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
  guestFillCount?: number;
  guests?: Array<{ name: string }>;
}

// Pending changes tracking
interface PendingChange {
  entryId: number;
  isGroup: boolean;
  assignedTimeBlockId: number | null;
  type: "assignment" | "member_move" | "member_add";
  details?: any;
}

// Selection state
interface SelectedItem {
  type: "entry";
  entryId: string;
  sourceTimeBlockId?: number | null;
  isGroup?: boolean;
}

// Confirmation dialog state
interface ConfirmDialogState {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
  variant?: "default" | "destructive";
}

// Time block with assigned lottery entries
interface TimeBlockWithEntries extends TimeBlockWithRelations {
  assignedEntries: ClientSideAssignment[];
}

interface LotteryStats {
  totalEntries: number;
  individualEntries: number;
  groupEntries: number;
  totalPlayers: number;
  availableSlots: number;
  processingStatus: "pending" | "processing" | "completed";
}

interface TeesheetPreviewAndArrangeProps {
  date: string;
  timeBlocks: TimeBlockWithRelations[];
  teesheetId: number;
  onTimeBlocksChange: (timeBlocks: TimeBlockWithRelations[]) => void;
  teesheetData?: {
    teesheet: any;
    config: TeesheetConfigWithBlocks;
    timeBlocks: TimeBlockWithRelations[];
    availableConfigs: any[];
    paceOfPlayData: any[];
    lotterySettings?: any;
    date: string;
  };
  lotteryEntries?: any;
  members?: Array<{
    id: number;
    firstName: string;
    lastName: string;
    memberClass?: { label: string } | null;
  }>;
  // Props from sidebar selection
  selectedEntryId?: string | null;
  onEntryClick?: (entryId: string) => void;
  // Processing control props
  stats?: LotteryStats;
  onProcessLottery?: () => void;
  isProcessing?: boolean;
  canProcess?: boolean;
  onOpenAlgorithmSettings?: () => void;
}

export function TeesheetPreviewAndArrange({
  date,
  timeBlocks,
  teesheetId,
  onTimeBlocksChange,
  teesheetData,
  lotteryEntries,
  members,
  selectedEntryId: externalSelectedEntryId,
  onEntryClick: externalOnEntryClick,
  stats,
  onProcessLottery,
  isProcessing,
  canProcess,
  onOpenAlgorithmSettings,
}: TeesheetPreviewAndArrangeProps) {
  const [insertTimeBlockDialogOpen, setInsertTimeBlockDialogOpen] =
    useState(false);
  const [insertAfterTimeBlockId, setInsertAfterTimeBlockId] = useState<
    number | null
  >(null);
  const [isLoading, setIsLoading] = useState(false);

  // Client-side state management
  const [clientTimeBlocks, setClientTimeBlocks] = useState<
    TimeBlockWithEntries[]
  >([]);
  const [unassignedEntries, setUnassignedEntries] = useState<
    ClientSideAssignment[]
  >([]);
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [isSavingChanges, setIsSavingChanges] = useState(false);
  const [isAssigningFairnessScores, setIsAssigningFairnessScores] =
    useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    open: false,
    title: "",
    description: "",
    onConfirm: () => {},
    variant: "default",
  });

  // Get dynamic time windows from config (memoized to prevent re-calculation)
  const timeWindows = useMemo(() => {
    return teesheetData?.config
      ? calculateDynamicTimeWindows(teesheetData.config)
      : [];
  }, [teesheetData?.config]);

  // Memoized member class mappings to prevent recalculation
  const memberClassMappings = useMemo(() => {
    if (!members || !members.length) return new Map();

    const map = new Map<number, { name: string; class: string }>();
    members.forEach((member) => {
      map.set(member.id, {
        name: `${member.firstName} ${member.lastName}`,
        class: member.memberClass?.label ?? "",
      });
    });
    return map;
  }, [members]);

  // Helper function to calculate assignment quality using dynamic windows
  const getAssignmentQuality = useCallback(
    (
      assignedTime: string,
      preferredWindow: string | null,
      alternateWindow: string | null,
    ): "preferred" | "alternate" | "fallback" => {
      if (!teesheetData?.config) return "fallback";

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
    },
    [timeWindows, teesheetData?.config],
  );

  // Helper function to convert ClientSideAssignment to LotteryEntryDisplay (memoized)
  const convertToLotteryDisplay = useCallback(
    (entry: ClientSideAssignment): LotteryEntryDisplay => ({
      id: entry.id,
      name: entry.name,
      isGroup: entry.isGroup,
      memberClass: entry.memberClass,
      members:
        entry.memberClasses?.map((m) => ({
          name: m.name,
          class: m.class,
        })) || [],
      preferredWindow: entry.preferredWindow,
      alternateWindow: entry.alternateWindow || undefined,
      assignmentQuality: entry.assignmentQuality || undefined,
      timeBlockId: entry.currentTimeBlockId || undefined,
      guestFillCount: entry.guestFillCount,
      guests: entry.guests,
    }),
    [],
  );

  // Transform initial data into client-side state (memoized to prevent infinite re-renders)
  const transformInitialData = useCallback(() => {
    if (!lotteryEntries) return;

    const unassigned: ClientSideAssignment[] = [];
    const blocksWithEntries: TimeBlockWithEntries[] = [];

    // Process unassigned individual entries
    lotteryEntries.individual
      ?.filter((entry: any) => !entry.assignedTimeBlockId)
      .forEach((entry: any) => {
        unassigned.push({
          id: `individual-${entry.id}`,
          name: `${entry.organizer?.firstName || ""} ${entry.organizer?.lastName || ""}`,
          entryId: entry.id,
          isGroup: false,
          size: 1,
          memberClass: entry.organizer?.memberClass?.label,
          preferredWindow: entry.preferredWindow,
          alternateWindow: entry.alternateWindow,
          originalTimeBlockId: null,
          currentTimeBlockId: null,
          hasChanges: false,
          guestFillCount: entry.guestFillCount || 0,
          guests:
            entry.guests?.map((g: any) => ({
              name: `${g.firstName} ${g.lastName}`,
            })) || [],
        });
      });

    // Process unassigned group entries
    lotteryEntries.groups
      ?.filter((group: any) => !group.assignedTimeBlockId)
      .forEach((group: any) => {
        const memberNames =
          group.members?.map((m: any) => `${m.firstName} ${m.lastName}`) || [];
        const memberClasses =
          group.members?.map((m: any) => ({
            name: `${m.firstName} ${m.lastName}`,
            class: m.memberClass?.label || "",
            id: m.id,
          })) || [];

        unassigned.push({
          id: `group-${group.id}`,
          name: `${group.organizer?.firstName || ""} ${group.organizer?.lastName || ""} (Group)`,
          entryId: group.id,
          isGroup: true,
          members: memberNames,
          memberIds: group.memberIds || [],
          memberClasses: memberClasses,
          size: (group.memberIds || []).length,
          memberClass: group.organizer?.memberClass?.label,
          preferredWindow: group.preferredWindow,
          alternateWindow: group.alternateWindow,
          originalTimeBlockId: null,
          currentTimeBlockId: null,
          hasChanges: false,
          guestFillCount: group.guestFillCount || 0,
          guests:
            group.guests?.map((g: any) => ({
              name: `${g.firstName} ${g.lastName}`,
            })) || [],
        });
      });

    // Process time blocks with assigned entries
    timeBlocks.forEach((block) => {
      const assignedEntries: ClientSideAssignment[] = [];

      // Add assigned individual entries
      lotteryEntries.individual
        ?.filter((entry: any) => entry.assignedTimeBlockId === block.id)
        .forEach((entry: any) => {
          assignedEntries.push({
            id: `individual-${entry.id}`,
            name: `${entry.organizer?.firstName || ""} ${entry.organizer?.lastName || ""}`,
            entryId: entry.id,
            isGroup: false,
            memberClass: entry.organizer?.memberClass?.label,
            preferredWindow: entry.preferredWindow,
            alternateWindow: entry.alternateWindow,
            assignmentQuality: getAssignmentQuality(
              block.startTime,
              entry.preferredWindow,
              entry.alternateWindow,
            ),
            size: 1,
            originalTimeBlockId: block.id,
            currentTimeBlockId: block.id,
            hasChanges: false,
            guestFillCount: entry.guestFillCount || 0,
            guests:
              entry.guests?.map((g: any) => ({
                name: `${g.firstName} ${g.lastName}`,
              })) || [],
          });
        });

      // Add assigned group entries
      lotteryEntries.groups
        ?.filter((group: any) => group.assignedTimeBlockId === block.id)
        .forEach((group: any) => {
          const memberNames =
            group.members?.map((m: any) => `${m.firstName} ${m.lastName}`) ||
            [];
          const memberClasses =
            group.members?.map((m: any) => ({
              name: `${m.firstName} ${m.lastName}`,
              class: m.memberClass?.label || "",
              id: m.id,
            })) || [];

          assignedEntries.push({
            id: `group-${group.id}`,
            name: `${group.organizer?.firstName || ""} ${group.organizer?.lastName || ""} (Group)`,
            entryId: group.id,
            isGroup: true,
            members: memberNames,
            memberIds: group.memberIds || [],
            memberClasses: memberClasses,
            memberClass: group.organizer?.memberClass?.label,
            preferredWindow: group.preferredWindow,
            alternateWindow: group.alternateWindow,
            assignmentQuality: getAssignmentQuality(
              block.startTime,
              group.preferredWindow,
              group.alternateWindow,
            ),
            size: group.memberIds?.length || 0,
            originalTimeBlockId: block.id,
            currentTimeBlockId: block.id,
            hasChanges: false,
            guestFillCount: group.guestFillCount || 0,
            guests:
              group.guests?.map((g: any) => ({
                name: `${g.firstName} ${g.lastName}`,
              })) || [],
          });
        });

      blocksWithEntries.push({
        ...block,
        assignedEntries,
      });
    });

    // Sort blocks by startTime to ensure chronological order
    blocksWithEntries.sort((a, b) => {
      const timeA = a.startTime.replace(":", "");
      const timeB = b.startTime.replace(":", "");
      return parseInt(timeA) - parseInt(timeB);
    });

    setUnassignedEntries(unassigned);
    setClientTimeBlocks(blocksWithEntries);
    setPendingChanges([]);
    setSelectedItem(null);
  }, [lotteryEntries, timeBlocks, getAssignmentQuality]);

  // Initialize data when props change
  React.useEffect(() => {
    transformInitialData();
  }, [transformInitialData]);

  // Sync external selection state with internal state
  React.useEffect(() => {
    if (externalSelectedEntryId !== undefined) {
      if (externalSelectedEntryId === null) {
        setSelectedItem(null);
      } else if (selectedItem?.entryId !== externalSelectedEntryId) {
        // Find the entry and set selection
        const entry = [
          ...unassignedEntries,
          ...clientTimeBlocks.flatMap((b) => b.assignedEntries),
        ].find((e) => e.id === externalSelectedEntryId);

        if (entry) {
          setSelectedItem({
            type: "entry",
            entryId: externalSelectedEntryId,
            isGroup: entry.isGroup,
            sourceTimeBlockId: entry.currentTimeBlockId,
          });
        }
      }
    }
  }, [
    externalSelectedEntryId,
    unassignedEntries,
    clientTimeBlocks,
    selectedItem?.entryId,
  ]);

  // Entry selection handler
  const handleEntryClick = (entryId: string) => {
    // Notify parent if callback provided
    if (externalOnEntryClick) {
      externalOnEntryClick(entryId);
    }

    if (selectedItem?.entryId === entryId) {
      setSelectedItem(null);
      return;
    }

    // Find the entry
    const entry = [
      ...unassignedEntries,
      ...clientTimeBlocks.flatMap((b) => b.assignedEntries),
    ].find((e) => e.id === entryId);

    if (!entry) return;

    // Check if we should swap with currently selected entry
    if (selectedItem?.type === "entry") {
      const currentEntry = [
        ...unassignedEntries,
        ...clientTimeBlocks.flatMap((b) => b.assignedEntries),
      ].find((e) => e.id === selectedItem.entryId);

      if (currentEntry && currentEntry.id !== entry.id) {
        swapEntries(selectedItem.entryId, entryId);
        return;
      }
    }

    setSelectedItem({
      type: "entry",
      entryId: entryId,
      isGroup: entry.isGroup,
      sourceTimeBlockId: entry.currentTimeBlockId,
    });
  };

  // Time block click handler (move selected entry here)
  const handleTimeBlockClick = (timeBlockId: number) => {
    if (!selectedItem) return;

    const entry = [
      ...unassignedEntries,
      ...clientTimeBlocks.flatMap((b) => b.assignedEntries),
    ].find((e) => e.id === selectedItem.entryId);

    if (!entry) return;

    // Check capacity
    const timeBlock = clientTimeBlocks.find((b) => b.id === timeBlockId);
    if (!timeBlock) return;

    const currentOccupancy = timeBlock.assignedEntries.reduce(
      (sum, assignment) => sum + assignment.size,
      0,
    );
    const availableSpots = Math.max(
      0,
      (timeBlock.maxMembers ?? 4) - currentOccupancy,
    );

    if (availableSpots >= entry.size) {
      moveEntryClientSide(selectedItem.entryId, timeBlockId);
      toast.success(`Moved ${entry.name} to time slot`);
    } else {
      toast.error("Not enough space in this time slot");
    }
  };

  // Swap two entries
  const swapEntries = (entryId1: string, entryId2: string) => {
    const entry1 = [
      ...unassignedEntries,
      ...clientTimeBlocks.flatMap((b) => b.assignedEntries),
    ].find((e) => e.id === entryId1);

    const entry2 = [
      ...unassignedEntries,
      ...clientTimeBlocks.flatMap((b) => b.assignedEntries),
    ].find((e) => e.id === entryId2);

    if (!entry1 || !entry2) {
      toast.error("Could not find entries to swap");
      return;
    }

    // Check capacity constraints for swapping between time blocks
    const entry1Location = entry1.currentTimeBlockId;
    const entry2Location = entry2.currentTimeBlockId;

    if (
      entry1Location !== null &&
      entry2Location !== null &&
      entry1Location !== entry2Location
    ) {
      const block1 = clientTimeBlocks.find((b) => b.id === entry1Location);
      const block2 = clientTimeBlocks.find((b) => b.id === entry2Location);

      if (block1 && block2) {
        const block1CurrentOccupancy = block1.assignedEntries.reduce(
          (sum, a) => sum + a.size,
          0,
        );
        const block2CurrentOccupancy = block2.assignedEntries.reduce(
          (sum, a) => sum + a.size,
          0,
        );

        const block1AfterSwap =
          block1CurrentOccupancy - entry1.size + entry2.size;
        const block2AfterSwap =
          block2CurrentOccupancy - entry2.size + entry1.size;

        if (
          block1AfterSwap > (block1.maxMembers ?? 4) ||
          block2AfterSwap > (block2.maxMembers ?? 4)
        ) {
          toast.error("Swap would exceed time block capacity");
          return;
        }
      }
    }

    // Perform the swap
    const temp1TimeBlockId = entry1.currentTimeBlockId;
    const temp2TimeBlockId = entry2.currentTimeBlockId;

    // Remove both entries from current locations and add to new locations
    moveEntryClientSide(entry1.id, temp2TimeBlockId ?? null, false);
    moveEntryClientSide(entry2.id, temp1TimeBlockId ?? null, false);

    setSelectedItem(null);
    toast.success(`Swapped ${entry1.name} and ${entry2.name}`);
  };

  // Move entry to new location (client-side)
  const moveEntryClientSide = (
    entryId: string,
    targetTimeBlockId: number | null,
    showToast: boolean = true,
  ) => {
    const sourceEntry = [
      ...unassignedEntries,
      ...clientTimeBlocks.flatMap((b) => b.assignedEntries),
    ].find((e) => e.id === entryId);

    if (!sourceEntry) return;

    // Remove from current location
    if (sourceEntry.currentTimeBlockId === null) {
      setUnassignedEntries((prev) => prev.filter((e) => e.id !== entryId));
    } else {
      setClientTimeBlocks((prev) =>
        prev.map((block) =>
          block.id === sourceEntry.currentTimeBlockId
            ? {
                ...block,
                assignedEntries: block.assignedEntries.filter(
                  (a) => a.id !== entryId,
                ),
              }
            : block,
        ),
      );
    }

    // Add to new location with changes tracking
    const updatedEntry = {
      ...sourceEntry,
      currentTimeBlockId: targetTimeBlockId,
      hasChanges: sourceEntry.originalTimeBlockId !== targetTimeBlockId,
    };

    if (targetTimeBlockId === null) {
      setUnassignedEntries((prev) => [...prev, updatedEntry]);
    } else {
      setClientTimeBlocks((prev) =>
        prev.map((block) =>
          block.id === targetTimeBlockId
            ? {
                ...block,
                assignedEntries: [...block.assignedEntries, updatedEntry],
              }
            : block,
        ),
      );
    }

    // Track the change
    setPendingChanges((prev) => {
      const existing = prev.find(
        (c) => c.entryId === sourceEntry.entryId && c.type === "assignment",
      );
      const newChange: PendingChange = {
        entryId: sourceEntry.entryId,
        isGroup: sourceEntry.isGroup,
        assignedTimeBlockId: targetTimeBlockId,
        type: "assignment",
      };

      if (existing) {
        return prev.map((c) =>
          c.entryId === sourceEntry.entryId && c.type === "assignment"
            ? newChange
            : c,
        );
      } else {
        return [...prev, newChange];
      }
    });

    if (showToast) {
      setSelectedItem(null);
    }
  };

  // Swap ALL players between adjacent time blocks
  const swapTimeBlockContents = (
    sourceBlockId: number,
    direction: "up" | "down",
  ) => {
    const sourceIndex = clientTimeBlocks.findIndex(
      (b) => b.id === sourceBlockId,
    );
    const targetIndex = direction === "up" ? sourceIndex - 1 : sourceIndex + 1;

    if (targetIndex < 0 || targetIndex >= clientTimeBlocks.length) {
      toast.error(`Cannot move ${direction} - no adjacent time block`);
      return;
    }

    const sourceBlock = clientTimeBlocks[sourceIndex];
    const targetBlock = clientTimeBlocks[targetIndex];

    if (!sourceBlock || !targetBlock) return;

    // Check capacity constraints
    const sourceTotalSize = sourceBlock.assignedEntries.reduce(
      (sum, e) => sum + e.size,
      0,
    );
    const targetTotalSize = targetBlock.assignedEntries.reduce(
      (sum, e) => sum + e.size,
      0,
    );

    if (
      sourceTotalSize > (targetBlock.maxMembers ?? 4) ||
      targetTotalSize > (sourceBlock.maxMembers ?? 4)
    ) {
      toast.error("Cannot swap - would exceed time block capacity");
      return;
    }

    // Perform the swap
    const sourceEntries = [...sourceBlock.assignedEntries];
    const targetEntries = [...targetBlock.assignedEntries];

    // Move all source entries to target block
    sourceEntries.forEach((entry) => {
      moveEntryClientSide(entry.id, targetBlock.id ?? null, false);
    });

    // Move all target entries to source block
    targetEntries.forEach((entry) => {
      moveEntryClientSide(entry.id, sourceBlock.id ?? null, false);
    });

    toast.success(`Swapped players between time blocks`);
  };

  // Save changes
  const handleSaveChanges = async () => {
    if (pendingChanges.length === 0) {
      toast.success("No changes to save");
      return;
    }

    setIsSavingChanges(true);
    try {
      const result = await batchUpdateLotteryAssignments(
        pendingChanges.filter((c) => c.type === "assignment"),
      );

      if (result.success) {
        toast.success(`Saved ${pendingChanges.length} changes`);
        // Reset pending changes and refresh data
        setPendingChanges([]);
        transformInitialData();
      } else {
        toast.error(result.error || "Failed to save changes");
      }
    } catch (error) {
      toast.error("An error occurred while saving changes");
    } finally {
      setIsSavingChanges(false);
    }
  };

  // Reset changes
  const handleResetChanges = () => {
    if (pendingChanges.length === 0) return;

    setConfirmDialog({
      open: true,
      title: "Reset Changes",
      description:
        "Are you sure you want to reset all unsaved changes? This action cannot be undone.",
      variant: "destructive",
      onConfirm: () => {
        transformInitialData(); // Reset to original state
        toast.success("Changes reset");
        setConfirmDialog((prev) => ({ ...prev, open: false }));
      },
    });
  };

  // Handle inserting new timeblock
  const handleInsertTimeBlock = async (newTimeBlockData: {
    startTime: string;
    displayName?: string;
    maxMembers?: number;
  }) => {
    if (!insertAfterTimeBlockId) return;

    setIsLoading(true);
    try {
      const result = await insertTimeBlock(teesheetId, insertAfterTimeBlockId, {
        ...newTimeBlockData,
        endTime: newTimeBlockData.startTime, // Same as start time per user request
      });
      if (result.success) {
        setInsertTimeBlockDialogOpen(false);
        setInsertAfterTimeBlockId(null);
        toast.success("Timeblock inserted successfully");
        // TODO: Optimistic update instead of full refresh
      } else {
        toast.error(result.error || "Failed to insert timeblock");
      }
    } catch (error) {
      console.error("Error inserting timeblock:", error);
      toast.error("Failed to insert timeblock");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle deleting timeblock
  const handleDeleteTimeBlock = (timeBlockId: number) => {
    setConfirmDialog({
      open: true,
      title: "Delete Time Block",
      description:
        "Are you sure you want to delete this time block? Any assigned entries will become unassigned. This action cannot be undone.",
      onConfirm: async () => {
        setIsLoading(true);
        try {
          const result = await deleteTimeBlock(teesheetId, timeBlockId);
          if (result.success) {
            toast.success("Time block deleted successfully");
            // Refresh the data by calling the callback
            onTimeBlocksChange([]);
          } else {
            toast.error(result.error || "Failed to delete time block");
          }
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        } catch (error) {
          console.error("Error deleting timeblock:", error);
          toast.error("Failed to delete time block");
        } finally {
          setIsLoading(false);
        }
      },
      variant: "destructive",
    });
  };

  // Handle opening insert dialog
  const handleOpenInsertDialog = (afterTimeBlockId: number) => {
    setInsertAfterTimeBlockId(afterTimeBlockId);
    setInsertTimeBlockDialogOpen(true);
  };

  // Handle Process Lottery with confirmation
  const handleProcessLotteryWithConfirm = () => {
    if (!onProcessLottery) return;

    setConfirmDialog({
      open: true,
      title: "Process Lottery",
      description:
        "This will run the lottery algorithm to assign all pending entries to time slots based on their preferences, fairness scores, and speed ratings. Entries with higher priority will be placed first. This action creates teesheet bookings - are you sure you want to proceed?",
      onConfirm: () => {
        setConfirmDialog((prev) => ({ ...prev, open: false }));
        onProcessLottery();
      },
      variant: "default",
    });
  };

  // Handle Fairness Scores with confirmation
  const handleFairnessScoresWithConfirm = () => {
    if (!teesheetData?.config) {
      toast.error("Teesheet configuration not available");
      return;
    }

    setConfirmDialog({
      open: true,
      title: "Assign Fairness Scores",
      description:
        "This will update each member's fairness score based on their final teesheet placement. Members who received their preferred time window will have their fairness score decreased, while those who didn't will have it increased. This helps ensure fair distribution in future lotteries.",
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, open: false }));
        await handleAssignFairnessScores();
      },
      variant: "default",
    });
  };

  // Handle assigning fairness scores (internal function)
  const handleAssignFairnessScores = async () => {
    if (!teesheetData?.config) {
      toast.error("Teesheet configuration not available");
      return;
    }

    setIsAssigningFairnessScores(true);
    try {
      const result = await assignFairnessScoresForDate(
        date,
        teesheetData.config,
      );
      if (result.success) {
        toast.success("Fairness scores assigned successfully");
        // Optionally refresh data
        onTimeBlocksChange([]);
      } else {
        toast.error(result.error || "Failed to assign fairness scores");
      }
    } catch (error) {
      console.error("Error assigning fairness scores:", error);
      toast.error("An error occurred while assigning fairness scores");
    } finally {
      setIsAssigningFairnessScores(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Sticky Save/Reset Controls */}
        {pendingChanges.length > 0 && (
          <div className="sticky top-0 z-10 border-b border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="text-sm">
                {pendingChanges.length} unsaved changes
              </Badge>
              <Button
                onClick={handleSaveChanges}
                disabled={isSavingChanges}
                variant="default"
                size="sm"
              >
                {isSavingChanges ? (
                  <>
                    <LoadingSpinner className="mr-2 h-4 w-4" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes ({pendingChanges.length})
                  </>
                )}
              </Button>
              <Button onClick={handleResetChanges} variant="ghost" size="sm">
                <Undo className="mr-2 h-4 w-4" />
                Reset
              </Button>
            </div>
          </div>
        )}

        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Teesheet Preview - {formatDate(date)}
                </CardTitle>
                <p className="mt-1 text-sm text-gray-600">
                  Click entries to select, then click time slots to move them.
                  Click up/down arrows to swap all players between adjacent time
                  blocks.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Process Lottery Button */}
                {onProcessLottery && (
                  <Button
                    onClick={handleProcessLotteryWithConfirm}
                    disabled={isProcessing || !canProcess}
                    variant="default"
                    size="sm"
                    className="bg-org-primary hover:bg-org-primary/90"
                    title={
                      !canProcess
                        ? "Lottery already processed or no entries to process"
                        : "Run lottery algorithm"
                    }
                  >
                    {isProcessing ? (
                      <>
                        <LoadingSpinner className="mr-2 h-4 w-4" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Process Lottery
                      </>
                    )}
                  </Button>
                )}

                {/* Algorithm Settings Button */}
                {onOpenAlgorithmSettings && (
                  <Button
                    onClick={onOpenAlgorithmSettings}
                    variant="outline"
                    size="sm"
                  >
                    <Sliders className="mr-2 h-4 w-4" />
                    Algorithm
                  </Button>
                )}

                {/* Assign Fairness Scores Button */}
                <Button
                  onClick={handleFairnessScoresWithConfirm}
                  disabled={
                    isAssigningFairnessScores ||
                    pendingChanges.length > 0 ||
                    !teesheetData?.config
                  }
                  variant="outline"
                  size="sm"
                  title={
                    pendingChanges.length > 0
                      ? "Please save all changes before assigning fairness scores"
                      : "Assign fairness scores based on final assignments"
                  }
                >
                  {isAssigningFairnessScores ? (
                    <>
                      <LoadingSpinner className="mr-2 h-4 w-4" />
                      Assigning...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Fairness Scores
                    </>
                  )}
                </Button>
              </div>
            </div>
            {pendingChanges.length > 0 && (
              <p className="mt-2 text-xs text-orange-600">
                Save all changes before assigning fairness scores
              </p>
            )}
          </CardHeader>
        </Card>

        {/* Teesheet Content */}
        <Card>
          <CardContent className="p-4">
            {isLoading && (
              <div className="mb-4 flex items-center gap-2 text-blue-600">
                <RotateCw className="h-4 w-4 animate-spin" />
                <span className="text-sm">Processing changes...</span>
              </div>
            )}

            <div className="space-y-2">
              {clientTimeBlocks.map((block) =>
                block.id ? (
                  <TimeBlockPreviewCard
                    key={block.id}
                    block={block}
                    assignedEntries={block.assignedEntries}
                    onMoveUp={() => swapTimeBlockContents(block.id!, "up")}
                    onMoveDown={() => swapTimeBlockContents(block.id!, "down")}
                    onInsert={() => handleOpenInsertDialog(block.id!)}
                    onDelete={() => handleDeleteTimeBlock(block.id!)}
                    onTimeBlockClick={() => handleTimeBlockClick(block.id!)}
                    onEntryClick={handleEntryClick}
                    selectedEntryId={selectedItem?.entryId}
                    disabled={isLoading || isSavingChanges}
                    config={teesheetData?.config}
                  />
                ) : null,
              )}
            </div>
          </CardContent>
        </Card>

        {/* Insert TimeBlock Dialog */}
        <InsertTimeBlockDialog
          isOpen={insertTimeBlockDialogOpen}
          onClose={() => {
            setInsertTimeBlockDialogOpen(false);
            setInsertAfterTimeBlockId(null);
          }}
          onInsert={handleInsertTimeBlock}
        />

        {/* Confirmation Dialog */}
        <ConfirmationDialog
          open={confirmDialog.open}
          onOpenChange={(open) =>
            setConfirmDialog((prev) => ({ ...prev, open }))
          }
          onConfirm={confirmDialog.onConfirm}
          title={confirmDialog.title}
          description={confirmDialog.description}
          variant={confirmDialog.variant}
        />
      </div>
    </TooltipProvider>
  );
}
