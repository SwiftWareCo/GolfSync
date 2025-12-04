"use client";

import { useActionState, startTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Switch } from "~/components/ui/switch";
import { Badge } from "~/components/ui/badge";
import { Slider } from "~/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Timer, TrendingUp, Clock, Save, AlertTriangle } from "lucide-react";
import { toast } from "react-hot-toast";
import { updateMemberSpeedProfileAction } from "~/server/lottery/member-profiles-actions";
import { formatDistanceToNow } from "date-fns";
import { formatPaceTime, getSpeedTierInfo } from "~/lib/lottery-display-utils";
import { memberSpeedProfilesUpdateSchema } from "~/server/db/schema/lottery/member-speed-profiles.schema";
import type { getMemberProfilesWithFairness } from "~/server/lottery/member-profiles-data";

// Infer form schema from database schema, refining to require non-null values for form
const speedProfileSchema = memberSpeedProfilesUpdateSchema
  .pick({
    speedTier: true,
    adminPriorityAdjustment: true,
    manualOverride: true,
    notes: true,
  })
  .required({
    speedTier: true,
    adminPriorityAdjustment: true,
    manualOverride: true,
  });

type FormData = z.infer<typeof speedProfileSchema>;

// Infer profile type from data function return type
type MemberProfile = Awaited<
  ReturnType<typeof getMemberProfilesWithFairness>
>["profiles"][number];

interface SpeedProfileEditDialogProps {
  profile: MemberProfile;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function SpeedProfileEditDialog({
  profile,
  isOpen,
  onClose,
  onSave,
}: SpeedProfileEditDialogProps) {
  const [, action, isPending] = useActionState(
    updateMemberSpeedProfileAction,
    null,
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(speedProfileSchema),
    defaultValues: {
      speedTier: profile.memberSpeedProfile?.speedTier ?? "AVERAGE",
      adminPriorityAdjustment:
        profile.memberSpeedProfile?.adminPriorityAdjustment ?? 0,
      manualOverride: profile.memberSpeedProfile?.manualOverride ?? false,
      notes: profile.memberSpeedProfile?.notes ?? "",
    },
  });

  const watchedAdminAdjustment = watch("adminPriorityAdjustment");
  const watchedManualOverride = watch("manualOverride");
  const watchedSpeedTier = watch("speedTier");

  const currentTierInfo = getSpeedTierInfo(watchedSpeedTier);

  const onSubmit = handleSubmit(async (data: FormData) => {
    try {
      startTransition(async () => {
        await action({
          memberId: profile.id,
          speedTier: data.speedTier,
          adminPriorityAdjustment: data.adminPriorityAdjustment,
          manualOverride: data.manualOverride,
          notes: data.notes ?? null,
        });
      });
      toast.success("Speed profile updated successfully");
      onSave();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update speed profile",
      );
    }
  });

  const getAutomaticSpeedTier = () => {
    if (!profile.memberSpeedProfile?.averageMinutes) return "Unknown";
    if (profile.memberSpeedProfile.averageMinutes <= 235) return "FAST";
    if (profile.memberSpeedProfile.averageMinutes <= 245) return "AVERAGE";
    return "SLOW";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5" />
            Edit Speed Profile: {profile.memberName}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-6">
          {/* Member Information */}
          <div className="rounded-lg border bg-gray-50 p-4">
            <h3 className="mb-3 font-medium">Member Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Name:</span>
                <div className="font-medium">{profile.memberName}</div>
              </div>
              <div>
                <span className="text-gray-600">Member #:</span>
                <div className="font-medium">#{profile.memberNumber}</div>
              </div>
              <div>
                <span className="text-gray-600">Average Pace:</span>
                <div className="font-medium">
                  {formatPaceTime(
                    profile.memberSpeedProfile?.averageMinutes ?? null,
                  )}
                  {profile.memberSpeedProfile?.averageMinutes && (
                    <span className="ml-1 text-gray-500">
                      ({profile.memberSpeedProfile.averageMinutes} min)
                    </span>
                  )}
                </div>
              </div>
              <div>
                <span className="text-gray-600">Last Calculated:</span>
                <div className="font-medium">
                  {profile.memberSpeedProfile?.lastCalculated
                    ? formatDistanceToNow(
                        profile.memberSpeedProfile.lastCalculated,
                        {
                          addSuffix: true,
                        },
                      )
                    : "Never"}
                </div>
              </div>
            </div>
            {profile.memberSpeedProfile?.averageMinutes && (
              <div className="mt-3 rounded border border-blue-200 bg-blue-50 p-2">
                <div className="text-xs text-blue-700">
                  <strong>Automatic Classification:</strong>{" "}
                  {getAutomaticSpeedTier()}
                  {!watchedManualOverride && " (Currently Applied)"}
                </div>
              </div>
            )}
          </div>

          {/* Speed Classification */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Speed Classification</label>
            <Select
              value={watchedSpeedTier}
              onValueChange={(value) =>
                setValue("speedTier", value as "FAST" | "AVERAGE" | "SLOW")
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select speed tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FAST">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <span>Fast (≤ 3:55)</span>
                  </div>
                </SelectItem>
                <SelectItem value="AVERAGE">
                  <div className="flex items-center gap-2">
                    <Timer className="h-4 w-4 text-yellow-600" />
                    <span>Average (3:56 - 4:05)</span>
                  </div>
                </SelectItem>
                <SelectItem value="SLOW">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-600" />
                    <span>Slow (4:06+)</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Speed Tier Information */}
            <div
              className={`rounded-lg border p-3 ${currentTierInfo.bgColor} ${currentTierInfo.borderColor}`}
            >
              <div
                className={`flex items-center gap-2 ${currentTierInfo.color} font-medium`}
              >
                {currentTierInfo.icon}
                {watchedSpeedTier} Player
              </div>
              <div className="mt-1 text-sm text-gray-600">
                {currentTierInfo.description}
              </div>
            </div>
            {errors.speedTier && (
              <p className="text-sm text-red-600">{errors.speedTier.message}</p>
            )}
          </div>

          {/* Manual Override Switch */}
          <div className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <label className="text-base font-medium">Manual Override</label>
              <p className="text-sm text-gray-500">
                Lock this classification and prevent automatic updates during
                monthly recalculation
              </p>
            </div>
            <Switch
              checked={watchedManualOverride}
              onCheckedChange={(checked) => setValue("manualOverride", checked)}
            />
          </div>

          {/* Admin Priority Adjustment */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="h-4 w-4" />
              Admin Priority Adjustment
            </label>
            <p className="text-sm text-gray-500">
              Manually adjust lottery priority (-10 to +10 points). Positive
              values increase priority.
            </p>
            <div className="space-y-3">
              <Slider
                min={-10}
                max={10}
                step={1}
                value={[watchedAdminAdjustment]}
                onValueChange={(value) =>
                  setValue("adminPriorityAdjustment", value[0]!)
                }
                className="w-full"
              />
              <div className="flex items-center justify-between text-sm">
                <span className="text-red-600">-10 (Lower Priority)</span>
                <Badge
                  variant={
                    watchedAdminAdjustment === 0
                      ? "outline"
                      : watchedAdminAdjustment > 0
                        ? "default"
                        : "destructive"
                  }
                >
                  {watchedAdminAdjustment > 0 ? "+" : ""}
                  {watchedAdminAdjustment} points
                </Badge>
                <span className="text-green-600">+10 (Higher Priority)</span>
              </div>
            </div>
            {errors.adminPriorityAdjustment && (
              <p className="text-sm text-red-600">
                {errors.adminPriorityAdjustment.message}
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Notes (Optional)</label>
            <p className="text-sm text-gray-500">
              Record reason for manual adjustments or other relevant information
            </p>
            <Textarea
              placeholder="e.g., Birthday week bonus, hosting important guests, etc."
              {...register("notes")}
              rows={3}
            />
            {errors.notes && (
              <p className="text-sm text-red-600">{errors.notes.message}</p>
            )}
          </div>

          <DialogFooter className="flex gap-3 pt-6">
            <Button
              type="submit"
              disabled={isPending}
              className="flex-1"
              size="lg"
            >
              {isPending ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={onClose}
              disabled={isPending}
              size="lg"
            >
              Cancel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
