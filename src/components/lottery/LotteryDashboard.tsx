"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Settings, Sliders } from "lucide-react";
import { LotteryProcessor } from "./LotteryProcessor";
import { LotteryResultsView } from "./LotteryResultsView";
import { LotteryAlgorithmSettingsDialog } from "./LotteryAlgorithmSettingsDialog";
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

type LotteryStatus = "setup" | "active" | "closed";

interface LotteryDashboardProps {
  date: string;
  status: LotteryStatus;
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
  initialTimeBlocks: any;
  config: TeesheetConfigWithBlocks | null;
  restrictions: any[];
  algorithmConfig: LotteryAlgorithmConfigFormData;
  teesheetData: {
    teesheet: any;
    config: any;
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
  status,
  members,
  initialStats,
  initialLotteryEntries,
  initialTimeBlocks,
  config,
  restrictions,
  algorithmConfig,
  teesheetData,
}: LotteryDashboardProps) {
  const [stats, setStats] = useState<LotteryStats>(initialStats);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingTest, setIsCreatingTest] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [processingExpanded, setProcessingExpanded] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
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

  const handleProcessComplete = () => {
    // Stats will update via prop changes from server
    // Collapse processing section after completion
    setProcessingExpanded(false);
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
    <div className="space-y-6">
      {/* Debug Controls - Available in production for now */}
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <CardTitle className="text-orange-800">Lottery Controls</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Button
            onClick={handleCreateTestEntries}
            disabled={isCreatingTest}
            variant="outline"
            className="border-orange-300 text-orange-700 hover:bg-orange-100"
          >
            {isCreatingTest ? "Creating..." : "Create Test Entries"}
          </Button>
          <Button
            onClick={handleClearEntries}
            disabled={isClearing}
            variant="outline"
            className="border-red-300 text-red-700 hover:bg-red-100"
          >
            {isClearing ? "Clearing..." : "Clear All Entries"}
          </Button>
        </CardContent>
      </Card>

      {/* Processing Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Lottery Processing
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{stats.totalEntries} entries</Badge>
                <Badge variant="secondary">{stats.totalPlayers} players</Badge>
                <Badge
                  variant={
                    stats.processingStatus === "pending"
                      ? "destructive"
                      : "outline"
                  }
                >
                  {stats.processingStatus}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSettingsDialogOpen(true)}
              >
                <Sliders className="mr-2 h-4 w-4" />
                Algorithm Settings
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setProcessingExpanded(!processingExpanded)}
              >
                {processingExpanded ? "Collapse" : "Expand"}
              </Button>
            </div>
          </div>
        </CardHeader>
        {processingExpanded && config && (
          <CardContent>
            <LotteryProcessor
              date={date}
              stats={stats}
              onProcessComplete={handleProcessComplete}
              config={config}
            />
          </CardContent>
        )}
      </Card>

      {/* Lottery Results - always show for preview and arrangement */}
      {config && (
        <LotteryResultsView
          date={date}
          onComplete={handleConfirmationComplete}
          members={members}
          initialLotteryEntries={initialLotteryEntries}
          config={config}
          teesheetData={teesheetData}
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
    </div>
  );
}
