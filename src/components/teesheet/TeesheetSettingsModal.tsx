"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import {
  Dialog,
  DialogContent,
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
import { settingsMutations } from "~/server/query-options/settings-mutation-options";
import type { Teesheet, TeesheetConfig } from "~/server/db/schema";

interface TeesheetSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  teesheet: Teesheet;
  availableConfigs: TeesheetConfig[];
  onSuccess?: () => void;
}

export function TeesheetSettingsModal({
  isOpen,
  onClose,
  teesheet,
  availableConfigs,
  onSuccess,
}: TeesheetSettingsModalProps) {
  const queryClient = useQueryClient();
  const [showConfigConfirmation, setShowConfigConfirmation] = useState(false);

  // Simple state object for all settings
  const [formData, setFormData] = useState({
    configId: teesheet.configId,
    lotteryEnabled: teesheet.lotteryEnabled ?? true,
    lotteryDisabledMessage:
      teesheet.lotteryDisabledMessage ||
      "Lottery signup is disabled for this date",
    isPublic: teesheet.isPublic || false,
    privateMessage:
      teesheet.privateMessage ||
      "This teesheet is not yet available for booking.",
  });

  // Reset form when teesheet/props change
  useEffect(() => {
    setFormData({
      configId: teesheet.configId,
      lotteryEnabled: teesheet.lotteryEnabled ?? true,
      lotteryDisabledMessage:
        teesheet.lotteryDisabledMessage ||
        "Lottery signup is disabled for this date",
      isPublic: teesheet.isPublic || false,
      privateMessage:
        teesheet.privateMessage ||
        "This teesheet is not yet available for booking.",
    });
  }, [teesheet]);

  // Setup mutations
  const updateConfigMutation = () => {
    //TODO: implement timeblcok granular changes instead?
  };
  const updateLotteryMutation = useMutation(
    settingsMutations.updateLotterySettings(queryClient)
  );
  const updateVisibilityMutation = useMutation(
    settingsMutations.updateVisibility(queryClient)
  );

  const isLoading =
    updateLotteryMutation.isPending ||
    updateVisibilityMutation.isPending;

  const configChanged = formData.configId !== teesheet.configId;

  const handleSave = async () => {
    // Check if configuration is changed and show confirmation
    if (configChanged && !showConfigConfirmation) {
      setShowConfigConfirmation(true);
      return;
    }

    try {
      const promises = [];

      // Update lottery settings
      promises.push(
        updateLotteryMutation.mutateAsync({
          teesheetId: teesheet.id,
          settings: {
            isLotteryEnabled: formData.lotteryEnabled,
            lotteryDisabledMessage: formData.lotteryDisabledMessage,
          },
        })
      );

      // Update visibility settings
      promises.push(
        updateVisibilityMutation.mutateAsync({
          teesheetId: teesheet.id,
          isPublic: formData.isPublic,
          privateMessage: formData.privateMessage,
        })
      );

      await Promise.all(promises);

      toast.success("Teesheet settings updated successfully");
      onSuccess?.();
      onClose();
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
    // Reset to initial state
    setFormData({
      configId: teesheet.configId,
      lotteryEnabled: teesheet.lotteryEnabled ?? true,
      lotteryDisabledMessage:
        teesheet.lotteryDisabledMessage ||
        "Lottery signup is disabled for this date",
      isPublic: teesheet.isPublic || false,
      privateMessage:
        teesheet.privateMessage ||
        "This teesheet is not yet available for booking.",
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Teesheet Settings
          </DialogTitle>
          <DialogDescription>
            Configure teesheet settings for {teesheet.date}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
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
                  value={formData.configId.toString()}
                  onValueChange={(value) =>
                    setFormData({ ...formData, configId: parseInt(value) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select configuration" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableConfigs.map((config) => (
                      <SelectItem
                        key={config?.id}
                        value={config?.id?.toString()}
                      >
                        {config?.name}
                        {config?.id === teesheet.configId && " (Current)"}
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
                    Changing configuration will remove all existing bookings
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
                    checked={formData.isPublic}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isPublic: checked })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Private Message</Label>
                  <Textarea
                    placeholder="Message shown to members when teesheet is private"
                    value={formData.privateMessage}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        privateMessage: e.target.value,
                      })
                    }
                    rows={3}
                  />
                  <p className="text-sm text-muted-foreground">
                    This message will be shown to members when the teesheet is private
                  </p>
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
                          {availableConfigs.find((c) => c.id === formData.configId)
                            ?.disallowMemberBooking
                            ? "Member Booking Disabled"
                            : "Member Booking Enabled"}
                        </p>
                        <p className="text-sm text-blue-700 mt-1">
                          {availableConfigs.find((c) => c.id === formData.configId)
                            ?.disallowMemberBooking
                            ? "Members cannot book time blocks for this configuration. Only admin can manage bookings."
                            : "Members can book available time blocks in this configuration."}
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This setting is configured at the teesheet configuration level. Change it in the configuration settings.
                  </p>
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
                  checked={formData.lotteryEnabled}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, lotteryEnabled: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Disabled Message</Label>
                <Textarea
                  placeholder="Message shown to members when lottery is disabled"
                  value={formData.lotteryDisabledMessage}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      lotteryDisabledMessage: e.target.value,
                    })
                  }
                  rows={3}
                />
                <p className="text-sm text-muted-foreground">
                  This message will be shown to members when lottery is disabled
                </p>
              </div>
            </TabsContent>

          </Tabs>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isLoading}>
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
        </div>

        {/* Configuration Change Confirmation Dialog */}
        <ConfirmationDialog
          open={showConfigConfirmation}
          onOpenChange={setShowConfigConfirmation}
          onConfirm={() => {
            setShowConfigConfirmation(false);
            handleSave();
          }}
          title="Change Teesheet Configuration"
          description="Changing the configuration will remove all existing bookings and lottery entries from this teesheet. Are you sure you want to continue?"
          confirmText="Change Configuration"
          cancelText="Cancel"
          variant="destructive"
          loading={isLoading}
        />
      </DialogContent>
    </Dialog>
  );
}
