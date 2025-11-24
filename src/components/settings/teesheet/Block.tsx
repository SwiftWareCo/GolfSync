"use client";

import { GripVertical, X } from "lucide-react";
import {
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview";
import { preserveOffsetOnSource } from "@atlaskit/pragmatic-drag-and-drop/element/preserve-offset-on-source";
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import { type HTMLAttributes, useEffect, useRef, useState } from "react";
import invariant from "tiny-invariant";
import { createPortal } from "react-dom";
import {
  attachClosestEdge,
  type Edge,
  extractClosestEdge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { DropIndicator } from "@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box";
import { Box } from "@atlaskit/primitives";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import type { ConfigBlockInsert } from "~/server/db/schema";
import { formatTimeString } from "~/lib/utils";

type BlockWithId = Omit<ConfigBlockInsert, "id"> & { id: string | number };

type BlockState =
  | {
      type: "idle";
    }
  | {
      type: "preview";
      container: HTMLElement;
      rect: DOMRect;
    }
  | {
      type: "is-dragging";
    }
  | {
      type: "is-dragging-over";
    };

const stateStyles: {
  [Key in BlockState["type"]]?: HTMLAttributes<HTMLDivElement>["className"];
} = {
  "is-dragging": "opacity-40",
};

const idle: BlockState = { type: "idle" };

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

interface BlockProps {
  block: BlockWithId;
  onDelete: (blockId: string | number) => void;
}

function getBlockData(block: BlockWithId): BlockData {
  return {
    type: "block",
    blockId: block.id,
  };
}

export function Block({ block, onDelete }: BlockProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<BlockState>(idle);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

  useEffect(() => {
    const element = ref.current;
    invariant(element);
    return combine(
      draggable({
        element,
        getInitialData: () => ({ type: "block", blockId: block.id }),
        onGenerateDragPreview({ nativeSetDragImage, source, location }) {
          const rect = source.element.getBoundingClientRect();
          setCustomNativeDragPreview({
            nativeSetDragImage,
            getOffset: preserveOffsetOnSource({
              element,
              input: location.current.input,
            }),
            render({ container }) {
              setState({ type: "preview", container, rect });
              return () => setState({ type: "is-dragging" });
            },
          });
        },
        onDragStart() {
          setState({ type: "is-dragging" });
        },
        onDrop() {
          setState(idle);
          setClosestEdge(null);
        },
      }),
      dropTargetForElements({
        element,
        canDrop({ source }) {
          // not allowing dropping on yourself
          if (source.element === element) {
            return false;
          }
          // only allowing blocks to be dropped on me
          return isBlockData(source.data);
        },
        getData({ input }) {
          const data = getBlockData(block);
          return attachClosestEdge(data as any, {
            element,
            input,
            allowedEdges: ["top", "bottom"],
          });
        },
        getIsSticky() {
          return true;
        },
        onDragEnter({ self }) {
          const edge = extractClosestEdge(self.data);
          setState({ type: "is-dragging-over" });
          setClosestEdge(edge);
        },
        onDrag({ self }) {
          const edge = extractClosestEdge(self.data);

          // Only need to update react state if nothing has changed.
          // Prevents re-rendering.
          setClosestEdge((current) => {
            if (current === edge) {
              return current;
            }
            return edge;
          });
        },
        onDragLeave() {
          setState(idle);
          setClosestEdge(null);
        },
        onDrop() {
          setState(idle);
          setClosestEdge(null);
        },
      }),
    );
  }, [block]);

  return (
    <>
      <div className="relative">
        <div
          data-block-id={block.id}
          ref={ref}
          className={`hover:bg-org-primary flex flex-row items-center rounded border border-solid bg-white p-3 pl-0 text-sm hover:cursor-grab hover:text-white ${stateStyles[state.type] ?? ""}`}
        >
          <div className="flex w-6 flex-shrink-0 justify-center">
            <GripVertical size={16} className="text-gray-400" />
          </div>
          <div className="flex min-w-0 flex-grow flex-col">
            <span className="text-sm font-medium">
              {formatTimeString(block.startTime)}
            </span>
            {block.displayName && (
              <span className="text-xs text-gray-600">{block.displayName}</span>
            )}
          </div>
          <div className="ml-2 flex flex-shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onDelete(block.id)}
              className="h-6 p-1 text-red-500 hover:bg-red-50 hover:text-red-600"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {state.type === "is-dragging-over" && closestEdge ? (
          <DropIndicator edge={closestEdge} gap="8px" />
        ) : null}
      </div>
      {state.type === "preview"
        ? createPortal(
            <Box
              style={{
                boxSizing: 'border-box',
                width: state.rect.width,
                height: state.rect.height,
              }}
            >
              <div
                className={`hover:bg-org-primary flex h-full flex-row items-center rounded border border-solid bg-white p-3 pl-0 text-sm hover:cursor-grab hover:text-white`}
              >
                <div className="flex w-6 flex-shrink-0 justify-center">
                  <GripVertical size={16} className="text-gray-400" />
                </div>
                <div className="flex min-w-0 flex-grow flex-col">
                  <span className="text-sm font-medium">
                    {formatTimeString(block.startTime)}
                  </span>
                  {block.displayName && (
                    <span className="text-xs text-gray-600">{block.displayName}</span>
                  )}
                </div>
                <div className="ml-2 flex flex-shrink-0 items-center gap-2">
                  <Badge variant="secondary" className="text-xs whitespace-nowrap">
                    Max {block.maxPlayers}
                  </Badge>
                </div>
              </div>
            </Box>,
            state.container,
          )
        : null}
    </>
  );
}
