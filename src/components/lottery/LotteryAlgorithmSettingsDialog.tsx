"use client";

import { useState, useActionState, startTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Badge } from "~/components/ui/badge";
import { TrendingUp, Timer } from "lucide-react";
import { toast } from "react-hot-toast";
import { updateAlgorithmConfigAction } from "~/server/lottery/algorithm-config-actions";
import { reclassifyAllSpeedTiers } from "~/server/lottery/maintenance-actions";
import { formatPaceTime } from "~/lib/lottery-display-utils";
import { cn } from "~/lib/utils";
import {
  lotteryAlgorithmConfigFormSchema,
  type LotteryAlgorithmConfigFormData,
  type PositionSpeedBonusConfig,
  type WindowPosition,
} from "~/server/db/schema";

type TabType = "thresholds" | "bonuses";

interface LotteryAlgorithmSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: LotteryAlgorithmConfigFormData;
}

const POSITION_LABELS: Record<WindowPosition, { icon: string; label: string }> =
  {
    early: { icon: "🌅", label: "Early (first 25%)" },
    mid_early: { icon: "☀️", label: "Mid-Early (25-50%)" },
    mid_late: { icon: "🌤️", label: "Mid-Late (50-75%)" },
    late: { icon: "🌆", label: "Late (last 25%)" },
  };

export function LotteryAlgorithmSettingsDialog({
  isOpen,
  onClose,
  initialData,
}: LotteryAlgorithmSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<TabType>("thresholds");

  const [, action, isPending] = useActionState(
    updateAlgorithmConfigAction,
    null,
  );

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<LotteryAlgorithmConfigFormData>({
    resolver: zodResolver(lotteryAlgorithmConfigFormSchema),
    defaultValues: initialData,
  });

  // Watch values for display
  const fastThreshold = watch("fastThresholdMinutes");
  const averageThreshold = watch("averageThresholdMinutes");
  const speedBonuses = watch("speedBonuses");

  const onSubmit = handleSubmit(
    async (data: LotteryAlgorithmConfigFormData) => {
      try {
        // Check if thresholds changed
        const thresholdsChanged =
          data.fastThresholdMinutes !== initialData.fastThresholdMinutes ||
          data.averageThresholdMinutes !== initialData.averageThresholdMinutes;

        startTransition(async () => {
          await action(data);
        });

        // If thresholds changed, reclassify all speed tiers
        if (thresholdsChanged) {
          const result = await reclassifyAllSpeedTiers();
          if (
            result.success &&
            result.data &&
            result.data.recordsAffected > 0
          ) {
            toast.success(
              `Settings saved. Updated ${result.data.recordsAffected} member speed tiers.`,
            );
          } else {
            toast.success("Algorithm settings saved successfully");
          }
        } else {
          toast.success("Algorithm settings saved successfully");
        }
        onClose();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to save algorithm settings",
        );
      }
    },
  );

  const updateSpeedBonus = (
    windowIndex: number,
    field: "fastBonus" | "averageBonus" | "slowBonus",
    value: number,
  ) => {
    const updated = [...speedBonuses];
    if (updated[windowIndex]) {
      updated[windowIndex] = { ...updated[windowIndex], [field]: value };
      setValue("speedBonuses", updated as PositionSpeedBonusConfig[]);
    }
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: "thresholds", label: "Speed Thresholds" },
    { id: "bonuses", label: "Time Window Bonuses" },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Lottery Algorithm Settings</DialogTitle>
          <DialogDescription>
            Configure speed tier thresholds and bonuses for lottery processing.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={onSubmit}
          className="flex flex-1 flex-col overflow-hidden"
          key={String(isOpen)}
        >
          <div className="grid flex-1 grid-cols-[180px_1fr] gap-6 overflow-hidden px-6 py-4">
            {/* Sidebar Navigation */}
            <nav className="space-y-1 border-r pr-4">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm font-medium transition-colors",
                    activeTab === tab.id
                      ? "bg-org-primary text-white"
                      : "hover:bg-org-primary/10",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            {/* Form Content */}
            <div className="min-h-[63vh] space-y-6 overflow-y-auto p-2">
              {/* Speed Tier Thresholds Tab */}
              {activeTab === "thresholds" && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Define pace thresholds (in minutes) for classifying members
                    as Fast, Average, or Slow.
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fastThreshold">Fast Threshold</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="fastThreshold"
                          type="number"
                          {...register("fastThresholdMinutes", {
                            valueAsNumber: true,
                          })}
                          className="w-24"
                        />
                        <Badge variant="outline" className="text-green-600">
                          <TrendingUp className="mr-1 h-3 w-3" />
                          {formatPaceTime(fastThreshold)}
                        </Badge>
                      </div>
                      {errors.fastThresholdMinutes && (
                        <p className="text-sm text-red-600">
                          {errors.fastThresholdMinutes.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="averageThreshold">
                        Average Threshold
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="averageThreshold"
                          type="number"
                          {...register("averageThresholdMinutes", {
                            valueAsNumber: true,
                          })}
                          className="w-24"
                        />
                        <Badge variant="outline" className="text-yellow-600">
                          <Timer className="mr-1 h-3 w-3" />
                          {formatPaceTime(averageThreshold)}
                        </Badge>
                      </div>
                      {errors.averageThresholdMinutes && (
                        <p className="text-sm text-red-600">
                          {errors.averageThresholdMinutes.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded border bg-gray-50 p-3 text-sm">
                    <strong>Classification:</strong>
                    <ul className="mt-1 space-y-1 text-gray-600">
                      <li>
                        🟢 <strong>Fast:</strong> ≤ {fastThreshold} min (
                        {formatPaceTime(fastThreshold)})
                      </li>
                      <li>
                        🟡 <strong>Average:</strong> {fastThreshold + 1} -{" "}
                        {averageThreshold} min
                      </li>
                      <li>
                        ⚪ <strong>Slow:</strong> &gt; {averageThreshold} min (
                        {formatPaceTime(averageThreshold)}+)
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Speed Bonuses Tab */}
              {activeTab === "bonuses" && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Priority bonus points given to members based on their speed
                    tier when requesting specific time windows. Higher bonuses
                    increase priority.
                  </p>

                  <div className="space-y-3">
                    {speedBonuses.map((bonus, index) => {
                      const positionInfo = POSITION_LABELS[bonus.position] ?? {
                        icon: "❓",
                        label: bonus.position,
                      };
                      return (
                        <div
                          key={`bonus-${bonus.position ?? index}`}
                          className="rounded-lg border bg-gray-50 p-3"
                        >
                          <div className="mb-2 font-medium">
                            {positionInfo.icon} {positionInfo.label}
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <Label className="text-xs text-green-600">
                                Fast Bonus
                              </Label>
                              <Input
                                type="number"
                                min={0}
                                max={50}
                                value={bonus.fastBonus}
                                onChange={(e) =>
                                  updateSpeedBonus(
                                    index,
                                    "fastBonus",
                                    parseInt(e.target.value) || 0,
                                  )
                                }
                                className="h-8"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-yellow-600">
                                Average Bonus
                              </Label>
                              <Input
                                type="number"
                                min={0}
                                max={50}
                                value={bonus.averageBonus}
                                onChange={(e) =>
                                  updateSpeedBonus(
                                    index,
                                    "averageBonus",
                                    parseInt(e.target.value) || 0,
                                  )
                                }
                                className="h-8"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-gray-600">
                                Slow Bonus
                              </Label>
                              <Input
                                type="number"
                                min={0}
                                max={50}
                                value={bonus.slowBonus}
                                onChange={(e) =>
                                  updateSpeedBonus(
                                    index,
                                    "slowBonus",
                                    parseInt(e.target.value) || 0,
                                  )
                                }
                                className="h-8"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-between gap-3 border-t px-6 pt-4 pb-6">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-org-primary hover:bg-org-primary/90"
            >
              {isPending ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
