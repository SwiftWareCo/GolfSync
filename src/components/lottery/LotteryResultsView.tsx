"use client";

import { useState, useCallback } from "react";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Calendar, Play, Sliders } from "lucide-react";
import { formatDate } from "~/lib/dates";
import { UnassignedEntriesSidebar } from "./UnassignedEntriesSidebar";
import { TeesheetPreviewAndArrange } from "./TeesheetPreviewAndArrange";
import { LotteryAlgorithmSettingsDialog } from "./LotteryAlgorithmSettingsDialog";
import {
  cancelLotteryEntry,
  processLotteryForDate,
} from "~/server/lottery/actions";
import { toast } from "react-hot-toast";
import type {
  TeesheetConfigWithBlocks,
  TimeBlockWithRelations,
  LotteryAlgorithmConfigFormData,
} from "~/server/db/schema";

interface LotteryStats {
  totalEntries: number;
  individualEntries: number;
  groupEntries: number;
  totalPlayers: number;
  availableSlots: number;
  processingStatus: "pending" | "processing" | "completed";
}

interface LotteryResultsViewProps {
  date: string;
  onComplete: () => void;
  members: Array<{
    id: number;
    firstName: string;
    lastName: string;
    class: string;
  }>;
  initialLotteryEntries: any;
  config: TeesheetConfigWithBlocks;
  teesheetData: {
    teesheet: any;
    config: any;
    timeBlocks: TimeBlockWithRelations[];
    availableConfigs: any[];
    paceOfPlayData: any[];
    lotterySettings?: any;
    date: string;
  } | null;
  stats?: LotteryStats;
  algorithmConfig?: LotteryAlgorithmConfigFormData;
}

export function LotteryResultsView({
  date,
  onComplete,
  members,
  initialLotteryEntries,
  config,
  teesheetData,
  stats,
  algorithmConfig,
}: LotteryResultsViewProps) {
  // Selection state for sidebar -> teesheet interaction
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  const handleEntrySelect = useCallback((entryId: string, isGroup: boolean) => {
    setSelectedEntryId((prev) => (prev === entryId ? null : entryId));
  }, []);

  const handleCancelEntry = async (entryId: number, isGroup: boolean) => {
    try {
      const result = await cancelLotteryEntry(entryId);
      if (result.success) {
        toast.success("Entry cancelled successfully");
        onComplete();
      } else {
        toast.error(result.error || "Failed to cancel entry");
      }
    } catch (error) {
      toast.error("An error occurred while cancelling the entry");
    }
  };

  const handleEntryUpdated = () => {
    // Data refresh happens via revalidatePath in the update action
    // No need to call onComplete() which would show the "finalized" toast
  };

  const handleProcessLottery = async () => {
    if (!config) {
      toast.error("No teesheet config available");
      return;
    }

    setIsProcessing(true);
    try {
      const result = await processLotteryForDate(date, config);
      if (result.success && result.data) {
        const data = result.data as {
          processedCount: number;
          totalEntries: number;
          bookingsCreated: number;
        };
        toast.success(
          `Lottery processed! ${data.processedCount}/${data.totalEntries} entries processed, ${data.bookingsCreated} bookings created.`,
        );
        onComplete();
      } else {
        toast.error(result.error || "Failed to process lottery");
      }
    } catch (error) {
      toast.error("An error occurred while processing the lottery");
    } finally {
      setIsProcessing(false);
    }
  };

  const timeBlocks = teesheetData?.timeBlocks || [];
  const canProcess =
    stats?.processingStatus === "pending" && (stats?.totalEntries || 0) > 0;

  return (
    <div className="space-y-4">
      {/* Two-Column Layout */}
      <div className="flex gap-4">
        {/* Left Column - Unassigned Entries Sidebar (30%) */}
        <div className="w-[30%] flex-shrink-0">
          <UnassignedEntriesSidebar
            groups={initialLotteryEntries?.groups || []}
            individuals={initialLotteryEntries?.individual || []}
            selectedEntryId={selectedEntryId}
            onEntrySelect={handleEntrySelect}
            onDeleteEntry={handleCancelEntry}
            onEntryUpdated={handleEntryUpdated}
            members={members}
            config={config}
          />
        </div>

        {/* Right Column - Teesheet Preview (70%) */}
        <div className="flex-1">
          {teesheetData ? (
            <TeesheetPreviewAndArrange
              date={date}
              timeBlocks={timeBlocks}
              teesheetId={teesheetData.teesheet.id}
              onTimeBlocksChange={() => {
                console.log("Teesheet changes saved");
              }}
              teesheetData={teesheetData}
              lotteryEntries={initialLotteryEntries}
              members={members}
              selectedEntryId={selectedEntryId}
              onEntryClick={(entryId) => setSelectedEntryId(entryId)}
              // Processing controls
              stats={stats}
              onProcessLottery={handleProcessLottery}
              isProcessing={isProcessing}
              canProcess={canProcess}
              onOpenAlgorithmSettings={() => setSettingsDialogOpen(true)}
            />
          ) : (
            <Card className="h-[calc(100vh-280px)]">
              <CardContent className="flex h-full items-center justify-center">
                <div className="text-center">
                  <Calendar className="mx-auto mb-4 h-12 w-12 text-gray-300" />
                  <p className="mb-2 text-gray-500">
                    No teesheet data available yet
                  </p>
                  <p className="text-sm text-gray-400">
                    Run the lottery processing to see teesheet preview
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Algorithm Settings Dialog */}
      {algorithmConfig && (
        <LotteryAlgorithmSettingsDialog
          isOpen={settingsDialogOpen}
          onClose={() => setSettingsDialogOpen(false)}
          initialData={algorithmConfig}
        />
      )}
    </div>
  );
}
