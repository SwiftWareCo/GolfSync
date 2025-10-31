"use client";

import React, { useState, useEffect, useMemo, memo, useCallback } from "react";
import { type TeeSheet } from "~/app/types/TeeSheetTypes";
import type {
  TimeBlockWithMembers,
  TimeBlockMemberView,
  TemplateBlock,
} from "~/app/types/TeeSheetTypes";
import type { TimeBlockGuest } from "~/app/types/GuestTypes";
import type { TimeBlockWithPaceOfPlay } from "~/app/types/PaceOfPlayTypes";
import type { PaceOfPlayRecord } from "~/server/pace-of-play/data";
import { type Template, ConfigTypes } from "~/app/types/TeeSheetTypes";
import type { TeesheetConfig } from "~/app/types/TeeSheetTypes";
import { TimeBlock as TimeBlockComponent } from "~/components/timeblock/TimeBlock";
import { TeesheetGeneralNotes } from "./TeesheetGeneralNotes";
import { TimeBlockNote } from "~/components/timeblock/TimeBlockNotes";
import { TimeBlockNoteEditor } from "~/components/timeblock/TimeBlockNotes";
import {
  removeTimeBlockMember,
  removeTimeBlockGuest,
  checkInMember,
  checkInGuest,
  checkInAllTimeBlockParticipants,
  updateTimeBlockNotes,
  removeFillFromTimeBlock,
} from "~/server/teesheet/actions";
import { type RestrictionViolation } from "~/app/types/RestrictionTypes";
import toast from "react-hot-toast";
import { useRestrictionHandling } from "~/hooks/useRestrictionHandling";
import { AddPlayerModal } from "../timeblock/AddPlayerModal";
import { RestrictionViolationAlert } from "~/components/settings/timeblock-restrictions/RestrictionViolationAlert";
import { AccountDialog } from "../member-teesheet-client/AccountDialog";

// Extended ActionResult type to include violations
type ExtendedActionResult = {
  success: boolean;
  error?: string;
  violations?: RestrictionViolation[];
};

interface TeesheetViewProps {
  teesheet: TeeSheet;
  timeBlocks: TimeBlockWithMembers[];
  availableConfigs: TeesheetConfig[];
  paceOfPlayData?: TimeBlockWithPaceOfPlay[];
  templates?: Template[];
  isAdmin?: boolean;
  mutations?: any; // SWR mutations for immediate UI updates
}

export const TeesheetView = memo(function TeesheetView({
  teesheet,
  timeBlocks,
  availableConfigs,
  paceOfPlayData = [],
  templates = [],
  isAdmin = true,
  mutations,
}: TeesheetViewProps) {

  // Restriction handling hook
  const {
    violations,
    showRestrictionAlert,
    setShowRestrictionAlert,
    handleRestrictionViolation,
    handleOverrideContinue,
    handleRestrictionCancel,
  } = useRestrictionHandling();

  // State management
  const [editingTimeBlockNote, setEditingTimeBlockNote] = useState<
    number | null
  >(null);
  const [selectedTimeBlock, setSelectedTimeBlock] =
    useState<TimeBlockWithMembers | null>(null);
  const [addPlayerModalOpen, setAddPlayerModalOpen] = useState(false);
  const [selectedAccountData, setSelectedAccountData] = useState<
    TimeBlockMemberView | TimeBlockGuest | null
  >(null);
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    (() => Promise<void>) | null
  >(null);

  // Memoized computations for performance
  const sortedTimeBlocks = useMemo(() => {
    // Deduplicate time blocks by ID to prevent duplicate rendering
    const uniqueBlocks = new Map<number, typeof timeBlocks[0]>();
    timeBlocks.forEach(block => {
      if (!uniqueBlocks.has(block.id)) {
        uniqueBlocks.set(block.id, block);
      }
    });

    return Array.from(uniqueBlocks.values()).sort((a, b) =>
      a.startTime.localeCompare(b.startTime),
    );
  }, [timeBlocks]);

  const paceOfPlayMap = useMemo(() => {
    return new Map(paceOfPlayData.map((item) => [item.id, item.paceOfPlay]));
  }, [paceOfPlayData]);

  // Memoized callback functions to prevent unnecessary re-renders
  const handleRestrictionViolations = useCallback(
    (violations: RestrictionViolation[]) => {
      handleRestrictionViolation(violations);
    },
    [handleRestrictionViolation],
  );

  const handleRemoveMember = useCallback(
    async (timeBlockId: number, memberId: number) => {
      try {
        // Use SWR mutation if available for immediate UI updates
        let result;
        if (mutations?.removeMember) {
          result = await mutations.removeMember(timeBlockId, memberId, {
            optimisticUpdate: true,
            revalidate: true,
          });
        } else {
          result = await removeTimeBlockMember(timeBlockId, memberId);
        }

        if (!result.success) {
          toast.error(result.error || "Failed to remove member");
        }
      } catch (error) {
        toast.error("An unexpected error occurred");
      }
    },
    [mutations],
  );

  const handleRemoveGuest = useCallback(
    async (timeBlockId: number, guestId: number) => {
      try {
        // Use SWR mutation if available for immediate UI updates
        let result;
        if (mutations?.removeGuest) {
          result = await mutations.removeGuest(timeBlockId, guestId, {
            optimisticUpdate: true,
            revalidate: true,
          });
        } else {
          result = await removeTimeBlockGuest(timeBlockId, guestId);
        }

        if (!result.success) {
          toast.error(result.error || "Failed to remove guest");
        }
      } catch (error) {
        toast.error("An unexpected error occurred");
      }
    },
    [mutations],
  );

  const handleCheckInMember = useCallback(
    async (timeBlockId: number, memberId: number, isCheckedIn: boolean) => {
      try {
        // Use SWR mutation if available for immediate UI updates
        let result;
        if (mutations?.checkInMember) {
          result = await mutations.checkInMember(
            timeBlockId,
            memberId,
            !isCheckedIn,
            {
              optimisticUpdate: true,
              revalidate: true,
            },
          );
        } else {
          result = await checkInMember(timeBlockId, memberId, !isCheckedIn);
        }

        if (!result.success) {
          toast.error(result.error || "Failed to update check-in status");
        }
      } catch (error) {
        toast.error("An unexpected error occurred");
      }
    },
    [mutations],
  );

  const handleCheckInGuest = useCallback(
    async (timeBlockId: number, guestId: number, isCheckedIn: boolean) => {
      try {
        // Use SWR mutation if available for immediate UI updates
        let result;
        if (mutations?.checkInGuest) {
          result = await mutations.checkInGuest(
            timeBlockId,
            guestId,
            !isCheckedIn,
            {
              optimisticUpdate: true,
              revalidate: true,
            },
          );
        } else {
          result = await checkInGuest(timeBlockId, guestId, !isCheckedIn);
        }

        if (!result.success) {
          toast.error(result.error || "Failed to update check-in status");
        }
      } catch (error) {
        toast.error("An unexpected error occurred");
      }
    },
    [mutations],
  );

  const handleCheckInAll = useCallback(
    async (timeBlockId: number) => {
      try {
        // Find the time block to determine current check-in state
        const timeBlock = timeBlocks.find((block) => block.id === timeBlockId);
        if (!timeBlock) {
          toast.error("Time block not found");
          return;
        }

        const members = timeBlock.members || [];
        const guests = timeBlock.guests || [];

        // Determine if we should check in or check out
        // If everyone is checked in, then check them out; otherwise check them in
        const allCheckedIn =
          members.length > 0 &&
          guests.length > 0 &&
          members.every((m) => m.checkedIn) &&
          guests.every((g) => g.checkedIn);

        const shouldCheckIn = !allCheckedIn;

        // Use SWR mutation if available for immediate UI updates
        let result;
        if (mutations?.checkInAllParticipants) {
          result = await mutations.checkInAllParticipants(
            timeBlockId,
            shouldCheckIn,
            {
              optimisticUpdate: true,
              revalidate: true,
            },
          );
        } else {
          result = await checkInAllTimeBlockParticipants(
            timeBlockId,
            shouldCheckIn,
          );
        }

        if (!result.success) {
          toast.error(result.error || "Failed to check in all participants");
        }
      } catch (error) {
        toast.error("An unexpected error occurred");
      }
    },
    [mutations, timeBlocks],
  );

  const handleSaveNotes = useCallback(
    async (timeBlockId: number, notes: string): Promise<boolean> => {
      try {
        // Use SWR mutation if available for immediate UI updates
        let result;
        if (mutations?.updateNotes) {
          result = await mutations.updateNotes(timeBlockId, notes, {
            optimisticUpdate: true,
            revalidate: true,
          });
        } else {
          result = await updateTimeBlockNotes(timeBlockId, notes);
        }

        if (result.success) {
          return true;
        } else {
          toast.error(result.error || "Failed to update notes");
          return false;
        }
      } catch (error) {
        toast.error("An unexpected error occurred");
        return false;
      }
    },
    [mutations],
  );

  const handleRemoveFill = useCallback(
    async (timeBlockId: number, fillId: number) => {
      try {
        // Use SWR mutation if available for immediate UI updates
        let result;
        if (mutations?.removeFill) {
          result = await mutations.removeFill(timeBlockId, fillId, {
            optimisticUpdate: true,
            revalidate: true,
          });
        } else {
          result = await removeFillFromTimeBlock(timeBlockId, fillId);
        }

        if (!result.success) {
          toast.error(result.error || "Failed to remove fill");
        }
      } catch (error) {
        toast.error("An unexpected error occurred");
      }
    },
    [mutations],
  );

  // Toggle timeblock note editing
  const toggleTimeBlockNoteEdit = useCallback((timeBlockId: number | null) => {
    setEditingTimeBlockNote(timeBlockId);
  }, []);

  // Handle modal close
  const handleModalOpenChange = useCallback((open: boolean) => {
    setAddPlayerModalOpen(open);
    if (!open) {
      setSelectedTimeBlock(null);
    }
  }, []);

  // Handle opening account dialog
  const handleShowAccount = useCallback(
    (data: TimeBlockMemberView | TimeBlockGuest) => {
      setSelectedAccountData(data);
      setIsAccountDialogOpen(true);
    },
    [],
  );

  const handleCloseAccountDialog = useCallback(() => {
    setIsAccountDialogOpen(false);
    setSelectedAccountData(null);
  }, []);

  // Add event listener for opening the add player modal
  useEffect(() => {
    const handleOpenAddPlayerModal = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.timeBlockId) {
        const timeBlock = timeBlocks.find(
          (block) => block.id === customEvent.detail.timeBlockId,
        );
        if (timeBlock) {
          setSelectedTimeBlock(timeBlock);
          setAddPlayerModalOpen(true);
        }
      }
    };

    window.addEventListener("open-add-player-modal", handleOpenAddPlayerModal);
    return () => {
      window.removeEventListener(
        "open-add-player-modal",
        handleOpenAddPlayerModal,
      );
    };
  }, [timeBlocks]);

  // Add event listener for opening the account dialog
  useEffect(() => {
    const handleOpenAccountDialog = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.accountData) {
        handleShowAccount(customEvent.detail.accountData);
      }
    };

    window.addEventListener("open-account-dialog", handleOpenAccountDialog);
    return () => {
      window.removeEventListener(
        "open-account-dialog",
        handleOpenAccountDialog,
      );
    };
  }, []);

  return (
    <div className="rounded-lg bg-white p-4 shadow">
      {/* General Notes Section */}
      <TeesheetGeneralNotes key={`notes-${teesheet.id}`} teesheet={teesheet} />

      {/* Traditional Vertical Teesheet View */}
      <div className="rounded-lg border p-1 shadow">
        <table className="w-full table-auto">
          <thead className="bg-gray-100 text-xs font-semibold text-gray-600 uppercase">
            <tr>
              <th className="w-[8%] px-3 py-2 text-left whitespace-nowrap">
                Time
              </th>
              <th className="w-[85%] px-3 py-2 text-left">Players</th>
              <th className="w-[7%] px-2 py-2 text-center whitespace-nowrap">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedTimeBlocks.map((block) => {
              // Get the template block if this is a custom config
              const config = availableConfigs.find(
                (c) => c.id === teesheet.configId,
              );
              let templateBlock: TemplateBlock | null = null;

              if (config?.type === ConfigTypes.CUSTOM) {
                const customConfig = config;
                const template = templates?.find(
                  (t) => t.id === customConfig.templateId,
                );
                if (template?.blocks) {
                  templateBlock =
                    template.blocks.find(
                      (tb) => block.startTime === tb.startTime,
                    ) || null;
                }
              }

              return (
                <React.Fragment key={`block-${block.id}`}>
                  <TimeBlockComponent
                    timeBlock={{
                      ...block,
                      startTime: block.startTime,
                      endTime: block.endTime,
                      date: block.date || teesheet.date,
                      members: block.members || [],
                      guests: block.guests || [],
                      displayName:
                        block.displayName || templateBlock?.displayName,
                    }}
                    onRestrictionViolation={handleRestrictionViolations}
                    setPendingAction={setPendingAction}
                    paceOfPlay={paceOfPlayMap.get(block.id) || null}
                    showMemberClass={true}
                    onRemoveMember={(memberId: number) =>
                      handleRemoveMember(block.id, memberId)
                    }
                    onRemoveGuest={(guestId: number) =>
                      handleRemoveGuest(block.id, guestId)
                    }
                    onRemoveFill={(fillId: number) =>
                      handleRemoveFill(block.id, fillId)
                    }
                    onCheckInMember={(memberId: number, isCheckedIn: boolean) =>
                      handleCheckInMember(block.id, memberId, isCheckedIn)
                    }
                    onCheckInGuest={(guestId: number, isCheckedIn: boolean) =>
                      handleCheckInGuest(block.id, guestId, isCheckedIn)
                    }
                    onCheckInAll={() => handleCheckInAll(block.id)}
                    onToggleNoteEdit={() => toggleTimeBlockNoteEdit(block.id)}
                    onSaveNotes={(notes: string) =>
                      handleSaveNotes(block.id, notes)
                    }
                  />

                  {/* Display note editor or existing note after timeblock */}
                  {editingTimeBlockNote === block.id ? (
                    <tr>
                      <td colSpan={3} className="p-0">
                        <TimeBlockNoteEditor
                          timeBlockId={block.id}
                          initialNote={block.notes || ""}
                          onSaveNotes={async (timeBlockId, notes) => {
                            const success = await handleSaveNotes(timeBlockId, notes);
                            if (success) {
                              toggleTimeBlockNoteEdit(null);
                            }
                            return success;
                          }}
                          onCancel={() => toggleTimeBlockNoteEdit(null)}
                        />
                      </td>
                    </tr>
                  ) : (
                    block.notes &&
                    block.notes.trim() !== "" && (
                      <tr>
                        <td colSpan={3} className="p-0">
                          <TimeBlockNote
                            notes={block.notes}
                            onEditClick={() => toggleTimeBlockNoteEdit(block.id)}
                            timeBlockId={block.id}
                            onSaveNotes={handleSaveNotes}
                          />
                        </td>
                      </tr>
                    )
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Restriction Violation Alert (Admin only) */}
      <RestrictionViolationAlert
        open={showRestrictionAlert}
        onOpenChange={setShowRestrictionAlert}
        violations={violations}
        onCancel={handleRestrictionCancel}
        onContinue={handleOverrideContinue}
      />

      {/* Add Player Modal */}
      {selectedTimeBlock && (
        <AddPlayerModal
          open={addPlayerModalOpen}
          onOpenChange={handleModalOpenChange}
          timeBlock={selectedTimeBlock}
          timeBlockGuests={selectedTimeBlock.guests}
          mutations={mutations}
        />
      )}

      {/* Account Dialog */}
      <AccountDialog
        member={selectedAccountData}
        isOpen={isAccountDialogOpen}
        onClose={handleCloseAccountDialog}
        isMember={false}
      />
    </div>
  );
});
