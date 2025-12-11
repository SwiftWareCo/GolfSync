"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "react-hot-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import type { Teesheet, TeesheetConfig } from "~/server/db/schema";
import {
  updateTeesheetVisibility,
  updateLotterySettings,
} from "~/server/settings/actions";
import { replaceTimeBlocks } from "~/server/teesheet/actions";
import { queryKeys } from "~/server/query-options/query-keys";
import { type TimeBlockWithRelations } from "~/server/db/schema";

// Form validation schema
const teesheetSettingsSchema = z.object({
  configId: z.number().nullable(),
  lotteryEnabled: z.boolean(),
  lotteryDisabledMessage: z.string().min(1, "Message is required"),
  isPublic: z.boolean(),
  privateMessage: z.string().min(1, "Message is required"),
  disallowMemberBooking: z.boolean(),
});

type TeesheetSettingsFormInput = z.infer<typeof teesheetSettingsSchema>;

interface TeesheetSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teesheet: Teesheet;
  timeBlocks: TimeBlockWithRelations[];
  availableConfigs: TeesheetConfig[];
}

export function TeesheetSettingsModal({
  open,
  onOpenChange,
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
      disallowMemberBooking: teesheet.disallowMemberBooking ?? false,
    },
  });

  // Watch form values
  const configId = watch("configId");
  const lotteryEnabled = watch("lotteryEnabled");
  const lotteryDisabledMessage = watch("lotteryDisabledMessage");
  const isPublic = watch("isPublic");
  const privateMessage = watch("privateMessage");
  const disallowMemberBooking = watch("disallowMemberBooking");

  const configChanged = configId !== teesheet.configId;

  // Mutations
  const updateLotteryMutation = useMutation({
    mutationFn: async (data: { enabled: boolean; disabledMessage: string }) =>
      updateLotterySettings(teesheet.id, data),
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
      disallowMemberBooking: boolean;
    }) =>
      updateTeesheetVisibility(
        teesheet.id,
        data.isPublic,
        data.privateMessage,
        data.disallowMemberBooking,
      ),
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

    // Handle the result
    if (result.success) {
      setShowConfigConfirmation(false);
      toast.success("Configuration changed successfully");
    } else {
      // Show the specific error message from the server
      setValue("configId", teesheet.configId); // ← Add this
      toast.error(result.error || "Failed to replace timeblocks");
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

    const promises = [];

    const visibilityChanged =
      data.isPublic !== teesheet.isPublic ||
      data.privateMessage !== teesheet.privateMessage ||
      data.disallowMemberBooking !== (teesheet.disallowMemberBooking ?? false);
    if (visibilityChanged) {
      promises.push(
        updateVisibilityMutation.mutateAsync({
          isPublic: data.isPublic,
          privateMessage: data.privateMessage,
          disallowMemberBooking: data.disallowMemberBooking,
        }),
      );
    }

    // Only run mutations if there are changes to apply
    if (promises.length === 0 && !configChanged) {
      toast.success("No changes to save");
      handleClose();
      return;
    }

    if (promises.length > 0) {
      const results = await Promise.allSettled(promises);

      // Check for any failures
      const failures = results.filter(
        (result) => result.status === "rejected",
      ) as PromiseRejectedResult[];

      if (failures.length > 0) {
        console.error("Some settings failed to update:", failures);
        const failureMessages = failures
          .map((f) =>
            f.reason instanceof Error ? f.reason.message : "Unknown error",
          )
          .join(", ");

        if (failures.length === results.length) {
          // All failed
          toast.error(`Failed to update settings: ${failureMessages}`);
        } else {
          // Partial success
          toast.error(`Some settings failed: ${failureMessages}`);
        }
        return; // Don't close modal on failure
      }
    }

    // All succeeded (or only config changed)
    toast.success("Teesheet settings updated successfully");
    handleClose();
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Teesheet Settings
          </DialogTitle>
          <DialogDescription>
            Configure teesheet settings for {teesheet.date}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col overflow-hidden"
        >
          <div className="space-y-6 overflow-y-auto px-6">
            <Tabs defaultValue="configuration" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="configuration">Configuration</TabsTrigger>
                <TabsTrigger value="lottery">Lottery</TabsTrigger>
              </TabsList>

              <TabsContent value="configuration" className="space-y-4 pt-4">
                <div className="mb-4 flex items-center gap-2">
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
                  <p className="text-muted-foreground text-sm">
                    Select the configuration for this teesheet
                  </p>
                  {configChanged && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-orange-600">
                      <AlertCircle className="h-4 w-4" />
                      Changing configuration will replace all existing
                      timeblocks
                    </div>
                  )}
                </div>

                {/* Visibility Settings */}
                <div className="space-y-4 border-t pt-4">
                  <div className="mb-4 flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    <h3 className="font-semibold">Visibility</h3>
                  </div>

                  <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label className="text-base">Public Teesheet</Label>
                      <p className="text-muted-foreground text-sm">
                        Make this teesheet visible to members for booking
                      </p>
                    </div>
                    <Switch
                      checked={isPublic}
                      onCheckedChange={(checked) =>
                        setValue("isPublic", checked)
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Private Message</Label>
                    <Textarea
                      placeholder="Message shown to members when teesheet is private"
                      value={privateMessage}
                      onChange={(e) =>
                        setValue("privateMessage", e.target.value)
                      }
                      rows={3}
                    />
                    <p className="text-muted-foreground text-sm">
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
                  <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label className="text-base">
                        Disallow Member Booking
                      </Label>
                      <p className="text-muted-foreground text-sm">
                        When enabled, members cannot book time blocks. Only
                        admin can manage bookings.
                      </p>
                    </div>
                    <Switch
                      checked={disallowMemberBooking}
                      onCheckedChange={(checked) =>
                        setValue("disallowMemberBooking", checked)
                      }
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="lottery" className="space-y-4 pt-4">
                <div className="mb-4 flex items-center gap-2">
                  <Dice1 className="h-4 w-4" />
                  <h3 className="font-semibold">Lottery Settings</h3>
                </div>

                <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label className="text-base">Enable Lottery</Label>
                    <p className="text-muted-foreground text-sm">
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
                  <p className="text-muted-foreground text-sm">
                    This message will be shown to members when lottery is
                    disabled
                  </p>
                  {errors.lotteryDisabledMessage && (
                    <p className="text-sm text-red-600">
                      {errors.lotteryDisabledMessage.message}
                    </p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter className="flex gap-3 pt-6">
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1"
              size="lg"
            >
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

            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
              size="lg"
            >
              Cancel
            </Button>
          </DialogFooter>
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
      </DialogContent>
    </Dialog>
  );
}
