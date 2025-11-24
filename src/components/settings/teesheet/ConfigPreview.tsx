"use client";

import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { BlocksList } from "./BlocksList";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import type { ConfigBlockInsert } from "~/server/db/schema";

type BlockWithId = Omit<ConfigBlockInsert, "id"> & { id: string | number };

interface ConfigPreviewProps {
  blocks: BlockWithId[];
  onBlocksChange: (blocks: BlockWithId[]) => void;
}

export function ConfigPreview({ blocks, onBlocksChange }: ConfigPreviewProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [insertIndex, setInsertIndex] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    startTime: "08:00",
    displayName: "",
  });

  const handleDeleteBlock = (blockId: string | number) => {
    const updatedBlocks = blocks.filter((b) => b.id !== blockId);
    onBlocksChange(updatedBlocks);
  };

  const handleAddCustomBlock = () => {
    const newBlock: BlockWithId = {
      id: `block-${Date.now()}`,
      startTime: formData.startTime,
      displayName: formData.displayName || undefined,
      maxPlayers: 4,
      sortOrder: 0,
      configId: 0,
    };

    let updatedBlocks: BlockWithId[];

    if (insertIndex !== null) {
      // Insert at specific index
      updatedBlocks = [...blocks];
      updatedBlocks.splice(insertIndex, 0, newBlock);
    } else {
      // Append to end
      updatedBlocks = [...blocks, newBlock];
    }

    // Update sortOrder for all blocks
    updatedBlocks = updatedBlocks.map((block, idx) => ({
      ...block,
      sortOrder: idx,
    }));

    onBlocksChange(updatedBlocks);
    setFormData({ startTime: "08:00", displayName: "" });
    setInsertIndex(null);
    setIsDialogOpen(false);
  };

  const handleInsertBlock = (index: number) => {
    setInsertIndex(index);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Time Blocks</h3>
          <p className="text-sm text-gray-500">
            Drag to reorder. Click X to remove blocks.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => setIsDialogOpen(true)}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Block
        </Button>
      </div>

      {/* Blocks List */}
      <div ref={scrollAreaRef} className="scrollbar-visible h-140 overflow-y-auto rounded-lg border">
        <div className="space-y-2 p-3">
          <BlocksList
            blocks={blocks}
            onBlocksChange={onBlocksChange}
            onDeleteBlock={handleDeleteBlock}
            scrollableRef={scrollAreaRef}
            onInsertBlock={handleInsertBlock}
          />
        </div>
      </div>

      {/* Add Custom Block Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {insertIndex !== null ? "Insert Block" : "Add Custom Block"}
            </DialogTitle>
            <DialogDescription>
              {insertIndex !== null
                ? "Create a new time block at this position."
                : "Create a new time block with a custom start time."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="blockTime">Start Time</Label>
              <Input
                id="blockTime"
                type="time"
                value={formData.startTime}
                onChange={(e) =>
                  setFormData({ ...formData, startTime: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="blockName">Display Name (Optional)</Label>
              <Input
                id="blockName"
                type="text"
                placeholder="e.g., Premium, Walkup"
                value={formData.displayName}
                onChange={(e) =>
                  setFormData({ ...formData, displayName: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false);
                setInsertIndex(null);
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleAddCustomBlock}>
              {insertIndex !== null ? "Insert Block" : "Add Block"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
