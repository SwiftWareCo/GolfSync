"use client";

import type { TimeBlockWithRelations } from "~/server/db/schema";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import { TimeBlockMemberManager } from "./TimeBlockMemberManager";

interface AddPlayerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  timeBlock: TimeBlockWithRelations;
  dateString: string;
}

export function AddPlayerModal({
  open,
  onOpenChange,
  timeBlock,
  dateString,
}: AddPlayerModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-6xl flex-col overflow-hidden">
        <DialogTitle>Add Players to {timeBlock.startTime}</DialogTitle>
        <div className="flex-grow overflow-y-auto pr-1">
          <TimeBlockMemberManager
            timeBlock={timeBlock}
            dateString={dateString}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
