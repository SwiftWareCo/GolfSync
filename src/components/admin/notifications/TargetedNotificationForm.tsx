"use client";

import { useState } from "react";
import { Card, CardHeader, CardContent, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import { Badge } from "~/components/ui/badge";
import { Target, Send, Users } from "lucide-react";
import { sendTargetedNotification } from "~/server/pwa/actions";
import toast from "react-hot-toast";
import type { ClassCount } from "~/server/pwa/data";

interface TargetedNotificationFormProps {
  memberClasses?: { id: number; label: string }[];
  classCounts?: ClassCount[];
  hideCard?: boolean;
}

export function TargetedNotificationForm({
  memberClasses,
  classCounts,
  hideCard = false,
}: TargetedNotificationFormProps) {
  const [title, setTitle] = useState("Quilchena Golf Club");
  const [message, setMessage] = useState("");
  const [selectedClassIds, setSelectedClassIds] = useState<number[]>([]);
  const [isSending, setIsSending] = useState(false);

  // Filter class counts based on selected class IDs
  const selectedClassCounts = (classCounts || []).filter((count) =>
    selectedClassIds.includes(count.classId),
  );

  const totalTargetedMembers = selectedClassCounts.reduce(
    (sum, count) => sum + count.subscribedCount,
    0,
  );

  const handleClassSelection = (classId: number, checked: boolean) => {
    setSelectedClassIds((prev) =>
      checked ? [...prev, classId] : prev.filter((id) => id !== classId),
    );
  };

  const handleSendTargetedNotification = async () => {
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }

    if (selectedClassIds.length === 0) {
      toast.error("Please select at least one member class");
      return;
    }

    try {
      setIsSending(true);
      const result = await sendTargetedNotification(
        title,
        message,
        selectedClassIds,
      );

      if (result.success) {
        toast.success(
          `Targeted notification sent to ${result.sent} members! ${result.expired} expired subscriptions cleaned up.`,
        );
        setMessage("");
        setSelectedClassIds([]);
      } else {
        toast.error(result.error || "Failed to send targeted notifications");
      }
    } catch (error) {
      toast.error("Error sending targeted notifications");
    } finally {
      setIsSending(false);
    }
  };

  const content = (
    <div className="space-y-4">
      <div>
        <Label htmlFor="targeted-title">Title</Label>
        <Input
          id="targeted-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Notification title"
        />
      </div>

      <div>
        <Label htmlFor="targeted-message">Message</Label>
        <Textarea
          id="targeted-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Enter your message for selected member classes..."
          rows={4}
        />
      </div>

      <div>
        <Label className="text-base font-medium">Select Member Classes</Label>
        <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-3">
          {(memberClasses || []).map((mc) => (
            <div key={mc.id} className="flex items-center space-x-2">
              <Checkbox
                id={`class-${mc.id}`}
                checked={selectedClassIds.includes(mc.id)}
                onCheckedChange={(checked) =>
                  handleClassSelection(mc.id, checked as boolean)
                }
              />
              <Label
                htmlFor={`class-${mc.id}`}
                className="cursor-pointer text-sm font-normal"
              >
                {mc.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {selectedClassIds.length > 0 && (
        <div className="rounded-lg border bg-gray-50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="font-medium">Selected Classes</span>
          </div>
          <div className="space-y-2">
            {selectedClassCounts.map((count) => (
              <div
                key={count.classId}
                className="flex items-center justify-between text-sm"
              >
                <span className="font-medium">{count.classLabel}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {count.subscribedCount} subscribed
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {count.totalCount} total
                  </Badge>
                </div>
              </div>
            ))}

            {selectedClassCounts.length > 0 && (
              <div className="mt-2 border-t pt-2">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>Total Target</span>
                  <Badge className="bg-org-primary text-white">
                    {totalTargetedMembers} members
                  </Badge>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          {selectedClassIds.length > 0
            ? `This will send a notification to ${totalTargetedMembers} members in ${selectedClassIds.length} class${selectedClassIds.length > 1 ? "es" : ""}`
            : "Select member classes to send targeted notification"}
        </p>
        <Button
          onClick={handleSendTargetedNotification}
          disabled={
            isSending || !message.trim() || selectedClassIds.length === 0
          }
          className="min-w-[120px]"
        >
          <Send className="mr-2 h-4 w-4" />
          {isSending ? "Sending..." : "Send Targeted"}
        </Button>
      </div>
    </div>
  );

  if (hideCard) {
    return content;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Send Targeted Notification
        </CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
