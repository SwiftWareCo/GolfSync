"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { ConfirmationDialog } from "~/components/ui/confirmation-dialog";
import { ListChecks, Users, Clock, Trash2 } from "lucide-react";
// Note: This component needs to be refactored to receive data via props instead of direct server calls
import { cancelLotteryEntry } from "~/server/lottery/actions";
import { toast } from "react-hot-toast";

// TODO: This component should receive timeWindows via props from parent using calculateDynamicTimeWindows
const TIME_WINDOWS = [
  { value: "MORNING", label: "Morning" },
  { value: "MIDDAY", label: "Midday" },
  { value: "AFTERNOON", label: "Afternoon" },
  { value: "EVENING", label: "Evening" },
] as const;

type LotteryStatus = "setup" | "active" | "closed";

interface LotteryEntryManagerProps {
  date: string;
  status: LotteryStatus;
}

interface LotteryEntryData {
  individual: any[];
  groups: any[];
}

interface ConfirmDialogState {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
  variant?: "default" | "destructive";
}

export function LotteryEntryManager({
  date,
  status,
}: LotteryEntryManagerProps) {
  const [entries, setEntries] = useState<LotteryEntryData>({
    individual: [],
    groups: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    open: false,
    title: "",
    description: "",
    onConfirm: () => {},
    variant: "default",
  });

  const canEdit = status === "setup" || status === "active";

  // TODO: Refactor to receive data via props instead of server calls
  const loadData = async () => {
    console.warn("MemberLotteryEntryManager needs refactoring to use props");
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [date]);

  const handleCancelEntry = async (entryId: number, isGroup: boolean) => {
    setConfirmDialog({
      open: true,
      title: "Cancel Entry",
      description: `Are you sure you want to cancel this ${isGroup ? "group" : "individual"} entry? This action cannot be undone.`,
      variant: "destructive",
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, open: false }));
        try {
          const result = await cancelLotteryEntry(entryId);
          if (result.success) {
            toast.success("Entry cancelled successfully");
            await loadData();
          } else {
            toast.error(result.error || "Failed to cancel entry");
          }
        } catch (error) {
          toast.error("An error occurred while cancelling the entry");
        }
      },
    });
  };

  const getTimeWindowLabel = (window: string) => {
    const timeWindow = TIME_WINDOWS.find((tw) => tw.value === window);
    return timeWindow ? timeWindow.label : window;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "secondary";
      case "ASSIGNED":
        return "default";
      case "CANCELLED":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const totalEntries = entries.individual.length + entries.groups.length;
  const pendingEntries =
    entries.individual.filter((e) => e.status === "PENDING").length +
    entries.groups.filter((g) => g.status === "PENDING").length;
  const assignedEntries =
    entries.individual.filter((e) => e.status === "ASSIGNED").length +
    entries.groups.filter((g) => g.status === "ASSIGNED").length;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="border-org-primary h-8 w-8 animate-spin rounded-full border-b-2"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{totalEntries}</div>
            <p className="text-sm text-gray-600">Total Entries</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">
              {pendingEntries}
            </div>
            <p className="text-sm text-gray-600">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {assignedEntries}
            </div>
            <p className="text-sm text-gray-600">Assigned</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            All Lottery Entries for {date}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {totalEntries === 0 ? (
              <div className="py-8 text-center text-gray-500">
                <ListChecks className="mx-auto mb-4 h-12 w-12 opacity-50" />
                <p>No lottery entries yet</p>
                <p className="text-sm">
                  Members can submit entries through their teesheet interface
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Individual Entries */}
                {entries.individual.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-lg font-medium">
                      Individual Entries ({entries.individual.length})
                    </h3>
                    <div className="space-y-3">
                      {entries.individual.map((entry) => (
                        <div key={entry.id} className="rounded-lg border p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Clock className="h-4 w-4 text-green-500" />
                              <div>
                                <span className="font-medium">
                                  {entry.member.firstName}{" "}
                                  {entry.member.lastName}
                                </span>
                                <div className="text-sm text-gray-500">
                                  {entry.member.class} • #
                                  {entry.member.memberNumber}
                                </div>
                              </div>
                              <Badge variant={getStatusColor(entry.status)}>
                                {entry.status}
                              </Badge>
                              {entry.assignedTimeBlock && (
                                <Badge variant="outline">
                                  Assigned: {entry.assignedTimeBlock.startTime}
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {entry.status === "PENDING" && canEdit && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    handleCancelEntry(entry.id, false)
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Cancel
                                </Button>
                              )}
                            </div>
                          </div>

                          <div className="mt-3 text-sm text-gray-600">
                            <div className="flex flex-wrap gap-4">
                              <span>
                                Preferred:{" "}
                                {getTimeWindowLabel(entry.preferredWindow)}
                              </span>
                              {entry.alternateWindow && (
                                <span>
                                  Alternate:{" "}
                                  {getTimeWindowLabel(entry.alternateWindow)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Group Entries */}
                {entries.groups.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-lg font-medium">
                      Group Entries ({entries.groups.length})
                    </h3>
                    <div className="space-y-3">
                      {entries.groups.map((group) => (
                        <div key={group.id} className="rounded-lg border p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Users className="h-4 w-4 text-blue-500" />
                              <div>
                                <span className="font-medium">
                                  {group.leader.firstName}{" "}
                                  {group.leader.lastName} (Leader)
                                </span>
                                <div className="text-sm text-gray-500">
                                  Group of {group.memberIds.length} •{" "}
                                  {group.leader.class}
                                </div>
                              </div>
                              <Badge variant={getStatusColor(group.status)}>
                                {group.status}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-2">
                              {group.status === "PENDING" && canEdit && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    handleCancelEntry(group.id, true)
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Cancel
                                </Button>
                              )}
                            </div>
                          </div>

                          <div className="mt-3 text-sm text-gray-600">
                            <div className="flex flex-wrap gap-4">
                              <span>
                                Preferred:{" "}
                                {getTimeWindowLabel(group.preferredWindow)}
                              </span>
                              {group.alternateWindow && (
                                <span>
                                  Alternate:{" "}
                                  {getTimeWindowLabel(group.alternateWindow)}
                                </span>
                              )}
                            </div>
                            {group.members && (
                              <div className="mt-2">
                                <span className="font-medium">Members: </span>
                                {group.members.map(
                                  (member: any, index: number) => (
                                    <span key={member.id}>
                                      {member.firstName} {member.lastName}
                                      {index < group.members.length - 1
                                        ? ", "
                                        : ""}
                                    </span>
                                  ),
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <ConfirmationDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant={confirmDialog.variant}
      />
    </div>
  );
}
