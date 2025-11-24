"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Card, CardContent } from "~/components/ui/card";
import { Calendar, Clock, User, Filter } from "lucide-react";
import { formatDateStringToWords, formatTimeString } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

export interface BookingHistoryItem {
  id: number;
  date: string;
  time?: string;
  timeBlockId: number;
  createdAt: Date | string;
  invitedBy?: string;
  invitedByMemberId?: number;
}

interface BookingHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  fetchHistory: (
    year?: number,
    month?: number,
  ) => Promise<BookingHistoryItem[]>;
  entityName: string;
}

export function BookingHistoryDialog({
  isOpen,
  onClose,
  title,
  fetchHistory,
  entityName,
}: BookingHistoryDialogProps) {
  const [history, setHistory] = useState<BookingHistoryItem[]>([]);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>("current");

  useEffect(() => {
    if (isOpen) {
      loadAvailableMonths();
    }
  }, [isOpen]);

  const loadAvailableMonths = async () => {
    setIsLoading(true);
    try {
      // Fetch current month data first to get available months
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth();

      const currentMonthData = await fetchHistory(currentYear, currentMonth);

      // Generate available months (current month + last 12 months)
      const months: string[] = [];
      for (let i = 0; i < 12; i++) {
        const monthDate = new Date(currentYear, currentMonth - i, 1);
        const monthKey = `${monthDate.getFullYear()}-${monthDate.getMonth()}`;
        months.push(monthKey);
      }

      setAvailableMonths(months);
      setHistory(currentMonthData);
      setSelectedMonth("current");
    } catch (error) {
      console.error("Error loading available months:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load history when month selection changes
  useEffect(() => {
    if (!isOpen || !selectedMonth) return;

    const loadMonthHistory = async () => {
      setIsLoading(true);
      try {
        if (selectedMonth === "current") {
          const currentDate = new Date();
          const data = await fetchHistory(
            currentDate.getFullYear(),
            currentDate.getMonth(),
          );
          setHistory(data);
        } else {
          const [year, month] = selectedMonth.split("-");
          if (year && month !== undefined) {
            const data = await fetchHistory(parseInt(year), parseInt(month));
            setHistory(data);
          }
        }
      } catch (error) {
        console.error("Error loading month history:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMonthHistory();
  }, [selectedMonth, isOpen, fetchHistory]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Showing booking history for {entityName}
          </DialogDescription>
        </DialogHeader>

        {/* Month Filter */}
        {availableMonths.length > 0 && (
          <div className="flex items-center gap-2 pb-4">
            <Filter className="h-4 w-4" />
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Current Month</SelectItem>
                {availableMonths.map((monthKey) => {
                  const [year, month] = monthKey.split("-");
                  if (!year || month === undefined) return null;
                  const date = new Date(parseInt(year), parseInt(month), 1);
                  return (
                    <SelectItem key={monthKey} value={monthKey}>
                      {format(date, "MMMM yyyy")}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <span className="text-sm text-gray-500">
              {history.length} bookings
            </span>
          </div>
        )}

        <div className="max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <p>Loading history...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="flex items-center justify-center p-8">
              <p>No booking history found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item) => {
                const dateStr = item.date;

                const formattedDate = formatDateStringToWords(dateStr);

                const timeDisplay = item.time
                  ? formatTimeString(item.time)
                  : "";

                const createdDate = new Date(item.createdAt);

                return (
                  <Card key={item.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-green-600" />
                          <span className="font-medium">{formattedDate}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-blue-600" />
                          <span>{timeDisplay}</span>
                        </div>
                        {item.invitedBy && (
                          <div className="flex items-center gap-2 text-sm">
                            <User className="h-4 w-4 text-purple-600" />
                            <span>Invited by: {item.invitedBy}</span>
                          </div>
                        )}
                        <div className="text-xs text-gray-500">
                          Booked on{" "}
                          {format(createdDate, "MMMM do, yyyy 'at' h:mm a")}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
