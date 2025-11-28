"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import {
  Home,
  Dices,
  Plus,
  Activity,
  CheckCircle2,
  CalendarDays,
  Zap,
  BaggageClaim,
  Settings,
} from "lucide-react";
import { getBCToday } from "~/lib/dates";

import { BagReportDialog } from "~/components/settings/teesheet/BagReportDialog";
import type {
  TeesheetConfig,
  TeesheetConfigWithBlocks,
} from "~/server/db/schema";
import { TeesheetSettingsModal } from "../TeesheetSettingsModal";
import type { Teesheet } from "~/server/db/schema";
import { AdminLotteryEntryModal } from "~/components/lottery/AdminLotteryEntryModal";
import { usePopulateTeesheet } from "~/services/teesheet/hooks";

interface SidebarActionsProps {
  teesheet: Teesheet;
  dateString: string;
  config: TeesheetConfigWithBlocks | null;
  timeBlocks: any[];
  availableConfigs: TeesheetConfig[];
}

export function SidebarActions({
  teesheet,
  dateString,
  config,
  timeBlocks,
  availableConfigs,
}: SidebarActionsProps) {
  const router = useRouter();
  const today = getBCToday();

  // Dialog states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBagReportOpen, setIsBagReportOpen] = useState(false);
  const [isLotteryEntryModalOpen, setIsLotteryEntryModalOpen] = useState(false);

  const populateMutation = usePopulateTeesheet();

  const handleReturnToToday = () => {
    router.push(`/admin/${today}`);
  };

  const handleSetupLottery = () => {
    router.push(`/admin/lottery/${dateString}`);
  };

  const handleCreateEntry = () => {
    setIsLotteryEntryModalOpen(true);
  };

  const handleTurnCheckIn = () => {
    router.push(`/admin/pace-of-play/turn?date=${dateString}`);
  };

  const handleFinishCheckIn = () => {
    router.push(`/admin/pace-of-play/finish?date=${dateString}`);
  };

  const handleTwoDayView = () => {
    // TODO: Implement two-day view logic
    console.log("Two-day view");
  };

  const handleAutoPopulate = async () => {
    populateMutation.mutate({ teesheetId: teesheet.id, date: dateString });
  };

  const handleSettings = () => {
    setIsSettingsOpen(true);
  };

  const buttonLabelClasses =
    "text-sm font-medium opacity-0 max-w-0 overflow-hidden whitespace-nowrap transition-all duration-200 group-hover:opacity-100 group-hover:max-w-xs group-hover:ml-2";

  const sidebarButtonClasses =
    "w-full hover:bg-org-primary! hover:text-white! h-10 flex items-center justify-center rounded-md text-gray-600 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-org-primary focus-visible:ring-offset-2 overflow-hidden px-0 group-hover:justify-start group-hover:px-3 ";

  return (
    <>
      {/* Sidebar */}
      <div className="group border-org-primary sticky top-6 mt-6 flex h-fit w-14 flex-col items-stretch gap-1 rounded-lg border bg-white p-2 transition-all duration-300 hover:w-48 hover:rounded-l-lg hover:rounded-r-none">
        {/* Return to Today - Top */}
        <Button
          variant="ghost"
          onClick={handleReturnToToday}
          title="Return to Today"
          className={sidebarButtonClasses}
        >
          <Home className="h-5 w-5 shrink-0" />
          <span className={buttonLabelClasses}>Today</span>
        </Button>

        <div className="border-org-primary/20 w-full border-b" />

        {/* Setup Lottery */}
        <Button
          variant="ghost"
          onClick={handleSetupLottery}
          title="Setup Lottery"
          className={sidebarButtonClasses}
        >
          <Dices className="h-5 w-5 shrink-0" />
          <span className={buttonLabelClasses}>Lottery</span>
        </Button>

        {/* Create Entry */}
        <Button
          variant="ghost"
          onClick={handleCreateEntry}
          title="Create Entry"
          className={sidebarButtonClasses}
        >
          <Plus className="h-5 w-5 shrink-0" />
          <span className={buttonLabelClasses}>Entry</span>
        </Button>

        {/* Turn Check-in */}
        <Button
          variant="ghost"
          onClick={handleTurnCheckIn}
          title="Turn Check-in"
          className={sidebarButtonClasses}
        >
          <Activity className="h-5 w-5 shrink-0" />
          <span className={buttonLabelClasses}>Turn</span>
        </Button>

        {/* Finish Check-in */}
        <Button
          variant="ghost"
          onClick={handleFinishCheckIn}
          title="Finish Check-in"
          className={sidebarButtonClasses}
        >
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span className={buttonLabelClasses}>Finish</span>
        </Button>

        <div className="border-org-primary/20 w-full border-b" />

        {/* Two Days */}
        <Button
          variant="ghost"
          onClick={handleTwoDayView}
          title="Two Days"
          className={sidebarButtonClasses}
        >
          <CalendarDays className="h-5 w-5 shrink-0" />
          <span className={buttonLabelClasses}>Two Days</span>
        </Button>

        {/* Auto-Populate */}
        <Button
          variant="ghost"
          onClick={handleAutoPopulate}
          title="Auto-Populate"
          className={sidebarButtonClasses}
          disabled={populateMutation.isPending}
        >
          <Zap className="h-5 w-5 shrink-0" />
          <span className={buttonLabelClasses}>
            {populateMutation.isPending ? "Populating..." : "Auto"}
          </span>
        </Button>

        {/* Bag Report */}
        <Button
          variant="ghost"
          onClick={() => setIsBagReportOpen(true)}
          title="Bag Report"
          className={sidebarButtonClasses}
        >
          <BaggageClaim className="h-5 w-5 shrink-0" />
          <span className={buttonLabelClasses}>Bag Report</span>
        </Button>

        {/* Teesheet Settings */}
        <Button
          variant="ghost"
          onClick={handleSettings}
          title="Teesheet Settings"
          className={sidebarButtonClasses}
        >
          <Settings className="h-5 w-5 shrink-0" />
          <span className={buttonLabelClasses}>Settings</span>
        </Button>
      </div>

      {/* Teesheet Settings Modal */}
      <TeesheetSettingsModal
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        teesheet={teesheet}
        timeBlocks={timeBlocks}
        availableConfigs={availableConfigs}
      />

      <AdminLotteryEntryModal
        open={isLotteryEntryModalOpen}
        onOpenChange={setIsLotteryEntryModalOpen}
        teesheet={teesheet}
        config={config}
      />

      <BagReportDialog
        timeBlocks={timeBlocks}
        open={isBagReportOpen}
        onOpenChange={setIsBagReportOpen}
      />
    </>
  );
}
