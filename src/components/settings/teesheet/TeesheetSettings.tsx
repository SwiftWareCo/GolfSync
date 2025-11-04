"use client";

import { useState } from "react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  CardContent,
} from "~/components/ui/card";
import { Calendar, Plus, Shield } from "lucide-react";
import { Button } from "~/components/ui/button";
import { TeesheetConfigDialog } from "./TeesheetConfigDialog";
import type {
  TeesheetConfig,
  TeesheetConfigInput,
  RegularConfig,
  Template,
  CustomConfig,
} from "~/app/types/TeeSheetTypes";
import { ConfigTypes } from "~/app/types/TeeSheetTypes";
import toast from "react-hot-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { settingsQueryOptions } from "~/server/query-options/settings-query-options";
import { settingsMutations } from "~/server/query-options/settings-mutation-options";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { Badge } from "~/components/ui/badge";
import { formatTimeStringTo12Hour } from "~/lib/utils";
import { DeleteConfirmationDialog } from "~/components/ui/delete-confirmation-dialog";

interface TeesheetSettingsProps {
  initialConfigs: TeesheetConfig[];
  templates: Template[];
}

export function TeesheetSettings({
  initialConfigs,
  templates,
}: TeesheetSettingsProps) {
  const queryClient = useQueryClient();

  // Use TanStack Query for configs
  const { data: configs = initialConfigs, isLoading } = useQuery(
    settingsQueryOptions.teesheetConfigs()
  );

  const [selectedConfig, setSelectedConfig] = useState<
    TeesheetConfig | undefined
  >(undefined);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [configToDelete, setConfigToDelete] = useState<
    TeesheetConfig | undefined
  >(undefined);

  // Setup mutations with factory pattern
  const createMutation = useMutation({
    ...settingsMutations.createConfig(queryClient),
    onSuccess: () => {
      toast.success("Configuration created successfully");
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create configuration");
    },
  });

  const updateMutation = useMutation({
    ...settingsMutations.updateConfig(queryClient),
    onSuccess: () => {
      toast.success("Configuration updated successfully");
      handleCloseDialog();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update configuration");
    },
  });

  const deleteMutation = useMutation({
    ...settingsMutations.deleteConfig(queryClient),
    onSuccess: () => {
      toast.success("Configuration deleted successfully");
      setIsDeleteDialogOpen(false);
      setConfigToDelete(undefined);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete configuration");
    },
  });

  const handleCloseDialog = () => {
    setSelectedConfig(undefined);
    setIsDialogOpen(false);
  };

  const handleOpenDialog = (config?: TeesheetConfig) => {
    setSelectedConfig(config);
    setIsDialogOpen(true);
  };

  const handleDelete = () => {
    if (!configToDelete) return;
    deleteMutation.mutate(configToDelete.id);
  };

  const handleSaveConfig = (configInput: TeesheetConfigInput) => {
    // Validate required fields for regular config
    if (configInput.type === ConfigTypes.REGULAR) {
      if (
        !configInput.startTime ||
        !configInput.endTime ||
        !configInput.interval ||
        !configInput.maxMembersPerBlock
      ) {
        toast.error("Missing required fields for regular configuration");
        return;
      }
    }

    if (selectedConfig) {
      // Update existing config
      updateMutation.mutate({
        id: selectedConfig.id,
        data: configInput,
      });
    } else {
      // Create new config
      createMutation.mutate(configInput);
    }
  };

  return (
    <>
      <Card className="rounded-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-lg">Teesheet Settings</CardTitle>
              <CardDescription>
                Configure time blocks, intervals, and member limits
              </CardDescription>
            </div>
          </div>
          <Button
            onClick={() => handleOpenDialog()}
            variant="default"
            className="flex items-center gap-2"
            disabled={isLoading || createMutation.isPending}
          >
            <Plus className="h-4 w-4" />
            Create New Configuration
          </Button>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="text-gray-500">Loading configurations...</div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {configs.map((config) => {
              const isRegularConfig = config.type === ConfigTypes.REGULAR;
              const regularConfig = isRegularConfig
                ? (config)
                : null;

              return (
                <div
                  key={config.id}
                  className="flex flex-col space-y-2 rounded-lg border p-4 hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{config.name}</h3>
                      {config.isSystemConfig && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge
                                variant="secondary"
                                className="flex items-center gap-1"
                              >
                                <Shield className="h-3 w-3" />
                                System
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                This is a system configuration that cannot be
                                deleted or deactivated
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDialog(config)}
                        disabled={updateMutation.isPending || deleteMutation.isPending}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setConfigToDelete(config);
                          setIsDeleteDialogOpen(true);
                        }}
                        disabled={config.isSystemConfig || deleteMutation.isPending}
                      >
                        {deleteMutation.isPending && configToDelete?.id === config.id ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {isRegularConfig && regularConfig ? (
                      <>
                        <p>
                          Hours:{" "}
                          {formatTimeStringTo12Hour(regularConfig.startTime)} -{" "}
                          {formatTimeStringTo12Hour(regularConfig.endTime)}
                        </p>
                        <p>Interval: {regularConfig.interval} minutes</p>
                        <p>Max Players: {regularConfig.maxMembersPerBlock}</p>
                      </>
                    ) : (
                      <p>Custom block configuration</p>
                    )}
                    <p>Status: {config.isActive ? "Active" : "Inactive"}</p>
                    <p>
                      Applied to:{" "}
                      {config.rules?.map((rule) =>
                        rule.daysOfWeek
                          ?.map(
                            (day) =>
                              ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
                                day
                              ],
                          )
                          .join(", "),
                      ) || "No days selected"}
                    </p>
                  </div>
                </div>
              );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <TeesheetConfigDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        onSave={handleSaveConfig}
        existingConfig={selectedConfig}
        templates={templates}
      />

      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Delete Configuration"
        description="This action cannot be undone and will permanently delete this configuration."
        itemName={configToDelete?.name}
      />
    </>
  );
}
