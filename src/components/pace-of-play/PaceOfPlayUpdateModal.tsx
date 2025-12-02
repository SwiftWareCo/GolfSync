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
import {
  updateTurnTime,
  updateFinishTime,
} from "~/server/pace-of-play/actions";
import toast from "react-hot-toast";
import { formatTime12Hour, getBCNow } from "~/lib/dates";

interface PaceOfPlayUpdateModalProps {
  timeBlock: TimeBlockWithPaceOfPlay | null;
  isOpen: boolean;
  onClose: () => void;
  mode: "turn" | "finish";
  userName: string;
}

export function PaceOfPlayUpdateModal({
  timeBlock,
  isOpen,
  onClose,
  mode,
  userName,
}: PaceOfPlayUpdateModalProps) {
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // When the modal opens or timeBlock/mode changes, check if we should auto-populate notes
  useEffect(() => {
    if (
      isOpen &&
      timeBlock &&
      mode === "finish" &&
      timeBlock.paceOfPlay?.notes
    ) {
      // Auto-populate with turn notes if we're in finish mode
      setNotes(timeBlock.paceOfPlay.notes);
    } else if (isOpen) {
      // Clear notes when opening in turn mode
      setNotes("");
    }
  }, [isOpen, timeBlock, mode]);

  const handleSubmit = async () => {
    if (!timeBlock) return;

    setIsSubmitting(true);
    try {
      const now = getBCNow();

      if (mode === "turn") {
        await updateTurnTime(timeBlock.id, now, userName, notes);
        toast.success(
          `Turn time for ${formatTime12Hour(timeBlock.startTime)} group has been updated.`,
        );
      } else {
        await updateFinishTime(timeBlock.id, now, userName, notes);
        toast.success(
          `Finish time for ${formatTime12Hour(timeBlock.startTime)} group has been updated.`,
        );
      }

      setNotes("");
      onClose();
    } catch (error) {
      console.error("Error updating pace of play:", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setNotes("");
    onClose();
  };

  const title = mode === "turn" ? "Record Turn Time" : "Record Finish Time";
  const description =
    mode === "turn"
      ? "Record that this group has reached the 9th hole turn."
      : "Record that this group has completed their round.";

  // Format tee time properly
  const formattedTeeTime = timeBlock?.startTime
    ? formatTime12Hour(timeBlock.startTime)
    : "";

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <p className="mb-1 text-sm font-medium">Tee Time</p>
            <p className="text-sm">{formattedTeeTime}</p>
          </div>

          <div>
            <p className="mb-1 text-sm font-medium">Players</p>
            <p className="text-sm">{timeBlock?.playerNames || "No players"}</p>
          </div>

          <div>
            <p className="mb-1 text-sm font-medium">
              {mode === "finish" && timeBlock?.paceOfPlay?.notes
                ? "Notes (auto-populated from turn)"
                : "Notes (optional)"}
            </p>
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
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
