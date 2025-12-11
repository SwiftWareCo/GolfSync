"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Snowflake, AlertTriangle } from "lucide-react";
import { cn } from "~/lib/utils";

interface FrostDelayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (delayMinutes: number) => void | Promise<void>;
  lastTeeTime?: string; // For showing warning about exceeding 8 PM
}

const PRESET_DELAYS = [15, 30, 45, 60, 90, 120];

export function FrostDelayModal({
  isOpen,
  onClose,
  onApply,
  lastTeeTime,
}: FrostDelayModalProps) {
  const [delayMinutes, setDelayMinutes] = useState<number>(30);
  const [customDelay, setCustomDelay] = useState<string>("");
  const [isApplying, setIsApplying] = useState(false);
  const [useCustom, setUseCustom] = useState(false);

  const effectiveDelay = useCustom ? parseInt(customDelay) || 0 : delayMinutes;

  // Calculate if the delay would exceed 8 PM
  const wouldExceedLimit = () => {
    if (!lastTeeTime) return false;
    const [hours, mins] = lastTeeTime.split(":").map(Number);
    const lastTimeMinutes = (hours || 0) * 60 + (mins || 0);
    const newLastTimeMinutes = lastTimeMinutes + effectiveDelay;
    return newLastTimeMinutes > 20 * 60; // 8 PM
  };

  const handleApply = async () => {
    if (effectiveDelay <= 0 || effectiveDelay > 180) return;
    if (wouldExceedLimit()) return;

    setIsApplying(true);
    try {
      await onApply(effectiveDelay);
      handleClose();
    } catch (error) {
      console.error("Error applying frost delay:", error);
    } finally {
      setIsApplying(false);
    }
  };

  const handleClose = () => {
    setDelayMinutes(30);
    setCustomDelay("");
    setUseCustom(false);
    onClose();
  };

  const handlePresetClick = (minutes: number) => {
    setDelayMinutes(minutes);
    setUseCustom(false);
    setCustomDelay("");
  };

  const handleCustomChange = (value: string) => {
    setCustomDelay(value);
    setUseCustom(true);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Snowflake className="h-5 w-5 text-blue-500" />
            Apply Frost Delay
          </DialogTitle>
          <DialogDescription>
            Shift all tee times forward by the specified minutes. This will
            permanently update all timeblock start times.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Preset buttons */}
          <div className="space-y-2">
            <Label>Quick Select (minutes)</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_DELAYS.map((minutes) => (
                <Button
                  key={minutes}
                  type="button"
                  variant={
                    !useCustom && delayMinutes === minutes
                      ? "default"
                      : "outline"
                  }
                  size="sm"
                  onClick={() => handlePresetClick(minutes)}
                  className="min-w-[60px]"
                >
                  {minutes}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom input */}
          <div className="space-y-2">
            <Label htmlFor="customDelay">Custom Delay (minutes)</Label>
            <Input
              id="customDelay"
              type="number"
              min="1"
              max="180"
              placeholder="Enter minutes..."
              value={customDelay}
              onChange={(e) => handleCustomChange(e.target.value)}
              className={cn(useCustom && "ring-2 ring-blue-500")}
            />
            <p className="text-muted-foreground text-xs">
              Maximum delay: 180 minutes (3 hours)
            </p>
          </div>

          {/* Selected delay display */}
          <div className="rounded-lg bg-blue-50 p-3">
            <p className="text-sm text-blue-800">
              Selected delay:{" "}
              <span className="font-semibold">{effectiveDelay} minutes</span>
              {effectiveDelay >= 60 && (
                <span className="ml-1 text-xs">
                  ({Math.floor(effectiveDelay / 60)}h {effectiveDelay % 60}m)
                </span>
              )}
            </p>
          </div>

          {/* Warning if exceeds limit */}
          {wouldExceedLimit() && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
              <p className="text-sm text-red-700">
                This delay would push the last tee time past 8:00 PM. Please
                choose a smaller delay or manually adjust the teesheet.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isApplying}
          >
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={
              isApplying ||
              effectiveDelay <= 0 ||
              effectiveDelay > 180 ||
              wouldExceedLimit()
            }
          >
            {isApplying ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Applying...
              </>
            ) : (
              <>
                <Snowflake className="mr-2 h-4 w-4" />
                Apply Delay
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
