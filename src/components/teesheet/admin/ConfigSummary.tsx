import { TeesheetConfigWithBlocks } from "~/server/db/schema";
import { Clock, Users, Calendar } from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { formatDate, formatTime12Hour } from "~/lib/dates";

interface ConfigSummaryProps {
  config: TeesheetConfigWithBlocks | null;
  dateString?: string;
  occupiedSpots?: number;
  totalCapacity?: number;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDaysOfWeek(days: number[] | null): string {
  if (!days || days.length === 0) return "Every day";
  if (days.length === 7) return "Every day";

  const dayNames = days.map(d => DAY_NAMES[d]).join(", ");
  return dayNames;
}

function getFirstAndLastTeeTime(blocks: Array<{ startTime: string }>): { first: string; last: string } | null {
  if (!blocks || blocks.length === 0) return null;

  const sorted = [...blocks].sort((a, b) => a.startTime.localeCompare(b.startTime));
  return {
    first: sorted[0]?.startTime || "",
    last: sorted[sorted.length - 1]?.startTime || "",
  };
}

function normalizeDate(date: string | Date | null | undefined): string | null {
  if (!date) return null;
  if (typeof date === "string") return date;
  if (date instanceof Date) {
    const iso = date.toISOString();
    return iso.split("T")[0] || null;
  }
  return null;
}

export function ConfigSummary({ config, dateString, occupiedSpots, totalCapacity: passedTotalCapacity }: ConfigSummaryProps) {
  const displayDate = dateString ? formatDate(dateString) : undefined;

  if (!config) {
    return (
      <Card>
        <CardContent className="p-3">
          <div className="text-sm text-gray-500">No configuration available</div>
        </CardContent>
      </Card>
    );
  }

  // Calculate from config blocks
  const blocks = config.blocks || [];
  const maxPlayersPerBlock = blocks.length > 0 ? Math.max(...blocks.map((b) => b.maxPlayers)) : 4;
  const totalCapacity = passedTotalCapacity ?? (blocks.length > 0 ? blocks.reduce((sum, b) => sum + b.maxPlayers, 0) : 0);
  const teeTimes = getFirstAndLastTeeTime(blocks);
  const applicableDays = formatDaysOfWeek(config.daysOfWeek);

  return (
    <Card>
      <CardContent className="p-3">
        <div className="space-y-3">
          {/* Date Header */}
          {displayDate && (
            <div className="flex items-center gap-3 border-b pb-2">
              <Calendar className="h-5 w-5 text-gray-600" />
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">Date</p>
                <p className="text-lg font-bold text-gray-900">{displayDate}</p>
              </div>
            </div>
          )}

          {/* Configuration Details */}
          <div className="space-y-2">
            {/* Config Name + Status */}
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-600" />
              <div className="flex-1">
                <span className="text-sm text-gray-600">
                  <span className="font-semibold text-gray-900">{config.name}</span>
                </span>
              </div>
              <Badge variant={config.isActive ? "default" : "secondary"} className="text-xs">
                {config.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>

            {/* Players Per Block */}
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-gray-600" />
              <span className="text-sm">
                <span className="font-semibold text-gray-900">{maxPlayersPerBlock}</span>
                <span className="text-gray-600"> per block</span>
              </span>
            </div>

            {/* Time Blocks Count */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>
                <span className="font-semibold text-gray-900">{blocks.length}</span> time blocks
              </span>
            </div>

            {/* Total Capacity */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>
                <span className="font-semibold text-gray-900">{totalCapacity}</span> total spots
              </span>
            </div>

            {/* Occupied Spots */}
            {occupiedSpots !== undefined && totalCapacity > 0 && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>
                  <span className="font-semibold text-gray-900">{occupiedSpots}/{totalCapacity}</span> spots booked
                </span>
              </div>
            )}

            {/* Tee Times */}
            {teeTimes && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>
                  <span className="font-semibold text-gray-900">{formatTime12Hour(teeTimes.first)}</span>
                  <span className="text-gray-400">—</span>
                  <span className="font-semibold text-gray-900">{formatTime12Hour(teeTimes.last)}</span>
                </span>
              </div>
            )}

            {/* Applicable Days */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="font-semibold text-gray-900">{applicableDays}</span>
            </div>

            {/* Date Range */}
            {(config.startDate || config.endDate) && (
              <div className="text-xs text-gray-500">
                {config.startDate && !config.endDate && (
                  <span>From {formatDate(normalizeDate(config.startDate) || "")}</span>
                )}
                {!config.startDate && config.endDate && (
                  <span>Until {formatDate(normalizeDate(config.endDate) || "")}</span>
                )}
                {config.startDate && config.endDate && (
                  <span>
                    {formatDate(normalizeDate(config.startDate) || "")} →{" "}
                    {formatDate(normalizeDate(config.endDate) || "")}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
