"use client";

import { useWatch, type Control } from "react-hook-form";
import { useState, useMemo } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import type { ConfigBlock as ConfigBlockType } from "~/server/db/schema";
import { Plus, X } from "lucide-react";

interface ConfigPreviewProps {
  control: Control<any>;
  blocks: ConfigBlockType[];
}

interface Block {
  id: string | number;
  displayName?: string | null;
  startTime: string;
  maxPlayers: number;
  sortOrder: number;
  isAuto: boolean;
}

function generateAutoBlocks(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  interval: number | null | undefined,
  maxPlayers: number | null | undefined
): Block[] {
  if (!startTime || !endTime || !interval || !maxPlayers) return [];

  const blocks: Block[] = [];
  const timeParts = startTime.split(":");
  const startHour = Number(timeParts[0]);
  const startMin = Number(timeParts[1]);

  const endTimeParts = endTime.split(":");
  const endHour = Number(endTimeParts[0]);
  const endMin = Number(endTimeParts[1]);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  let currentMinutes = startMinutes;
  let sortOrder = 0;

  while (currentMinutes < endMinutes) {
    const hour = Math.floor(currentMinutes / 60);
    const min = currentMinutes % 60;
    const timeStr = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;

    blocks.push({
      id: `auto-${sortOrder}`,
      startTime: timeStr,
      maxPlayers,
      sortOrder,
      isAuto: true,
    });

    currentMinutes += interval;
    sortOrder++;
  }

  return blocks;
}

function formatTimeString(time: string): string {
  const timeParts = time.split(":");
  const hour = Number(timeParts[0]);
  const min = Number(timeParts[1]);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(min).padStart(2, "0")} ${period}`;
}

export function ConfigPreview({ control, blocks: initialBlocks }: ConfigPreviewProps) {
  const startTime = useWatch({ control, name: "startTime" });
  const endTime = useWatch({ control, name: "endTime" });
  const interval = useWatch({ control, name: "interval" });
  const maxMembersPerBlock = useWatch({ control, name: "maxMembersPerBlock" });

  const [manualBlocks, setManualBlocks] = useState<Block[]>(
    initialBlocks.map((block, index) => ({
      id: block.id,
      displayName: block.displayName,
      startTime: block.startTime,
      maxPlayers: block.maxPlayers,
      sortOrder: block.sortOrder || index,
      isAuto: false,
    }))
  );

  const [showAddBlock, setShowAddBlock] = useState(false);
  const [newBlockForm, setNewBlockForm] = useState({
    displayName: "",
    startTime: startTime || "08:00",
    maxPlayers: maxMembersPerBlock || 4,
  });

  const autoBlocks = useMemo(() => {
    return generateAutoBlocks(startTime, endTime, interval, maxMembersPerBlock);
  }, [startTime, endTime, interval, maxMembersPerBlock]);

  const allBlocks = useMemo(() => {
    const combined = [...autoBlocks, ...manualBlocks];
    return combined.sort((a, b) => {
      const timeA = parseInt(a.startTime.replace(":", ""));
      const timeB = parseInt(b.startTime.replace(":", ""));
      return timeA - timeB;
    });
  }, [autoBlocks, manualBlocks]);

  const handleAddBlock = () => {
    if (!newBlockForm.startTime) return;

    const newBlock: Block = {
      id: `manual-${Date.now()}`,
      displayName: newBlockForm.displayName || undefined,
      startTime: newBlockForm.startTime,
      maxPlayers: newBlockForm.maxPlayers,
      sortOrder: manualBlocks.length,
      isAuto: false,
    };

    setManualBlocks([...manualBlocks, newBlock]);
    setNewBlockForm({
      displayName: "",
      startTime: startTime || "08:00",
      maxPlayers: maxMembersPerBlock || 4,
    });
    setShowAddBlock(false);
  };

  const handleDeleteBlock = (blockId: string | number) => {
    setManualBlocks(manualBlocks.filter((b) => b.id !== blockId));
  };

  const handleReorderBlocks = (
    sourceIndex: number,
    destinationIndex: number
  ) => {
    const newBlocks = Array.from(allBlocks);
    const spliced = newBlocks.splice(sourceIndex, 1);
    const movedBlock = spliced[0];
    if (!movedBlock) return;

    newBlocks.splice(destinationIndex, 0, movedBlock);

    // Update manual blocks order
    const updatedManual = manualBlocks.map((block) => {
      const newIndex = newBlocks.findIndex((b) => b.id === block.id);
      return { ...block, sortOrder: newIndex };
    });
    setManualBlocks(updatedManual);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Preview</h3>
        <p className="text-sm text-gray-500">
          Generated and custom time blocks
        </p>
      </div>

      {/* Blocks List */}
      <div className="max-h-96 space-y-2 overflow-y-auto rounded-lg border p-3">
        {allBlocks.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-gray-500">
            <p>No time blocks. Adjust settings or add custom blocks.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {allBlocks.map((block) => (
              <div
                key={block.id}
                className="flex items-center justify-between rounded border bg-gray-50 p-3 hover:bg-gray-100"
              >
                <div className="flex flex-1 items-center gap-3">
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">
                      {formatTimeString(block.startTime)}
                    </span>
                    {block.displayName && (
                      <span className="text-xs text-gray-600">
                        {block.displayName}
                      </span>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    Max {block.maxPlayers}
                  </Badge>
                  {block.isAuto && (
                    <Badge variant="outline" className="text-xs">
                      Auto
                    </Badge>
                  )}
                </div>

                {!block.isAuto && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteBlock(block.id)}
                    className="text-red-500 hover:bg-red-50 hover:text-red-600"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Block Section */}
      {!showAddBlock ? (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => setShowAddBlock(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Custom Block
        </Button>
      ) : (
        <div className="space-y-3 rounded-lg border bg-gray-50 p-4">
          <div className="space-y-2">
            <Label htmlFor="blockDisplayName" className="text-xs">
              Display Name (optional)
            </Label>
            <Input
              id="blockDisplayName"
              placeholder="e.g., HOLE 1"
              value={newBlockForm.displayName}
              onChange={(e) =>
                setNewBlockForm({
                  ...newBlockForm,
                  displayName: e.target.value,
                })
              }
              className="text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="blockStartTime" className="text-xs">
                Start Time
              </Label>
              <Input
                id="blockStartTime"
                type="time"
                value={newBlockForm.startTime}
                onChange={(e) =>
                  setNewBlockForm({
                    ...newBlockForm,
                    startTime: e.target.value,
                  })
                }
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="blockMaxPlayers" className="text-xs">
                Max Players
              </Label>
              <Input
                id="blockMaxPlayers"
                type="number"
                value={newBlockForm.maxPlayers}
                onChange={(e) =>
                  setNewBlockForm({
                    ...newBlockForm,
                    maxPlayers: parseInt(e.target.value) || 0,
                  })
                }
                className="text-sm"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                setShowAddBlock(false);
                setNewBlockForm({
                  displayName: "",
                  startTime: startTime || "08:00",
                  maxPlayers: maxMembersPerBlock || 4,
                });
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="flex-1"
              onClick={handleAddBlock}
            >
              Add Block
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
