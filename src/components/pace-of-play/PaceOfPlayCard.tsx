import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
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
} from "lucide-react";
import { formatTime12Hour, formatTime, formatDateTime } from "~/lib/dates";

interface PaceOfPlayCardProps {
  timeBlock: TimeBlockWithPaceOfPlay;
  onUpdateStart?: () => void;
  onUpdateTurn?: () => void;
  onUpdateFinish?: () => void;
  showStartButton?: boolean;
  showTurnButton?: boolean;
  showFinishButton?: boolean;
  isMissedTurn?: boolean;
}

export function PaceOfPlayCard({
  timeBlock,
  onUpdateStart,
  onUpdateTurn,
  onUpdateFinish,
  showStartButton = false,
  showTurnButton = false,
  showFinishButton = false,
  isMissedTurn = false,
}: PaceOfPlayCardProps) {
  const { paceOfPlay, playerNames, numPlayers, startTime } = timeBlock;

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
          {paceOfPlay && <PaceOfPlayStatus status={paceOfPlay.status} />}
          <div className="flex items-center gap-2">
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
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="grid gap-2">
          <div className="flex items-center gap-2">
            <Users className="text-muted-foreground h-4 w-4" />
            <span className="text-sm">
              {playerNames || "No players"} ({numPlayers})
            </span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-4">
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
