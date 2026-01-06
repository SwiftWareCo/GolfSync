"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Users, User, ChevronDown, Search, Pencil, Trash2 } from "lucide-react";
import type { TeesheetConfigWithBlocks } from "~/server/db/schema";
import { LotteryEditDialog } from "./LotteryEditDialog";
import { ConfirmationDialog } from "~/components/ui/confirmation-dialog";

interface Guest {
  id: number;
  firstName: string;
  lastName: string;
}

interface LotteryEntry {
  id: number;
  organizer: {
    firstName: string;
    lastName: string;
    memberClass?: { label: string } | null;
  };
  members?: Array<{
    firstName: string;
    lastName: string;
    memberClass?: { label: string } | null;
  }>;
  memberIds?: number[];
  guests?: Guest[];
  guestFillCount?: number;
  preferredWindow: string;
  alternateWindow?: string;
  status: string;
  assignedTimeBlockId?: number | null;
}

interface UnassignedEntriesSidebarProps {
  groups: LotteryEntry[];
  individuals: LotteryEntry[];
  selectedEntryId: string | null;
  onEntrySelect: (entryId: string, isGroup: boolean) => void;
  onDeleteEntry: (entryId: number, isGroup: boolean) => void;
  onEntryUpdated: () => void;
  members: Array<{
    id: number;
    firstName: string;
    lastName: string;
    class: string;
  }>;
  config: TeesheetConfigWithBlocks;
}

export function UnassignedEntriesSidebar({
  groups,
  individuals,
  selectedEntryId,
  onEntrySelect,
  onDeleteEntry,
  onEntryUpdated,
  members,
  config,
}: UnassignedEntriesSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [groupsExpanded, setGroupsExpanded] = useState(true);
  const [individualsExpanded, setIndividualsExpanded] = useState(true);

  // Edit dialog state
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    entry: LotteryEntry | null;
    isGroup: boolean;
  }>({
    open: false,
    entry: null,
    isGroup: false,
  });

  // Delete confirmation dialog state
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    entryId: number | null;
    isGroup: boolean;
    entryName: string;
  }>({
    open: false,
    entryId: null,
    isGroup: false,
    entryName: "",
  });

  // Filter unassigned entries
  const unassignedGroups = useMemo(() => {
    return groups.filter((g) => !g.assignedTimeBlockId);
  }, [groups]);

  const unassignedIndividuals = useMemo(() => {
    return individuals.filter((i) => !i.assignedTimeBlockId);
  }, [individuals]);

  // Apply search filter
  const filteredGroups = useMemo(() => {
    if (!searchQuery) return unassignedGroups;
    const query = searchQuery.toLowerCase();
    return unassignedGroups.filter((group) => {
      const leaderName =
        `${group.organizer?.firstName} ${group.organizer?.lastName}`.toLowerCase();
      const memberNames =
        group.members
          ?.map((m) => `${m.firstName} ${m.lastName}`.toLowerCase())
          .join(" ") || "";
      const guestNames =
        group.guests
          ?.map((g) => `${g.firstName} ${g.lastName}`.toLowerCase())
          .join(" ") || "";
      return (
        leaderName.includes(query) ||
        memberNames.includes(query) ||
        guestNames.includes(query)
      );
    });
  }, [unassignedGroups, searchQuery]);

  const filteredIndividuals = useMemo(() => {
    if (!searchQuery) return unassignedIndividuals;
    const query = searchQuery.toLowerCase();
    return unassignedIndividuals.filter((entry) => {
      const name =
        `${entry.organizer?.firstName} ${entry.organizer?.lastName}`.toLowerCase();
      const guestNames =
        entry.guests
          ?.map((g) => `${g.firstName} ${g.lastName}`.toLowerCase())
          .join(" ") || "";
      return name.includes(query) || guestNames.includes(query);
    });
  }, [unassignedIndividuals, searchQuery]);

  const totalUnassigned =
    unassignedIndividuals.length + unassignedGroups.length;

  // Get all player names for an entry (member + guests)
  const getEntryPlayerNames = (entry: LotteryEntry, isGroup: boolean) => {
    const names: string[] = [];

    // Add organizer/leader name
    names.push(`${entry.organizer?.firstName} ${entry.organizer?.lastName}`);

    // Add group members if applicable
    if (isGroup && entry.members) {
      entry.members.forEach((m) => {
        names.push(`${m.firstName} ${m.lastName}`);
      });
    }

    // Add guest names
    if (entry.guests && entry.guests.length > 0) {
      entry.guests.forEach((g) => {
        names.push(`${g.firstName} ${g.lastName} (Guest)`);
      });
    }

    return names;
  };

  const handleEditClick = (entry: LotteryEntry, isGroup: boolean) => {
    setEditDialog({ open: true, entry, isGroup });
  };

  const handleDeleteClick = (entry: LotteryEntry, isGroup: boolean) => {
    const name = `${entry.organizer?.firstName} ${entry.organizer?.lastName}${isGroup ? " (Group)" : ""}`;
    setDeleteDialog({
      open: true,
      entryId: entry.id,
      isGroup,
      entryName: name,
    });
  };

  const handleConfirmDelete = () => {
    if (deleteDialog.entryId !== null) {
      onDeleteEntry(deleteDialog.entryId, deleteDialog.isGroup);
    }
    setDeleteDialog({
      open: false,
      entryId: null,
      isGroup: false,
      entryName: "",
    });
  };

  return (
    <>
      <Card className="flex h-[calc(100vh-280px)] flex-col">
        <CardHeader className="flex-shrink-0 pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <span>Unassigned ({totalUnassigned})</span>
          </CardTitle>
          {/* Search */}
          <div className="relative">
            <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search entries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardHeader>
        <CardContent className="flex-1 space-y-3 overflow-y-auto pt-0">
          {/* Groups Section */}
          <div>
            <button
              type="button"
              onClick={() => setGroupsExpanded(!groupsExpanded)}
              className="flex w-full items-center justify-between rounded-md bg-orange-50 px-3 py-2 text-sm font-medium text-orange-800 hover:bg-orange-100"
            >
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Groups ({filteredGroups.length})
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${groupsExpanded ? "rotate-180" : ""}`}
              />
            </button>
            {groupsExpanded && (
              <div className="mt-2 space-y-1">
                {filteredGroups.length === 0 ? (
                  <div className="py-2 text-center text-sm text-gray-500">
                    No unassigned groups
                  </div>
                ) : (
                  filteredGroups.map((group) => {
                    const entryId = `group-${group.id}`;
                    const isSelected = selectedEntryId === entryId;
                    const playerNames = getEntryPlayerNames(group, true);

                    return (
                      <div
                        key={group.id}
                        className={`rounded border px-2 py-1.5 text-sm transition-all ${
                          isSelected
                            ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500"
                            : "border-orange-200 bg-orange-50/50 hover:bg-orange-100"
                        }`}
                      >
                        <div
                          className="flex cursor-pointer items-center gap-2"
                          onClick={() => onEntrySelect(entryId, true)}
                        >
                          <Users className="h-3.5 w-3.5 flex-shrink-0 text-orange-600" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">
                              {group.organizer?.firstName}{" "}
                              {group.organizer?.lastName}
                            </div>
                            <div className="text-xs text-gray-600">
                              {playerNames.slice(1).join(", ")}
                            </div>
                            {(group.guestFillCount ?? 0) > 0 && (
                              <Badge
                                variant="outline"
                                className="mt-1 border-amber-400 text-xs text-amber-700"
                              >
                                +{group.guestFillCount} fills
                              </Badge>
                            )}
                          </div>
                        </div>
                        {/* Action buttons */}
                        <div className="mt-1 flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditClick(group, true);
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(group, true);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Individuals Section */}
          <div>
            <button
              type="button"
              onClick={() => setIndividualsExpanded(!individualsExpanded)}
              className="flex w-full items-center justify-between rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-200"
            >
              <span className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Individuals ({filteredIndividuals.length})
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${individualsExpanded ? "rotate-180" : ""}`}
              />
            </button>
            {individualsExpanded && (
              <div className="mt-2 space-y-1">
                {filteredIndividuals.length === 0 ? (
                  <div className="py-2 text-center text-sm text-gray-500">
                    No unassigned individuals
                  </div>
                ) : (
                  filteredIndividuals.map((entry) => {
                    const entryId = `individual-${entry.id}`;
                    const isSelected = selectedEntryId === entryId;
                    const playerNames = getEntryPlayerNames(entry, false);

                    return (
                      <div
                        key={entry.id}
                        className={`rounded border px-2 py-1.5 text-sm transition-all ${
                          isSelected
                            ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500"
                            : "border-gray-200 hover:bg-gray-100"
                        }`}
                      >
                        <div
                          className="flex cursor-pointer items-center gap-2"
                          onClick={() => onEntrySelect(entryId, false)}
                        >
                          <User className="h-3.5 w-3.5 flex-shrink-0 text-gray-500" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">
                              {entry.organizer?.firstName}{" "}
                              {entry.organizer?.lastName}
                            </div>
                            <div className="truncate text-xs text-gray-500">
                              {entry.organizer?.memberClass?.label || ""}
                              {playerNames.length > 1 && (
                                <span className="ml-1 text-gray-400">
                                  • {playerNames.slice(1).join(", ")}
                                </span>
                              )}
                            </div>
                            {(entry.guestFillCount ?? 0) > 0 && (
                              <Badge
                                variant="outline"
                                className="mt-1 border-amber-400 text-xs text-amber-700"
                              >
                                +{entry.guestFillCount} fills
                              </Badge>
                            )}
                          </div>
                        </div>
                        {/* Action buttons */}
                        <div className="mt-1 flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditClick(entry, false);
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(entry, false);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <LotteryEditDialog
        open={editDialog.open}
        onClose={() =>
          setEditDialog({ open: false, entry: null, isGroup: false })
        }
        onSuccess={() => {
          setEditDialog({ open: false, entry: null, isGroup: false });
          onEntryUpdated();
        }}
        entry={editDialog.entry as any}
        isGroup={editDialog.isGroup}
        members={members}
        config={config}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteDialog({
              open: false,
              entryId: null,
              isGroup: false,
              entryName: "",
            });
          }
        }}
        onConfirm={handleConfirmDelete}
        title="Cancel Lottery Entry"
        description={`Are you sure you want to cancel the lottery entry for "${deleteDialog.entryName}"? This action cannot be undone.`}
        confirmText="Cancel Entry"
        cancelText="Keep Entry"
        variant="destructive"
      />
    </>
  );
}
