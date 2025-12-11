import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { PaceOfPlayStatus, getStatusColor } from "./PaceOfPlayStatus";
import { type TimeBlockWithPaceOfPlay } from "~/server/pace-of-play/data";
import { Button } from "~/components/ui/button";
import {
  CalendarClock,
  Clock,
  Users,
  PlayCircle,
  Flag,
  CheckCircle,
  Settings,
} from "lucide-react";
import { formatTime12Hour } from "~/lib/dates";

interface PaceOfPlayCardProps {
  timeBlock: TimeBlockWithPaceOfPlay;
  onUpdateStart?: () => void;
  onUpdateTurn?: () => void;
  onUpdateFinish?: () => void;
  onAdminUpdate?: () => void;
  showStartButton?: boolean;
  showTurnButton?: boolean;
  showFinishButton?: boolean;
  isMissedTurn?: boolean;
  isAdmin?: boolean;
}

export function PaceOfPlayCard({
  timeBlock,
  onUpdateStart,
  onUpdateTurn,
  onUpdateFinish,
  onAdminUpdate,
  showStartButton = false,
  showTurnButton = false,
  showFinishButton = false,
  isMissedTurn = false,
  isAdmin = false,
}: PaceOfPlayCardProps) {
  const { paceOfPlay, players, numPlayers, startTime } = timeBlock;

  // Format the tee time using our utility function
  const displayStartTime = startTime ? formatTime12Hour(startTime) : "—";

  // Helper to format pace of play timestamps safely
  const formatPaceOfPlayTime = (
    timestamp: Date | string | null | undefined,
  ): string => {
    if (!timestamp) return "—";
    try {
      const date =
        typeof timestamp === "string" ? new Date(timestamp) : timestamp;
      if (isNaN(date.getTime())) return "Invalid Date";
      return formatTime12Hour(date);
    } catch (error) {
      return "Invalid Date";
    }
  };

  // Use the safe timestamp formatter for pace of play times
  const displayTurnTime = formatPaceOfPlayTime(paceOfPlay?.turn9Time);
  const displayFinishTime = formatPaceOfPlayTime(paceOfPlay?.finishTime);

  const statusColor = paceOfPlay
    ? getStatusColor(paceOfPlay.status)
    : "text-gray-600";

  return (
    <Card className="mb-4 w-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold">
            {displayStartTime} Tee Time
          </CardTitle>
          <div className="flex items-center gap-2">
            {paceOfPlay && <PaceOfPlayStatus status={paceOfPlay.status} />}
            {showStartButton && !timeBlock.paceOfPlay?.startTime && (
              <Button
                variant="outline"
                size="sm"
                onClick={onUpdateStart}
                className="h-8 px-2 py-1"
              >
                <PlayCircle className="mr-1 h-4 w-4" />
                Start Round
              </Button>
            )}
            {showTurnButton &&
              timeBlock.paceOfPlay?.startTime &&
              !timeBlock.paceOfPlay?.turn9Time && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onUpdateTurn}
                  className="h-8 px-2 py-1"
                >
                  <Flag className="mr-1 h-4 w-4" />
                  Record Turn
                </Button>
              )}
            {showFinishButton &&
              timeBlock.paceOfPlay?.startTime &&
              !timeBlock.paceOfPlay?.finishTime && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onUpdateFinish}
                  className="h-8 px-2 py-1"
                >
                  <CheckCircle className="mr-1 h-4 w-4" />
                  {isMissedTurn ? "Record Turn & Finish" : "Record Finish"}
                </Button>
              )}
            {/* Admin custom time button - moved inside card */}
            {isAdmin && onAdminUpdate && (
              <Button
                variant="outline"
                size="sm"
                onClick={onAdminUpdate}
                className="h-8 border-amber-300 px-2 py-1 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
              >
                <Settings className="mr-1 h-4 w-4" />
                Custom Time
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="grid gap-3">
          {/* Players as individual badges */}
          <div className="flex flex-wrap items-center gap-2">
            <Users className="text-muted-foreground h-4 w-4 shrink-0" />
            {players && players.length > 0 ? (
              players.map((player, idx) => (
                <span
                  key={idx}
                  className="border-org-primary/30 bg-org-secondary text-org-primary inline-flex items-center rounded-md border px-2.5 py-1 text-sm font-medium"
                >
                  {player.name}
                  {player.checkedIn && (
                    <CheckCircle className="ml-1.5 h-3.5 w-3.5 text-green-500" />
                  )}
                </span>
              ))
            ) : (
              <span className="text-muted-foreground text-sm">
                No checked-in players
              </span>
            )}
            <span className="text-muted-foreground ml-1 text-sm">
              ({numPlayers})
            </span>
          </div>

          {/* Time info grid */}
          <div className="mt-1 grid grid-cols-3 gap-4">
            <div className="flex flex-col">
              <span className="text-muted-foreground flex items-center gap-1 text-xs">
                <Clock className="h-3 w-3" /> Start
              </span>
              <span className="font-medium">{displayStartTime}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-muted-foreground flex items-center gap-1 text-xs">
                <CalendarClock className="h-3 w-3" /> Turn
              </span>
              <span className="font-medium">{displayTurnTime}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-muted-foreground flex items-center gap-1 text-xs">
                <CalendarClock className="h-3 w-3" /> Finish
              </span>
              <span className="font-medium">{displayFinishTime}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
