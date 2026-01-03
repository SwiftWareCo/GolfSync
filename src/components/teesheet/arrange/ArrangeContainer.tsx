"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { Card, CardContent } from "~/components/ui/card";
import { TooltipProvider } from "~/components/ui/tooltip";
import { ConfirmationDialog } from "~/components/ui/confirmation-dialog";
import { ArrangeControls } from "./ArrangeControls";
import { ArrangeTimeBlockCard } from "./ArrangeTimeBlockCard";
import { FrostDelayModal } from "./FrostDelayModal";
import { BlockRemapModal } from "./BlockRemapModal";
import {
  ChangeLogModal,
  type ChangeLogEntry,
  type ChangeType,
} from "./ChangeLogModal";
import { InsertTimeBlockDialog } from "~/components/teesheet/arrange-results/InsertTimeBlockDialog";
import type { ArrangePlayer } from "./ArrangePlayerBadge";
import {
  batchMoveChanges,
  insertTimeBlock,
  deleteTimeBlock,
  replaceTimeBlockRange,
} from "~/server/teesheet/actions";
import type {
  TimeBlockWithRelations,
  TeesheetConfigWithBlocks,
} from "~/server/db/schema";
import { formatTime12Hour } from "~/lib/dates";

// Pending change for server
interface PendingMoveChange {
  playerId: number;
  playerType: "member" | "guest" | "fill";
  sourceTimeBlockId: number;
  targetTimeBlockId: number;
  invitedByMemberId?: number;
  fillType?: string;
  fillCustomName?: string | null;
}

// Pending delete
interface PendingDeleteChange {
  timeBlockId: number;
  timeBlockTime: string;
}

// Selection state
interface SelectedPlayer {
  id: number;
  type: "member" | "guest" | "fill";
  sourceTimeBlockId: number;
  name: string;
  fillType?: string;
  fillCustomName?: string | null;
}

interface ArrangeContainerProps {
  dateString: string;
  teesheetId: number;
  initialTimeBlocks: TimeBlockWithRelations[];
  config: TeesheetConfigWithBlocks | null;
}

/**
 * Generate a stable hash of player positions across all timeblocks.
 * The hash is order-independent within each block - only player IDs and their block assignments matter.
 * This prevents false "unsaved changes" when arrays have same content but different order.
 */
function generatePlayerPositionHash(blocks: TimeBlockWithRelations[]): string {
  const positions: string[] = [];

  blocks.forEach((block) => {
    const blockId = block.id;
    block.members?.forEach((m) => positions.push(`${blockId}:m:${m.id}`));
    block.guests?.forEach((g) => positions.push(`${blockId}:g:${g.id}`));
    block.fills?.forEach((f) => positions.push(`${blockId}:f:${f.id}`));
  });

  // Sort to ensure deterministic order regardless of iteration order
  positions.sort();
  return positions.join("|");
}

export function ArrangeContainer({
  dateString,
  teesheetId,
  initialTimeBlocks,
  config,
}: ArrangeContainerProps) {
  const router = useRouter();

  // Client-side state
  const [timeBlocks, setTimeBlocks] =
    useState<TimeBlockWithRelations[]>(initialTimeBlocks);
  const [selectedPlayer, setSelectedPlayer] = useState<SelectedPlayer | null>(
    null,
  );
  const [pendingDeletes, setPendingDeletes] = useState<PendingDeleteChange[]>(
    [],
  );
  const [changeLog, setChangeLog] = useState<ChangeLogEntry[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Ref to always have access to latest timeBlocks (avoids stale closure)
  const timeBlocksRef = useRef(timeBlocks);
  useEffect(() => {
    timeBlocksRef.current = timeBlocks;
  }, [timeBlocks]);

  // Ref to store initial player position hash (for detecting actual changes)
  const initialHashRef = useRef<string>(
    generatePlayerPositionHash(initialTimeBlocks),
  );
  useEffect(() => {
    initialHashRef.current = generatePlayerPositionHash(initialTimeBlocks);
  }, [initialTimeBlocks]);

  // Sync local timeBlocks state when initialTimeBlocks prop changes (after server action with revalidatePath)
  // Only sync when there are no pending deletes to avoid losing user edits
  useEffect(() => {
    // Always sync if no pending deletes (safe to update from server)
    if (pendingDeletes.length === 0) {
      setTimeBlocks(initialTimeBlocks);
    }
  }, [initialTimeBlocks, pendingDeletes.length]);

  // Modal states
  const [isFrostDelayOpen, setIsFrostDelayOpen] = useState(false);
  const [isFrostRemapOpen, setIsFrostRemapOpen] = useState(false);
  const [isChangeLogOpen, setIsChangeLogOpen] = useState(false);
  const [insertDialogOpen, setInsertDialogOpen] = useState(false);
  const [insertAfterBlockId, setInsertAfterBlockId] = useState<number | null>(
    null,
  );
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    variant?: "default" | "destructive";
  }>({
    open: false,
    title: "",
    description: "",
    onConfirm: () => {},
  });

  // Compute current hash for comparison
  const currentHash = useMemo(
    () => generatePlayerPositionHash(timeBlocks),
    [timeBlocks],
  );

  // Compute pending moves by diffing initialTimeBlocks vs current timeBlocks
  // Only compute if hash differs (optimization + fixes false positives)
  const pendingMoves = useMemo(() => {
    // Short-circuit if hash matches - no actual changes
    if (currentHash === initialHashRef.current) {
      return [];
    }

    const moves: PendingMoveChange[] = [];

    // Build lookup of where each player was originally
    const originalMemberLocations = new Map<number, number>(); // memberId -> timeBlockId
    const originalGuestLocations = new Map<
      number,
      { blockId: number; invitedBy?: number }
    >(); // guestId -> { blockId, invitedBy }
    const originalFillLocations = new Map<
      number,
      { blockId: number; fillType: string; fillCustomName?: string | null }
    >(); // fillId -> { blockId, fillType, fillCustomName }

    initialTimeBlocks.forEach((block) => {
      block.members?.forEach((member) => {
        originalMemberLocations.set(member.id, block.id!);
      });
      block.guests?.forEach((guest) => {
        originalGuestLocations.set(guest.id, {
          blockId: block.id!,
          invitedBy: guest.invitedByMemberId,
        });
      });
      block.fills?.forEach((fill) => {
        originalFillLocations.set(fill.id, {
          blockId: block.id!,
          fillType: fill.fillType,
          fillCustomName: fill.customName,
        });
      });
    });

    // Compare with current locations
    timeBlocks.forEach((block) => {
      block.members?.forEach((member) => {
        const originalBlockId = originalMemberLocations.get(member.id);
        if (originalBlockId && originalBlockId !== block.id) {
          moves.push({
            playerId: member.id,
            playerType: "member",
            sourceTimeBlockId: originalBlockId,
            targetTimeBlockId: block.id!,
          });
        }
      });
      block.guests?.forEach((guest) => {
        const original = originalGuestLocations.get(guest.id);
        if (original && original.blockId !== block.id) {
          moves.push({
            playerId: guest.id,
            playerType: "guest",
            sourceTimeBlockId: original.blockId,
            targetTimeBlockId: block.id!,
            invitedByMemberId: original.invitedBy,
          });
        }
      });
      block.fills?.forEach((fill) => {
        const original = originalFillLocations.get(fill.id);
        if (original && original.blockId !== block.id) {
          moves.push({
            playerId: fill.id,
            playerType: "fill",
            sourceTimeBlockId: original.blockId,
            targetTimeBlockId: block.id!,
            fillType: original.fillType,
            fillCustomName: original.fillCustomName,
          });
        }
      });
    });

    return moves;
  }, [currentHash, initialTimeBlocks, timeBlocks]);

  // Compute which blocks have changes
  const blockChanges = useMemo(() => {
    const changedBlocks = new Set<number>();
    pendingMoves.forEach((change) => {
      changedBlocks.add(change.sourceTimeBlockId);
      changedBlocks.add(change.targetTimeBlockId);
    });
    pendingDeletes.forEach((del) => {
      changedBlocks.add(del.timeBlockId);
    });
    return changedBlocks;
  }, [pendingMoves, pendingDeletes]);

  // Total pending changes count
  // Display count based on user actions (matches View Log)
  // Note: pendingMoves/pendingDeletes are still used for actual save operations
  const pendingChangesCount = changeLog.length;

  // Get last tee time for frost delay validation
  const lastTeeTime = useMemo(() => {
    if (timeBlocks.length === 0) return undefined;
    return timeBlocks[timeBlocks.length - 1]?.startTime;
  }, [timeBlocks]);

  // Helper to get player name
  const getPlayerName = useCallback(
    (
      playerId: number,
      playerType: "member" | "guest" | "fill",
      blocks: TimeBlockWithRelations[],
    ): string => {
      for (const block of blocks) {
        if (playerType === "member") {
          const member = block.members?.find((m) => m.id === playerId);
          if (member) return `${member.firstName} ${member.lastName}`;
        } else if (playerType === "guest") {
          const guest = block.guests?.find((g) => g.id === playerId);
          if (guest) return `${guest.firstName} ${guest.lastName}`;
        }
      }
      return "Unknown";
    },
    [],
  );

  // Add to change log
  const addChangeLog = useCallback(
    (
      type: ChangeType,
      description: string,
      details?: ChangeLogEntry["details"],
    ) => {
      setChangeLog((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          type,
          description,
          timestamp: new Date(),
          details,
        },
      ]);
    },
    [],
  );

  // Handle player click (select or swap)
  const handlePlayerClick = useCallback(
    (player: ArrangePlayer) => {
      const playerId = player.data.id;
      const playerType = player.type;

      // Find which block this player is in
      const sourceBlock = timeBlocks.find((block) => {
        if (playerType === "member") {
          return block.members?.some((m) => m.id === playerId);
        } else if (playerType === "guest") {
          return block.guests?.some((g) => g.id === playerId);
        } else if (playerType === "fill") {
          return block.fills?.some((f) => f.id === playerId);
        }
        return false;
      });

      if (!sourceBlock) return;

      const playerName =
        playerType === "fill"
          ? "Fill"
          : `${player.data.firstName} ${player.data.lastName}`;

      // Extract fill metadata if it's a fill
      const fillType = playerType === "fill" ? player.data.fillType : undefined;
      const fillCustomName =
        playerType === "fill" ? player.data.customName : undefined;

      // If no selection, select this player
      if (!selectedPlayer) {
        setSelectedPlayer({
          id: playerId,
          type: playerType,
          sourceTimeBlockId: sourceBlock.id!,
          name: playerName,
          fillType,
          fillCustomName,
        });
        return;
      }

      // If clicking same player, deselect
      if (
        selectedPlayer.id === playerId &&
        selectedPlayer.type === playerType
      ) {
        setSelectedPlayer(null);
        return;
      }

      // If clicking different player, swap them

      // Perform swap
      performSwap(
        selectedPlayer,
        {
          id: playerId,
          type: playerType,
          sourceTimeBlockId: sourceBlock.id!,
          name: playerName,
          fillType,
          fillCustomName,
        },
        timeBlocks,
      );
      setSelectedPlayer(null);
    },
    [selectedPlayer, timeBlocks],
  );

  // Perform swap of two players (single operation, single toast)
  const performSwap = useCallback(
    (
      player1: SelectedPlayer,
      player2: SelectedPlayer,
      currentBlocks: TimeBlockWithRelations[],
    ) => {
      const block1Id = player1.sourceTimeBlockId;
      const block2Id = player2.sourceTimeBlockId;

      // Get invited by for guests
      let invitedBy1: number | undefined;
      let invitedBy2: number | undefined;

      const block1 = currentBlocks.find((b) => b.id === block1Id);
      const block2 = currentBlocks.find((b) => b.id === block2Id);

      if (player1.type === "guest" && block1) {
        invitedBy1 = block1.guests?.find(
          (g) => g.id === player1.id,
        )?.invitedByMemberId;
      }
      if (player2.type === "guest" && block2) {
        invitedBy2 = block2.guests?.find(
          (g) => g.id === player2.id,
        )?.invitedByMemberId;
      }

      // Update state in one operation - preserve order when swapping
      setTimeBlocks((prev) => {
        // Handle same-block swap differently - just swap positions
        if (block1Id === block2Id) {
          return prev.map((block) => {
            if (block.id !== block1Id) return block;

            const newBlock = { ...block };

            // Swap members if both are members
            if (player1.type === "member" && player2.type === "member") {
              newBlock.members = block.members?.map((m) => {
                if (m.id === player1.id) {
                  return block.members?.find((x) => x.id === player2.id) ?? m;
                }
                if (m.id === player2.id) {
                  return block.members?.find((x) => x.id === player1.id) ?? m;
                }
                return m;
              });
            }

            // Swap guests if both are guests
            if (player1.type === "guest" && player2.type === "guest") {
              newBlock.guests = block.guests?.map((g) => {
                if (g.id === player1.id) {
                  return block.guests?.find((x) => x.id === player2.id) ?? g;
                }
                if (g.id === player2.id) {
                  return block.guests?.find((x) => x.id === player1.id) ?? g;
                }
                return g;
              });
            }

            // Swap fills if both are fills
            if (player1.type === "fill" && player2.type === "fill") {
              newBlock.fills = block.fills?.map((f) => {
                if (f.id === player1.id) {
                  return block.fills?.find((x) => x.id === player2.id) ?? f;
                }
                if (f.id === player2.id) {
                  return block.fills?.find((x) => x.id === player1.id) ?? f;
                }
                return f;
              });
            }

            // Handle mixed type swaps in same block
            if (
              (player1.type === "member" && player2.type === "guest") ||
              (player1.type === "member" && player2.type === "fill") ||
              (player1.type === "guest" && player2.type === "fill")
            ) {
              // For mixed types, just leave as-is (can't swap types)
              toast.error("Cannot swap different player types in same block");
            }

            return newBlock;
          });
        }

        // Cross-block swap - replace in-place to maintain order
        const block1 = prev.find((b) => b.id === block1Id);
        const block2 = prev.find((b) => b.id === block2Id);

        if (!block1 || !block2) return prev;

        return prev.map((block) => {
          if (block.id !== block1Id && block.id !== block2Id) return block;

          const newBlock = { ...block };

          if (block.id === block1Id) {
            // Remove player1, add player2 at player1's position
            if (player1.type === "member") {
              const idx =
                block.members?.findIndex((m) => m.id === player1.id) ?? -1;
              if (idx !== -1 && player2.type === "member") {
                const player2Data = block2.members?.find(
                  (m) => m.id === player2.id,
                );
                if (player2Data) {
                  newBlock.members = [...(block.members ?? [])];
                  newBlock.members[idx] = player2Data;
                }
              } else {
                newBlock.members =
                  block.members?.filter((m) => m.id !== player1.id) ?? [];
                if (player2.type === "member") {
                  const player2Data = block2.members?.find(
                    (m) => m.id === player2.id,
                  );
                  if (player2Data) {
                    newBlock.members = [...newBlock.members, player2Data];
                  }
                }
              }
            }
            if (player1.type === "guest") {
              const idx =
                block.guests?.findIndex((g) => g.id === player1.id) ?? -1;
              if (idx !== -1 && player2.type === "guest") {
                const player2Data = block2.guests?.find(
                  (g) => g.id === player2.id,
                );
                if (player2Data) {
                  newBlock.guests = [...(block.guests ?? [])];
                  newBlock.guests[idx] = player2Data;
                }
              } else {
                newBlock.guests =
                  block.guests?.filter((g) => g.id !== player1.id) ?? [];
                if (player2.type === "guest") {
                  const player2Data = block2.guests?.find(
                    (g) => g.id === player2.id,
                  );
                  if (player2Data) {
                    newBlock.guests = [...newBlock.guests, player2Data];
                  }
                }
              }
            }
            if (player1.type === "fill") {
              const idx =
                block.fills?.findIndex((f) => f.id === player1.id) ?? -1;
              if (idx !== -1 && player2.type === "fill") {
                const player2Data = block2.fills?.find(
                  (f) => f.id === player2.id,
                );
                if (player2Data) {
                  newBlock.fills = [...(block.fills ?? [])];
                  newBlock.fills[idx] = player2Data;
                }
              } else {
                newBlock.fills =
                  block.fills?.filter((f) => f.id !== player1.id) ?? [];
                if (player2.type === "fill" && player2.fillType) {
                  const player2Data = block2.fills?.find(
                    (f) => f.id === player2.id,
                  );
                  if (player2Data) {
                    const newFill = {
                      ...player2Data,
                      fillType: player2.fillType,
                      customName: player2.fillCustomName ?? null,
                    };
                    newBlock.fills = [...newBlock.fills, newFill];
                  }
                }
              }
            }
            // Add player2 if different type
            if (player2.type === "member" && player1.type !== "member") {
              const player2Data = block2.members?.find(
                (m) => m.id === player2.id,
              );
              if (player2Data) {
                newBlock.members = [...(newBlock.members ?? []), player2Data];
              }
            }
            if (player2.type === "guest" && player1.type !== "guest") {
              const player2Data = block2.guests?.find(
                (g) => g.id === player2.id,
              );
              if (player2Data) {
                newBlock.guests = [...(newBlock.guests ?? []), player2Data];
              }
            }
            if (player2.type === "fill" && player1.type !== "fill" && player2.fillType) {
              const player2Data = block2.fills?.find(
                (f) => f.id === player2.id,
              );
              if (player2Data) {
                const newFill = {
                  ...player2Data,
                  fillType: player2.fillType,
                  customName: player2.fillCustomName ?? null,
                };
                newBlock.fills = [...(newBlock.fills ?? []), newFill];
              }
            }
          }

          if (block.id === block2Id) {
            // Remove player2, add player1 at player2's position
            if (player2.type === "member") {
              const idx =
                block.members?.findIndex((m) => m.id === player2.id) ?? -1;
              if (idx !== -1 && player1.type === "member") {
                const player1Data = block1.members?.find(
                  (m) => m.id === player1.id,
                );
                if (player1Data) {
                  newBlock.members = [...(block.members ?? [])];
                  newBlock.members[idx] = player1Data;
                }
              } else {
                newBlock.members =
                  block.members?.filter((m) => m.id !== player2.id) ?? [];
                if (player1.type === "member") {
                  const player1Data = block1.members?.find(
                    (m) => m.id === player1.id,
                  );
                  if (player1Data) {
                    newBlock.members = [...newBlock.members, player1Data];
                  }
                }
              }
            }
            if (player2.type === "guest") {
              const idx =
                block.guests?.findIndex((g) => g.id === player2.id) ?? -1;
              if (idx !== -1 && player1.type === "guest") {
                const player1Data = block1.guests?.find(
                  (g) => g.id === player1.id,
                );
                if (player1Data) {
                  newBlock.guests = [...(block.guests ?? [])];
                  newBlock.guests[idx] = player1Data;
                }
              } else {
                newBlock.guests =
                  block.guests?.filter((g) => g.id !== player2.id) ?? [];
                if (player1.type === "guest") {
                  const player1Data = block1.guests?.find(
                    (g) => g.id === player1.id,
                  );
                  if (player1Data) {
                    newBlock.guests = [...newBlock.guests, player1Data];
                  }
                }
              }
            }
            if (player2.type === "fill") {
              const idx =
                block.fills?.findIndex((f) => f.id === player2.id) ?? -1;
              if (idx !== -1 && player1.type === "fill") {
                const player1Data = block1.fills?.find(
                  (f) => f.id === player1.id,
                );
                if (player1Data && player1.fillType) {
                  const newFill = {
                    ...player1Data,
                    fillType: player1.fillType,
                    customName: player1.fillCustomName ?? null,
                  };
                  newBlock.fills = [...(block.fills ?? [])];
                  newBlock.fills[idx] = newFill;
                }
              } else {
                newBlock.fills =
                  block.fills?.filter((f) => f.id !== player2.id) ?? [];
                if (player1.type === "fill" && player1.fillType) {
                  const player1Data = block1.fills?.find(
                    (f) => f.id === player1.id,
                  );
                  if (player1Data) {
                    const newFill = {
                      ...player1Data,
                      fillType: player1.fillType,
                      customName: player1.fillCustomName ?? null,
                    };
                    newBlock.fills = [...newBlock.fills, newFill];
                  }
                }
              }
            }
            // Add player1 if different type
            if (player1.type === "member" && player2.type !== "member") {
              const player1Data = block1.members?.find(
                (m) => m.id === player1.id,
              );
              if (player1Data) {
                newBlock.members = [...(newBlock.members ?? []), player1Data];
              }
            }
            if (player1.type === "guest" && player2.type !== "guest") {
              const player1Data = block1.guests?.find(
                (g) => g.id === player1.id,
              );
              if (player1Data) {
                newBlock.guests = [...(newBlock.guests ?? []), player1Data];
              }
            }
            if (player1.type === "fill" && player2.type !== "fill" && player1.fillType) {
              const player1Data = block1.fills?.find(
                (f) => f.id === player1.id,
              );
              if (player1Data) {
                const newFill = {
                  ...player1Data,
                  fillType: player1.fillType,
                  customName: player1.fillCustomName ?? null,
                };
                newBlock.fills = [...(newBlock.fills ?? []), newFill];
              }
            }
          }

          return newBlock;
        });
      });

      // Change tracking now computed via diff, no need to track manually

      // Log the change
      const time1 = block1 ? formatTime12Hour(block1.startTime) : "";
      const time2 = block2 ? formatTime12Hour(block2.startTime) : "";
      addChangeLog("swap", `Swapped ${player1.name} with ${player2.name}`, {
        playerName: player1.name,
        fromTime: time1,
        toTime: time2,
        swappedWith: player2.name,
      });

      toast.success(`Swapped ${player1.name} with ${player2.name}`);
    },
    [addChangeLog],
  );

  // Handle timeblock click (move selected player here)
  const handleTimeBlockClick = useCallback(
    (targetBlockId: number) => {
      if (!selectedPlayer) return;
      if (selectedPlayer.sourceTimeBlockId === targetBlockId) {
        setSelectedPlayer(null);
        return;
      }

      // Check capacity
      const targetBlock = timeBlocks.find((b) => b.id === targetBlockId);
      if (!targetBlock) return;

      const currentOccupancy =
        (targetBlock.members?.length ?? 0) +
        (targetBlock.guests?.length ?? 0) +
        (targetBlock.fills?.length ?? 0);

      if (currentOccupancy >= (targetBlock.maxMembers ?? 4)) {
        toast.error("Time slot is full");
        return;
      }

      // Move player
      performMove(selectedPlayer, targetBlockId, timeBlocks);
      setSelectedPlayer(null);
    },
    [selectedPlayer, timeBlocks],
  );

  // Perform move of a single player
  const performMove = useCallback(
    (
      player: SelectedPlayer,
      targetBlockId: number,
      currentBlocks: TimeBlockWithRelations[],
    ) => {
      const sourceBlockId = player.sourceTimeBlockId;
      const sourceBlock = currentBlocks.find((b) => b.id === sourceBlockId);
      const targetBlock = currentBlocks.find((b) => b.id === targetBlockId);

      let invitedByMemberId: number | undefined;
      if (player.type === "guest" && sourceBlock) {
        invitedByMemberId = sourceBlock.guests?.find(
          (g) => g.id === player.id,
        )?.invitedByMemberId;
      }

      // Update state
      setTimeBlocks((prev) => {
        return prev.map((block) => {
          if (block.id === sourceBlockId) {
            if (player.type === "member") {
              return {
                ...block,
                members: block.members?.filter((m) => m.id !== player.id) ?? [],
              };
            } else if (player.type === "guest") {
              return {
                ...block,
                guests: block.guests?.filter((g) => g.id !== player.id) ?? [],
              };
            } else if (player.type === "fill") {
              return {
                ...block,
                fills: block.fills?.filter((f) => f.id !== player.id) ?? [],
              };
            }
          }
          if (block.id === targetBlockId) {
            if (player.type === "member") {
              const member = prev
                .find((b) => b.id === sourceBlockId)
                ?.members?.find((m) => m.id === player.id);
              if (member) {
                return {
                  ...block,
                  members: [...(block.members ?? []), member],
                };
              }
            } else if (player.type === "guest") {
              const guest = prev
                .find((b) => b.id === sourceBlockId)
                ?.guests?.find((g) => g.id === player.id);
              if (guest) {
                return {
                  ...block,
                  guests: [...(block.guests ?? []), guest],
                };
              }
            } else if (player.type === "fill") {
              const fill = prev
                .find((b) => b.id === sourceBlockId)
                ?.fills?.find((f) => f.id === player.id);
              if (fill && player.fillType) {
                // Create a new fill object with the preserved metadata
                const newFill = {
                  ...fill,
                  fillType: player.fillType,
                  customName: player.fillCustomName ?? null,
                };
                return {
                  ...block,
                  fills: [...(block.fills ?? []), newFill],
                };
              }
            }
          }
          return block;
        });
      });

      // Change tracking now computed via diff, no need to track manually

      // Log change
      const fromTime = sourceBlock
        ? formatTime12Hour(sourceBlock.startTime)
        : "";
      const toTime = targetBlock ? formatTime12Hour(targetBlock.startTime) : "";
      addChangeLog(
        "move",
        `Moved ${player.name} from ${fromTime} to ${toTime}`,
        {
          playerName: player.name,
          fromTime,
          toTime,
        },
      );

      toast.success(`Moved ${player.name} to ${toTime}`);
    },
    [addChangeLog],
  );

  // Swap all players between adjacent blocks
  const handleSwapAdjacent = useCallback(
    (blockId: number, direction: "up" | "down") => {
      // Read from ref to get latest state (avoids stale closure)
      const currentBlocks = timeBlocksRef.current;
      const blockIndex = currentBlocks.findIndex((b) => b.id === blockId);
      const targetIndex = direction === "up" ? blockIndex - 1 : blockIndex + 1;

      if (targetIndex < 0 || targetIndex >= currentBlocks.length) return;

      const sourceBlock = currentBlocks[blockIndex];
      const targetBlock = currentBlocks[targetIndex];

      if (!sourceBlock || !targetBlock) return;

      // Check capacity (not including fills since they don't move)
      const sourcePlayerCount =
        (sourceBlock.members?.length ?? 0) + (sourceBlock.guests?.length ?? 0);
      const targetPlayerCount =
        (targetBlock.members?.length ?? 0) + (targetBlock.guests?.length ?? 0);
      const sourceFillCount = sourceBlock.fills?.length ?? 0;
      const targetFillCount = targetBlock.fills?.length ?? 0;

      // Ensure max 4 members per block
      if (
        targetPlayerCount + sourceFillCount > (sourceBlock.maxMembers ?? 4) ||
        sourcePlayerCount + targetFillCount > (targetBlock.maxMembers ?? 4)
      ) {
        toast.error("Cannot swap - capacity would be exceeded");
        return;
      }

      // Read members/guests from ref (current state)
      const srcMembers = sourceBlock.members ?? [];
      const tgtMembers = targetBlock.members ?? [];
      const srcGuests = sourceBlock.guests ?? [];
      const tgtGuests = targetBlock.guests ?? [];

      // Capture times for toast/log before state update
      const srcTime = formatTime12Hour(sourceBlock.startTime);
      const tgtTime = formatTime12Hour(targetBlock.startTime);

      // Update state - create new array with swapped contents
      setTimeBlocks((prev) => {
        const newBlocks = [...prev];
        const srcIdx = newBlocks.findIndex((b) => b.id === sourceBlock.id);
        const tgtIdx = newBlocks.findIndex((b) => b.id === targetBlock.id);

        if (srcIdx === -1 || tgtIdx === -1) return prev;

        newBlocks[srcIdx] = {
          ...newBlocks[srcIdx]!,
          members: tgtMembers,
          guests: tgtGuests,
        };
        newBlocks[tgtIdx] = {
          ...newBlocks[tgtIdx]!,
          members: srcMembers,
          guests: srcGuests,
        };

        return newBlocks;
      });

      // Log and toast
      addChangeLog(
        "swap",
        `Swapped all players between ${srcTime} and ${tgtTime}`,
        {
          fromTime: srcTime,
          toTime: tgtTime,
        },
      );
      toast.success(`Swapped players between ${srcTime} and ${tgtTime}`);
    },
    [addChangeLog],
  );

  // Delete timeblock (client-side)
  const handleDeleteTimeBlock = useCallback(
    (blockId: number) => {
      const block = timeBlocks.find((b) => b.id === blockId);
      if (!block) return;

      const hasPlayers =
        (block.members?.length ?? 0) +
          (block.guests?.length ?? 0) +
          (block.fills?.length ?? 0) >
        0;

      setConfirmDialog({
        open: true,
        title: "Delete Time Slot",
        description: hasPlayers
          ? "This time slot has players assigned. Deleting it will remove all assignments. Are you sure?"
          : "Are you sure you want to delete this time slot?",
        variant: "destructive",
        onConfirm: () => {
          // Remove from client state
          setTimeBlocks((prev) => prev.filter((b) => b.id !== blockId));

          // Add to pending deletes
          setPendingDeletes((prev) => [
            ...prev,
            { timeBlockId: blockId, timeBlockTime: block.startTime },
          ]);

          addChangeLog(
            "delete",
            `Deleted time slot at ${formatTime12Hour(block.startTime)}`,
            { fromTime: formatTime12Hour(block.startTime) },
          );

          toast.success(
            `Time slot at ${formatTime12Hour(block.startTime)} marked for deletion`,
          );
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        },
      });
    },
    [timeBlocks, addChangeLog],
  );

  // Save all changes
  const handleSave = async () => {
    if (pendingMoves.length === 0 && pendingDeletes.length === 0) {
      toast.success("No changes to save");
      return;
    }

    setIsSaving(true);
    try {
      // Save moves first
      if (pendingMoves.length > 0) {
        const moveResult = await batchMoveChanges(teesheetId, pendingMoves);
        if (!moveResult.success) {
          toast.error(moveResult.error || "Failed to save player moves");
          setIsSaving(false);
          return;
        }
      }

      // Then process deletes
      for (const del of pendingDeletes) {
        const deleteResult = await deleteTimeBlock(teesheetId, del.timeBlockId);
        if (!deleteResult.success) {
          toast.error(
            deleteResult.error ||
              `Failed to delete time slot at ${formatTime12Hour(del.timeBlockTime)}`,
          );
        }
      }

      toast.success(
        `Saved ${pendingMoves.length} moves and ${pendingDeletes.length} deletions`,
      );
      setPendingDeletes([]);
      setChangeLog([]);
      router.refresh();
    } catch (error) {
      toast.error("An error occurred while saving");
    } finally {
      setIsSaving(false);
    }
  };

  // Reset all changes
  const handleReset = () => {
    if (changeLog.length === 0) return;

    setConfirmDialog({
      open: true,
      title: "Reset Changes",
      description:
        "Are you sure you want to discard all unsaved changes? This cannot be undone.",
      variant: "destructive",
      onConfirm: () => {
        setTimeBlocks(initialTimeBlocks);
        setPendingDeletes([]);
        setChangeLog([]);
        setSelectedPlayer(null);
        toast.success("Changes reset");
        setConfirmDialog((prev) => ({ ...prev, open: false }));
      },
    });
  };

  // Apply frost delay (client-side - moves players, doesn't delete blocks)
  const handleApplyFrostDelay = (delayMinutes: number) => {
    const currentBlocks = timeBlocksRef.current;

    // Parse time string to minutes since midnight
    const timeToMinutes = (time: string): number => {
      const [hours, mins] = time.split(":").map(Number);
      return (hours || 0) * 60 + (mins || 0);
    };

    // Find target block for a given source time + delay
    const findTargetBlock = (sourceTimeMinutes: number) => {
      const targetTimeMinutes = sourceTimeMinutes + delayMinutes;
      return currentBlocks.find((block) => {
        const blockMinutes = timeToMinutes(block.startTime);
        return blockMinutes >= targetTimeMinutes;
      });
    };

    // Process blocks in reverse order (latest first) to avoid overwriting
    const sortedBlocks = [...currentBlocks].sort((a, b) => {
      return timeToMinutes(b.startTime) - timeToMinutes(a.startTime);
    });

    // Check if all moves are possible (capacity check)
    for (const block of sortedBlocks) {
      if (!block.members?.length && !block.guests?.length) continue;

      const targetBlock = findTargetBlock(timeToMinutes(block.startTime));
      if (!targetBlock) {
        toast.error(
          `Cannot apply delay - no time slot available for ${formatTime12Hour(block.startTime)} + ${delayMinutes}min`,
        );
        return;
      }

      // Check capacity (simplified - would need to track accumulated moves for full accuracy)
      const playersToMove =
        (block.members?.length ?? 0) + (block.guests?.length ?? 0);
      const targetCapacity = targetBlock.maxMembers ?? 4;
      if (playersToMove > targetCapacity) {
        toast.error(
          `Cannot apply delay - ${formatTime12Hour(targetBlock.startTime)} cannot hold all players`,
        );
        return;
      }
    }

    // Apply the moves
    setTimeBlocks((prev) => {
      const newBlocks = prev.map((block) => ({
        ...block,
        members: [] as typeof block.members,
        guests: [] as typeof block.guests,
      }));

      // Process each original block
      for (const originalBlock of sortedBlocks) {
        const targetBlock = findTargetBlock(
          timeToMinutes(originalBlock.startTime),
        );
        if (!targetBlock) continue;

        const targetIdx = newBlocks.findIndex((b) => b.id === targetBlock.id);
        if (targetIdx === -1) continue;

        // Add members and guests to target
        if (originalBlock.members?.length) {
          newBlocks[targetIdx] = {
            ...newBlocks[targetIdx]!,
            members: [
              ...(newBlocks[targetIdx]!.members ?? []),
              ...originalBlock.members,
            ],
          };
        }
        if (originalBlock.guests?.length) {
          newBlocks[targetIdx] = {
            ...newBlocks[targetIdx]!,
            guests: [
              ...(newBlocks[targetIdx]!.guests ?? []),
              ...originalBlock.guests,
            ],
          };
        }
      }

      return newBlocks;
    });

    addChangeLog(
      "frost_delay",
      `Applied ${delayMinutes} minute frost delay (moves players down)`,
      { delayMinutes },
    );
    toast.success(`Applied ${delayMinutes} minute frost delay`);
    setIsFrostDelayOpen(false);
  };

  // Apply frost delay remap (replace blocks with new interval)
  const handleApplyFrostRemap = async (
    startBlockId: number,
    endBlockId: number,
    replacementBlocks: Array<{
      id: string;
      startTime: string;
      maxMembers: number;
      displayName?: string;
      mappedPlayers: Array<{
        playerId: number;
        playerType: "member" | "guest" | "fill";
        name: string;
        originalBlockId: number;
        invitedByMemberId?: number;
        fillType?: string;
        fillCustomName?: string | null;
      }>;
    }>,
  ) => {
    const result = await replaceTimeBlockRange(
      teesheetId,
      startBlockId,
      endBlockId,
      replacementBlocks.map((block) => ({
        startTime: block.startTime,
        maxMembers: block.maxMembers,
        displayName: block.displayName,
        mappedPlayers: block.mappedPlayers.map((p) => ({
          playerId: p.playerId,
          playerType: p.playerType,
          invitedByMemberId: p.invitedByMemberId,
          fillType: p.fillType,
          fillCustomName: p.fillCustomName,
        })),
      })),
    );

    if (result.success) {
      toast.success("Frost delay remap applied successfully");
      router.refresh();
    } else {
      toast.error(result.error || "Failed to apply remap");
      throw new Error(result.error || "Failed to apply remap");
    }
  };

  // Insert timeblock
  const handleInsertTimeBlock = async (data: {
    startTime: string;
    endTime: string;
    displayName?: string;
    maxMembers?: number;
  }) => {
    if (!insertAfterBlockId) return;

    const result = await insertTimeBlock(teesheetId, insertAfterBlockId, data);

    if (result.success && result.data) {
      // Add new block to local state
      const baseBlock = result.data as unknown as TimeBlockWithRelations;
      const newBlock: TimeBlockWithRelations = {
        ...baseBlock,
        members: [],
        guests: [],
        fills: [],
      };

      // Insert in correct position (sorted by startTime)
      setTimeBlocks((prev) => {
        const updated = [...prev, newBlock];
        // Sort by startTime
        return updated.sort((a, b) => a.startTime.localeCompare(b.startTime));
      });

      toast.success("Time slot inserted");
      setInsertDialogOpen(false);
      setInsertAfterBlockId(null);
    } else {
      toast.error(result.error || "Failed to insert time slot");
    }
  };

  return (
    <TooltipProvider>
      <div className="flex gap-4">
        {/* Fixed Left Sidebar with Controls */}
        <div className="sticky top-0 w-56 flex-shrink-0 self-start">
          <Card className="max-h-[calc(100vh-2rem)] overflow-auto">
            <CardContent className="p-4">
              <ArrangeControls
                dateString={dateString}
                pendingChangesCount={pendingChangesCount}
                isSaving={isSaving}
                onSave={handleSave}
                onReset={handleReset}
                onFrostDelay={() => setIsFrostDelayOpen(true)}
                onFrostRemap={() => setIsFrostRemapOpen(true)}
                onViewLog={() => setIsChangeLogOpen(true)}
                hasLog={changeLog.length > 0}
              />
            </CardContent>
          </Card>
        </div>

        {/* Main Content - Timeblock List */}
        <div className="flex-1">
          <Card className="max-h-[calc(100vh-2rem)] overflow-auto">
            <CardContent className="p-4">
              {timeBlocks.length === 0 ? (
                <div className="py-8 text-center text-gray-500">
                  No time slots configured for this date.
                </div>
              ) : (
                <div className="space-y-2">
                  {timeBlocks.map((block, index) => (
                    <ArrangeTimeBlockCard
                      key={block.id}
                      block={block}
                      onSwapUp={() => handleSwapAdjacent(block.id!, "up")}
                      onSwapDown={() => handleSwapAdjacent(block.id!, "down")}
                      onInsert={() => {
                        setInsertAfterBlockId(block.id!);
                        setInsertDialogOpen(true);
                      }}
                      onDelete={() => handleDeleteTimeBlock(block.id!)}
                      onTimeBlockClick={() => handleTimeBlockClick(block.id!)}
                      onPlayerClick={handlePlayerClick}
                      selectedPlayerId={selectedPlayer?.id}
                      selectedPlayerType={selectedPlayer?.type}
                      isFirst={index === 0}
                      isLast={index === timeBlocks.length - 1}
                      disabled={isSaving}
                      hasChanges={blockChanges.has(block.id!)}
                      isDeleted={pendingDeletes.some(
                        (d) => d.timeBlockId === block.id,
                      )}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Frost Delay Modal */}
      <FrostDelayModal
        isOpen={isFrostDelayOpen}
        onClose={() => setIsFrostDelayOpen(false)}
        onApply={handleApplyFrostDelay}
        lastTeeTime={lastTeeTime}
      />

      {/* Block Remap Modal */}
      <BlockRemapModal
        isOpen={isFrostRemapOpen}
        onClose={() => setIsFrostRemapOpen(false)}
        onConfirm={handleApplyFrostRemap}
        timeBlocks={timeBlocks}
      />

      {/* Change Log Modal */}
      <ChangeLogModal
        isOpen={isChangeLogOpen}
        onClose={() => setIsChangeLogOpen(false)}
        changes={changeLog}
      />

      {/* Insert TimeBlock Dialog */}
      <InsertTimeBlockDialog
        isOpen={insertDialogOpen}
        onClose={() => {
          setInsertDialogOpen(false);
          setInsertAfterBlockId(null);
        }}
        onInsert={handleInsertTimeBlock}
        afterTimeBlock={timeBlocks.find((b) => b.id === insertAfterBlockId)}
      />

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant={confirmDialog.variant}
      />
    </TooltipProvider>
  );
}
