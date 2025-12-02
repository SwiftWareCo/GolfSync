"use client";

import { useState, forwardRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import type { PaceOfPlay } from "~/server/db/schema";
import {
  calculateExpectedHole,
  calculatePaceStatus,
  getPaceLabel,
  calculateTurnStatus,
  calculateFinishStatus,
  calculateExpectedHoleTime,
} from "~/lib/pace-helpers";
import { formatTime12Hour, getBCNow } from "~/lib/dates";

interface HoleProgressModalProps {
  paceOfPlay: PaceOfPlay | null;
  startTime: string;
}

interface HoleProgressModalHandle {
  open: () => void;
}

const HoleProgressModal = forwardRef<HoleProgressModalHandle, HoleProgressModalProps>(
  ({ paceOfPlay, startTime }, ref) => {
    const [isOpen, setIsOpen] = useState(false);

    // Expose open method via ref
    if (ref && typeof ref === "object") {
      ref.current = { open: () => setIsOpen(true) };
    }

    const progress = calculateExpectedHole(paceOfPlay);
    const status = calculatePaceStatus(paceOfPlay);
    const statusLabel = getPaceLabel(status);

    if (!paceOfPlay || !progress) {
      return null;
    }

  const frontNine = Array.from({ length: 9 }, (_, i) => i + 1);
  const backNine = Array.from({ length: 9 }, (_, i) => i + 10);

  // Calculate elapsed time using BC timezone
  const now = getBCNow();
  const scheduledStart = new Date(paceOfPlay.expectedStartTime);
  const elapsedMinutes = Math.floor(
    (now.getTime() - scheduledStart.getTime()) / (1000 * 60),
  );

  // Calculate performance status
  const turnStatus = calculateTurnStatus(paceOfPlay);
  const finishStatus = calculateFinishStatus(paceOfPlay);

  // Determine hole status color with performance rings
  const getHoleColor = (hole: number) => {
    const isCompleted = hole < progress.currentHole;
    const isCurrent = hole === progress.currentHole;

    // If finished, all holes are green
    if (paceOfPlay.finishTime) {
      return "bg-green-500 border-green-600";
    }

    // Current hole - pulsing animation
    if (isCurrent) {
      return status === "late"
        ? "bg-red-500 border-red-600 animate-pulse"
        : status === "early"
          ? "bg-green-500 border-green-600 animate-pulse"
          : "bg-blue-500 border-blue-600 animate-pulse";
    }

    // Completed holes - add performance ring
    if (isCompleted) {
      let baseClass = "bg-green-500 border-green-600";

      // Front nine - based on turn status
      if (hole <= 9 && paceOfPlay.turn9Time) {
        if (turnStatus === "early") {
          return `${baseClass} ring-2 ring-blue-400`;
        } else if (turnStatus === "late") {
          return `${baseClass} ring-2 ring-amber-400`;
        }
      }

      // Back nine - based on finish status
      if (hole > 9 && paceOfPlay.finishTime) {
        if (finishStatus === "early") {
          return `${baseClass} ring-2 ring-blue-400`;
        } else if (finishStatus === "late") {
          return `${baseClass} ring-2 ring-red-400`;
        }
      }

      return baseClass;
    }

    // Upcoming holes
    return "bg-gray-200 border-gray-300";
  };

  // Get tooltip text for hole
  const getHoleTooltip = (hole: number) => {
    const expectedTimes = calculateExpectedHoleTime(paceOfPlay, hole);

    if (!expectedTimes) {
      return "No data";
    }

    const timeAt4HrPace = formatTime12Hour(expectedTimes.timeAt4HourPace);
    const timeAtActualPace = expectedTimes.timeAtActualPace
      ? formatTime12Hour(expectedTimes.timeAtActualPace)
      : null;

    // For holes before current hole
    if (hole < progress.currentHole) {
      // Front nine completed - show both times if available
      if (hole <= 9 && paceOfPlay.turn9Time) {
        return timeAtActualPace
          ? `Should be at ${timeAt4HrPace} (4-hr) vs ${timeAtActualPace} (actual)`
          : `Should be at ${timeAt4HrPace}`;
      }
      // Back nine completed - show both times if available
      if (hole > 9 && timeAtActualPace) {
        return `Should be at ${timeAt4HrPace} (4-hr) vs ${timeAtActualPace} (actual)`;
      }
      // Default for completed holes before turn recorded
      return `Should be at ${timeAt4HrPace}`;
    }

    // For current hole
    if (hole === progress.currentHole && !paceOfPlay.finishTime) {
      return timeAtActualPace
        ? `Current - Expected at ${timeAt4HrPace} (4-hr) vs ${timeAtActualPace} (actual)`
        : `Current - Expected at ${timeAt4HrPace}`;
    }

    // For upcoming holes
    return timeAtActualPace
      ? `Should be at ${timeAt4HrPace} (4-hr) vs ${timeAtActualPace} (actual)`
      : `Should be at ${timeAt4HrPace}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Hole Progress - {formatTime12Hour(startTime)} Group
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Front Nine */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-gray-700">
              Holes 1-9 (Front Nine)
            </h3>
            <TooltipProvider>
              <div className="flex gap-2">
                {frontNine.map((hole) => (
                  <Tooltip key={hole}>
                    <TooltipTrigger asChild>
                      <div className="relative flex flex-col items-center">
                        <div
                          className={`h-8 w-8 rounded-full border-2 transition-all ${getHoleColor(hole)}`}
                        >
                          <span className="flex h-full items-center justify-center text-xs font-bold text-white">
                            {hole}
                          </span>
                        </div>
                        {hole === progress.currentHole &&
                          !paceOfPlay.finishTime && (
                            <div className="mt-1 text-xs font-medium text-blue-600">
                              ↑ Here
                            </div>
                          )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{getHoleTooltip(hole)}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </TooltipProvider>
          </div>

          {/* Back Nine */}
          <div>
            <h3 className="mb-3 text-sm font-semibold text-gray-700">
              Holes 10-18 (Back Nine)
            </h3>
            <TooltipProvider>
              <div className="flex gap-2">
                {backNine.map((hole) => (
                  <Tooltip key={hole}>
                    <TooltipTrigger asChild>
                      <div className="relative flex flex-col items-center">
                        <div
                          className={`h-8 w-8 rounded-full border-2 transition-all ${getHoleColor(hole)}`}
                        >
                          <span className="flex h-full items-center justify-center text-xs font-bold text-white">
                            {hole}
                          </span>
                        </div>
                        {hole === progress.currentHole &&
                          !paceOfPlay.finishTime && (
                            <div className="mt-1 text-xs font-medium text-blue-600">
                              ↑ Here
                            </div>
                          )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{getHoleTooltip(hole)}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </TooltipProvider>
          </div>

          {/* Stats */}
          <div className="space-y-2 rounded-lg bg-gray-50 p-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Current Hole:</span>
              <span className="font-semibold">Hole {progress.currentHole}</span>
            </div>
            {progress.expectedHole !== progress.currentHole && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Expected Hole:</span>
                <span className="font-semibold text-blue-600">
                  Hole {progress.expectedHole}
                </span>
              </div>
            )}
            {paceOfPlay.turn9Time && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Turn Time (9th):</span>
                <span className="font-semibold">
                  {formatTime12Hour(paceOfPlay.turn9Time)}
                </span>
              </div>
            )}
            {paceOfPlay.finishTime && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Finish Time:</span>
                <span className="font-semibold text-green-600">
                  {formatTime12Hour(paceOfPlay.finishTime)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Progress:</span>
              <span className="font-semibold">{progress.percentComplete}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Status:</span>
              <span
                className={`font-semibold ${
                  progress.status === "behind"
                    ? "text-red-600"
                    : progress.status === "ahead"
                      ? "text-green-600"
                      : status === "late"
                        ? "text-red-600"
                        : status === "early"
                          ? "text-green-600"
                          : "text-blue-600"
                }`}
              >
                {progress.status === "behind"
                  ? `${progress.expectedHole - progress.currentHole} ${
                      progress.expectedHole - progress.currentHole === 1
                        ? "hole"
                        : "holes"
                    } behind`
                  : progress.status === "ahead"
                    ? `${progress.currentHole - progress.expectedHole} ${
                        progress.currentHole - progress.expectedHole === 1
                          ? "hole"
                          : "holes"
                      } ahead`
                    : statusLabel}
              </span>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full bg-green-500"></div>
              <span>Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-pulse rounded-full bg-blue-500"></div>
              <span>Current</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full bg-gray-200"></div>
              <span>Upcoming</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
  }
);

HoleProgressModal.displayName = "HoleProgressModal";

export { HoleProgressModal };
