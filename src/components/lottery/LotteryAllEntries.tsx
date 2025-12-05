"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Search } from "lucide-react";
import { LotteryIndividualEntriesList } from "./LotteryIndividualEntriesList";
import { LotteryGroupEntriesList } from "./LotteryGroupEntriesList";
import { LotteryEditDialog } from "./LotteryEditDialog";
import { ConfirmationDialog } from "~/components/ui/confirmation-dialog";
import type { TeesheetConfigWithBlocks } from "~/server/db/schema";

interface LotteryEntryData {
  individual: any[];
  groups: any[];
}

interface LotteryAllEntriesProps {
  entries: LotteryEntryData;
  onCancelEntry: (entryId: number, isGroup: boolean) => void;
  getTimeWindowLabel: (window: string) => string;
  members: Array<{
    id: number;
    firstName: string;
    lastName: string;
    class: string;
  }>;
  config: TeesheetConfigWithBlocks;
}

export function LotteryAllEntries({
  entries,
  onCancelEntry,
  getTimeWindowLabel,
  members,
  config,
}: LotteryAllEntriesProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    entry: any | null;
    isGroup: boolean;
  }>({
    open: false,
    entry: null,
    isGroup: false,
  });
  const [confirmCancelDialog, setConfirmCancelDialog] = useState<{
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

  // Filter and sort entries based on search term
  const filteredAndSortedEntries = useMemo(() => {
    // Filter and sort individual entries (organizer IS the member)
    const filteredIndividual = entries.individual
      .filter((entry) => {
        if (!searchTerm) return true;
        const fullName =
          `${entry.organizer.firstName} ${entry.organizer.lastName}`.toLowerCase();
        return fullName.includes(searchTerm.toLowerCase());
      })
      .sort((a, b) => {
        const nameA =
          `${a.organizer.firstName} ${a.organizer.lastName}`.toLowerCase();
        const nameB =
          `${b.organizer.firstName} ${b.organizer.lastName}`.toLowerCase();
        return nameA.localeCompare(nameB);
      });

    // Filter and sort group entries (organizer IS the leader)
    const filteredGroups = entries.groups
      .filter((entry) => {
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();

        // Search in leader/organizer name
        const leaderName =
          `${entry.organizer.firstName} ${entry.organizer.lastName}`.toLowerCase();
        if (leaderName.includes(searchLower)) return true;

        // Search in group members if they exist
        if (entry.members && entry.members.length > 0) {
          return entry.members.some((member: any) => {
            const memberName =
              `${member.firstName} ${member.lastName}`.toLowerCase();
            return memberName.includes(searchLower);
          });
        }

        return false;
      })
      .sort((a, b) => {
        const nameA =
          `${a.organizer.firstName} ${a.organizer.lastName}`.toLowerCase();
        const nameB =
          `${b.organizer.firstName} ${b.organizer.lastName}`.toLowerCase();
        return nameA.localeCompare(nameB);
      });

    return {
      individual: filteredIndividual,
      groups: filteredGroups,
    };
  }, [entries, searchTerm]);

  const handleEditEntry = (entry: any, isGroup: boolean) => {
    setEditDialog({
      open: true,
      entry,
      isGroup,
    });
  };

  const handleCloseEdit = () => {
    setEditDialog({
      open: false,
      entry: null,
      isGroup: false,
    });
  };

  const handleCancelEntryClick = (entryId: number, isGroup: boolean) => {
    // Find the entry to get its name for the confirmation dialog
    let entryName = "";
    if (isGroup) {
      const groupEntry = entries.groups.find((g) => g.id === entryId);
      if (groupEntry) {
        entryName = `${groupEntry.organizer.firstName} ${groupEntry.organizer.lastName} (Group)`;
      }
    } else {
      const individualEntry = entries.individual.find((i) => i.id === entryId);
      if (individualEntry) {
        entryName = `${individualEntry.organizer.firstName} ${individualEntry.organizer.lastName}`;
      }
    }

    setConfirmCancelDialog({
      open: true,
      entryId,
      isGroup,
      entryName,
    });
  };

  const handleConfirmCancel = () => {
    if (confirmCancelDialog.entryId !== null) {
      onCancelEntry(confirmCancelDialog.entryId, confirmCancelDialog.isGroup);
    }
    setConfirmCancelDialog({
      open: false,
      entryId: null,
      isGroup: false,
      entryName: "",
    });
  };

  const handleCancelCancel = () => {
    setConfirmCancelDialog({
      open: false,
      entryId: null,
      isGroup: false,
      entryName: "",
    });
  };

  const totalEntries =
    filteredAndSortedEntries.individual.length +
    filteredAndSortedEntries.groups.length;

  return (
    <>
      <Card className="flex h-[800px] flex-col">
        <CardHeader className="flex-shrink-0">
          <CardTitle>All Lottery Entries</CardTitle>
          <div className="flex items-center gap-4">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search players..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="text-sm text-gray-600">
              {totalEntries} {totalEntries === 1 ? "entry" : "entries"}
              {searchTerm &&
                ` (filtered from ${entries.individual.length + entries.groups.length})`}
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Individual Entries Column */}
              <div>
                <LotteryIndividualEntriesList
                  entries={filteredAndSortedEntries.individual}
                  onCancelEntry={handleCancelEntryClick}
                  onEditEntry={(entry) => handleEditEntry(entry, false)}
                  getTimeWindowLabel={getTimeWindowLabel}
                />
              </div>

              {/* Group Entries Column */}
              <div>
                <LotteryGroupEntriesList
                  entries={filteredAndSortedEntries.groups}
                  onCancelEntry={handleCancelEntryClick}
                  onEditEntry={(entry) => handleEditEntry(entry, true)}
                  getTimeWindowLabel={getTimeWindowLabel}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <LotteryEditDialog
        open={editDialog.open}
        onClose={handleCloseEdit}
        entry={editDialog.entry}
        isGroup={editDialog.isGroup}
        members={members}
        config={config}
      />

      <ConfirmationDialog
        open={confirmCancelDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            handleCancelCancel();
          }
        }}
        onConfirm={handleConfirmCancel}
        title="Cancel Lottery Entry"
        description={`Are you sure you want to cancel the lottery entry for "${confirmCancelDialog.entryName}"? This action cannot be undone.`}
        confirmText="Cancel Entry"
        cancelText="Keep Entry"
        variant="destructive"
      />
    </>
  );
}
