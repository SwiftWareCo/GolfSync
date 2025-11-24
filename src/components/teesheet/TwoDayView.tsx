"use client";

import { addDays } from "date-fns";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useQuery } from "@tanstack/react-query";
import { useTeesheetMutations } from "~/hooks/useTeesheetMutations";
import { TeesheetView } from "./TeesheetView";
import { MutationProvider } from "~/hooks/useMutationContext";
import { formatDate, getBCToday, parseDate } from "~/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { useEffect, useState, useMemo, memo } from "react";
import { GripVertical, Calendar, CalendarDays } from "lucide-react";

interface TwoDayViewProps {
  currentDate: Date;
  initialData: {
    teesheet: any;
    config: any;
    timeBlocks: any[];
    availableConfigs: any[];
    paceOfPlayData: any[];
  };
  isAdmin?: boolean;
}

// Memoized TeesheetView wrapper to prevent unnecessary re-renders during panel resize
const MemoizedTeesheetView = memo(
  function MemoizedTeesheetView({
    teesheet,
    timeBlocks,
    availableConfigs,
    paceOfPlayData,
    isAdmin,
    mutations,
  }: {
    teesheet: any;
    timeBlocks: any[];
    availableConfigs: any[];
    paceOfPlayData: any[];
    isAdmin: boolean;
    mutations: any;
  }) {
    return (
      <MutationProvider mutations={mutations}>
        <TeesheetView
          teesheet={teesheet}
          timeBlocks={timeBlocks}
          availableConfigs={availableConfigs}
          paceOfPlayData={paceOfPlayData}
          isAdmin={isAdmin}
          mutations={mutations}
        />
      </MutationProvider>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison to prevent re-renders during panel resize
    // Only re-render if the actual data changes, not the mutations object reference
    return (
      prevProps.teesheet?.id === nextProps.teesheet?.id &&
      prevProps.timeBlocks?.length === nextProps.timeBlocks?.length &&
      prevProps.isAdmin === nextProps.isAdmin &&
      JSON.stringify(prevProps.timeBlocks) ===
        JSON.stringify(nextProps.timeBlocks)
    );
  },
);

export function TwoDayView({
  currentDate,
  initialData,
  isAdmin = true,
}: TwoDayViewProps) {
  const nextDate = addDays(currentDate, 1);

  // Fetch data for both days using TanStack Query
  const currentDateString = formatDate(currentDate, "yyyy-MM-dd");
  const nextDateString = formatDate(nextDate, "yyyy-MM-dd");

  const currentDayQuery = useQuery(teesheetQueryOptions.byDate(currentDateString));
  const nextDayQuery = useQuery(teesheetQueryOptions.byDate(nextDateString));

  // Get mutations for both days
  const { mutations: currentDayMutations } = useTeesheetMutations(currentDate);
  const { mutations: nextDayMutations } = useTeesheetMutations(nextDate);

  // Extract data, error, and loading states
  const currentDayData = currentDayQuery.data;
  const currentDayError = currentDayQuery.error;
  const currentDayLoading = currentDayQuery.isLoading;

  const nextDayData = nextDayQuery.data;
  const nextDayError = nextDayQuery.error;
  const nextDayLoading = nextDayQuery.isLoading;

  // Use TanStack Query data if available, otherwise fall back to initial data for current day
  const displayCurrentData = currentDayData || initialData;

  // Panel sizes from localStorage
  const [panelSizes, setPanelSizes] = useState([50, 50]);

  // Load saved panel sizes on mount
  useEffect(() => {
    const saved = localStorage.getItem("twoday-panel-sizes");
    if (saved) {
      try {
        const sizes = JSON.parse(saved);
        setPanelSizes(sizes);
      } catch (e) {
        // Ignore parsing errors, use defaults
      }
    }
  }, []);

  // Debounced panel resize handler to improve performance and prevent SWR re-fetches
  const handlePanelResize = useMemo(() => {
    let timeoutId: NodeJS.Timeout;

    return (sizes: number[]) => {
      // Update panel sizes immediately for responsive UI
      setPanelSizes(sizes);

      // Debounce localStorage saves to reduce writes during drag
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        try {
          localStorage.setItem("twoday-panel-sizes", JSON.stringify(sizes));
        } catch (error) {
          // Silently handle localStorage errors
          console.warn("Failed to save panel sizes to localStorage:", error);
        }
      }, 250); // Increased debounce time to reduce frequency
    };
  }, []);

  const formatDayTitle = useMemo(() => {
    return (date: Date) => {
      const todayString = getBCToday();
      const tomorrowString = formatDate(
        addDays(parseDate(todayString), 1),
        "yyyy-MM-dd",
      );
      const dateString = formatDate(date, "yyyy-MM-dd");

      if (dateString === todayString) {
        return `Today - ${formatDate(date)}`;
      } else if (dateString === tomorrowString) {
        return `Tomorrow - ${formatDate(date)}`;
      } else {
        return formatDate(date);
      }
    };
  }, []);

  if (currentDayError && nextDayError) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-500">
              Failed to load teesheet data for both days
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-12rem)] w-full">
      <PanelGroup
        direction="horizontal"
        onLayout={handlePanelResize}
        className="gap-2"
        // Performance optimizations for smooth dragging
        autoSaveId="two-day-panels"
      >
        {/* Current Day Panel */}
        <Panel
          defaultSize={panelSizes[0]}
          minSize={30}
          className="relative"
          // Add id for better performance
          id="current-day-panel"
        >
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-5 w-5" />
                {formatDayTitle(currentDate)}
                {currentDayLoading && (
                  <span className="text-sm text-gray-500">(Loading...)</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="relative h-[calc(100%-4rem)] overflow-auto">
              {currentDayError ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-red-500">
                    Failed to load data for {formatDate(currentDate)}
                  </p>
                </div>
              ) : (
                <>
                  {/* Loading overlay for current day */}
                  {currentDayLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
                      <div className="text-sm text-gray-600">
                        Loading teesheet...
                      </div>
                    </div>
                  )}

                  <MemoizedTeesheetView
                    teesheet={displayCurrentData.teesheet}
                    timeBlocks={displayCurrentData.timeBlocks}
                    availableConfigs={displayCurrentData.availableConfigs}
                    paceOfPlayData={displayCurrentData.paceOfPlayData}
                    isAdmin={isAdmin}
                    mutations={currentDayMutations}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </Panel>

        {/* Resize Handle - Optimized for smooth dragging */}
        <PanelResizeHandle className="group flex w-2 items-center justify-center rounded-sm bg-gray-200 transition-colors hover:bg-blue-300 data-[resize-handle-active]:bg-blue-400">
          <div className="flex flex-col gap-1 group-hover:text-blue-600 data-[resize-handle-active]:text-blue-700">
            <GripVertical className="h-4 w-4" />
          </div>
        </PanelResizeHandle>

        {/* Next Day Panel */}
        <Panel
          defaultSize={panelSizes[1]}
          minSize={30}
          className="relative"
          // Add id for better performance
          id="next-day-panel"
        >
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarDays className="h-5 w-5" />
                {formatDayTitle(nextDate)}
                {nextDayLoading && (
                  <span className="text-sm text-gray-500">(Loading...)</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="relative h-[calc(100%-4rem)] overflow-auto">
              {nextDayError ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-red-500">
                    Failed to load data for {formatDate(nextDate)}
                  </p>
                </div>
              ) : nextDayData ? (
                <>
                  {/* Loading overlay for next day */}
                  {nextDayLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
                      <div className="text-sm text-gray-600">
                        Loading teesheet...
                      </div>
                    </div>
                  )}

                  <MemoizedTeesheetView
                    teesheet={nextDayData.teesheet}
                    timeBlocks={nextDayData.timeBlocks}
                    availableConfigs={nextDayData.availableConfigs}
                    paceOfPlayData={nextDayData.paceOfPlayData}
                    isAdmin={isAdmin}
                    mutations={nextDayMutations}
                  />
                </>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center text-gray-500">
                    <CalendarDays className="mx-auto mb-2 h-8 w-8" />
                    <p>Loading {formatDate(nextDate)}...</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </Panel>
      </PanelGroup>
    </div>
  );
}
