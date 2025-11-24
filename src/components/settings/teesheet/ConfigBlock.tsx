"use client";

import type { ConfigBlock as ConfigBlockType } from "~/server/db/schema";
import { Badge } from "~/components/ui/badge";

interface ConfigBlockProps {
  block: ConfigBlockType;
  onDelete?: (blockId: number) => void;
}

export function ConfigBlock({ block, onDelete }: ConfigBlockProps) {
  return (
    <div className="flex items-center justify-between rounded border bg-gray-50 p-3">
      <div className="flex flex-1 items-center gap-3">
        <span className="font-medium text-sm">{block.startTime}</span>
        {block.displayName && (
          <span className="text-xs text-gray-600">{block.displayName}</span>
        )}
        <Badge variant="secondary" className="text-xs">
          Max {block.maxPlayers}
        </Badge>
      </div>
    </div>
  );
}
