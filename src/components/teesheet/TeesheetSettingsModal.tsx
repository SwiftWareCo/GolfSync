"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "react-hot-toast";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Settings, Eye, Dice1, AlertCircle } from "lucide-react";
import { ConfirmationDialog } from "~/components/ui/confirmation-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  Teesheet,
  TeesheetConfig,
  TeesheetConfigWithBlocks,
  TimeBlock,
} from "~/server/db/schema";
import {
  updateTeesheetVisibility,
  updateLotterySettings,
} from "~/server/settings/actions";
import { replaceTimeBlocks } from "~/server/teesheet/actions";
import { queryKeys } from "~/server/query-options/query-keys";

// Form validation schema
const teesheetSettingsSchema = z.object({
  configId: z.number().nullable(),
  lotteryEnabled: z.boolean(),
  lotteryDisabledMessage: z.string().min(1, "Message is required"),
  isPublic: z.boolean(),
  privateMessage: z.string().min(1, "Message is required"),
});

type TeesheetSettingsFormInput = z.infer<typeof teesheetSettingsSchema>;

interface TeesheetSettingsModalProps {
  onClose: () => void;
  teesheet: Teesheet;
  timeBlocks: TimeBlock[];
  availableConfigs: TeesheetConfig[];
}

export function TeesheetSettingsModal({
  onClose,
  teesheet,
  timeBlocks,
  availableConfigs,
}: TeesheetSettingsModalProps) {
  const queryClient = useQueryClient();
  const [showConfigConfirmation, setShowConfigConfirmation] = useState(false);

  // React Hook Form setup
  const {
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<TeesheetSettingsFormInput>({
    resolver: zodResolver(teesheetSettingsSchema),
    mode: "onChange",
    defaultValues: {
      configId: teesheet.configId,
      lotteryEnabled: teesheet.lotteryEnabled ?? true,
      lotteryDisabledMessage:
        teesheet.lotteryDisabledMessage ||
        "Lottery signup is disabled for this date",
      isPublic: teesheet.isPublic || false,
      privateMessage:
        teesheet.privateMessage ||
        "This teesheet is not yet available for booking.",
    },
  });

  // Watch form values
  const configId = watch("configId");
  const lotteryEnabled = watch("lotteryEnabled");
  const lotteryDisabledMessage = watch("lotteryDisabledMessage");
  const isPublic = watch("isPublic");
  const privateMessage = watch("privateMessage");

  const configChanged = configId !== teesheet.configId;

  // Mutations
  const updateLotteryMutation = useMutation({
    mutationFn: async (data: {
      enabled: boolean;
      disabledMessage: string;
    }) => updateLotterySettings(teesheet.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.lottery.all(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.teesheets.all(),
      });
    },
    onError: (error: Error) => {
      console.error("Failed to update lottery settings:", error);
      toast.error(error.message || "Failed to update lottery settings");
    },
  });

  const updateVisibilityMutation = useMutation({
    mutationFn: async (data: {
      isPublic: boolean;
      privateMessage: string;
    }) => updateTeesheetVisibility(teesheet.id, data.isPublic, data.privateMessage),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.teesheets.all(),
      });
    },
    onError: (error: Error) => {
      console.error("Failed to update visibility:", error);
      toast.error(error.message || "Failed to update visibility");
    },
  });

  const replaceTimeBlocksMutation = useMutation({
    mutationFn: async (newConfig: TeesheetConfig) =>
      replaceTimeBlocks(teesheet.id, newConfig),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.teesheets.all(),
      });
      toast.success("Timeblocks replaced successfully");
    },
    onError: (error: Error) => {
      console.error("Failed to replace timeblocks:", error);
      toast.error(error.message || "Failed to replace timeblocks");
    },
  });

  const isLoading =
    updateLotteryMutation.isPending ||
    updateVisibilityMutation.isPending ||
    replaceTimeBlocksMutation.isPending;

  const handleConfigChange = async () => {
    // Find the new config
    const newConfig = availableConfigs.find((c) => c.id === configId);
    if (!newConfig) {
      toast.error("Configuration not found");
      return;
    }

    // Call replaceTimeBlocks which will validate that timeblocks are empty
    const result = await replaceTimeBlocksMutation.mutateAsync(newConfig);
    if (result.success) {
      setShowConfigConfirmation(false);
    }
  };

  const onSubmit = async (data: TeesheetSettingsFormInput) => {
    // Handle config change separately if it changed
    if (configChanged) {
      if (!showConfigConfirmation) {
        setShowConfigConfirmation(true);
        return;
      }
      // User has confirmed, proceed with config change
      await handleConfigChange();
    }

    try {
      const promises = [];

      // Update lottery settings
      promises.push(
        updateLotteryMutation.mutateAsync({
          enabled: data.lotteryEnabled,
          disabledMessage: data.lotteryDisabledMessage,
        })
      );

      // Update visibility settings
      promises.push(
        updateVisibilityMutation.mutateAsync({
          isPublic: data.isPublic,
          privateMessage: data.privateMessage,
        })
      );

      await Promise.all(promises);

      toast.success("Teesheet settings updated successfully");
      handleClose();
    } catch (error) {
      console.error("Error updating teesheet settings:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update teesheet settings"
      );
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Teesheet Settings
        </DialogTitle>
        <DialogDescription>
          Configure teesheet settings for {teesheet.date}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Tabs defaultValue="configuration" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="configuration">Configuration</TabsTrigger>
            <TabsTrigger value="lottery">Lottery</TabsTrigger>
          </TabsList>

          <TabsContent value="configuration" className="space-y-4 pt-4">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="h-4 w-4" />
              <h3 className="font-semibold">Configuration & Access</h3>
            </div>

            {/* Teesheet Configuration Selection */}
            <div className="space-y-2">
              <Label>Teesheet Configuration</Label>
              <Select
                value={configId?.toString() || ""}
                onValueChange={(value) =>
                  setValue("configId", value ? parseInt(value) : null)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select configuration" />
                </SelectTrigger>
                <SelectContent>
                  {availableConfigs.map((cfg) => (
                    <SelectItem key={cfg.id} value={cfg.id!.toString()}>
                      {cfg.name}
                      {cfg.id === teesheet.configId && " (Current)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Select the configuration for this teesheet
              </p>
              {configChanged && (
                <div className="flex items-center gap-2 text-sm text-orange-600 mt-2">
                  <AlertCircle className="h-4 w-4" />
                  Changing configuration will replace all existing timeblocks
                </div>
              )}
            </div>

            {/* Visibility Settings */}
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center gap-2 mb-4">
                <Eye className="h-4 w-4" />
                <h3 className="font-semibold">Visibility</h3>
              </div>

              <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label className="text-base">Public Teesheet</Label>
                  <p className="text-sm text-muted-foreground">
                    Make this teesheet visible to members for booking
                  </p>
                </div>
                <Switch
                  checked={isPublic}
                  onCheckedChange={(checked) => setValue("isPublic", checked)}
                />
              </div>

              <div className="space-y-2">
                <Label>Private Message</Label>
                <Textarea
                  placeholder="Message shown to members when teesheet is private"
                  value={privateMessage}
                  onChange={(e) => setValue("privateMessage", e.target.value)}
                  rows={3}
                />
                <p className="text-sm text-muted-foreground">
                  This message will be shown to members when the teesheet is
                  private
                </p>
                {errors.privateMessage && (
                  <p className="text-sm text-red-600">
                    {errors.privateMessage.message}
                  </p>
                )}
              </div>
            </div>

            {/* Member Booking Settings */}
            <div className="space-y-4 border-t pt-4">
              <div className="space-y-3">
                <div className="text-sm font-medium">
                  Member Booking Restrictions
                </div>
                <div className="rounded-lg border p-4 bg-blue-50">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900">
                        {teesheet.disallowMemberBooking
                          ? "Member Booking Disabled"
                          : "Member Booking Enabled"}
                      </p>
                      <p className="text-sm text-blue-700 mt-1">
                        {teesheet.disallowMemberBooking
                          ? "Members cannot book time blocks. Only admin can manage bookings."
                          : "Members can book available time blocks."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="lottery" className="space-y-4 pt-4">
            <div className="flex items-center gap-2 mb-4">
              <Dice1 className="h-4 w-4" />
              <h3 className="font-semibold">Lottery Settings</h3>
            </div>

            <div className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-base">Enable Lottery</Label>
                <p className="text-sm text-muted-foreground">
                  Allow members to submit lottery entries for this date
                </p>
              </div>
              <Switch
                checked={lotteryEnabled}
                onCheckedChange={(checked) =>
                  setValue("lotteryEnabled", checked)
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Disabled Message</Label>
              <Textarea
                placeholder="Message shown to members when lottery is disabled"
                value={lotteryDisabledMessage}
                onChange={(e) =>
                  setValue("lotteryDisabledMessage", e.target.value)
                }
                rows={3}
              />
              <p className="text-sm text-muted-foreground">
                This message will be shown to members when lottery is disabled
              </p>
              {errors.lotteryDisabledMessage && (
                <p className="text-sm text-red-600">
                  {errors.lotteryDisabledMessage.message}
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Saving...
              </>
            ) : (
              <>
                <Settings className="mr-2 h-4 w-4" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Configuration Change Confirmation Dialog */}
      <ConfirmationDialog
        open={showConfigConfirmation}
        onOpenChange={setShowConfigConfirmation}
        onConfirm={() => {
          // Proceed with form submission
          handleSubmit(onSubmit)();
        }}
        title="Change Teesheet Configuration"
        description={
          timeBlocks.length > 0
            ? "This action will replace all existing timeblocks. Any members, guests, or fills currently assigned will be removed. This cannot be undone. Are you sure?"
            : "This action will replace all existing timeblocks. Are you sure?"
        }
        confirmText="Replace Configuration"
        cancelText="Cancel"
        variant="destructive"
        loading={isLoading}
      />
    </>
  );
}
