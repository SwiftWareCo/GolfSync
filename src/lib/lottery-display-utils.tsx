import { Badge } from "~/components/ui/badge";
import { TrendingUp, Timer, Clock, AlertTriangle, Target, Trophy, Calendar } from "lucide-react";

/**
 * Format pace time from minutes to "H:MM" format
 */
export function formatPaceTime(minutes: number | null): string {
  if (!minutes) return "N/A";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}:${mins.toString().padStart(2, "0")}`;
}

/**
 * Get badge component for speed tier
 */
export function getSpeedTierBadge(tier: "FAST" | "AVERAGE" | "SLOW") {
  switch (tier) {
    case "FAST":
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
          <TrendingUp className="mr-1 h-3 w-3" />
          Fast
        </Badge>
      );
    case "AVERAGE":
      return (
        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
          <Timer className="mr-1 h-3 w-3" />
          Average
        </Badge>
      );
    case "SLOW":
      return (
        <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">
          <Clock className="mr-1 h-3 w-3" />
          Slow
        </Badge>
      );
  }
}

/**
 * Get badge component for admin priority adjustment
 */
export function getAdminAdjustmentBadge(adjustment: number) {
  if (adjustment === 0) {
    return <span className="text-gray-500">0</span>;
  }

  const isPositive = adjustment > 0;
  return (
    <Badge
      variant={isPositive ? "default" : "destructive"}
      className={isPositive ? "bg-blue-100 text-blue-800" : ""}
    >
      <AlertTriangle className="mr-1 h-3 w-3" />
      {isPositive ? "+" : ""}
      {adjustment}
    </Badge>
  );
}

/**
 * Get badge component for fairness priority level
 */
export function getPriorityBadge(score: number) {
  if (score > 20) {
    return (
      <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
        <Target className="mr-1 h-3 w-3" />
        High ({score.toFixed(1)})
      </Badge>
    );
  } else if (score >= 10) {
    return (
      <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
        <Calendar className="mr-1 h-3 w-3" />
        Medium ({score.toFixed(1)})
      </Badge>
    );
  } else {
    return (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
        <Trophy className="mr-1 h-3 w-3" />
        Low ({score.toFixed(1)})
      </Badge>
    );
  }
}

/**
 * Get speed tier info with descriptions
 */
export function getSpeedTierInfo(tier: "FAST" | "AVERAGE" | "SLOW") {
  switch (tier) {
    case "FAST":
      return {
        icon: <TrendingUp className="h-4 w-4" />,
        color: "text-green-700",
        bgColor: "bg-green-50",
        borderColor: "border-green-200",
        description: "≤ 3:55 - Gets priority in morning slots for optimal pace",
      };
    case "AVERAGE":
      return {
        icon: <Timer className="h-4 w-4" />,
        color: "text-yellow-700",
        bgColor: "bg-yellow-50",
        borderColor: "border-yellow-200",
        description: "3:56 - 4:05 - Moderate priority in morning slots",
      };
    case "SLOW":
      return {
        icon: <Clock className="h-4 w-4" />,
        color: "text-gray-700",
        bgColor: "bg-gray-50",
        borderColor: "border-gray-200",
        description: "4:06+ - Typically assigned to later time slots",
      };
  }
}
