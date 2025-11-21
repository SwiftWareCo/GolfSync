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
import { CreateConfigDialog } from "./CreateConfigDialog";
import { EditConfigDialog } from "./EditConfigDialog";
import type { Template } from "~/app/types/TeeSheetTypes";
import toast from "react-hot-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { Badge } from "~/components/ui/badge";
import { formatTimeStringTo12Hour } from "~/lib/utils";
import { DeleteConfirmationDialog } from "~/components/ui/delete-confirmation-dialog";
import { TeesheetConfigRule, TeesheetConfigWithRules } from "~/server/db/schema";
import {
  deleteTeesheetConfig,
  createTeesheetConfigAction,
  updateTeesheetConfigAction,
} from "~/server/settings/actions";

interface TeesheetSettingsProps {
  configs: TeesheetConfigWithRules[];
  templates: Template[];
}

export function TeesheetSettings({
  configs,
  templates,
}: TeesheetSettingsProps) {
  // Dialog state: null = closed, config object = editing, "create" = creating new
  const [dialogState, setDialogState] = useState<TeesheetConfigWithRules | "create" | null>(null);
  const [deletingConfig, setDeletingConfig] = useState<TeesheetConfigWithRules | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isCreating = dialogState === "create";
  const isEditing = dialogState !== null && dialogState !== "create";
  const editingConfig = isEditing ? (dialogState as TeesheetConfigWithRules) : null;

  const handleCloseDialog = () => {
    setDialogState(null);
  };

  const handleOpenCreateDialog = () => {
    setDialogState("create");
  };

  const handleOpenEditDialog = (config: TeesheetConfigWithRules) => {
    setDialogState(config);
  };

  const handleDelete = async (configId: number) => {
    try {
      setIsLoading(true);
      await deleteTeesheetConfig(configId);
      toast.success("Configuration deleted successfully");
      setDeletingConfig(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete configuration",
      );
    } finally {
      setIsLoading(false);
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
            onClick={handleOpenCreateDialog}
            variant="default"
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Create New Configuration
          </Button>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {configs.map((config: TeesheetConfigWithRules) => {

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
                                deleted
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
                        onClick={() => handleOpenEditDialog(config)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeletingConfig(config)}
                        disabled={
                          config.isSystemConfig || isLoading
                        }
                      >
                        {isLoading
                          ? "Deleting..."
                          : "Delete"}
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {config.type === "REGULAR" ? (
                      <>
                        <p>
                          Hours:{" "}
                          {formatTimeStringTo12Hour(
                            config.startTime as string,
                          )}{" "}
                          -{" "}
                          {formatTimeStringTo12Hour(
                            config.endTime as string,
                          )}
                        </p>
                        <p>Interval: {config.interval} minutes</p>
                        <p>Max Players: {config.maxMembersPerBlock}</p>
                      </>
                    ) : (
                      <p>Custom block configuration</p>
                    )}
                    <p>Status: {config.isActive ? "Active" : "Inactive"}</p>
                    <p>
                      Applied to:{" "}
                      {config.rules?.map((rule: TeesheetConfigRule) =>
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
        </CardContent>
      </Card>

      <CreateConfigDialog
        isOpen={isCreating}
        onClose={handleCloseDialog}
        action={createTeesheetConfigAction}
        templates={templates as any}
        onSuccess={handleCloseDialog}
      />

      {editingConfig && (
        <EditConfigDialog
          isOpen={isEditing}
          onClose={handleCloseDialog}
          action={updateTeesheetConfigAction}
          config={editingConfig}
          templates={templates as any}
          onSuccess={handleCloseDialog}
        />
      )}

      <DeleteConfirmationDialog
        open={deletingConfig !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingConfig(null);
        }}
        onConfirm={() => {
          if (deletingConfig) {
            handleDelete(deletingConfig.id);
          }
        }}
        title="Delete Configuration"
        description="This action cannot be undone and will permanently delete this configuration."
        itemName={deletingConfig?.name}
      />
    </>
  );
}
