"use client";

import { useState } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Send, Target, Users, Bell, BarChart3, Wrench } from "lucide-react";
import {
  sendNotificationToAllMembers,
  sendTargetedNotification,
  runPushNotificationMaintenance,
} from "~/server/pwa/actions";
import { MultiSelect, type OptionType } from "~/components/ui/multi-select";
import toast from "react-hot-toast";
import type { ClassCount } from "~/server/pwa/data";

interface NotificationsPanelProps {
  stats: {
    totalMembers: number;
    subscribedMembers: number;
    validSubscriptions: number;
    subscriptionRate: number;
  };
  memberClasses: { id: number; label: string }[];
  classCounts: ClassCount[];
}

type NotificationType = "bulk" | "targeted";

export function NotificationsPanel({
  stats,
  memberClasses,
  classCounts,
}: NotificationsPanelProps) {
  const [notificationType, setNotificationType] =
    useState<NotificationType>("bulk");
  const [title, setTitle] = useState("Quilchena Golf Club");
  const [message, setMessage] = useState("");
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isRunningMaintenance, setIsRunningMaintenance] = useState(false);

  // Convert member classes to MultiSelect options
  const classOptions: OptionType[] = memberClasses.map((mc) => ({
    value: mc.id.toString(),
    label: mc.label,
  }));

  // Get selected class counts for summary
  const selectedClassCounts = classCounts.filter((cc) =>
    selectedClassIds.includes(cc.classId.toString()),
  );

  const totalTargetedMembers = selectedClassCounts.reduce(
    (sum, cc) => sum + cc.subscribedCount,
    0,
  );

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }

    if (notificationType === "targeted" && selectedClassIds.length === 0) {
      toast.error("Please select at least one member class");
      return;
    }

    try {
      setIsSending(true);

      if (notificationType === "bulk") {
        const result = await sendNotificationToAllMembers(title, message);
        if (result.success) {
          toast.success(`Sent to ${result.sent} members!`);
          setMessage("");
        } else {
          toast.error(result.error || "Failed to send");
        }
      } else {
        const classIdsAsNumbers = selectedClassIds.map((id) => parseInt(id));
        const result = await sendTargetedNotification(
          title,
          message,
          classIdsAsNumbers,
        );
        if (result.success) {
          toast.success(`Sent to ${result.sent} members!`);
          setMessage("");
          setSelectedClassIds([]);
        } else {
          toast.error(result.error || "Failed to send");
        }
      }
    } catch (error) {
      toast.error("Error sending notification");
    } finally {
      setIsSending(false);
    }
  };

  const handleRunMaintenance = async () => {
    try {
      setIsRunningMaintenance(true);
      const result = await runPushNotificationMaintenance();
      if (result.success) {
        toast.success(`Cleaned up ${result.cleanedUp} expired subscriptions`);
      } else {
        toast.error("Maintenance failed");
      }
    } catch (error) {
      toast.error("Error running maintenance");
    } finally {
      setIsRunningMaintenance(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Push Notifications
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Sidebar - Stats & Options */}
          <div className="flex flex-col gap-4 lg:w-64 lg:border-r lg:pr-6">
            {/* Compact Stats */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
              <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
                <Users className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="text-lg font-semibold">
                    {stats.subscribedMembers}
                  </p>
                  <p className="text-xs text-gray-500">Subscribed</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
                <BarChart3 className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-lg font-semibold">
                    {stats.subscriptionRate.toFixed(0)}%
                  </p>
                  <p className="text-xs text-gray-500">Rate</p>
                </div>
              </div>
            </div>

            {/* Notification Type Selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Type</Label>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setNotificationType("bulk")}
                  className={`flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors ${
                    notificationType === "bulk"
                      ? "border-org-primary bg-org-primary/5"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <Send
                    className={`h-4 w-4 ${notificationType === "bulk" ? "text-org-primary" : "text-gray-400"}`}
                  />
                  <div>
                    <p className="font-medium">Bulk</p>
                    <p className="text-xs text-gray-500">All subscribed</p>
                  </div>
                </button>
                <button
                  onClick={() => setNotificationType("targeted")}
                  className={`flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors ${
                    notificationType === "targeted"
                      ? "border-org-primary bg-org-primary/5"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <Target
                    className={`h-4 w-4 ${notificationType === "targeted" ? "text-org-primary" : "text-gray-400"}`}
                  />
                  <div>
                    <p className="font-medium">Targeted</p>
                    <p className="text-xs text-gray-500">By member class</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Maintenance Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRunMaintenance}
              disabled={isRunningMaintenance}
              className="mt-auto"
            >
              <Wrench className="mr-2 h-4 w-4" />
              {isRunningMaintenance ? "Running..." : "Run Maintenance"}
            </Button>
          </div>

          {/* Main Form Area */}
          <div className="flex-1 space-y-4">
            {/* Title */}
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Notification title"
              />
            </div>

            {/* Message */}
            <div>
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter your notification message..."
                rows={4}
              />
            </div>

            {/* Member Class Selector (Targeted Only) */}
            {notificationType === "targeted" && (
              <div>
                <Label>Member Classes</Label>
                <MultiSelect
                  options={classOptions}
                  selected={selectedClassIds}
                  onChange={setSelectedClassIds}
                  placeholder="Select member classes..."
                />

                {selectedClassIds.length > 0 && (
                  <div className="mt-3 rounded-lg bg-gray-50 p-3">
                    <div className="flex flex-wrap gap-2">
                      {selectedClassCounts.map((cc) => (
                        <Badge key={cc.classId} variant="secondary">
                          {cc.classLabel}: {cc.subscribedCount} subscribed
                        </Badge>
                      ))}
                    </div>
                    <p className="mt-2 text-sm font-medium">
                      Total: {totalTargetedMembers} members
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Send Button */}
            <div className="flex items-center justify-between border-t pt-4">
              <p className="text-sm text-gray-500">
                {notificationType === "bulk"
                  ? `Sending to ${stats.validSubscriptions} active subscriptions`
                  : selectedClassIds.length > 0
                    ? `Sending to ${totalTargetedMembers} members`
                    : "Select classes to see recipient count"}
              </p>
              <Button
                onClick={handleSend}
                disabled={
                  isSending ||
                  !message.trim() ||
                  (notificationType === "targeted" &&
                    selectedClassIds.length === 0)
                }
              >
                <Send className="mr-2 h-4 w-4" />
                {isSending ? "Sending..." : "Send Notification"}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
