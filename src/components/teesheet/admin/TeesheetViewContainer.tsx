"use client";

import { useState } from "react";
import { TeesheetTable } from "./TeesheetTable";
import { TwoDayView } from "./TwoDayView";
import { SidebarActions } from "./SidebarActions";
import { GeneralNotes } from "./GeneralNotes";
import { ConfigSummary } from "./ConfigSummary";
import { CalendarPicker } from "./CalendarPicker";
import type { Teesheet, TeesheetConfig, TeesheetConfigWithBlocks, ConfigBlock } from "~/server/db/schema";

interface TeesheetViewContainerProps {
  dateString: string;
  teesheet: Teesheet;
  config: TeesheetConfigWithBlocks | null;
  timeBlocks: any[];
  teesheetConfigs: TeesheetConfig[];
  occupiedSpots?: number;
  totalCapacity?: number;
}

export function TeesheetViewContainer({
  dateString,
  teesheet,
  config,
  timeBlocks,
  teesheetConfigs,
  occupiedSpots,
  totalCapacity,
}: TeesheetViewContainerProps) {
  const [isTwoDayViewOpen, setIsTwoDayViewOpen] = useState(false);

  return (
    <>
      {/* Sidebar */}
      <SidebarActions
        teesheet={teesheet}
        dateString={dateString}
        config={config}
        timeBlocks={timeBlocks}
        availableConfigs={teesheetConfigs}
        isTwoDayViewOpen={isTwoDayViewOpen}
        onTwoDayViewToggle={setIsTwoDayViewOpen}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 p-6">
          {/* Config & Calendar Section */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-4">
            <ConfigSummary
              config={config}
              dateString={dateString}
              occupiedSpots={occupiedSpots}
              totalCapacity={totalCapacity}
            />
            <CalendarPicker dateString={dateString} />
          </div>

          {isTwoDayViewOpen ? (
            <div className="h-[calc(100vh-12rem)]">
              <TwoDayView currentDateString={dateString} />
            </div>
          ) : (
            <div className="space-y-4">
              <GeneralNotes teesheet={teesheet} />
              <TeesheetTable dateString={dateString} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
