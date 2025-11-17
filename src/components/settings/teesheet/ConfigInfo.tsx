import { Card, CardContent } from "~/components/ui/card";
import { Clock, Users } from "lucide-react";
import type {
  TeesheetConfig,
  TimeBlockWithMembers,
} from "~/app/types/TeeSheetTypes";
import { BagReportDialog } from "./BagReportDialog";
import { formatTimeStringTo12Hour } from "~/lib/utils";

interface ConfigInfoProps {
  config: TeesheetConfig | null;
  teesheetId: number;
  timeBlocks: TimeBlockWithMembers[];
}

export function ConfigInfo({ config, timeBlocks }: ConfigInfoProps) {
  // Handle null config
  if (!config) {
    return null;
  }

  // Only show config details for Regular configs
  const isRegularConfig = config.type === "REGULAR";

  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-4">
          {isRegularConfig && (
            <>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>
                  {formatTimeStringTo12Hour(config.startTime)} -{" "}
                  {formatTimeStringTo12Hour(config.endTime)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>{config.maxMembersPerBlock} per block</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">
                  {config.interval} min intervals
                </span>
              </div>
            </>
          )}
          {!isRegularConfig && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">
                Custom configuration: {config.name}
              </span>
            </div>
          )}
        </div>
        <BagReportDialog timeBlocks={timeBlocks} />
      </CardContent>
    </Card>
  );
}
