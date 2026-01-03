"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Blocks,
  Plus,
  Wand2,
  ArrowRight,
  Clock,
  Users,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { formatTime12Hour } from "~/lib/dates";
import type { TimeBlockWithRelations } from "~/server/db/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { ScrollArea } from "~/components/ui/scroll-area";
import { BlocksList } from "~/components/settings/teesheet/BlocksList";

// Types for the remapping workflow
interface ReplacementBlock {
  id: string;
  startTime: string;
  maxMembers: number;
  displayName?: string;
  mappedPlayers: MappedPlayer[];
}

interface MappedPlayer {
  playerId: number;
  playerType: "member" | "guest" | "fill";
  name: string;
  originalBlockId: number;
  invitedByMemberId?: number;
  fillType?: string;
  fillCustomName?: string | null;
}

interface BlockRemapModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (
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
  ) => Promise<void>;
  timeBlocks: TimeBlockWithRelations[];
}

type MappingStrategy = "forward-only" | "earliest-available";

type Step = "select_range" | "create_blocks" | "preview_map" | "confirm";

const STEP_TITLES: Record<Step, string> = {
  select_range: "Select Range",
  create_blocks: "Create Blocks",
  preview_map: "Map Players",
  confirm: "Confirm",
};

export function BlockRemapModal({
  isOpen,
  onClose,
  onConfirm,
  timeBlocks,
}: BlockRemapModalProps) {
  // Step state
  const [currentStep, setCurrentStep] = useState<Step>("select_range");

  // Range selection
  const [startBlockId, setStartBlockId] = useState<number | null>(null);
  const [endBlockId, setEndBlockId] = useState<number | null>(null);

  // Block generation
  const [intervalA, setIntervalA] = useState<number>(6);
  const [intervalB, setIntervalB] = useState<number>(7);
  const [useAlternating, setUseAlternating] = useState<boolean>(true);
  const [replacementBlocks, setReplacementBlocks] = useState<
    ReplacementBlock[]
  >([]);
  const [customBlockTime, setCustomBlockTime] = useState<string>("");

  // Mapping strategy
  const [mappingStrategy, setMappingStrategy] =
    useState<MappingStrategy>("forward-only");

  // Keep players together toggle (default: enabled)
  const [keepPlayersTogether, setKeepPlayersTogether] = useState<boolean>(true);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);

  // Get blocks in selected range
  const blocksInRange = useMemo(() => {
    if (!startBlockId || !endBlockId) return [];
    const startIdx = timeBlocks.findIndex((b) => b.id === startBlockId);
    const endIdx = timeBlocks.findIndex((b) => b.id === endBlockId);
    if (startIdx === -1 || endIdx === -1 || startIdx > endIdx) return [];
    return timeBlocks.slice(startIdx, endIdx + 1);
  }, [startBlockId, endBlockId, timeBlocks]);

  // Get all players from blocks in range (including fills)
  const playersInRange = useMemo(() => {
    const players: MappedPlayer[] = [];
    blocksInRange.forEach((block) => {
      block.members?.forEach((member) => {
        players.push({
          playerId: member.id,
          playerType: "member",
          name: `${member.firstName} ${member.lastName}`,
          originalBlockId: block.id!,
        });
      });
      block.guests?.forEach((guest) => {
        players.push({
          playerId: guest.id,
          playerType: "guest",
          name: `${guest.firstName} ${guest.lastName}`,
          originalBlockId: block.id!,
          invitedByMemberId: guest.invitedByMemberId,
        });
      });
      block.fills?.forEach((fill) => {
        players.push({
          playerId: fill.id,
          playerType: "fill",
          name: fill.customName || fill.fillType || "Fill",
          originalBlockId: block.id!,
          fillType: fill.fillType,
          fillCustomName: fill.customName,
        });
      });
    });
    return players;
  }, [blocksInRange]);

  // Calculate capacity info
  const capacityInfo = useMemo(() => {
    const totalPlayers = playersInRange.length;
    const totalNewSlots = replacementBlocks.reduce(
      (acc, b) => acc + b.maxMembers,
      0,
    );
    const hasOverflow = totalPlayers > totalNewSlots;
    return { totalPlayers, totalNewSlots, hasOverflow };
  }, [playersInRange, replacementBlocks]);

  // Generate blocks based on interval - merges with existing blocks
  const handleGenerateBlocks = useCallback(() => {
    if (blocksInRange.length === 0) return;

    const startTime = blocksInRange[0]!.startTime;
    const endTime = blocksInRange[blocksInRange.length - 1]!.startTime;

    const newBlocks = generateTimeBlocks(
      startTime,
      endTime,
      intervalA,
      useAlternating ? intervalB : undefined,
    );

    // Merge with existing blocks - preserve existing, add new if time doesn't exist
    setReplacementBlocks((prev) => {
      const existingTimes = new Set(prev.map((b) => b.startTime));
      const blocksToAdd = newBlocks.filter(
        (b) => !existingTimes.has(b.startTime),
      );
      const merged = [...prev, ...blocksToAdd];
      // Sort by startTime
      return merged.sort((a, b) => a.startTime.localeCompare(b.startTime));
    });
  }, [blocksInRange, intervalA, intervalB, useAlternating]);

  // Add custom block
  const handleAddCustomBlock = useCallback(() => {
    if (!customBlockTime) return;

    const newBlock: ReplacementBlock = {
      id: `custom-${Date.now()}`,
      startTime: customBlockTime,
      maxMembers: 4,
      mappedPlayers: [],
    };

    setReplacementBlocks((prev) =>
      [...prev, newBlock].sort((a, b) =>
        a.startTime.localeCompare(b.startTime),
      ),
    );
    setCustomBlockTime("");
  }, [customBlockTime]);

  // Remove block
  const handleRemoveBlock = useCallback((blockId: string) => {
    setReplacementBlocks((prev) => prev.filter((b) => b.id !== blockId));
  }, []);

  // Auto-map players using the algorithm
  const handleAutoMapPlayers = useCallback(() => {
    const mapped = autoMapPlayers(
      playersInRange,
      replacementBlocks,
      blocksInRange,
      mappingStrategy,
      keepPlayersTogether,
    );
    setReplacementBlocks(mapped);
  }, [
    playersInRange,
    replacementBlocks,
    blocksInRange,
    mappingStrategy,
    keepPlayersTogether,
  ]);

  // Delete all blocks
  const handleDeleteAllBlocks = useCallback(() => {
    setReplacementBlocks([]);
  }, []);

  // Handle confirmation
  const handleConfirm = async () => {
    if (!startBlockId || !endBlockId) return;

    setIsProcessing(true);
    try {
      // Include all players including fills - server now handles them explicitly
      const blocksForServer = replacementBlocks.map((block) => ({
        ...block,
        mappedPlayers: block.mappedPlayers.map((p) => ({
          playerId: p.playerId,
          playerType: p.playerType,
          name: p.name,
          originalBlockId: p.originalBlockId,
          invitedByMemberId: p.invitedByMemberId,
          fillType: p.fillType,
          fillCustomName: p.fillCustomName,
        })),
      }));
      await onConfirm(startBlockId, endBlockId, blocksForServer);
      handleClose();
    } catch (error) {
      console.error("Error applying remap:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Reset and close
  const handleClose = () => {
    setCurrentStep("select_range");
    setStartBlockId(null);
    setEndBlockId(null);
    setReplacementBlocks([]);
    setIntervalA(6);
    setIntervalB(7);
    setUseAlternating(true);
    setCustomBlockTime("");
    setMappingStrategy("forward-only");
    onClose();
  };

  // Navigate between steps
  const goToNextStep = () => {
    const steps: Step[] = [
      "select_range",
      "create_blocks",
      "preview_map",
      "confirm",
    ];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]!);
    }
  };

  const goToPreviousStep = () => {
    const steps: Step[] = [
      "select_range",
      "create_blocks",
      "preview_map",
      "confirm",
    ];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]!);
    }
  };

  // Validation for each step
  const canProceed = useMemo(() => {
    switch (currentStep) {
      case "select_range":
        return (
          startBlockId !== null &&
          endBlockId !== null &&
          blocksInRange.length > 0
        );
      case "create_blocks":
        return replacementBlocks.length > 0;
      case "preview_map":
        return true;
      case "confirm":
        return !capacityInfo.hasOverflow;
      default:
        return false;
    }
  }, [
    currentStep,
    startBlockId,
    endBlockId,
    blocksInRange.length,
    replacementBlocks.length,
    capacityInfo.hasOverflow,
  ]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[90vh] min-w-5xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Blocks className="h-5 w-5 text-blue-500" />
            Block Remapping
          </DialogTitle>
          <DialogDescription>
            Replace a range of time blocks with new blocks at a different
            interval.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 border-b py-2">
          {(
            [
              "select_range",
              "create_blocks",
              "preview_map",
              "confirm",
            ] as Step[]
          ).map((step, idx) => (
            <div key={step} className="flex items-center">
              <div
                className={cn(
                  "flex items-center gap-1 rounded-full px-3 py-1 text-sm",
                  currentStep === step
                    ? "bg-blue-100 font-medium text-blue-700"
                    : "text-gray-500",
                )}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-current/10 text-xs">
                  {idx + 1}
                </span>
                <span className="hidden sm:inline">{STEP_TITLES[step]}</span>
              </div>
              {idx < 3 && <ArrowRight className="mx-1 h-4 w-4 text-gray-300" />}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-auto py-4">
          {currentStep === "select_range" && (
            <StepSelectRange
              timeBlocks={timeBlocks}
              startBlockId={startBlockId}
              endBlockId={endBlockId}
              onStartChange={setStartBlockId}
              onEndChange={setEndBlockId}
              blocksInRange={blocksInRange}
              playersInRange={playersInRange}
            />
          )}

          {currentStep === "create_blocks" && (
            <StepCreateBlocks
              intervalA={intervalA}
              intervalB={intervalB}
              useAlternating={useAlternating}
              onIntervalAChange={setIntervalA}
              onIntervalBChange={setIntervalB}
              onUseAlternatingChange={setUseAlternating}
              customBlockTime={customBlockTime}
              onCustomBlockTimeChange={setCustomBlockTime}
              replacementBlocks={replacementBlocks}
              onGenerate={handleGenerateBlocks}
              onAddCustom={handleAddCustomBlock}
              onRemoveBlock={handleRemoveBlock}
              onDeleteAllBlocks={handleDeleteAllBlocks}
              onBlocksChange={setReplacementBlocks}
              onInsertBlock={(insertIndex) => {
                // Insert a new block at the given index with a default time
                const prevBlock = replacementBlocks[insertIndex - 1];
                const nextBlock = replacementBlocks[insertIndex];
                let newTime = "08:00";
                if (prevBlock && nextBlock) {
                  // Calculate midpoint time
                  const [prevH, prevM] = prevBlock.startTime
                    .split(":")
                    .map(Number);
                  const [nextH, nextM] = nextBlock.startTime
                    .split(":")
                    .map(Number);
                  const prevMins = (prevH ?? 0) * 60 + (prevM ?? 0);
                  const nextMins = (nextH ?? 0) * 60 + (nextM ?? 0);
                  const midMins = Math.floor((prevMins + nextMins) / 2);
                  const h = Math.floor(midMins / 60);
                  const m = midMins % 60;
                  newTime = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
                } else if (prevBlock) {
                  const [h, m] = prevBlock.startTime.split(":").map(Number);
                  const newMins = (h ?? 0) * 60 + (m ?? 0) + 7;
                  newTime = `${String(Math.floor(newMins / 60)).padStart(2, "0")}:${String(newMins % 60).padStart(2, "0")}`;
                } else if (nextBlock) {
                  const [h, m] = nextBlock.startTime.split(":").map(Number);
                  const newMins = Math.max(0, (h ?? 0) * 60 + (m ?? 0) - 7);
                  newTime = `${String(Math.floor(newMins / 60)).padStart(2, "0")}:${String(newMins % 60).padStart(2, "0")}`;
                }
                const newBlock: ReplacementBlock = {
                  id: `insert-${Date.now()}`,
                  startTime: newTime,
                  maxMembers: 4,
                  mappedPlayers: [],
                };
                const updated = [...replacementBlocks];
                updated.splice(insertIndex, 0, newBlock);
                setReplacementBlocks(updated);
              }}
              blocksInRange={blocksInRange}
            />
          )}

          {currentStep === "preview_map" && (
            <StepPreviewMap
              blocksInRange={blocksInRange}
              replacementBlocks={replacementBlocks}
              playersInRange={playersInRange}
              onAutoMap={handleAutoMapPlayers}
              capacityInfo={capacityInfo}
              mappingStrategy={mappingStrategy}
              onMappingStrategyChange={setMappingStrategy}
              keepPlayersTogether={keepPlayersTogether}
              onKeepPlayersTogetherChange={setKeepPlayersTogether}
            />
          )}

          {currentStep === "confirm" && (
            <StepConfirm
              blocksInRange={blocksInRange}
              replacementBlocks={replacementBlocks}
              capacityInfo={capacityInfo}
            />
          )}
        </div>

        <DialogFooter className="gap-2 border-t pt-4">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isProcessing}
          >
            Cancel
          </Button>

          {currentStep !== "select_range" && (
            <Button
              variant="outline"
              onClick={goToPreviousStep}
              disabled={isProcessing}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
          )}

          {currentStep !== "confirm" ? (
            <Button
              onClick={goToNextStep}
              disabled={!canProceed || isProcessing}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleConfirm}
              disabled={!canProceed || isProcessing}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isProcessing ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Applying...
                </>
              ) : (
                <>
                  <Blocks className="mr-2 h-4 w-4" />
                  Apply Remap
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Step 1: Select Range
function StepSelectRange({
  timeBlocks,
  startBlockId,
  endBlockId,
  onStartChange,
  onEndChange,
  blocksInRange,
  playersInRange,
}: {
  timeBlocks: TimeBlockWithRelations[];
  startBlockId: number | null;
  endBlockId: number | null;
  onStartChange: (id: number | null) => void;
  onEndChange: (id: number | null) => void;
  blocksInRange: TimeBlockWithRelations[];
  playersInRange: MappedPlayer[];
}) {
  return (
    <div className="space-y-6 p-2">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Start Block</Label>
          <Select
            value={startBlockId?.toString() ?? ""}
            onValueChange={(val) => onStartChange(val ? parseInt(val) : null)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select start time..." />
            </SelectTrigger>
            <SelectContent>
              {timeBlocks.map((block) => (
                <SelectItem key={block.id} value={block.id!.toString()}>
                  {formatTime12Hour(block.startTime)}
                  {block.displayName && ` - ${block.displayName}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>End Block</Label>
          <Select
            value={endBlockId?.toString() ?? ""}
            onValueChange={(val) => onEndChange(val ? parseInt(val) : null)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select end time..." />
            </SelectTrigger>
            <SelectContent>
              {timeBlocks
                .filter((b) => {
                  if (!startBlockId) return true;
                  // Filter by array position, not by ID (IDs may not be sequential after remaps)
                  const startIndex = timeBlocks.findIndex(
                    (tb) => tb.id === startBlockId,
                  );
                  const currentIndex = timeBlocks.findIndex(
                    (tb) => tb.id === b.id,
                  );
                  return currentIndex >= startIndex;
                })
                .map((block) => (
                  <SelectItem key={block.id} value={block.id!.toString()}>
                    {formatTime12Hour(block.startTime)}
                    {block.displayName && ` - ${block.displayName}`}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {blocksInRange.length > 0 && (
        <div className="space-y-2 rounded-lg bg-blue-50 p-4">
          <h4 className="font-medium text-blue-800">Selected Range</h4>
          <div className="text-sm text-blue-700">
            <p>
              <Clock className="mr-1 inline h-4 w-4" />
              {formatTime12Hour(blocksInRange[0]!.startTime)} to{" "}
              {formatTime12Hour(
                blocksInRange[blocksInRange.length - 1]!.startTime,
              )}
            </p>
            <p>
              <Users className="mr-1 inline h-4 w-4" />
              {blocksInRange.length} blocks with {playersInRange.length} players
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Step 2: Create Blocks
function StepCreateBlocks({
  intervalA,
  intervalB,
  useAlternating,
  onIntervalAChange,
  onIntervalBChange,
  onUseAlternatingChange,
  customBlockTime,
  onCustomBlockTimeChange,
  replacementBlocks,
  onGenerate,
  onAddCustom,
  onRemoveBlock,
  onDeleteAllBlocks,
  onBlocksChange,
  onInsertBlock,
  blocksInRange,
}: {
  intervalA: number;
  intervalB: number;
  useAlternating: boolean;
  onIntervalAChange: (val: number) => void;
  onIntervalBChange: (val: number) => void;
  onUseAlternatingChange: (val: boolean) => void;
  customBlockTime: string;
  onCustomBlockTimeChange: (val: string) => void;
  replacementBlocks: ReplacementBlock[];
  onGenerate: () => void;
  onAddCustom: () => void;
  onRemoveBlock: (id: string) => void;
  onDeleteAllBlocks: () => void;
  onBlocksChange: (blocks: ReplacementBlock[]) => void;
  onInsertBlock: (insertIndex: number) => void;
  blocksInRange: TimeBlockWithRelations[];
}) {
  const scrollableRef = useRef<HTMLDivElement>(null);
  return (
    <div className="grid grid-cols-4 gap-4 p-2">
      <div className="col-span-1 space-y-4">
        {/* Interval generation */}
        <div className="space-y-3">
          <Label>Generate Blocks at Interval</Label>

          {/* Alternating toggle */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="alternating-toggle"
              checked={useAlternating}
              onCheckedChange={(checked) =>
                onUseAlternatingChange(checked === true)
              }
            />
            <Label
              htmlFor="alternating-toggle"
              className="cursor-pointer text-sm font-normal"
            >
              Use alternating intervals (e.g., 6-7-6-7 pattern)
            </Label>
          </div>

          {/* Interval inputs */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={5}
                max={30}
                value={intervalA}
                onChange={(e) =>
                  onIntervalAChange(parseInt(e.target.value) || 6)
                }
                className="w-20"
              />
              <span className="text-sm text-gray-500">min</span>
            </div>

            {useAlternating && (
              <>
                <span className="text-gray-400">/</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={5}
                    max={30}
                    value={intervalB}
                    onChange={(e) =>
                      onIntervalBChange(parseInt(e.target.value) || 7)
                    }
                    className="w-20"
                  />
                  <span className="text-sm text-gray-500">min</span>
                </div>
              </>
            )}

            <Button onClick={onGenerate} variant="outline">
              <Wand2 className="mr-2 h-4 w-4" />
              Generate
            </Button>
          </div>

          <p className="text-xs text-gray-500">
            {useAlternating
              ? `Alternates ${intervalA} and ${intervalB} minute intervals from ${formatTime12Hour(blocksInRange[0]?.startTime || "00:00")} to ${formatTime12Hour(blocksInRange[blocksInRange.length - 1]?.startTime || "00:00")}`
              : `Generates blocks every ${intervalA} minutes from ${formatTime12Hour(blocksInRange[0]?.startTime || "00:00")} to ${formatTime12Hour(blocksInRange[blocksInRange.length - 1]?.startTime || "00:00")}`}
          </p>
        </div>

        {/* Custom block addition */}
        <div className="space-y-3">
          <Label>Add Custom Block</Label>
          <div className="flex gap-2">
            <Input
              type="time"
              value={customBlockTime}
              onChange={(e) => onCustomBlockTimeChange(e.target.value)}
              className="w-36"
            />
            <Button
              onClick={onAddCustom}
              variant="outline"
              disabled={!customBlockTime}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add
            </Button>
          </div>
        </div>
      </div>
      <div className="col-span-3">
        {/* Generated blocks list with drag-and-drop */}
        <div className="h-full space-y-2">
          <div className="flex items-center justify-between">
            <Label>New Blocks ({replacementBlocks.length})</Label>
            {replacementBlocks.length > 0 && (
              <Button
                onClick={onDeleteAllBlocks}
                variant="ghost"
                size="sm"
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="mr-1 h-4 w-4" />
                Delete All
              </Button>
            )}
          </div>
          <ScrollArea
            className="h-80 rounded-lg border p-2"
            ref={scrollableRef}
          >
            <BlocksList
              blocks={replacementBlocks.map((block, index) => ({
                id: block.id,
                startTime: block.startTime,
                maxPlayers: block.maxMembers,
                displayName: block.displayName,
                sortOrder: index,
                configId: 0, // Dummy value - not used for rendering
              }))}
              onBlocksChange={(updatedBlocks) => {
                // Convert back to ReplacementBlock format preserving mappedPlayers
                const playersByBlockId = new Map(
                  replacementBlocks.map((b) => [b.id, b.mappedPlayers]),
                );
                onBlocksChange(
                  updatedBlocks.map((b) => ({
                    id: String(b.id),
                    startTime: b.startTime,
                    maxMembers: b.maxPlayers ?? 4,
                    displayName: b.displayName ?? undefined,
                    mappedPlayers: playersByBlockId.get(String(b.id)) ?? [],
                  })),
                );
              }}
              onDeleteBlock={(blockId) => onRemoveBlock(String(blockId))}
              scrollableRef={scrollableRef}
              onInsertBlock={onInsertBlock}
            />
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

// Step 3: Preview and Map
function StepPreviewMap({
  blocksInRange,
  replacementBlocks,
  playersInRange,
  onAutoMap,
  capacityInfo,
  mappingStrategy,
  onMappingStrategyChange,
  keepPlayersTogether,
  onKeepPlayersTogetherChange,
}: {
  blocksInRange: TimeBlockWithRelations[];
  replacementBlocks: ReplacementBlock[];
  playersInRange: MappedPlayer[];
  onAutoMap: () => void;
  capacityInfo: {
    totalPlayers: number;
    totalNewSlots: number;
    hasOverflow: boolean;
  };
  mappingStrategy: MappingStrategy;
  onMappingStrategyChange: (value: MappingStrategy) => void;
  keepPlayersTogether: boolean;
  onKeepPlayersTogetherChange: (value: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Capacity warning */}
      {capacityInfo.hasOverflow && (
        <div className="flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-600" />
          <div className="text-sm text-yellow-800">
            <p className="font-medium">Capacity Warning</p>
            <p>
              {capacityInfo.totalPlayers} players need to be mapped but only{" "}
              {capacityInfo.totalNewSlots} slots available.
            </p>
          </div>
        </div>
      )}

      {/* Mapping strategy selector */}
      <div className="space-y-2 rounded-lg bg-gray-50 p-3">
        <div className="flex items-center gap-2">
          <Label className="text-sm">Mapping Strategy</Label>
          <Select
            value={mappingStrategy}
            onValueChange={(val) =>
              onMappingStrategyChange(val as MappingStrategy)
            }
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="forward-only">Forward Only</SelectItem>
              <SelectItem value="earliest-available">
                Earliest Available
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-gray-500">
          {mappingStrategy === "forward-only"
            ? "Maps players to the closest available block at or after their original time. Prevents moving players earlier. Best for frost delays."
            : "Maps players to the closest available block regardless of time. May move players earlier or later. Best for condensing tee times."}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <Checkbox
            id="keep-together-toggle"
            checked={keepPlayersTogether}
            onCheckedChange={(checked) =>
              onKeepPlayersTogetherChange(checked === true)
            }
          />
          <Label
            htmlFor="keep-together-toggle"
            className="cursor-pointer text-sm font-normal"
          >
            Keep players together
          </Label>
        </div>
        <p className="text-xs text-gray-500">
          {keepPlayersTogether
            ? "Players from the same tee time will be mapped to the same block."
            : "Each player is mapped individually to the earliest available slot."}
        </p>
      </div>

      {/* Auto-map button */}
      <div className="flex justify-center">
        <Button onClick={onAutoMap} className="gap-2">
          <Wand2 className="h-4 w-4" />
          Auto-Map Players
        </Button>
      </div>

      {/* Side-by-side preview */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Original blocks */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Original Blocks</h4>
          <ScrollArea className="h-64 rounded-lg border p-2">
            <div className="space-y-2">
              {blocksInRange.map((block) => {
                const playerCount =
                  (block.members?.length ?? 0) +
                  (block.guests?.length ?? 0) +
                  (block.fills?.length ?? 0);
                return (
                  <div
                    key={block.id}
                    className="rounded border border-red-100 bg-red-50 p-2"
                  >
                    <div className="text-sm font-medium text-red-800">
                      {formatTime12Hour(block.startTime)}
                    </div>
                    <div className="text-xs text-red-600">
                      {playerCount} player{playerCount !== 1 ? "s" : ""}
                    </div>
                    {playerCount > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {block.members?.map((m) => (
                          <Badge
                            key={`m-${m.id}`}
                            variant="outline"
                            className="border-blue-200 bg-blue-50 text-xs text-blue-700"
                          >
                            {m.firstName} {m.lastName}
                          </Badge>
                        ))}
                        {block.guests?.map((g) => (
                          <Badge
                            key={`g-${g.id}`}
                            variant="outline"
                            className="border-purple-200 bg-purple-50 text-xs text-purple-700"
                          >
                            {g.firstName} {g.lastName}
                            <span className="ml-0.5 text-[10px] opacity-70">
                              G
                            </span>
                          </Badge>
                        ))}
                        {block.fills?.map((f) => (
                          <Badge
                            key={`f-${f.id}`}
                            variant="outline"
                            className="border-gray-200 bg-gray-100 text-xs text-gray-700"
                          >
                            {f.customName || f.fillType || "Fill"}
                            <span className="ml-0.5 text-[10px] opacity-70">
                              F
                            </span>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* New blocks */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">New Blocks</h4>
          <ScrollArea className="h-64 rounded-lg border p-2">
            <div className="space-y-2">
              {replacementBlocks.map((block) => (
                <div
                  key={block.id}
                  className="rounded border border-green-100 bg-green-50 p-2"
                >
                  <div className="text-sm font-medium text-green-800">
                    {formatTime12Hour(block.startTime)}
                  </div>
                  <div className="text-xs text-green-600">
                    {block.mappedPlayers.length} / {block.maxMembers} players
                  </div>
                  {block.mappedPlayers.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {block.mappedPlayers.map((p) => (
                        <Badge
                          key={`${p.playerType}-${p.playerId}-${p.originalBlockId}`}
                          variant="outline"
                          className={`text-xs ${
                            p.playerType === "member"
                              ? "border-blue-200 bg-blue-50 text-blue-700"
                              : p.playerType === "guest"
                                ? "border-purple-200 bg-purple-50 text-purple-700"
                                : "border-gray-200 bg-gray-100 text-gray-700"
                          }`}
                        >
                          {p.name}
                          {p.playerType === "guest" && (
                            <span className="ml-0.5 text-[10px] opacity-70">
                              G
                            </span>
                          )}
                          {p.playerType === "fill" && (
                            <span className="ml-0.5 text-[10px] opacity-70">
                              F
                            </span>
                          )}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Unmapped players */}
      {playersInRange.length > 0 && (
        <div className="text-center text-sm text-gray-500">
          {replacementBlocks.reduce(
            (acc, b) => acc + b.mappedPlayers.length,
            0,
          )}{" "}
          of {playersInRange.length} players mapped
        </div>
      )}
    </div>
  );
}

// Step 4: Confirm
function StepConfirm({
  blocksInRange,
  replacementBlocks,
  capacityInfo,
}: {
  blocksInRange: TimeBlockWithRelations[];
  replacementBlocks: ReplacementBlock[];
  capacityInfo: {
    totalPlayers: number;
    totalNewSlots: number;
    hasOverflow: boolean;
  };
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg bg-gray-50 p-4">
        <h4 className="font-medium">Summary</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Blocks to remove:</span>
            <span className="ml-2 font-medium text-red-600">
              {blocksInRange.length}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Blocks to create:</span>
            <span className="ml-2 font-medium text-green-600">
              {replacementBlocks.length}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Players to remap:</span>
            <span className="ml-2 font-medium">
              {capacityInfo.totalPlayers}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Available slots:</span>
            <span className="ml-2 font-medium">
              {capacityInfo.totalNewSlots}
            </span>
          </div>
        </div>
      </div>

      {capacityInfo.hasOverflow ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
          <div className="text-sm text-red-800">
            <p className="font-medium">Cannot Proceed</p>
            <p>
              Not enough slots for all players. Go back and add more blocks or
              increase capacity.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <p className="text-sm text-green-800">
            Ready to apply. This will permanently replace the selected time
            blocks.
          </p>
        </div>
      )}
    </div>
  );
}

// Helper: Generate time blocks at interval (supports alternating intervals)
function generateTimeBlocks(
  startTime: string,
  endTime: string,
  intervalA: number,
  intervalB?: number,
): ReplacementBlock[] {
  const blocks: ReplacementBlock[] = [];

  // Parse times using the same parser (handles both HH:MM and H:MM AM/PM)
  let currentMinutes: number;
  let endMinutes: number;
  try {
    currentMinutes = parseTimeToMinutes(startTime);
    endMinutes = parseTimeToMinutes(endTime);
  } catch (error) {
    console.error("Error parsing times in generateTimeBlocks:", error);
    return blocks; // Return empty if we can't parse
  }

  let useFirstInterval = true;

  while (currentMinutes <= endMinutes) {
    const h = Math.floor(currentMinutes / 60);
    const m = currentMinutes % 60;
    blocks.push({
      id: `gen-${currentMinutes}`,
      startTime: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
      maxMembers: 4,
      mappedPlayers: [],
    });

    // Alternate between intervals if intervalB is provided
    if (intervalB !== undefined) {
      currentMinutes += useFirstInterval ? intervalA : intervalB;
      useFirstInterval = !useFirstInterval;
    } else {
      currentMinutes += intervalA;
    }
  }

  return blocks;
}


// Forward-Only Strategy:
// Only maps to blocks at or after original time
// If no block available, falls back to latest available block (not earliest)
// Skips mapping if original time can't be parsed (instead of using 0)
// Earliest Available Strategy:
// Ignores original time completely
// Always picks earliest block with capacity
// Fills early blocks sequentially
// Both strategies now handle:
// Times with/without AM/PM
// Times with seconds
// Variations like "p.m." or "P.M."
// Invalid/unparseable times (skips instead of mapping incorrectly)
// Helper: Parse time string to minutes since midnight
// Handles both "HH:MM" (24-hour) and "H:MM AM/PM" (12-hour) formats
// Also handles seconds and variations like "p.m." or "P.M."
function parseTimeToMinutes(timeStr: string): number {
  const s = timeStr.trim();

  // Try to match: "7:53", "07:53", "7:53 AM", "2:45 PM", "7am", "12 PM", "14:45:00", "2:45:00 PM", "2:45 p.m.", etc.
  // Match format: hour:minute:second? AM/PM?
  const match = s.match(
    /^(\d{1,2})(?::(\d{2}))(?::(\d{2}))?\s*([AaPp]\.?[Mm]\.?)?$/,
  );
  if (!match) {
    throw new Error(`Invalid time format: "${timeStr}"`);
  }

  let hour = parseInt(match[1]!, 10);
  const minute = match[2] ? parseInt(match[2]!, 10) : 0;
  // seconds are ignored but parsed to handle formats like "14:45:00"
  const meridiem = match[4]?.replace(/\./g, "").toUpperCase(); // "AM" | "PM" | undefined (handles "a.m.", "P.M.", etc.)

  if (minute < 0 || minute > 59) {
    throw new Error(`Invalid minutes in "${timeStr}"`);
  }

  // If AM/PM is present, convert to 24-hour
  if (meridiem) {
    if (hour < 1 || hour > 12) {
      throw new Error(`Invalid 12-hour time in "${timeStr}"`);
    }
    if (meridiem === "AM") {
      if (hour === 12) hour = 0;
    } else {
      // PM
      if (hour !== 12) hour += 12;
    }
  } else {
    // No AM/PM - assume 24-hour format
    if (hour < 0 || hour > 23) {
      throw new Error(`Invalid hour in "${timeStr}"`);
    }
  }

  return hour * 60 + minute;
}

// Helper: Auto-map players to new blocks
// strategy: "forward-only" = only map to blocks at or after original time (default for frost delays)
//           "earliest-available" = map to earliest available block regardless of original time
// keepTogether: if true, players from same original block are mapped together
function autoMapPlayers(
  players: MappedPlayer[],
  newBlocks: ReplacementBlock[],
  originalBlocks: TimeBlockWithRelations[],
  strategy: MappingStrategy = "forward-only",
  keepTogether: boolean = true,
): ReplacementBlock[] {
  if (newBlocks.length === 0 || players.length === 0) {
    return newBlocks.map((b) => ({
      ...b,
      mappedPlayers: [] as MappedPlayer[],
    }));
  }

  // Pre-parse and sort replacement blocks once (and filter out bad ones)
  const parsedBlocks = newBlocks
    .map((b) => {
      try {
        const blockTime = parseTimeToMinutes(b.startTime);
        return {
          ...b,
          mappedPlayers: [] as MappedPlayer[],
          _t: blockTime, // Store parsed time for sorting
        };
      } catch (e) {
        console.error("Bad replacement block time:", b.id, b.startTime, e);
        return null;
      }
    })
    .filter((b): b is NonNullable<typeof b> => b !== null)
    .sort((a, b) => a._t - b._t); // Sort by time (earliest first)

  if (parsedBlocks.length === 0) {
    console.warn("No valid replacement blocks after parsing");
    return newBlocks.map((b) => ({
      ...b,
      mappedPlayers: [] as MappedPlayer[],
    }));
  }

  // Build time lookup for original blocks (use null for unparseable, not 0)
  const originalBlockTimes = new Map<number, number | null>();
  originalBlocks.forEach((block) => {
    if (!block.id) {
      console.error("Original block missing id:", block);
      return;
    }
    try {
      const blockTime = parseTimeToMinutes(block.startTime);
      originalBlockTimes.set(block.id, blockTime);
    } catch (e) {
      console.error("Bad original block time:", block.id, block.startTime, e);
      originalBlockTimes.set(block.id, null); // Use null, not 0
    }
  });

  // Helper to find best block for a group of players
  const findBestBlock = (
    groupSize: number,
    originalTime: number | null,
  ): (typeof parsedBlocks)[number] | null => {
    // If original time is null/unparseable, skip mapping for forward-only
    if (originalTime === null && strategy === "forward-only") {
      console.warn("Skipping mapping: missing/unparseable original time");
      return null;
    }

    let bestBlock: (typeof parsedBlocks)[number] | null = null;
    let bestDistance = Infinity;

    parsedBlocks.forEach((block) => {
      const availableSlots = block.maxMembers - block.mappedPlayers.length;
      if (availableSlots < groupSize) return;

      const blockTime = block._t; // Already parsed and stored

      let distance: number;
      if (strategy === "forward-only") {
        // Only consider blocks at or after original time
        if (originalTime !== null) {
          distance =
            blockTime >= originalTime ? blockTime - originalTime : Infinity;
        } else {
          return; // Skip if originalTime is null
        }
      } else {
        // "earliest-available": ignore original time, pick earliest block
        // Just use blockTime as distance (lower = earlier = better)
        distance = blockTime;
      }

      if (distance < bestDistance) {
        bestDistance = distance;
        bestBlock = block;
      }
    });

    // Fallback for forward-only: pick latest available block (not first)
    if (bestBlock === null && strategy === "forward-only") {
      // Iterate backwards to find latest block with capacity
      for (let i = parsedBlocks.length - 1; i >= 0; i--) {
        const block = parsedBlocks[i]!;
        const availableSlots = block.maxMembers - block.mappedPlayers.length;
        if (availableSlots >= groupSize) {
          bestBlock = block;
          break;
        }
      }
    }

    return bestBlock;
  };

  if (keepTogether) {
    // Group players by original block
    const playerGroups = new Map<number, MappedPlayer[]>();
    players.forEach((player) => {
      const group = playerGroups.get(player.originalBlockId) || [];
      group.push(player);
      playerGroups.set(player.originalBlockId, group);
    });

    // Sort groups by time (for forward-only) or ignore time (for earliest-available)
    const sortedGroups = [...playerGroups.entries()];
    if (strategy === "forward-only") {
      sortedGroups.sort((a, b) => {
        const timeA = originalBlockTimes.get(a[0]) ?? Infinity;
        const timeB = originalBlockTimes.get(b[0]) ?? Infinity;
        // Put null times at the end
        if (timeA === null) return 1;
        if (timeB === null) return -1;
        return timeA - timeB;
      });
    }
    // For earliest-available, order doesn't matter - we'll fill earliest blocks first

    // Map each group together
    sortedGroups.forEach(([blockId, group]) => {
      const originalTime = originalBlockTimes.get(blockId) ?? null;
      const bestBlock = findBestBlock(group.length, originalTime);

      if (bestBlock) {
        const targetBlock = bestBlock;
        group.forEach((player) => targetBlock.mappedPlayers.push(player));
      }
    });
  } else {
    // Map each player individually
    // For earliest-available, we want to fill earliest blocks first, so sort players
    // by their original time (earliest players get mapped first)
    // For forward-only, also sort by original time
    const sortedPlayers = [...players].sort((a, b) => {
      const timeA = originalBlockTimes.get(a.originalBlockId) ?? Infinity;
      const timeB = originalBlockTimes.get(b.originalBlockId) ?? Infinity;
      // Put null times at the end
      if (timeA === null) return 1;
      if (timeB === null) return -1;
      return timeA - timeB;
    });

    sortedPlayers.forEach((player) => {
      const originalTime =
        originalBlockTimes.get(player.originalBlockId) ?? null;
      const bestBlock = findBestBlock(1, originalTime);
      if (bestBlock) {
        bestBlock.mappedPlayers.push(player);
      }
    });
  }

  // Return blocks in original order (remove _t property)
  return parsedBlocks.map(({ _t, ...block }) => block);
}
