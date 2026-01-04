"use client";

import { useMemo } from "react";
import { Flag, Check } from "lucide-react";
import {
  calculateExpectedHole,
  calculateExpectedHoleTime,
} from "~/lib/pace-helpers";
import { formatTime12Hour } from "~/lib/dates";
import { cn } from "~/lib/utils";
import type { PaceOfPlay } from "~/server/db/schema";

interface PaceTimelineProps {
  paceOfPlay: PaceOfPlay;
}

export function PaceTimeline({ paceOfPlay }: PaceTimelineProps) {
  const holeProgress = calculateExpectedHole(paceOfPlay);
  const currentHole = holeProgress?.expectedHole ?? 1;

  const holes = useMemo(() => {
    return Array.from({ length: 18 }, (_, i) => {
      const holeNumber = i + 1;
      const times = calculateExpectedHoleTime(paceOfPlay, holeNumber);

      return {
        number: holeNumber,
        expectedTime: times?.timeAt4HourPace
          ? formatTime12Hour(times.timeAt4HourPace)
          : "--",
        isPast: holeNumber < currentHole,
        isCurrent: holeNumber === currentHole,
        isFuture: holeNumber > currentHole,
      };
    });
  }, [paceOfPlay, currentHole]);

  const frontNine = holes.slice(0, 9);
  const backNine = holes.slice(9, 18);

  return (
    <div className="pt-4">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <HoleGroup title="Front 9" holes={frontNine} />
        <HoleGroup title="Back 9" holes={backNine} />
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded-full bg-green-500" />
          <span>Completed</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 animate-pulse rounded-full bg-blue-500" />
          <span>Current</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded-full bg-gray-200" />
          <span>Upcoming</span>
        </div>
      </div>
    </div>
  );
}

interface HoleData {
  number: number;
  expectedTime: string;
  isPast: boolean;
  isCurrent: boolean;
  isFuture: boolean;
}

function HoleGroup({ title, holes }: { title: string; holes: HoleData[] }) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-medium text-gray-600">{title}</h4>
      <div className="space-y-1">
        {holes.map((hole) => (
          <HoleRow key={hole.number} hole={hole} />
        ))}
      </div>
    </div>
  );
}

function HoleRow({ hole }: { hole: HoleData }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg px-3 py-2 transition-colors",
        hole.isPast && "bg-green-50",
        hole.isCurrent && "bg-blue-50 ring-2 ring-blue-300",
        hole.isFuture && "bg-gray-50",
      )}
    >
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
            hole.isPast && "bg-green-500 text-white",
            hole.isCurrent && "animate-pulse bg-blue-500 text-white",
            hole.isFuture && "bg-gray-200 text-gray-600",
          )}
        >
          {hole.isPast ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <span>{hole.number}</span>
          )}
        </div>
        <span
          className={cn(
            "text-sm",
            hole.isPast && "text-green-700",
            hole.isCurrent && "font-medium text-blue-700",
            hole.isFuture && "text-gray-500",
          )}
        >
          Hole {hole.number}
        </span>
      </div>
      <span
        className={cn(
          "text-sm",
          hole.isPast && "text-green-600",
          hole.isCurrent && "font-medium text-blue-600",
          hole.isFuture && "text-gray-400",
        )}
      >
        {hole.expectedTime}
      </span>
    </div>
  );
}
