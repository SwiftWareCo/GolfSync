"use client";

import { useState } from "react";
import { LotterySettingsType } from "~/server/db/schema";
import { Button } from "~/components/ui/button";
import { CalendarDays, Zap, BaggageClaim, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { BagReportDialog } from "~/components/settings/teesheet/BagReportDialog";
import { TeesheetSettings } from "~/components/settings/teesheet/TeesheetSettings";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import type { Template } from "~/app/types/TeeSheetTypes";
import type { TeesheetConfig } from "~/server/db/schema";

interface ActionButtonsRowProps {
  teesheetId: number;
  lotterySettings: LotterySettingsType | null;
  timeBlocks: any[];
  config: TeesheetConfig;
  availableConfigs: TeesheetConfig[];
  templates: Template[];
}

export function ActionButtonsRow({
  teesheetId,
  lotterySettings,
  timeBlocks,
  config,
  availableConfigs,
  templates,
}: ActionButtonsRowProps) {
  const router = useRouter();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBagReportOpen, setIsBagReportOpen] = useState(false);

  const handleTwoDayView = () => {
    // TODO: Implement two-day view logic
    console.log("Two-day view");
  };

  const handleAutoPopulate = () => {
    // TODO: Implement auto-populate
    console.log("Auto-populate");
  };

  const handleSettings = () => {
    setIsSettingsOpen(true);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleTwoDayView}
          className="shadow-sm transition-all"
        >
          <CalendarDays className="mr-2 h-4 w-4" />
          Two Days
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleAutoPopulate}
          className="shadow-sm transition-all"
        >
          <Zap className="mr-2 h-4 w-4" />
          Auto-Populate
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsBagReportOpen(true)}
          className="shadow-sm transition-all"
        >
          <BaggageClaim className="mr-2 h-4 w-4" />
          Bag Report
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleSettings}
          className="ml-auto shadow-sm transition-all"
        >
          <Settings className="mr-2 h-4 w-4" />
          Teesheet Settings
        </Button>
      </div>

      {/* Teesheet Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-h-[80vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Teesheet Settings</DialogTitle>
          </DialogHeader>
          <TeesheetSettings
            initialConfigs={availableConfigs}
            templates={templates}
          />
        </DialogContent>
      </Dialog>

      <BagReportDialog
        timeBlocks={timeBlocks}
        open={isBagReportOpen}
        onOpenChange={setIsBagReportOpen}
      />
    </>
  );
}
