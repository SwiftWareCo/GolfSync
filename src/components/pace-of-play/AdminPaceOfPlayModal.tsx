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
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { type TimeBlockWithPaceOfPlay } from "~/server/pace-of-play/data";
import {
  updateTurnTime,
  updateFinishTime,
} from "~/server/pace-of-play/actions";
import toast from "react-hot-toast";
import {
  formatTime12Hour,
  getBCNow,
  getBCToday,
  parseDateTime,
} from "~/lib/dates";
import { Clock, Save, RotateCcw } from "lucide-react";

interface AdminPaceOfPlayModalProps {
  timeBlock: TimeBlockWithPaceOfPlay | null;
  isOpen: boolean;
  onClose: () => void;
  mode: "turn" | "finish" | "both";
  userName: string;
}

export function AdminPaceOfPlayModal({
  timeBlock,
  isOpen,
  onClose,
  mode,
  userName,
}: AdminPaceOfPlayModalProps) {
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("quick");

  // Manual time state
  const [customTurnTime, setCustomTurnTime] = useState("");
  const [customFinishTime, setCustomFinishTime] = useState("");
  const [customDate, setCustomDate] = useState("");

  // When the modal opens or timeBlock/mode changes
  useEffect(() => {
    if (isOpen && timeBlock) {
      // Auto-populate with existing notes if available
      if (mode === "finish" && timeBlock.paceOfPlay?.notes) {
        setNotes(timeBlock.paceOfPlay.notes);
      } else {
        setNotes("");
      }

      // Set current date
      setCustomDate(getBCToday());

      // Reset custom times
      setCustomTurnTime("");
      setCustomFinishTime("");

      // Set default tab based on mode
      setActiveTab("quick");
    }
  }, [isOpen, timeBlock, mode]);

  const handleQuickRecord = async () => {
    if (!timeBlock) return;

    setIsSubmitting(true);
    try {
      const now = getBCNow();

      if (mode === "turn" || mode === "both") {
        const result = await updateTurnTime(timeBlock.id, now, userName, notes);
        if (!result.success) {
          toast.error(result.error || "Failed to record turn time");
          setIsSubmitting(false);
          return;
        }
      }

      if (mode === "finish" || mode === "both") {
        const result = await updateFinishTime(
          timeBlock.id,
          now,
          userName,
          notes,
        );
        if (!result.success) {
          toast.error(result.error || "Failed to record finish time");
          setIsSubmitting(false);
          return;
        }
      }

      const actionText =
        mode === "both"
          ? "Turn and finish times"
          : mode === "turn"
            ? "Turn time"
            : "Finish time";

      toast.success(
        `${actionText} for ${formatTime12Hour(timeBlock.startTime)} group has been updated.`,
      );

      handleClose();
    } catch (error) {
      console.error("Error updating pace of play:", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualRecord = async () => {
    if (!timeBlock) return;

    setIsSubmitting(true);
    try {
      let turnDateTime: Date | undefined;
      let finishDateTime: Date | undefined;

      // Parse custom times if provided - use BC timezone
      if ((mode === "turn" || mode === "both") && customTurnTime) {
        turnDateTime = parseDateTime(customDate, customTurnTime);
      }

      if ((mode === "finish" || mode === "both") && customFinishTime) {
        finishDateTime = parseDateTime(customDate, customFinishTime);
      }

      // Validate that we have the required times
      if (mode === "turn" && !turnDateTime) {
        toast.error("Please provide a turn time");
        return;
      }

      if (mode === "finish" && !finishDateTime) {
        toast.error("Please provide a finish time");
        return;
      }

      if (mode === "both" && (!turnDateTime || !finishDateTime)) {
        toast.error("Please provide both turn and finish times");
        return;
      }

      // Update the times
      if (turnDateTime) {
        const result = await updateTurnTime(
          timeBlock.id,
          turnDateTime,
          userName,
          notes,
        );
        if (!result.success) {
          toast.error(result.error || "Failed to record turn time");
          setIsSubmitting(false);
          return;
        }
      }

      if (finishDateTime) {
        const result = await updateFinishTime(
          timeBlock.id,
          finishDateTime,
          userName,
          notes,
        );
        if (!result.success) {
          toast.error(result.error || "Failed to record finish time");
          setIsSubmitting(false);
          return;
        }
      }

      const actionText =
        mode === "both"
          ? "Turn and finish times"
          : mode === "turn"
            ? "Turn time"
            : "Finish time";

      toast.success(
        `${actionText} for ${formatTime12Hour(timeBlock.startTime)} group has been manually set.`,
      );

      handleClose();
    } catch (error) {
      console.error("Error updating pace of play:", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setNotes("");
    setCustomTurnTime("");
    setCustomFinishTime("");
    setActiveTab("quick");
    onClose();
  };

  const getCurrentTime = () => {
    const now = getBCNow();
    return formatTime12Hour(now);
  };

  const title =
    mode === "turn"
      ? "Record Turn Time"
      : mode === "finish"
        ? "Record Finish Time"
        : "Record Turn & Finish Times";

  const description =
    mode === "turn"
      ? "Record that this group has reached the 9th hole turn."
      : mode === "finish"
        ? "Record that this group has completed their round."
        : "Record both turn and finish times for this group.";

  // Format tee time properly
  const formattedTeeTime = timeBlock?.startTime
    ? formatTime12Hour(timeBlock.startTime)
    : "";

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {title} (Admin)
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
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
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="quick" className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4" />
                Quick Record (Now)
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Manual Time Set
              </TabsTrigger>
            </TabsList>

            <TabsContent value="quick" className="space-y-4">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm text-blue-800">
                  This will record the current time ({getCurrentTime()}) for the
                  selected action.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="manual" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                  />
                </div>

                {(mode === "turn" || mode === "both") && (
                  <div>
                    <Label htmlFor="turnTime">Turn Time (9th Hole)</Label>
                    <Input
                      id="turnTime"
                      type="time"
                      value={customTurnTime}
                      onChange={(e) => setCustomTurnTime(e.target.value)}
                      placeholder="HH:MM"
                    />
                  </div>
                )}

                {(mode === "finish" || mode === "both") && (
                  <div>
                    <Label htmlFor="finishTime">Finish Time (18th Hole)</Label>
                    <Input
                      id="finishTime"
                      type="time"
                      value={customFinishTime}
                      onChange={(e) => setCustomFinishTime(e.target.value)}
                      placeholder="HH:MM"
                    />
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div>
            <Label htmlFor="notes">
              Notes{" "}
              {mode === "finish" && timeBlock?.paceOfPlay?.notes
                ? "(auto-populated from turn)"
                : "(optional)"}
            </Label>
            <Textarea
              id="notes"
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
            onClick={
              activeTab === "quick" ? handleQuickRecord : handleManualRecord
            }
            disabled={isSubmitting}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {isSubmitting ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
