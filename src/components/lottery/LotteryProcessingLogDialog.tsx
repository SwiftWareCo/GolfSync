"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Separator } from "~/components/ui/separator";
import { LoadingSpinner } from "~/components/ui/loading-spinner";
import {
  ChevronDown,
  ChevronRight,
  Users,
  User,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowRight,
  Edit,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { formatDate } from "~/lib/dates";
import { getLotteryProcessingLog } from "~/server/lottery/actions";

type ProcessingLogData = Awaited<ReturnType<typeof getLotteryProcessingLog>>;
type EnrichedLog = NonNullable<ProcessingLogData["data"]>["logs"]["all"][0];
type RestrictionDetails = EnrichedLog["restrictionDetails"];

interface LotteryProcessingLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
}

const assignmentReasonLabels: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  PREFERRED_MATCH: { label: "Preferred", variant: "default" },
  ALTERNATE_MATCH: { label: "Alternate", variant: "secondary" },
  ALLOWED_FALLBACK: { label: "Fallback", variant: "outline" },
  RESTRICTION_VIOLATION: { label: "Violation", variant: "destructive" },
};

/**
 * Formatted display for restriction violation details
 */
function RestrictionDetailsDisplay({
  details,
}: {
  details: RestrictionDetails;
}) {
  if (!details) return null;

  const { restrictionIds, reasons } = details;
  const hasReasons = reasons && reasons.length > 0;
  const hasIds = restrictionIds && restrictionIds.length > 0;

  if (!hasReasons && !hasIds) return null;

  return (
    <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-red-800">
        <AlertTriangle className="h-3.5 w-3.5" />
        Restriction Violation
      </div>
      {hasReasons && (
        <ul className="mt-2 space-y-1">
          {reasons.map((reason, idx) => (
            <li
              key={idx}
              className="flex items-start gap-2 text-xs text-red-700"
            >
              <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400" />
              {reason}
            </li>
          ))}
        </ul>
      )}
      {hasIds && !hasReasons && (
        <p className="mt-1 text-xs text-red-600">
          Affected restriction IDs: {restrictionIds.join(", ")}
        </p>
      )}
    </div>
  );
}

function EntryLogCard({ log }: { log: EnrichedLog }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const reasonInfo = assignmentReasonLabels[log.assignmentReason] ?? {
    label: log.assignmentReason,
    variant: "outline" as const,
  };

  const fairnessDelta = log.fairnessScoreDelta ?? 0;
  const hasFairnessData =
    log.fairnessScoreBefore !== null && log.fairnessScoreAfter !== null;

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <CollapsibleTrigger asChild>
        <div className="flex cursor-pointer items-center justify-between rounded-md border p-3 hover:bg-gray-50">
          <div className="flex items-center gap-3">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-500" />
            )}
            <div className="flex items-center gap-2">
              {log.entryType === "GROUP" ? (
                <Users className="h-4 w-4 text-blue-500" />
              ) : (
                <User className="h-4 w-4 text-green-500" />
              )}
              <span className="text-sm font-medium">
                {log.memberNames || "Unknown"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {log.violatedRestrictions && (
              <Badge variant="destructive" className="text-xs">
                <AlertTriangle className="mr-1 h-3 w-3" />
                Violation
              </Badge>
            )}
            {log.wasModifiedByAdmin && (
              <Badge variant="outline" className="text-xs">
                <Edit className="mr-1 h-3 w-3" />
                Admin Edit
              </Badge>
            )}
            <Badge variant={reasonInfo.variant} className="text-xs">
              {reasonInfo.label}
            </Badge>
            {log.finalBlockTime && (
              <span className="text-sm text-gray-600">
                {log.finalBlockTime}
              </span>
            )}
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 ml-8 space-y-2 rounded-md bg-gray-50 p-3 text-sm">
          {/* Time Preferences */}
          <div className="flex items-center gap-4">
            <span className="text-gray-500">Preferences:</span>
            <span>
              Window {log.preferredWindow}
              {log.alternateWindow && ` / ${log.alternateWindow}`}
            </span>
          </div>

          {/* Assignment Flow */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Assignment:</span>
            <span>{log.autoAssignedStartTime ?? "—"}</span>
            {log.wasModifiedByAdmin && (
              <>
                <ArrowRight className="h-4 w-4 text-orange-500" />
                <span className="font-medium text-orange-600">
                  {log.finalStartTime ?? "—"}
                </span>
                <Badge variant="outline" className="ml-1 text-xs">
                  Admin changed
                </Badge>
              </>
            )}
          </div>

          {/* Fairness Score */}
          {hasFairnessData && (
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Fairness:</span>
              <span>{String(log.fairnessScoreBefore ?? "—")}</span>
              <ArrowRight className="h-3 w-3 text-gray-400" />
              <span className="font-medium">
                {String(log.fairnessScoreAfter ?? "—")}
              </span>
              {fairnessDelta !== 0 && (
                <Badge
                  variant={fairnessDelta < 0 ? "default" : "secondary"}
                  className="text-xs"
                >
                  {fairnessDelta > 0 ? (
                    <TrendingUp className="mr-1 h-3 w-3" />
                  ) : (
                    <TrendingDown className="mr-1 h-3 w-3" />
                  )}
                  {fairnessDelta > 0 ? "+" : ""}
                  {fairnessDelta}
                </Badge>
              )}
            </div>
          )}

          {/* Preference Granted */}
          {log.preferenceGranted !== null && (
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Preference Granted:</span>
              {log.preferenceGranted ? (
                <Badge variant="default" className="text-xs">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Yes
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">
                  No
                </Badge>
              )}
            </div>
          )}

          {/* Restriction Details */}
          {log.violatedRestrictions && log.restrictionDetails && (
            <RestrictionDetailsDisplay details={log.restrictionDetails} />
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function LotteryProcessingLogDialog({
  open,
  onOpenChange,
  date,
}: LotteryProcessingLogDialogProps) {
  const [data, setData] = useState<ProcessingLogData["data"] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groupsExpanded, setGroupsExpanded] = useState(true);
  const [individualsExpanded, setIndividualsExpanded] = useState(true);

  useEffect(() => {
    if (open && date) {
      setIsLoading(true);
      setError(null);
      getLotteryProcessingLog(date)
        .then((result) => {
          if (result.success && result.data) {
            setData(result.data);
          } else {
            setError(result.error ?? "Failed to load processing log");
          }
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "An error occurred");
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [open, date]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Lottery Processing Log - {formatDate(date)}
          </DialogTitle>
          <DialogDescription>
            Detailed log of lottery algorithm processing and assignments
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner className="h-8 w-8" />
          </div>
        )}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
            {error}
          </div>
        )}

        {data && !isLoading && (
          <ScrollArea className="max-h-[calc(90vh-200px)] pr-4">
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {data.summary.totalEntries}
                    </div>
                    <div className="text-xs text-gray-500">Total Entries</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {data.summary.assignedCount}
                    </div>
                    <div className="text-xs text-gray-500">Assigned</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {data.summary.groupCount}
                    </div>
                    <div className="text-xs text-gray-500">Groups</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <div
                      className={`text-2xl font-bold ${data.summary.violationCount > 0 ? "text-red-600" : "text-gray-400"}`}
                    >
                      {data.summary.violationCount}
                    </div>
                    <div className="text-xs text-gray-500">Violations</div>
                  </CardContent>
                </Card>
              </div>

              {/* Workflow Status */}
              <Card>
                <CardContent className="p-3">
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Processed:</span>
                      <span>
                        {data.summary.processedAt
                          ? new Date(data.summary.processedAt).toLocaleString()
                          : "—"}
                      </span>
                    </div>
                    <Separator orientation="vertical" className="h-4" />
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Fairness Assigned:</span>
                      {data.summary.fairnessAssignedAt ? (
                        <Badge variant="default" className="text-xs">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Yes
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Pending
                        </Badge>
                      )}
                    </div>
                    <Separator orientation="vertical" className="h-4" />
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Finalized:</span>
                      {data.summary.finalizedAt ? (
                        <Badge variant="default" className="text-xs">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Yes
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Pending
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Group Entries */}
              {data.logs.groups.length > 0 && (
                <Collapsible
                  open={groupsExpanded}
                  onOpenChange={setGroupsExpanded}
                >
                  <CollapsibleTrigger asChild>
                    <Card className="cursor-pointer">
                      <CardHeader className="py-3">
                        <CardTitle className="flex items-center justify-between text-base">
                          <div className="flex items-center gap-2">
                            {groupsExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            <Users className="h-4 w-4 text-blue-500" />
                            Group Entries ({data.logs.groups.length})
                          </div>
                        </CardTitle>
                      </CardHeader>
                    </Card>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 space-y-2">
                      {data.logs.groups.map((log) => (
                        <EntryLogCard key={log.id} log={log} />
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Individual Entries */}
              {data.logs.individuals.length > 0 && (
                <Collapsible
                  open={individualsExpanded}
                  onOpenChange={setIndividualsExpanded}
                >
                  <CollapsibleTrigger asChild>
                    <Card className="cursor-pointer">
                      <CardHeader className="py-3">
                        <CardTitle className="flex items-center justify-between text-base">
                          <div className="flex items-center gap-2">
                            {individualsExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            <User className="h-4 w-4 text-green-500" />
                            Individual Entries ({data.logs.individuals.length})
                          </div>
                        </CardTitle>
                      </CardHeader>
                    </Card>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 space-y-2">
                      {data.logs.individuals.map((log) => (
                        <EntryLogCard key={log.id} log={log} />
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Empty State */}
              {data.logs.all.length === 0 && (
                <div className="py-8 text-center text-gray-500">
                  No entry logs found for this processing run.
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-end pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
