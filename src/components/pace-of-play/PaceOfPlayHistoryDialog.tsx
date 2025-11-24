"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { Card, CardContent } from "~/components/ui/card";
import { Calendar, Clock, MessageSquare } from "lucide-react";
import { formatDateStringToWords, formatTimeString } from "~/lib/utils";
import { formatTime12Hour } from "~/lib/dates";
import { PaceOfPlayStatus } from "~/components/pace-of-play/PaceOfPlayStatus";
import type {
  PaceOfPlayHistoryItem,
  PaceOfPlayStatus as PaceOfPlayStatusType,
} from "~/app/types/PaceOfPlayTypes";

interface PaceOfPlayHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  fetchHistory: () => Promise<{
    success: boolean;
    data: PaceOfPlayHistoryItem[];
    error?: string;
  }>;
  entityName: string;
}

export function PaceOfPlayHistoryDialog({
  isOpen,
  onClose,
  title,
  fetchHistory,
  entityName,
}: PaceOfPlayHistoryDialogProps) {
  const [history, setHistory] = useState<PaceOfPlayHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const result = await fetchHistory();
      if (result.success) {
        setHistory(Array.isArray(result.data) ? result.data : []);
      } else {
        console.error("Error loading pace of play history:", result.error);
        setHistory([]);
      }
    } catch (error) {
      console.error("Error loading pace of play history:", error);
      setHistory([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Showing pace of play history for {entityName}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <p>Loading history...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <p>No pace of play history found</p>
          </div>
        ) : (
          <div className="max-h-[60vh] space-y-3 overflow-y-auto">
            {history.map((item) => {
              const formattedDate = formatDateStringToWords(item.date);
              const formattedTeeTime = formatTimeString(item.startTime);

              return (
                <Card key={item.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-green-600" />
                          <span className="font-medium">{formattedDate}</span>
                        </div>
                        <PaceOfPlayStatus status={item.status} />
                      </div>

                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-blue-600" />
                        <span>Tee Time: {formattedTeeTime}</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 rounded-md bg-gray-50 p-2 text-xs">
                        <div className="space-y-1">
                          <p className="font-medium">Tee Time</p>
                          <p>{formatTimeString(item.startTime)}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="font-medium">Turn</p>
                          <p>
                            {item.turn9Time
                              ? formatTime12Hour(new Date(item.turn9Time))
                              : "—"}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="font-medium">Finish</p>
                          <p>
                            {item.finishTime
                              ? formatTime12Hour(new Date(item.finishTime))
                              : "—"}
                          </p>
                        </div>
                      </div>

                      {item.notes && (
                        <div className="rounded-md bg-blue-50 p-2 text-xs">
                          <div className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3 text-blue-600" />
                            <p className="font-medium text-blue-700">Notes</p>
                          </div>
                          <p className="mt-1 text-gray-700">{item.notes}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
