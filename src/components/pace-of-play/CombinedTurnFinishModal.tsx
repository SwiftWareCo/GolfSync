import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { type TimeBlockWithPaceOfPlay } from "~/server/pace-of-play/data";
import { updateTurnAndFinishTime } from "~/server/pace-of-play/actions";
import toast from "react-hot-toast";
import { formatTime12Hour, getBCNow, formatTime } from "~/lib/dates";
import { Input } from "~/components/ui/input";

interface CombinedTurnFinishModalProps {
  timeBlock: TimeBlockWithPaceOfPlay | null;
  isOpen: boolean;
  onClose: () => void;
  userName: string;
}

export function CombinedTurnFinishModal({
  timeBlock,
  isOpen,
  onClose,
  userName,
}: CombinedTurnFinishModalProps) {
  const [notes, setNotes] = useState("");
  const [turnTime, setTurnTime] = useState<string>("");
  const [finishTime, setFinishTime] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // When the modal opens or timeBlock changes, initialize the form
  useEffect(() => {
    if (isOpen && timeBlock) {
      setNotes(timeBlock.paceOfPlay?.notes || "");
      // Set default turn time to halfway between start and now
      const startTime = new Date(timeBlock.paceOfPlay?.startTime || "");
      const now = getBCNow();
      const halfwayTime = new Date((startTime.getTime() + now.getTime()) / 2);
      setTurnTime(formatTimeForInput(halfwayTime));
      setFinishTime(formatTimeForInput(now));
    }
  }, [isOpen, timeBlock]);

  // Helper to format Date object for time input
  const formatTimeForInput = (date: Date) => {
    return formatTime(date);
  };

  // Helper to create a full Date object from time string
  const createDateFromTimeString = (timeString: string): Date => {
    const [hours, minutes] = timeString.split(":");
    const date = getBCNow();
    date.setHours(parseInt(hours || "0", 10));
    date.setMinutes(parseInt(minutes || "0", 10));
    date.setSeconds(0);
    date.setMilliseconds(0);
    return date;
  };

  const handleSubmit = async () => {
    if (!timeBlock) return;

    setIsSubmitting(true);
    try {
      const turnDate = createDateFromTimeString(turnTime);
      const finishDate = createDateFromTimeString(finishTime);

      const result = await updateTurnAndFinishTime(
        timeBlock.id,
        turnDate,
        finishDate,
        userName,
        notes,
      );

      if (result.success) {
        toast.success("Turn and finish times recorded successfully");
        onClose();
      } else {
        toast.error(result.error || "Failed to update times");
      }
    } catch (error) {
      console.error("Error updating turn and finish times:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setNotes("");
    setTurnTime("");
    setFinishTime("");
    onClose();
  };

  // Format tee time properly
  const formattedTeeTime = timeBlock?.startTime
    ? formatTime12Hour(timeBlock.startTime)
    : "";

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Turn & Finish Times</DialogTitle>
          <DialogDescription>
            This group missed recording their turn time. Please enter both the
            turn and finish times.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <p className="mb-1 text-sm font-medium">Tee Time</p>
            <p className="text-sm">{formattedTeeTime}</p>
          </div>

          <div>
            <p className="mb-1 text-sm font-medium">Players</p>
            <p className="text-sm">
              {timeBlock?.players && timeBlock.players.length > 0
                ? timeBlock.players.map((p) => p.name).join(", ")
                : "No players"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="mb-1 text-sm font-medium">Turn Time</p>
              <Input
                type="time"
                value={turnTime}
                onChange={(e) => setTurnTime(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium">Finish Time</p>
              <Input
                type="time"
                value={finishTime}
                onChange={(e) => setFinishTime(e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          <div>
            <p className="mb-1 text-sm font-medium">Notes</p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !turnTime || !finishTime}
          >
            {isSubmitting ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
