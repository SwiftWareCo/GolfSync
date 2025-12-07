"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { NotificationCenter } from "./NotificationCenter";

interface NotificationBellProps {
  memberId: number;
}

export function NotificationBell({ memberId }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  // Query for unread count
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["notifications", "unread-count", memberId],
    queryFn: async () => {
      const response = await fetch(`/api/notifications/unread-count`);
      if (!response.ok) return 0;
      const data = await response.json();
      return data.count ?? 0;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000,
  });

  const handleOpen = () => {
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    // Invalidate the count query after closing (notifications will be marked read)
    queryClient.invalidateQueries({
      queryKey: ["notifications", "unread-count", memberId],
    });
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={handleOpen}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center p-0 text-xs"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        )}
      </Button>

      <NotificationCenter
        memberId={memberId}
        isOpen={isOpen}
        onClose={handleClose}
      />
    </>
  );
}
