"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Badge } from "~/components/ui/badge";
import {
  ArrowRight,
  Trash2,
  Plus,
  Snowflake,
  ArrowLeftRight,
} from "lucide-react";

// Define types locally to avoid circular imports
export type ChangeType = "move" | "swap" | "delete" | "insert" | "frost_delay";

export interface ChangeLogEntry {
  id: string;
  type: ChangeType;
  description: string;
  timestamp: Date;
  details?: {
    playerName?: string;
    fromTime?: string;
    toTime?: string;
    swappedWith?: string;
    delayMinutes?: number;
  };
}

interface ChangeLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  changes: ChangeLogEntry[];
}

function getChangeIcon(type: ChangeType) {
  switch (type) {
    case "move":
      return <ArrowRight className="h-4 w-4 text-blue-500" />;
    case "swap":
      return <ArrowLeftRight className="h-4 w-4 text-purple-500" />;
    case "delete":
      return <Trash2 className="h-4 w-4 text-red-500" />;
    case "insert":
      return <Plus className="h-4 w-4 text-green-500" />;
    case "frost_delay":
      return <Snowflake className="h-4 w-4 text-cyan-500" />;
    default:
      return null;
  }
}

function getChangeBadgeVariant(type: ChangeType) {
  switch (type) {
    case "move":
      return "default";
    case "swap":
      return "secondary";
    case "delete":
      return "destructive";
    case "insert":
      return "outline";
    case "frost_delay":
      return "secondary";
    default:
      return "default";
  }
}

export function ChangeLogModal({
  isOpen,
  onClose,
  changes,
}: ChangeLogModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Change Log</DialogTitle>
          <DialogDescription>
            {changes.length === 0
              ? "No changes have been made yet."
              : `${changes.length} pending change${changes.length === 1 ? "" : "s"}`}
          </DialogDescription>
        </DialogHeader>

        {changes.length > 0 && (
          <ScrollArea className="max-h-[400px] pr-4">
            <div className="space-y-3">
              {changes.map((change, index) => (
                <div
                  key={change.id}
                  className="bg-muted/30 flex items-start gap-3 rounded-lg border p-3"
                >
                  <div className="flex-shrink-0 pt-0.5">
                    {getChangeIcon(change.type)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          getChangeBadgeVariant(change.type) as
                            | "default"
                            | "secondary"
                            | "destructive"
                            | "outline"
                        }
                      >
                        {change.type.replace("_", " ")}
                      </Badge>
                      <span className="text-muted-foreground text-xs">
                        #{changes.length - index}
                      </span>
                    </div>
                    <p className="text-sm">{change.description}</p>
                    {change.details && (
                      <div className="text-muted-foreground text-xs">
                        {change.details.fromTime && change.details.toTime && (
                          <span>
                            {change.details.fromTime} → {change.details.toTime}
                          </span>
                        )}
                        {change.details.delayMinutes && (
                          <span>{change.details.delayMinutes} minutes</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {changes.length === 0 && (
          <div className="text-muted-foreground py-8 text-center">
            <p>Make changes to the teesheet to see them here.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
