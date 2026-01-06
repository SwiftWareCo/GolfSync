"use client";

import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Sliders, Upload } from "lucide-react";
import { LotteryResultsView } from "./LotteryResultsView";
import { LotteryAlgorithmSettingsDialog } from "./LotteryAlgorithmSettingsDialog";
import { ImportLegacyEntriesDialog } from "./ImportLegacyEntriesDialog";
import { ConfirmationDialog } from "~/components/ui/confirmation-dialog";
import type {
  TeesheetConfigWithBlocks,
  LotteryAlgorithmConfigFormData,
} from "~/server/db/schema";

import {
  createTestLotteryEntries,
  clearLotteryEntriesForDate,
} from "~/server/lottery/actions";
import { toast } from "react-hot-toast";

interface LotteryDashboardProps {
  date: string;
  members: Array<{
    id: number;
    firstName: string;
    lastName: string;
    class: string;
  }>;
  initialStats: {
    totalEntries: number;
    individualEntries: number;
    groupEntries: number;
    totalPlayers: number;
    availableSlots: number;
    processingStatus: "pending" | "processing" | "completed";
  };
  initialLotteryEntries: any;
  algorithmConfig: LotteryAlgorithmConfigFormData;
  teesheetData: {
    teesheet: any;
    config: TeesheetConfigWithBlocks | null;
    timeBlocks: any[];
    availableConfigs: any[];
    paceOfPlayData: any[];
    lotterySettings?: any;
    date: string;
  } | null;
}

interface LotteryStats {
  totalEntries: number;
  individualEntries: number;
  groupEntries: number;
  totalPlayers: number;
  availableSlots: number;
  processingStatus: "pending" | "processing" | "completed";
}

interface ConfirmDialogState {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
  variant?: "default" | "destructive";
}

export function LotteryDashboard({
  date,
  members,
  initialStats,
  initialLotteryEntries,
  algorithmConfig,
  teesheetData,
}: LotteryDashboardProps) {
  // Use the config assigned to the teesheet
  const config = teesheetData?.config ?? null;
  const [stats, setStats] = useState<LotteryStats>(initialStats);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingTest, setIsCreatingTest] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    open: false,
    title: "",
    description: "",
    onConfirm: () => {},
    variant: "default",
  });

  const handleCreateTestEntries = async () => {
    setIsCreatingTest(true);
    try {
      const result = await createTestLotteryEntries(date);
      if (result.success && result.data) {
        const data = result.data as {
          createdEntries: number;
          createdGroups: number;
          totalPlayers: number;
        };
        toast.success(
          `Created ${data.createdEntries} individual entries and ${data.createdGroups} group entries (${data.totalPlayers} total players)`,
        );
        // Stats will update via prop changes from server
      } else {
        toast.error(result.error || "Failed to create test entries");
      }
    } catch (error) {
      toast.error("An error occurred while creating test entries");
    } finally {
      setIsCreatingTest(false);
    }
  };

  const handleClearEntries = async () => {
    setConfirmDialog({
      open: true,
      title: "Clear All Entries",
      description:
        "Are you sure you want to clear ALL lottery entries for this date? This cannot be undone.",
      variant: "destructive",
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, open: false }));
        setIsClearing(true);
        try {
          const result = await clearLotteryEntriesForDate(date);
          if (result.success && result.data) {
            const data = result.data as { deletedEntries: number };
            toast.success(`Cleared ${data.deletedEntries} entries`);
            // Stats will update via prop changes from server
          } else {
            toast.error(result.error || "Failed to clear entries");
          }
        } catch (error) {
          toast.error("An error occurred while clearing entries");
        } finally {
          setIsClearing(false);
        }
      },
    });
  };

  const handleConfirmationComplete = () => {
    toast.success("Lottery results finalized successfully!");
    // Stats will update via prop changes from server
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="border-org-primary h-8 w-8 animate-spin rounded-full border-b-2"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Testing Controls - Compact bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-orange-800">
            🧪 Testing
          </span>
          <Button
            onClick={() => setImportDialogOpen(true)}
            variant="outline"
            size="sm"
            className="border-blue-300 text-blue-700 hover:bg-blue-100"
          >
            <Upload className="mr-1 h-3 w-3" />
            Import
          </Button>
          <Button
            onClick={handleCreateTestEntries}
            disabled={isCreatingTest}
            variant="outline"
            size="sm"
            className="border-orange-300 text-orange-700 hover:bg-orange-100"
          >
            {isCreatingTest ? "Creating..." : "Add Test Data"}
          </Button>
          <Button
            onClick={handleClearEntries}
            disabled={isClearing}
            variant="outline"
            size="sm"
            className="border-red-300 text-red-700 hover:bg-red-100"
          >
            {isClearing ? "Clearing..." : "Clear All"}
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{stats.totalEntries} entries</Badge>
          <Badge variant="secondary">{stats.totalPlayers} players</Badge>
          <Badge
            variant={
              stats.processingStatus === "pending" ? "destructive" : "outline"
            }
          >
            {stats.processingStatus}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSettingsDialogOpen(true)}
          >
            <Sliders className="mr-1 h-3 w-3" />
            Algorithm
          </Button>
        </div>
      </div>

      {/* Lottery Results - Full width */}
      {config && (
        <LotteryResultsView
          date={date}
          onComplete={handleConfirmationComplete}
          members={members}
          initialLotteryEntries={initialLotteryEntries}
          config={config}
          teesheetData={teesheetData}
          stats={stats}
          algorithmConfig={algorithmConfig}
        />
      )}

      <ConfirmationDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant={confirmDialog.variant}
      />

      {/* Algorithm Settings Dialog */}
      <LotteryAlgorithmSettingsDialog
        isOpen={settingsDialogOpen}
        onClose={() => setSettingsDialogOpen(false)}
        initialData={algorithmConfig}
      />

      {/* Import Legacy Entries Dialog */}
      <ImportLegacyEntriesDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        lotteryDate={date}
        members={members.map((m) => ({
          id: m.id,
          firstName: m.firstName,
          lastName: m.lastName,
        }))}
        availableConfigs={teesheetData?.availableConfigs ?? []}
        currentConfig={config}
      />
    </div>
  );
}
