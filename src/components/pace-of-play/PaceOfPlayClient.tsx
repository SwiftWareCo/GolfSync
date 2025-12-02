"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "~/components/ui/calendar";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";
import { PaceOfPlayCard } from "~/components/pace-of-play/PaceOfPlayCard";
import { PaceOfPlayUpdateModal } from "~/components/pace-of-play/PaceOfPlayUpdateModal";
import { type TimeBlockWithPaceOfPlay } from "~/server/pace-of-play/data";
import { useUser } from "@clerk/nextjs";

interface PaceOfPlayClientProps {
  initialTimeBlocks: TimeBlockWithPaceOfPlay[];
  initialDate: Date;
  onDateChange: (date: Date) => Promise<TimeBlockWithPaceOfPlay[]>;
}

export function PaceOfPlayClient({
  initialTimeBlocks,
  initialDate,
  onDateChange,
}: PaceOfPlayClientProps) {
  const { user } = useUser();
  const [date, setDate] = useState<Date>(initialDate);
  const [timeBlocks, setTimeBlocks] =
    useState<TimeBlockWithPaceOfPlay[]>(initialTimeBlocks);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTimeBlock, setSelectedTimeBlock] =
    useState<TimeBlockWithPaceOfPlay | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"turn" | "finish">("turn");

  const formatDate = (date: Date) => {
    return format(date, "PPP");
  };

  const loadTimeBlocks = async (selectedDate: Date) => {
    setIsLoading(true);
    try {
      const result = await onDateChange(selectedDate);
      setTimeBlocks(result);
    } catch (error) {
      console.error("Error loading pace of play data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      setDate(selectedDate);
      void loadTimeBlocks(selectedDate);
    }
  };

  const handleUpdateTurn = (timeBlock: TimeBlockWithPaceOfPlay) => {
    setSelectedTimeBlock(timeBlock);
    setModalMode("turn");
    setIsModalOpen(true);
  };

  const handleUpdateFinish = (timeBlock: TimeBlockWithPaceOfPlay) => {
    setSelectedTimeBlock(timeBlock);
    setModalMode("finish");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedTimeBlock(null);
    void loadTimeBlocks(date);
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pace of Play</h1>
        <div className="flex items-center gap-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("w-[200px] justify-start text-left font-normal")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formatDate(date)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                selected={date}
                onSelect={handleDateSelect}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Button onClick={() => loadTimeBlocks(date)}>Refresh</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <p className="col-span-full text-center">
            Loading pace of play data...
          </p>
        ) : timeBlocks.length === 0 ? (
          <p className="col-span-full text-center">
            No tee times found for this date.
          </p>
        ) : (
          timeBlocks.map((timeBlock) => (
            <PaceOfPlayCard
              key={timeBlock.id}
              timeBlock={timeBlock}
              onUpdateTurn={() => handleUpdateTurn(timeBlock)}
              onUpdateFinish={() => handleUpdateFinish(timeBlock)}
              showTurnButton={
                timeBlock.paceOfPlay?.startTime !== null &&
                timeBlock.paceOfPlay?.turn9Time === null
              }
              showFinishButton={
                timeBlock.paceOfPlay?.turn9Time !== null &&
                timeBlock.paceOfPlay?.finishTime === null
              }
            />
          ))
        )}
      </div>

      <PaceOfPlayUpdateModal
        timeBlock={selectedTimeBlock}
        isOpen={isModalOpen}
        onClose={closeModal}
        mode={modalMode}
        userName={user?.fullName || user?.username || "Admin"}
      />
    </div>
  );
}
