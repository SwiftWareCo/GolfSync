"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Calendar, Users } from "lucide-react";
import { formatDate } from "~/lib/dates";
import { LotteryAllEntries } from "./LotteryAllEntries";
import { TeesheetPreviewAndArrange } from "./TeesheetPreviewAndArrange";
import { cancelLotteryEntry } from "~/server/lottery/actions";
import { toast } from "react-hot-toast";
import type {
  TeesheetConfigWithBlocks,
  TimeBlockWithRelations,
} from "~/server/db/schema";

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
}

export function LotteryResultsView({
  date,
  onComplete,
  members,
  initialLotteryEntries,
  config,
  teesheetData,
}: LotteryResultsViewProps) {
  const [activeTab, setActiveTab] = useState("preview");

  const getTimeWindowLabel = (window: string) => {
    // Simple mapping for common time windows
    const windowMap: Record<string, string> = {
      MORNING: "Morning",
      MIDDAY: "Midday",
      AFTERNOON: "Afternoon",
      EVENING: "Evening",
    };
    return windowMap[window] || window;
  };

  const handleCancelEntry = async (entryId: number, isGroup: boolean) => {
    try {
      const result = await cancelLotteryEntry(entryId);
      if (result.success) {
        toast.success("Entry cancelled successfully");
        onComplete(); // Refresh the data
      } else {
        toast.error(result.error || "Failed to cancel entry");
      }
    } catch (error) {
      toast.error("An error occurred while cancelling the entry");
    }
  };

  // If no teesheet data yet, show empty preview with entries tab
  const timeBlocks = teesheetData?.timeBlocks || [];
  const totalAssigned = teesheetData
    ? timeBlocks.reduce((sum, block) => sum + (block.members?.length || 0), 0)
    : (initialLotteryEntries?.individual?.length || 0) +
      (initialLotteryEntries?.groups?.length || 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">
            Lottery Results - {formatDate(date)}
          </h3>
          <p className="text-sm text-gray-600">
            {teesheetData
              ? "Bookings have been created. You can arrange the teesheet or view all entries."
              : "View lottery entries and preview. Process lottery to create teesheet bookings."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm">
            <span className="font-medium">{totalAssigned}</span>
            {teesheetData ? " bookings created" : " entries available"}
          </div>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="preview">
            <Calendar className="mr-2 h-4 w-4" />
            Preview & Arrange
          </TabsTrigger>
          <TabsTrigger value="entries">
            <Users className="mr-2 h-4 w-4" />
            All Entries
          </TabsTrigger>
        </TabsList>

        {/* Teesheet Preview & Arrangement Tab */}
        <TabsContent value="preview">
          {teesheetData ? (
            <TeesheetPreviewAndArrange
              date={date}
              timeBlocks={timeBlocks}
              teesheetId={teesheetData.teesheet.id}
              onTimeBlocksChange={() => {
                // Data will be refreshed when parent component reloads
                console.log("Teesheet changes saved");
              }}
              teesheetData={teesheetData}
              lotteryEntries={initialLotteryEntries}
              members={members}
            />
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="mb-4 text-gray-500">
                  No teesheet data available yet
                </p>
                <p className="text-sm text-gray-400">
                  Run the lottery processing to see teesheet preview
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* All Entries Tab */}
        <TabsContent value="entries">
          <LotteryAllEntries
            entries={initialLotteryEntries}
            onCancelEntry={handleCancelEntry}
            getTimeWindowLabel={getTimeWindowLabel}
            members={members}
            config={config}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
