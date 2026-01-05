"use client";

import { useState, useMemo } from "react";
import { Timer, Users, Flag, Clock, ChevronDown, ChevronUp, TrendingUp } from "lucide-react";
import { useMemberRounds } from "~/services/member-rounds/hooks";
import { PaceOfPlayStatus } from "~/components/pace-of-play/PaceOfPlayStatus";
import { PaceTimeline } from "./PaceTimeline";
import {
  calculateExpectedHole,
  calculateHolePhase,
  calculatePaceStatus,
  getHolePhaseLabel,
  getPaceBadgeClasses,
  getPaceLabel,
} from "~/lib/pace-helpers";
import { formatTime12Hour, formatDate } from "~/lib/dates";
import { cn } from "~/lib/utils";
import type {
  MemberActiveRound,
  MemberPaceOfPlayHistoryItem,
} from "~/server/pace-of-play/data";

interface RoundsPageClientProps {
  initialData: {
    activeRound: MemberActiveRound | null;
    history: MemberPaceOfPlayHistoryItem[];
  };
}

export function RoundsPageClient({ initialData }: RoundsPageClientProps) {
  const { data, isLoading } = useMemberRounds();

  const activeRound = data?.activeRound ?? initialData.activeRound;
  const history = data?.history ?? initialData.history;

  return (
    <div className="space-y-6">
      {activeRound ? (
        <ActiveRoundSection round={activeRound} />
      ) : (
        <NoActiveRoundBanner />
      )}

      <AveragePaceStats history={history} />

      <HistorySection history={history} />
    </div>
  );
}

function ActiveRoundSection({ round }: { round: MemberActiveRound }) {
  const [isTimelineExpanded, setIsTimelineExpanded] = useState(true);
  const holeProgress = calculateExpectedHole(round.paceOfPlay);
  const paceStatus = calculatePaceStatus(round.paceOfPlay);
  const holePhase = calculateHolePhase(round.paceOfPlay);

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-white p-6 shadow-md">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <Timer className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Active Round
              </h2>
              <p className="text-sm text-gray-500">
                {formatTime12Hour(round.scheduledStartTime)} tee time
              </p>
            </div>
          </div>
          <PaceOfPlayStatus
            status={round.paceOfPlay.status ?? "pending"}
            className="text-sm"
          />
        </div>

        {holeProgress && (
          <div className="space-y-3">
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
                  "rounded-full px-3 py-1 text-sm font-medium",
                  getPaceBadgeClasses(paceStatus),
                )}
              >
                {getPaceLabel(paceStatus)}
              </span>
            </div>

            <div className="relative h-3 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-green-500 transition-all"
                style={{ width: `${holeProgress.percentComplete}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Hole 1</span>
              <span className="font-medium">
                {holeProgress.percentComplete}% complete
              </span>
              <span>Hole 18</span>
            </div>
          </div>
        )}

        {round.players.length > 0 && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
            <Users className="h-4 w-4" />
            <span>
              <strong>Group:</strong>{" "}
              {round.players.map((p) => p.name).join(", ")}
            </span>
          </div>
        )}
      </div>

      <div className="rounded-lg bg-white shadow-md">
        <button
          onClick={() => setIsTimelineExpanded(!isTimelineExpanded)}
          className="flex w-full items-center justify-between p-4 text-left"
        >
          <h3 className="text-lg font-medium text-gray-900">Pace Timeline</h3>
          {isTimelineExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-500" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-500" />
          )}
        </button>
        {isTimelineExpanded && (
          <div className="border-t px-4 pb-4">
            <PaceTimeline paceOfPlay={round.paceOfPlay} />
          </div>
        )}
      </div>
    </div>
  );
}

function NoActiveRoundBanner() {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200">
          <Timer className="h-5 w-5 text-gray-500" />
        </div>
        <div>
          <h2 className="font-medium text-gray-700">No Active Round</h2>
          <p className="text-sm text-gray-500">
            Your active round will appear here once you check in for your tee
            time.
          </p>
        </div>
      </div>
    </div>
  );
}

function AveragePaceStats({
  history,
}: {
  history: MemberPaceOfPlayHistoryItem[];
}) {
  const stats = useMemo(() => {
    // Filter to completed rounds (have both start and finish times)
    const completedRounds = history.filter(
      (round) => round.actualStartTime && round.finishTime,
    );

    if (completedRounds.length === 0) {
      return null;
    }

    // Calculate average duration
    let totalDurationMs = 0;
    const durations: number[] = [];

    for (const round of completedRounds) {
      const start = new Date(round.actualStartTime!).getTime();
      const finish = new Date(round.finishTime!).getTime();
      const durationMs = finish - start;
      totalDurationMs += durationMs;
      durations.push(durationMs);
    }

    const avgDurationMs = totalDurationMs / completedRounds.length;
    const avgHours = Math.floor(avgDurationMs / (1000 * 60 * 60));
    const avgMinutes = Math.floor(
      (avgDurationMs % (1000 * 60 * 60)) / (1000 * 60),
    );

    // Calculate pace distribution by status
    const statusCounts = {
      early: 0,
      onTime: 0,
      late: 0,
    };

    for (const round of completedRounds) {
      const status = round.status;
      if (status === "completed_early") {
        statusCounts.early++;
      } else if (status === "completed_on_time") {
        statusCounts.onTime++;
      } else if (status === "completed_late") {
        statusCounts.late++;
      }
    }

    const totalWithStatus =
      statusCounts.early + statusCounts.onTime + statusCounts.late;

    return {
      completedCount: completedRounds.length,
      avgDuration: `${avgHours}h ${avgMinutes}m`,
      avgDurationMs,
      paceDistribution:
        totalWithStatus > 0
          ? {
              early: Math.round((statusCounts.early / totalWithStatus) * 100),
              onTime: Math.round(
                (statusCounts.onTime / totalWithStatus) * 100,
              ),
              late: Math.round((statusCounts.late / totalWithStatus) * 100),
            }
          : null,
      rawCounts: statusCounts,
    };
  }, [history]);

  if (!stats) {
    return null;
  }

  // Determine overall pace status based on average duration
  // 4 hours = 240 minutes = 14,400,000 ms
  const fourHoursMs = 4 * 60 * 60 * 1000;
  const toleranceMs = 10 * 60 * 1000; // 10 minute tolerance
  let overallStatus: "early" | "on-time" | "late" = "on-time";
  if (stats.avgDurationMs < fourHoursMs - toleranceMs) {
    overallStatus = "early";
  } else if (stats.avgDurationMs > fourHoursMs + toleranceMs) {
    overallStatus = "late";
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow-md">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
          <TrendingUp className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Your Pace Stats</h2>
          <p className="text-sm text-gray-500">
            Based on {stats.completedCount} completed round
            {stats.completedCount !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {/* Average Duration */}
        <div className="rounded-lg bg-gray-50 p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-500" />
            <p className="text-sm text-gray-500">Avg. Duration</p>
          </div>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {stats.avgDuration}
          </p>
          <span
            className={cn(
              "mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium",
              overallStatus === "early" &&
                "bg-green-100 text-green-700",
              overallStatus === "on-time" &&
                "bg-blue-100 text-blue-700",
              overallStatus === "late" &&
                "bg-red-100 text-red-700",
            )}
          >
            {overallStatus === "early"
              ? "Under 4 hrs"
              : overallStatus === "late"
                ? "Over 4 hrs"
                : "~4 hrs"}
          </span>
        </div>

        {/* Pace Distribution */}
        {stats.paceDistribution && (
          <div className="col-span-2 rounded-lg bg-gray-50 p-4">
            <p className="mb-2 text-sm text-gray-500">Pace Distribution</p>
            <div className="flex h-3 w-full overflow-hidden rounded-full">
              {stats.paceDistribution.early > 0 && (
                <div
                  className="bg-green-500"
                  style={{ width: `${stats.paceDistribution.early}%` }}
                />
              )}
              {stats.paceDistribution.onTime > 0 && (
                <div
                  className="bg-blue-500"
                  style={{ width: `${stats.paceDistribution.onTime}%` }}
                />
              )}
              {stats.paceDistribution.late > 0 && (
                <div
                  className="bg-red-500"
                  style={{ width: `${stats.paceDistribution.late}%` }}
                />
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-gray-600">
                  Early ({stats.rawCounts.early})
                </span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                <span className="text-gray-600">
                  On Time ({stats.rawCounts.onTime})
                </span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-red-500" />
                <span className="text-gray-600">
                  Late ({stats.rawCounts.late})
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function HistorySection({
  history,
}: {
  history: MemberPaceOfPlayHistoryItem[];
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (history.length === 0) {
    return (
      <div className="rounded-lg bg-white p-6 shadow-md">
        <h3 className="mb-2 text-lg font-medium text-gray-900">Round History</h3>
        <p className="text-gray-500">No rounds recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow-md">
      <h3 className="mb-4 text-lg font-medium text-gray-900">
        Round History ({history.length} rounds)
      </h3>
      <div className="space-y-2">
        {history.map((round) => (
          <HistoryItem
            key={round.id}
            round={round}
            isExpanded={expandedId === round.id}
            onToggle={() =>
              setExpandedId(expandedId === round.id ? null : round.id)
            }
          />
        ))}
      </div>
    </div>
  );
}

function HistoryItem({
  round,
  isExpanded,
  onToggle,
}: {
  round: MemberPaceOfPlayHistoryItem;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const duration =
    round.finishTime && round.actualStartTime
      ? calculateDuration(
          new Date(round.actualStartTime),
          new Date(round.finishTime),
        )
      : null;

  return (
    <div className="rounded-lg border border-gray-200">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="text-sm">
            <p className="font-medium text-gray-900">
              {formatDate(round.date, "EEEE, MMM d, yyyy")}
            </p>
            <p className="text-gray-500">
              {formatTime12Hour(round.startTime)} tee time
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {round.status && <PaceOfPlayStatus status={round.status} />}
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t bg-gray-50 p-4">
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            {round.actualStartTime && (
              <div>
                <p className="text-gray-500">Started</p>
                <p className="font-medium">
                  {formatTime12Hour(new Date(round.actualStartTime))}
                </p>
              </div>
            )}
            {round.turn9Time && (
              <div>
                <p className="text-gray-500">Turn (9)</p>
                <p className="font-medium">
                  {formatTime12Hour(new Date(round.turn9Time))}
                </p>
              </div>
            )}
            {round.finishTime && (
              <div>
                <p className="text-gray-500">Finished</p>
                <p className="font-medium">
                  {formatTime12Hour(new Date(round.finishTime))}
                </p>
              </div>
            )}
            {duration && (
              <div>
                <p className="text-gray-500">Duration</p>
                <p className="font-medium">{duration}</p>
              </div>
            )}
          </div>
          {round.notes && (
            <div className="mt-3 text-sm">
              <p className="text-gray-500">Notes</p>
              <p className="text-gray-700">{round.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function calculateDuration(start: Date, end: Date): string {
  const diffMs = end.getTime() - start.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}
