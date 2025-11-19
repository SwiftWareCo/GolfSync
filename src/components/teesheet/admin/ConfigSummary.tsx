import { TeesheetConfig, Timeblocks } from "~/server/db/schema";
import { Clock, Users, Zap, Calendar } from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
import { formatTime12Hour, formatDate } from "~/lib/dates";

interface ConfigSummaryProps {
  config: TeesheetConfig;
  timeBlocks: Timeblocks[];
  dateString?: string;
}

export function ConfigSummary({ config, timeBlocks, dateString }: ConfigSummaryProps) {
  const isCustom = config.type === "CUSTOM";
  const startTime = config.startTime ? formatTime12Hour(config.startTime) : "N/A";
  const endTime = config.endTime ? formatTime12Hour(config.endTime) : "N/A";
  const interval = config.interval || "N/A";
  const maxMembers = config.maxMembersPerBlock || "N/A";
  const displayDate = dateString ? formatDate(dateString) : undefined;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Date Header */}
          {displayDate && (
            <div className="flex items-center gap-3 border-b pb-4">
              <Calendar className="h-5 w-5 text-gray-600" />
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">Date</p>
                <p className="text-lg font-bold text-gray-900">{displayDate}</p>
              </div>
            </div>
          )}

          {/* Configuration Details */}
          <div className="flex items-center justify-start gap-8 flex-wrap">
            {isCustom ? (
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-gray-600" />
                <span className="text-sm text-gray-600">Custom Template</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-gray-600" />
                <span className="text-sm">
                  <span className="font-semibold text-gray-900">{startTime}</span>
                  <span className="text-gray-600"> - </span>
                  <span className="font-semibold text-gray-900">{endTime}</span>
                </span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-gray-600" />
              <span className="text-sm">
                <span className="font-semibold text-gray-900">{maxMembers}</span>
                <span className="text-gray-600"> per block</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-gray-600" />
              <span className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{interval}</span> min intervals
              </span>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{timeBlocks.length}</span> time blocks
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
