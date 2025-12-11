"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";
import { Plus } from "lucide-react";

interface InsertTimeBlockDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (data: {
    startTime: string;
    endTime: string;
    displayName?: string;
    maxMembers?: number;
  }) => void;
  afterTimeBlock?: { startTime: string } | null;
}

export function InsertTimeBlockDialog({
  isOpen,
  onClose,
  onInsert,
}: InsertTimeBlockDialogProps) {
  const [startTime, setStartTime] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!startTime) return;

    setIsSubmitting(true);
    try {
      await onInsert({
        startTime,
        endTime: startTime,
        displayName: displayName || undefined,
        maxMembers: 4,
      });
      setStartTime("");
      setDisplayName("");
      onClose();
    } catch (error) {
      console.error("Error inserting timeblock:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setStartTime("");
    setDisplayName("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Insert Time Block
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="startTime">Time</Label>
            <Input
              id="startTime"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name (Optional)</Label>
            <Input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g., Shotgun Start"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !startTime}>
            {isSubmitting ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Inserting...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Insert
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
