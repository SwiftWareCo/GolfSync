"use client";

import { useEffect, useState } from "react";
import type { RefObject } from "react";
import { Plus } from "lucide-react";
import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { extractClosestEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { reorderWithEdge } from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/reorder-with-edge";
import { autoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";
import { flushSync } from "react-dom";
import { Block } from "./Block";
import type { ConfigBlockInsert } from "~/server/db/schema";

interface BlockData {
  type: "block";
  blockId: string | number;
}

function isBlockData(data: unknown): data is BlockData {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    data.type === "block" &&
    "blockId" in data
  );
}

type BlockWithId = Omit<ConfigBlockInsert, "id"> & { id: string | number };

interface BlocksListProps {
  blocks: BlockWithId[];
  onBlocksChange: (blocks: BlockWithId[]) => void;
  onDeleteBlock: (blockId: string | number) => void;
  scrollableRef: RefObject<HTMLDivElement>;
  onInsertBlock?: (insertIndex: number) => void;
}

export function BlocksList({
  blocks,
  onBlocksChange,
  onDeleteBlock,
  scrollableRef,
  onInsertBlock,
}: BlocksListProps) {
  const [hoveredInsertIndex, setHoveredInsertIndex] = useState<number | null>(
    null,
  );
  useEffect(() => {
    return monitorForElements({
      canMonitor({ source }) {
        return isBlockData(source.data);
      },
      onDrop({ location, source }) {
        const target = location.current.dropTargets[0];
        if (!target) {
          return;
        }

        const sourceData = source.data;
        const targetData = target.data;

        if (!isBlockData(sourceData) || !isBlockData(targetData)) {
          return;
        }

        const indexOfSource = blocks.findIndex(
          (block) => block.id === sourceData.blockId,
        );
        const indexOfTarget = blocks.findIndex(
          (block) => block.id === targetData.blockId,
        );

        if (indexOfTarget < 0 || indexOfSource < 0) {
          return;
        }

        const closestEdgeOfTarget = extractClosestEdge(targetData);

        // Using `flushSync` so we can query the DOM straight after this line
        flushSync(() => {
          const reorderedBlocks = reorderWithEdge({
            list: blocks,
            startIndex: indexOfSource,
            indexOfTarget,
            closestEdgeOfTarget,
            axis: "vertical",
          });

          // Update sortOrder for each block based on new position
          const updatedBlocks = reorderedBlocks.map((block, index) => ({
            ...block,
            sortOrder: index,
          }));

          onBlocksChange(updatedBlocks);
        });
      },
    });
  }, [blocks, onBlocksChange]);

  useEffect(() => {
    const scrollableElement = scrollableRef.current;
    if (!scrollableElement) {
      return;
    }
    return autoScrollForElements({
      element: scrollableElement,
      canScroll: ({ source }) => {
        return isBlockData(source.data);
      },
    });
  }, [scrollableRef]);

  if (blocks.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-gray-500">
        <p>No time blocks. Generate or add custom blocks.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0">
      {/* Insert zone before first block */}
      <div
        onMouseEnter={() => setHoveredInsertIndex(0)}
        onMouseLeave={() => setHoveredInsertIndex(null)}
        className="relative flex h-3 items-center"
      >
        <div
          className={`absolute h-px transition-colors ${hoveredInsertIndex === 0 ? "bg-org-primary" : "bg-transparent"}`}
          style={{
            left: '12px',
            right: '12px',
          }}
        ></div>
        {hoveredInsertIndex === 0 && (
          <>
            <button
              onClick={() => onInsertBlock?.(0)}
              className="absolute left-0 flex h-3 w-3 cursor-pointer items-center justify-center text-org-primary transition-colors hover:text-org-primary-light"
              title="Insert block before"
            >
              <Plus size={10} strokeWidth={3} />
            </button>
            <button
              onClick={() => onInsertBlock?.(0)}
              className="absolute right-0 flex h-3 w-3 cursor-pointer items-center justify-center text-org-primary transition-colors hover:text-org-primary-light"
              title="Insert block before"
            >
              <Plus size={10} strokeWidth={3} />
            </button>
          </>
        )}
      </div>

      {blocks.map((block, index) => (
        <div key={block.id} className="flex flex-col gap-0">
          {/* Block */}
          <Block block={block} onDelete={onDeleteBlock} />

          {/* Insert zone after block */}
          <div
            onMouseEnter={() => setHoveredInsertIndex(index + 1)}
            onMouseLeave={() => setHoveredInsertIndex(null)}
            className="relative flex h-3 items-center"
          >
            <div
              className={`absolute h-px transition-colors ${hoveredInsertIndex === index + 1 ? "bg-org-primary" : "bg-transparent"}`}
              style={{
                left: '12px',
                right: '12px',
              }}
            ></div>
            {hoveredInsertIndex === index + 1 && (
              <>
                <button
                  onClick={() => onInsertBlock?.(index + 1)}
                  className="absolute left-0 flex h-3 w-3 cursor-pointer items-center justify-center text-org-primary transition-colors hover:text-org-primary-light"
                  title="Insert block after"
                >
                  <Plus size={10} strokeWidth={3} />
                </button>
                <button
                  onClick={() => onInsertBlock?.(index + 1)}
                  className="absolute right-0 flex h-3 w-3 cursor-pointer items-center justify-center text-org-primary transition-colors hover:text-org-primary-light"
                  title="Insert block after"
                >
                  <Plus size={10} strokeWidth={3} />
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
