import { TeesheetConfig, Timeblocks } from "~/server/db/schema";
import { Clock, Users, Calendar } from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
import { formatDate } from "~/lib/dates";

interface ConfigSummaryProps {
  config: TeesheetConfig | null;
  timeBlocks: Timeblocks[];
  dateString?: string;
}

export function ConfigSummary({ config, timeBlocks, dateString }: ConfigSummaryProps) {
  const displayDate = dateString ? formatDate(dateString) : undefined;

  if (!config) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="text-sm text-gray-500">No configuration available</div>
        </CardContent>
      </Card>
    );
  }

  const maxMembers = config.maxMembersPerBlock || "N/A";

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
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-600" />
              <span className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{config.name}</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-gray-600" />
              <span className="text-sm">
                <span className="font-semibold text-gray-900">{maxMembers}</span>
                <span className="text-gray-600"> per block</span>
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
