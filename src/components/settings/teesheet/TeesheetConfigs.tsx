"use client";

import { useState, startTransition, useActionState } from "react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  CardContent,
} from "~/components/ui/card";
import { Calendar, Plus, Trash } from "lucide-react";
import { Button } from "~/components/ui/button";
import { ConfigEditor } from "./ConfigEditor";
import toast from "react-hot-toast";
import { DeleteConfirmationDialog } from "~/components/ui/delete-confirmation-dialog";
import { TeesheetConfigWithBlocks } from "~/server/db/schema";
import { deleteTeesheetConfig } from "~/server/settings/actions";

interface TeesheetConfigsProps {
  configs: TeesheetConfigWithBlocks[];
}

export function TeesheetConfigs({ configs }: TeesheetConfigsProps) {
  const [editorState, setEditorState] = useState<{
    mode: "create" | "edit";
    config?: TeesheetConfigWithBlocks;
  } | null>(null);
  const [deletingConfig, setDeletingConfig] =
    useState<TeesheetConfigWithBlocks | null>(null);


  const [error, action, isPending] = useActionState(deleteTeesheetConfig, null);

  const handleOpenCreateEditor = () => {
    setEditorState({ mode: "create" });
  };

  const handleOpenEditEditor = (config: TeesheetConfigWithBlocks) => {
    setEditorState({ mode: "edit", config });
  };

  const handleCloseEditor = () => {
    setEditorState(null);
  };

  const handleDelete = (configId: number) => {
    try {
      startTransition(() => action(configId));
      toast.success("Configuration deleted successfully");
      setDeletingConfig(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete configuration",
      );
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
      {/* Left Panel - Configs List */}
      <div className="lg:col-span-1">
        <Card className="rounded-lg">
          <CardHeader>
            <div className="flex items-center space-x-4">
              <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                <Calendar className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg">Teesheet Settings</CardTitle>
                <CardDescription>
                  Configure time blocks and intervals
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            <Button
              onClick={handleOpenCreateEditor}
              variant="default"
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create New
            </Button>

            <div className="space-y-2">
              {configs.length === 0 ? (
                <div className="py-8 text-center text-sm text-gray-500">
                  No configurations yet
                </div>
              ) : (
                configs.map((config) => (
                  <div
                    key={config?.id}
                    className={`group hover:bg-org-primary flex cursor-pointer flex-row items-center justify-between rounded-lg border p-3 transition-colors hover:text-white ${
                      editorState?.config?.id === config?.id
                        ? "bg-org-primary text-white"
                        : ""
                    }`}
                    onClick={() => handleOpenEditEditor(config)}
                  >
                    <div className="flex items-center justify-between gap-2 flex-1">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-medium">
                          {config.name}
                        </h3>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="text-xs"
                    >
                      <Trash
                        className="h-4 w-4"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingConfig(config);
                        }}
                      />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Panel - Editor or Empty State */}
      <div className="lg:col-span-3">
        {editorState ? (
          <Card className="rounded-lg py-4">
            <CardContent className="max-h-[calc(100vh-200px)] overflow-auto">
              <ConfigEditor
                key={editorState.config?.id}
                mode={editorState.mode}
                config={editorState.config}
                onSuccess={handleCloseEditor}
                onCancel={handleCloseEditor}
              />
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-lg">
            <CardContent className="flex items-center justify-center py-16">
              <div className="text-center">
                <Calendar className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900">
                  No configuration selected
                </h3>
                <p className="mt-2 text-sm text-gray-500">
                  Select an existing configuration or create a new one to get
                  started
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={deletingConfig !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingConfig(null);
        }}
        onConfirm={() => {
          handleDelete(deletingConfig!.id);
        }}
        title="Delete Configuration"
        description="This action cannot be undone and will permanently delete this configuration."
        itemName={deletingConfig?.name}
      />
    </div>
  );
}
