"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Bell, Check, Calendar, Trophy, Megaphone, Info } from "lucide-react";
import { markAllNotificationsAsRead } from "~/server/notifications/actions";
import { formatDistanceToNow } from "date-fns";
import { toZonedTime } from "date-fns-tz";

interface Notification {
  id: number;
  memberId: number | null;
  title: string;
  body: string;
  type: string;
  data: string | null;
  readAt: Date | null;
  createdAt: Date;
}

interface NotificationCenterProps {
  memberId: number;
  isOpen: boolean;
  onClose: () => void;
}

// Get icon based on notification type
function getNotificationIcon(type: string) {
  switch (type) {
    case "lottery_result":
      return <Trophy className="h-5 w-5 text-amber-500" />;
    case "tee_time_reminder":
      return <Calendar className="h-5 w-5 text-blue-500" />;
    case "event":
      return <Calendar className="h-5 w-5 text-green-500" />;
    case "broadcast":
      return <Megaphone className="h-5 w-5 text-purple-500" />;
    case "system":
    default:
      return <Info className="h-5 w-5 text-gray-500" />;
  }
}

// Format timestamp to BC timezone for display
function formatTimestamp(date: Date | string) {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const bcTime = toZonedTime(dateObj, "America/Vancouver");
  return formatDistanceToNow(bcTime, { addSuffix: true });
}

export function NotificationCenter({
  memberId,
  isOpen,
  onClose,
}: NotificationCenterProps) {
  // Query for notifications
  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["notifications", "list", memberId],
    queryFn: async () => {
      const response = await fetch(`/api/notifications`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: isOpen, // Only fetch when open
    staleTime: 0, // Always fetch fresh when opening
  });

  // Mark all as read when opening the dialog
  useEffect(() => {
    if (isOpen && notifications.length > 0) {
      // Small delay to let user see notifications before marking as read
      const timer = setTimeout(() => {
        markAllNotificationsAsRead(memberId);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, notifications.length, memberId]);

  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="max-h-[80vh] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="mt-4 max-h-[60vh]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Check className="mb-3 h-12 w-12 text-green-500" />
              <p className="text-lg font-medium text-gray-700">
                All caught up!
              </p>
              <p className="text-sm text-gray-500">
                You have no new notifications
              </p>
            </div>
          ) : (
            <div className="space-y-3 pr-4">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`rounded-lg border p-4 transition-colors ${
                    notification.readAt
                      ? "bg-gray-50 opacity-70"
                      : "bg-white shadow-sm"
                  }`}
                >
                  <div className="flex gap-3">
                    <div className="mt-0.5 flex-shrink-0">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900">
                        {notification.title}
                      </p>
                      <p className="mt-1 text-sm whitespace-pre-wrap text-gray-600">
                        {notification.body}
                      </p>
                      <p className="mt-2 text-xs text-gray-400">
                        {formatTimestamp(notification.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
