"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { LoadingSpinner } from "~/components/ui/loading-spinner";
import { Badge } from "~/components/ui/badge";
import { calculateDynamicTimeWindows } from "~/lib/lottery-utils";
import type { TeesheetConfigWithBlocks } from "~/server/db/schema";
import {
  updateLotteryEntryAdmin,
  updateLotteryGroupAdmin,
} from "~/server/lottery/actions";
import { toast } from "react-hot-toast";
import { MemberSearchInput } from "~/components/members/MemberSearchInput";
import { X } from "lucide-react";

interface Member {
  id: number;
  firstName: string;
  lastName: string;
  class: string;
  memberNumber?: string;
}

interface IndividualEntry {
  id: number;
  member: {
    id: number;
    firstName: string;
    lastName: string;
    class: string;
  };
  preferredWindow: string;
  alternateWindow?: string;
  status: string;
}

interface GroupEntry {
  id: number;
  leader: {
    id: number;
    firstName: string;
    lastName: string;
    class: string;
  };
  members?: Array<{
    id: number;
    firstName: string;
    lastName: string;
    class: string;
  }>;
  memberIds: number[];
  preferredWindow: string;
  alternateWindow?: string;
  status: string;
}

interface LotteryEditDialogProps {
  open: boolean;
  onClose: () => void;
  entry: IndividualEntry | GroupEntry | null;
  isGroup: boolean;
  members: Member[];
  config: TeesheetConfigWithBlocks;
}

export function LotteryEditDialog({
  open,
  onClose,
  entry,
  isGroup,
  members,
  config,
}: LotteryEditDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  // Calculate dynamic time windows from config
  const timeWindows = calculateDynamicTimeWindows(config);

  // Form state
  const [preferredWindow, setPreferredWindow] = useState<string>("MORNING");
  const [alternateWindow, setAlternateWindow] = useState<string | "">("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);

  // Initialize form when entry changes
  useEffect(() => {
    if (entry) {
      setPreferredWindow(entry.preferredWindow);
      setAlternateWindow(entry.alternateWindow || "");

      if (isGroup && "memberIds" in entry) {
        setSelectedMemberIds(entry.memberIds);
      }
    }
  }, [entry, isGroup]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entry) return;

    setIsLoading(true);
    try {
      const updateData = {
        preferredWindow,
        alternateWindow: alternateWindow || undefined,
      };

      let result;
      if (isGroup && "memberIds" in entry) {
        result = await updateLotteryGroupAdmin(entry.id, {
          ...updateData,
          memberIds: selectedMemberIds,
        });
      } else {
        result = await updateLotteryEntryAdmin(entry.id, updateData);
      }

      if (result.success) {
        toast.success(
          `${isGroup ? "Group" : "Individual"} entry updated successfully`,
        );
        onClose();
      } else {
        toast.error(result.error || "Failed to update entry");
      }
    } catch (error) {
      toast.error("An error occurred while updating the entry");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Edit {isGroup ? "Group" : "Individual"} Entry
          </DialogTitle>
        </DialogHeader>

        {entry && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Entry Info */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Entry Details</Label>
              <div className="rounded border bg-gray-50 p-3">
                {isGroup && "leader" in entry ? (
                  <>
                    <div className="font-medium">
                      {entry.leader.firstName} {entry.leader.lastName} (Group
                      Leader)
                    </div>
                    <div className="text-sm text-gray-600">
                      {entry.leader.class} • {entry.memberIds.length} members
                    </div>
                  </>
                ) : (
                  <>
                    <div className="font-medium">
                      {"member" in entry ? entry.member.firstName : ""}{" "}
                      {"member" in entry ? entry.member.lastName : ""}
                    </div>
                    <div className="text-sm text-gray-600">
                      {"member" in entry ? entry.member.class : ""}
                    </div>
                  </>
                )}
                <Badge variant="outline" className="mt-1">
                  {entry.status}
                </Badge>
              </div>
            </div>

            {/* Preferred Time Window */}
            <div className="space-y-2">
              <Label htmlFor="preferredWindow">Preferred Time Window</Label>
              <Select
                value={preferredWindow}
                onValueChange={(value) => setPreferredWindow(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeWindows.map((window) => (
                    <SelectItem key={window.value} value={window.value}>
                      {window.label} ({window.timeRange})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Alternate Window */}
            <div className="space-y-2">
              <Label htmlFor="alternateWindow">
                Alternate Time Window (Optional)
              </Label>
              <Select
                value={alternateWindow || "NONE"}
                onValueChange={(value) =>
                  setAlternateWindow(value === "NONE" ? "" : value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select alternate window" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">None</SelectItem>
                  {timeWindows.map((window) => (
                    <SelectItem key={window.value} value={window.value}>
                      {window.label} ({window.timeRange})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Group Members (only for groups) */}
            {isGroup && (
              <div className="space-y-2">
                <Label>Group Members</Label>
                {selectedMemberIds.length < 4 && (
                  <MemberSearchInput
                    onSelect={(searchMember: any) => {
                      if (
                        searchMember &&
                        !selectedMemberIds.includes(searchMember.id)
                      ) {
                        setSelectedMemberIds((prev) => [
                          ...prev,
                          searchMember.id,
                        ]);
                      }
                    }}
                    placeholder="Search and add members..."
                  />
                )}
                {selectedMemberIds.length >= 4 && (
                  <div className="text-sm text-gray-500 italic">
                    Maximum group size of 4 members reached
                  </div>
                )}

                {/* Selected Members List */}
                {selectedMemberIds.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">
                      Selected Members ({selectedMemberIds.length})
                    </div>
                    <div className="space-y-1">
                      {selectedMemberIds.map((memberId) => {
                        const member = members.find((m) => m.id === memberId);
                        if (!member) return null;

                        return (
                          <div
                            key={memberId}
                            className="flex items-center justify-between rounded border bg-gray-50 p-2"
                          >
                            <div>
                              <div className="font-medium">
                                {member.firstName} {member.lastName}
                              </div>
                              <div className="text-sm text-gray-600">
                                {member.class}
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setSelectedMemberIds((prev) =>
                                  prev.filter((id) => id !== memberId),
                                )
                              }
                              className="h-8 w-8 text-red-500 hover:bg-red-50"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <LoadingSpinner className="mr-2 h-4 w-4" />
                    Updating...
                  </>
                ) : (
                  "Update Entry"
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
