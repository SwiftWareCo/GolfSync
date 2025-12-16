"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "react-hot-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Settings } from "lucide-react";
import { updateLotterySettings } from "~/server/lottery/lottery-settings-actions";
import { lotterySettingsFormSchema } from "~/server/db/schema/lottery/lottery-settings.schema";
import type { LotterySettingsFormData } from "~/server/db/schema";

interface LotterySettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSettings: {
    lotteryAdvanceDays: number;
    lotteryMaxDaysAhead: number;
  };
}

export function LotterySettingsDialog({
  open,
  onOpenChange,
  initialSettings,
}: LotterySettingsDialogProps) {
  const [isPending, setIsPending] = useState(false);
  
  const form = useForm<LotterySettingsFormData>({
    resolver: zodResolver(lotterySettingsFormSchema),
    defaultValues: {
      lotteryAdvanceDays: initialSettings.lotteryAdvanceDays,
      lotteryMaxDaysAhead: initialSettings.lotteryMaxDaysAhead,
    },
  });

  const onSubmit = async (data: LotterySettingsFormData) => {
    setIsPending(true);
    try {
      const result = await updateLotterySettings(data);
      if (result.success) {
        toast.success("Lottery settings updated successfully");
        onOpenChange(false);
      } else {
        toast.error(result.error || "Failed to update lottery settings");
      }
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Lottery Settings
          </DialogTitle>
          <DialogDescription>
            Configure global lottery entry settings
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lotteryAdvanceDays">
              Lottery Advance Days
            </Label>
            <Input
              id="lotteryAdvanceDays"
              type="number"
              min="0"
              max="365"
              {...form.register("lotteryAdvanceDays", {
                valueAsNumber: true,
              })}
            />
            <p className="text-sm text-gray-500">
              How many days in advance lottery forms become available (e.g., 3
              means forms show 3 days before the lottery date)
            </p>
            {form.formState.errors.lotteryAdvanceDays && (
              <p className="text-sm text-red-500">
                {form.formState.errors.lotteryAdvanceDays.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="lotteryMaxDaysAhead">
              Maximum Days Ahead
            </Label>
            <Input
              id="lotteryMaxDaysAhead"
              type="number"
              min="1"
              max="365"
              {...form.register("lotteryMaxDaysAhead", {
                valueAsNumber: true,
              })}
            />
            <p className="text-sm text-gray-500">
              Maximum number of days in advance that lottery entries can be
              submitted (e.g., 60 means entries can be submitted up to 60 days
              ahead)
            </p>
            {form.formState.errors.lotteryMaxDaysAhead && (
              <p className="text-sm text-red-500">
                {form.formState.errors.lotteryMaxDaysAhead.message}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

