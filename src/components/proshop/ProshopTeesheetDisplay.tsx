"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format, addDays, subDays } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Users,
  RefreshCw,
} from "lucide-react";
import { useTeesheet } from "~/services/teesheet/hooks";
import { parseDate, formatDateToYYYYMMDD, getBCToday } from "~/lib/dates";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface ProshopTeesheetDisplayProps {
  dateString: string;
}

export function ProshopTeesheetDisplay({
  dateString,
}: ProshopTeesheetDisplayProps) {
  const router = useRouter();

  // TanStack Query with 15-second auto-refresh
  const { data, isLoading, isFetching, dataUpdatedAt } =
    useTeesheet(dateString);

  const timeBlocks = useMemo(() => {
    if (!data?.timeBlocks) return [];
    // Sort by start time
    return [...data.timeBlocks].sort((a, b) =>
      a.startTime.localeCompare(b.startTime),
    );
  }, [data?.timeBlocks]);

  const navigateDate = (direction: "prev" | "next") => {
    const currentDate = parseDate(dateString);
    const newDate =
      direction === "next" ? addDays(currentDate, 1) : subDays(currentDate, 1);
    const newDateString = formatDateToYYYYMMDD(newDate);
    router.push(`/admin/proshop/display?date=${newDateString}`);
  };

  const goToToday = () => {
    router.push(`/admin/proshop/display?date=${getBCToday()}`);
  };

  // Format time for display (e.g., "7:30 AM")
  const formatTime = (timeString: string) => {
    const parts = timeString.split(":");
    const hours = parseInt(parts[0] ?? "0", 10);
    const minutes = parseInt(parts[1] ?? "0", 10);
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
  };

  // Get current time for highlighting
  const now = new Date();
  const currentTimeString = format(now, "HH:mm");

  // Find nearest upcoming timeblock for today
  const findNearestTimeBlockIndex = () => {
    if (dateString !== getBCToday()) return -1;
    return timeBlocks.findIndex(
      (block) => block.startTime >= currentTimeString,
    );
  };

  const nearestIndex = findNearestTimeBlockIndex();

  return (
    <div className="flex h-screen flex-col bg-white">
      {/* Header */}
      <header className="border-org-primary/20 bg-org-secondary flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigateDate("prev")}
            className="text-org-primary hover:bg-org-primary/10 hover:text-org-primary"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <div className="text-center">
            <h1 className="text-org-primary text-3xl font-bold tracking-tight">
              {format(parseDate(dateString), "EEEE")}
            </h1>
            <p className="text-org-tertiary text-lg font-medium">
              {format(parseDate(dateString), "MMMM d, yyyy")}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigateDate("next")}
            className="text-org-primary hover:bg-org-primary/10 hover:text-org-primary"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        </div>

        <div className="flex items-center gap-4">
          {dateString !== getBCToday() && (
            <Button
              variant="outline"
              onClick={goToToday}
              className="border-org-primary text-org-primary hover:bg-org-primary hover:text-white"
            >
              Today
            </Button>
          )}
          <div className="text-org-tertiary flex items-center gap-2 text-sm">
            <RefreshCw
              className={cn("h-4 w-4", isFetching && "animate-spin")}
            />
            <span>Updated {format(new Date(dataUpdatedAt), "h:mm:ss a")}</span>
          </div>
        </div>
      </header>

      {/* Tee Times Grid */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <RefreshCw className="text-org-primary mx-auto h-12 w-12 animate-spin" />
              <p className="text-org-tertiary mt-4 text-lg">
                Loading tee sheet...
              </p>
            </div>
          </div>
        ) : timeBlocks.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Clock className="text-org-primary/30 mx-auto h-16 w-16" />
              <p className="text-org-tertiary mt-4 text-xl">
                No tee times available
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            {timeBlocks.map((block, index) => {
              const members = block.members || [];
              const fills = block.fills || [];
              const totalPlayers = members.length;
              const maxMembers = block.maxMembers || 4;
              const isFull = totalPlayers >= maxMembers;
              const isEmpty = totalPlayers === 0 && fills.length === 0;
              const isCurrentSlot = index === nearestIndex;

              return (
                <div
                  key={block.id}
                  className={cn(
                    "rounded-xl border p-4 transition-all",
                    isCurrentSlot && "ring-org-primary ring-2 ring-offset-2",
                    isEmpty
                      ? "border-gray-200 bg-gray-50"
                      : isFull
                        ? "border-org-primary/30 bg-org-secondary"
                        : "border-org-primary/20 bg-white",
                  )}
                >
                  <div className="flex items-start gap-6">
                    {/* Time */}
                    <div className="w-28 shrink-0">
                      <div
                        className={cn(
                          "text-2xl font-bold tabular-nums",
                          isEmpty ? "text-gray-400" : "text-org-primary",
                        )}
                      >
                        {formatTime(block.startTime)}
                      </div>
                      {isCurrentSlot && (
                        <span className="bg-org-primary mt-1 inline-block rounded px-2 py-0.5 text-xs font-medium text-white">
                          NOW
                        </span>
                      )}
                    </div>

                    {/* Players */}
                    <div className="flex-1">
                      {isEmpty ? (
                        <p className="text-lg text-gray-400">Available</p>
                      ) : (
                        <div className="space-y-2">
                          {/* Member names */}
                          {members.length > 0 && (
                            <div className="flex flex-wrap gap-3">
                              {members.map((member: any, idx: number) => (
                                <div
                                  key={idx}
                                  className={cn(
                                    "rounded-lg border px-3 py-1.5 text-base font-medium",
                                    member.checkedIn
                                      ? "border-green-500 bg-green-50 text-green-700"
                                      : "border-org-primary/30 text-org-primary bg-white",
                                  )}
                                >
                                  {member.firstName} {member.lastName}
                                  {member.checkedIn && (
                                    <span className="ml-2 text-xs text-green-500">
                                      ✓
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Fills */}
                          {fills.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {fills.map((fill: any, idx: number) => (
                                <span
                                  key={idx}
                                  className="rounded border border-amber-400 bg-amber-50 px-2 py-1 text-sm text-amber-700"
                                >
                                  {fill.label || "Fill"}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Capacity indicator */}
                    <div className="flex shrink-0 items-center gap-2">
                      <Users
                        className={cn(
                          "h-5 w-5",
                          isEmpty
                            ? "text-gray-300"
                            : isFull
                              ? "text-org-primary"
                              : "text-org-tertiary",
                        )}
                      />
                      <span
                        className={cn(
                          "text-lg font-semibold tabular-nums",
                          isEmpty
                            ? "text-gray-300"
                            : isFull
                              ? "text-org-primary"
                              : "text-org-tertiary",
                        )}
                      >
                        {totalPlayers}/{maxMembers}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-org-primary/20 bg-org-secondary border-t px-6 py-3">
        <div className="text-org-tertiary flex items-center justify-between text-sm">
          <span>GolfSync Pro Shop Display</span>
          <span>{format(now, "EEEE, MMMM d, yyyy • h:mm a")}</span>
        </div>
      </footer>
    </div>
  );
}
