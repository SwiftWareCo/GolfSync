"use client";

import Link from "next/link";
import { Timer, Users, Flag, ChevronRight } from "lucide-react";
import { useMemberRounds } from "~/services/member-rounds/hooks";
import { PaceOfPlayStatus } from "~/components/pace-of-play/PaceOfPlayStatus";
import {
  calculateExpectedHole,
  calculateHolePhase,
  calculatePaceStatus,
  getHolePhaseLabel,
  getPaceBadgeClasses,
  getPaceLabel,
} from "~/lib/pace-helpers";
import { formatTime12Hour } from "~/lib/dates";
import { cn } from "~/lib/utils";

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-4 w-24 rounded bg-gray-200" />
      <div className="h-10 w-full rounded bg-gray-200" />
      <div className="flex justify-between">
        <div className="h-3 w-20 rounded bg-gray-200" />
        <div className="h-3 w-16 rounded bg-gray-200" />
      </div>
    </div>
  );
}

function ActiveRoundContent() {
  const { data, isLoading, error } = useMemberRounds();

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="text-sm text-red-600">
        Unable to load round data. Please try again.
      </div>
    );
  }

  const activeRound = data?.activeRound;

  if (!activeRound) {
    return <NoActiveRound historyCount={data?.history?.length ?? 0} />;
  }

  const holeProgress = calculateExpectedHole(activeRound.paceOfPlay);
  const paceStatus = calculatePaceStatus(activeRound.paceOfPlay);
  const holePhase = calculateHolePhase(activeRound.paceOfPlay);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-gray-900">
            Active Round
          </span>
          <PaceOfPlayStatus status={activeRound.paceOfPlay.status ?? "pending"} />
        </div>
        <span className="text-sm text-gray-500">
          {formatTime12Hour(activeRound.scheduledStartTime)} tee time
        </span>
      </div>

      {holeProgress && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flag className="h-4 w-4 text-green-600" />
              <span className="font-medium text-gray-900">
                Expected: Hole {holeProgress.expectedHole}{" "}
                <span className="text-gray-500">
                  ({getHolePhaseLabel(holePhase)})
                </span>
              </span>
            </div>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                getPaceBadgeClasses(paceStatus),
              )}
            >
              {getPaceLabel(paceStatus)}
            </span>
          </div>

          <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-green-500 transition-all"
              style={{ width: `${holeProgress.percentComplete}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>Hole 1</span>
            <span>{holeProgress.percentComplete}% complete</span>
            <span>Hole 18</span>
          </div>
        </div>
      )}

      {activeRound.players.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Users className="h-4 w-4" />
          <span>
            Playing with:{" "}
            {activeRound.players
              .filter((p) => p.name !== activeRound.players[0]?.name)
              .map((p) => p.name.split(" ")[0])
              .join(", ") || "Solo"}
          </span>
        </div>
      )}

      <Link
        href="/members/rounds"
        className="flex items-center justify-center gap-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
      >
        View Full Round
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function NoActiveRound({ historyCount }: { historyCount: number }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Timer className="h-5 w-5 text-gray-400" />
        <span className="font-medium text-gray-600">No active round</span>
      </div>
      <p className="text-sm text-gray-500">
        Your active round will appear here once you check in for your tee time.
      </p>
      {historyCount > 0 && (
        <Link
          href="/members/rounds"
          className="flex items-center gap-1 text-sm text-green-700 hover:underline"
        >
          View round history ({historyCount} rounds)
          <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}

export function ActiveRoundCard() {
  return (
    <div className="rounded-lg bg-white p-6 shadow-md">
      <h3 className="mb-3 text-lg font-medium">My Round</h3>
      <ActiveRoundContent />
    </div>
  );
}
