"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import type {
  TeesheetConfig,
  TeesheetConfigInput,
  TimeBlock,
  RegularConfig,
  Template,
  TemplateBlock,
} from "~/app/types/TeeSheetTypes";
import { ConfigTypes } from "~/app/types/TeeSheetTypes";
import { TimeBlockPreviewPanel } from "./TimeBlockPreviewPanel";
import { generateTimeBlocks } from "~/lib/utils";
import { ManageTemplatesDialog } from "./ManageTemplatesDialog";

interface TeesheetConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: TeesheetConfigInput) => void;
  existingConfig?: TeesheetConfig;
  templates?: Template[];
}

// Add blocks to TeesheetConfigInput type
interface ExtendedTeesheetConfigInput extends TeesheetConfigInput {
  blocks?: TemplateBlock[];
  hasScheduleRules?: boolean;
  templateId?: number;
}

export function TeesheetConfigDialog({
  isOpen,
  onClose,
  onSave,
  existingConfig,
  templates = [],
}: TeesheetConfigDialogProps) {
  const [previewBlocks, setPreviewBlocks] = useState<TimeBlock[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null,
  );
  const [isManageTemplatesOpen, setIsManageTemplatesOpen] = useState(false);
  const [localTemplates, setLocalTemplates] = useState<Template[]>(templates);

  const defaultValues = {
    name: "",
    type: ConfigTypes.REGULAR,
    startTime: "07:00",
    endTime: "19:00",
    interval: 15,
    maxMembersPerBlock: 4,
    isActive: true,
    hasScheduleRules: false,
    templateId: undefined,
    disallowMemberBooking: false,
    rules: [
      {
        daysOfWeek: [],
        startDate: null,
        endDate: null,
        priority: 1,
        isActive: true,
      },
    ],
  };

  const form = useForm<ExtendedTeesheetConfigInput>({
    defaultValues,
  });

  const { handleSubmit, reset, watch, setValue, register } = form;
  const configType = watch("type");
  const startTime = watch("startTime");
  const endTime = watch("endTime");
  const interval = watch("interval");
  const hasScheduleRules = watch("hasScheduleRules");

  // Reset form when existingConfig changes
  useEffect(() => {
    if (existingConfig) {
      const isRegularConfig = existingConfig.type === ConfigTypes.REGULAR;

      // If it's a custom config, find the associated template
      if (!isRegularConfig && existingConfig.templateId) {
        const template = templates.find(
          (t) => t.id === existingConfig.templateId,
        );
        if (template) {
          setSelectedTemplate(template);
        }
      }

      const formData = {
        name: existingConfig.name,
        type: existingConfig.type,
        startTime: isRegularConfig
          ? (existingConfig).startTime
          : undefined,
        endTime: isRegularConfig
          ? (existingConfig).endTime
          : undefined,
        interval: isRegularConfig
          ? (existingConfig).interval
          : undefined,
        maxMembersPerBlock: isRegularConfig
          ? (existingConfig).maxMembersPerBlock
          : undefined,
        isActive: existingConfig.isActive,
        hasScheduleRules: existingConfig.rules?.length > 0,
        templateId: !isRegularConfig ? existingConfig.templateId : undefined,
        disallowMemberBooking: existingConfig.disallowMemberBooking ?? false,
        rules:
          existingConfig.rules?.map((rule) => ({
            daysOfWeek: rule.daysOfWeek || [],
            startDate: rule.startDate
              ? new Date(rule.startDate).toISOString().split("T")[0]
              : null,
            endDate: rule.endDate
              ? new Date(rule.endDate).toISOString().split("T")[0]
              : null,
            priority: rule.priority,
            isActive: rule.isActive,
          })) || [],
      };

      reset(formData);
    } else {
      // If no existingConfig, reset to default values
      reset(defaultValues);
      setSelectedTemplate(null);
      setPreviewBlocks([]);
    }
  }, [existingConfig, reset, templates]);

  // Update preview blocks whenever relevant fields change or template is selected
  useEffect(() => {
    if (
      configType === ConfigTypes.REGULAR &&
      startTime &&
      endTime &&
      interval
    ) {
      const blocks = generateTimeBlocks({
        startTime,
        endTime,
        interval,
      });
      setPreviewBlocks(
        blocks.map((time, index) => ({
          id: index,
          teesheetId: 0,
          startTime: time,
          endTime: blocks[index + 1] || endTime,
          maxMembers: watch("maxMembersPerBlock") || 4,
          sortOrder: index,
          type: ConfigTypes.REGULAR,
          createdAt: new Date(),
          updatedAt: null,
        })),
      );
    } else if (configType === ConfigTypes.CUSTOM && selectedTemplate?.blocks) {
      setPreviewBlocks(
        selectedTemplate.blocks.map((block, index) => ({
          id: index,
          teesheetId: 0,
          startTime: block.startTime,
          endTime: block.startTime,
          maxMembers: block.maxPlayers,
          displayName: block.displayName,
          sortOrder: index,
          type: ConfigTypes.CUSTOM,
          createdAt: new Date(),
          updatedAt: null,
        })),
      );
    }
  }, [configType, startTime, endTime, interval, selectedTemplate, watch]);

  // Update localTemplates when parent templates change
  useEffect(() => {
    setLocalTemplates(templates);
  }, [templates]);

  const handleTemplateSelect = (templateId: number) => {
    const template = localTemplates.find((t) => t.id === templateId);
    if (template) {
      setSelectedTemplate(template);
      // Update form values when template is selected
      setValue("type", ConfigTypes.CUSTOM); // Ensure type is set to CUSTOM
      setValue("templateId", template.id);
      setValue("blocks", template.blocks);

      // Log current form values after update
      const currentValues = form.getValues();
    }
  };

  const handleTemplatesChange = (updatedTemplates: Template[]) => {
    setLocalTemplates(updatedTemplates);
    // If the selected template was updated, update it
    if (selectedTemplate) {
      const updated = updatedTemplates.find(
        (t) => t.id === selectedTemplate.id,
      );
      if (updated) {
        setSelectedTemplate(updated);
      }
    }
  };

  const handleClose = () => {
    // Reset form to default values
    reset(defaultValues);
    // Clear selected template
    setSelectedTemplate(null);
    // Reset preview blocks
    setPreviewBlocks([]);
    // Call the parent's onClose
    onClose();
  };

  const onSubmit = (data: ExtendedTeesheetConfigInput) => {
    const formData = { ...data };

    // Ensure templateId is included for custom configs
    if (configType === ConfigTypes.CUSTOM) {
      // Use the selected template if available, otherwise keep existing templateId
      formData.templateId = selectedTemplate?.id || formData.templateId;
      formData.blocks = selectedTemplate?.blocks || formData.blocks;
      // Keep schedule rules for custom configs if enabled
      if (!formData.hasScheduleRules) {
        formData.rules = [];
      } else {
        // Ensure each rule has priority set to 1 if not specified
        formData.rules = formData.rules.map((rule) => ({
          ...rule,
          priority: rule.priority || 1,
        }));
      }
    } else {
      // Clear template-related fields for regular configs
      formData.templateId = undefined;
      formData.blocks = undefined;
      // Only include rules if hasScheduleRules is true for regular configs
      if (!formData.hasScheduleRules) {
        formData.rules = [];
      } else {
        // Ensure each rule has priority set to 1 if not specified
        formData.rules = formData.rules.map((rule) => ({
          ...rule,
          priority: rule.priority || 1,
        }));
      }
    }

    onSave(formData as TeesheetConfigInput);
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-5xl max-h-[90vh] p-0 flex flex-col">
          <DialogHeader className="p-6 pb-0 shrink-0">
            <DialogTitle className="text-xl font-semibold">
              {existingConfig
                ? "Edit Teesheet Configuration"
                : "Create New Configuration"}
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              Configure tee time settings and preview the generated time blocks
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col overflow-hidden flex-1">
            <div className="p-6 pt-4 overflow-y-auto flex-1">
            <div className="grid grid-cols-2 gap-8">
              {/* Left Panel - Configuration */}
              <div className="space-y-6">
                <div className="space-y-4">
                  {/* Basic Info */}
                  <div className="space-y-2">
                    <Label htmlFor="name">Configuration Name</Label>
                    <Input
                      id="name"
                      {...register("name", { required: true })}
                      placeholder="e.g., Morning Shotgun"
                      className="w-full"
                    />
                  </div>

                  {/* Configuration Type */}
                  <div className="space-y-2">
                    <Label>Configuration Type</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={
                          configType === ConfigTypes.REGULAR
                            ? "default"
                            : "outline"
                        }
                        onClick={() => setValue("type", ConfigTypes.REGULAR)}
                        className={
                          configType === ConfigTypes.REGULAR
                            ? "w-full bg-[#1e3a5f] text-white hover:bg-[#1e3a5f]/90"
                            : "w-full"
                        }
                      >
                        Regular Intervals
                      </Button>
                      <Button
                        type="button"
                        variant={
                          configType === ConfigTypes.CUSTOM
                            ? "default"
                            : "outline"
                        }
                        onClick={() => setValue("type", ConfigTypes.CUSTOM)}
                        className={
                          configType === ConfigTypes.CUSTOM
                            ? "w-full bg-[#1e3a5f] text-white hover:bg-[#1e3a5f]/90"
                            : "w-full"
                        }
                      >
                        Custom Blocks
                      </Button>
                    </div>
                  </div>

                  {/* Type-specific Settings */}
                  {configType === ConfigTypes.REGULAR ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="startTime">Start Time</Label>
                          <Input
                            id="startTime"
                            type="time"
                            {...register("startTime")}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="endTime">End Time</Label>
                          <Input
                            id="endTime"
                            type="time"
                            {...register("endTime")}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="interval">Interval (minutes)</Label>
                          <Input
                            id="interval"
                            type="number"
                            min={5}
                            max={60}
                            {...register("interval")}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="maxMembers">
                            Max Players per Time
                          </Label>
                          <Input
                            id="maxMembers"
                            type="number"
                            min={1}
                            max={8}
                            {...register("maxMembersPerBlock")}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label>Template Selection</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setIsManageTemplatesOpen(true)}
                        >
                          Manage Templates
                        </Button>
                      </div>
                      {configType === ConfigTypes.CUSTOM ? (
                        <div className="space-y-2">
                          {localTemplates.map((template) => (
                            <div
                              key={template.id}
                              className={`cursor-pointer rounded-lg border-2 p-3 transition-colors hover:bg-gray-50 ${
                                selectedTemplate?.id === template.id
                                  ? "border-org-primary bg-org-primary/5"
                                  : "border-gray-200"
                              }`}
                              onClick={() => handleTemplateSelect(template.id)}
                            >
                              <div className="font-medium">{template.name}</div>
                              <div className="text-sm text-gray-500">
                                {template.blocks?.length || 0} blocks
                              </div>
                            </div>
                          ))}

                          {localTemplates.length === 0 && (
                            <div className="rounded-lg border border-dashed p-4 text-center text-sm text-gray-500">
                              No templates available. Click 'Manage Templates'
                              to create one.
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed p-4">
                          <p className="text-sm text-gray-500">
                            Template selection is only available for custom
                            block configurations.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {configType === ConfigTypes.CUSTOM && (
                    <div className="flex items-center space-x-2 pt-4">
                      <Switch
                        id="disallowMemberBooking"
                        checked={watch("disallowMemberBooking")}
                        onCheckedChange={(checked) =>
                          setValue("disallowMemberBooking", checked)
                        }
                      />
                      <Label
                        htmlFor="disallowMemberBooking"
                        className="text-sm text-gray-700"
                      >
                        Disable Member Booking
                      </Label>
                      <div className="ml-1">
                        <span className="text-xs text-gray-500">
                          (Members will not be able to book this teesheet)
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Schedule Rules Toggle - Show for both Regular and Custom configs */}
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="hasScheduleRules"
                      checked={hasScheduleRules}
                      onCheckedChange={(checked) =>
                        setValue("hasScheduleRules", checked)
                      }
                    />
                    <Label htmlFor="hasScheduleRules">
                      Enable Schedule Rules
                    </Label>
                  </div>

                  {/* Schedule Rules */}
                  {hasScheduleRules && (
                    <div className="space-y-2">
                      <Label>Schedule Rules</Label>
                      <div className="space-y-4 rounded-lg border p-4">
                        <div className="space-y-2">
                          <Label>Days of Week</Label>
                          <div className="grid grid-cols-4 gap-2">
                            {[
                              "Sun",
                              "Mon",
                              "Tue",
                              "Wed",
                              "Thu",
                              "Fri",
                              "Sat",
                            ].map((day, index) => (
                              <Button
                                key={day}
                                type="button"
                                variant="outline"
                                size="sm"
                                className={`w-full ${watch("rules.0.daysOfWeek")?.includes(index) ? "bg-[#1e3a5f] text-white" : ""}`}
                                onClick={() => {
                                  const currentDays =
                                    watch("rules.0.daysOfWeek") || [];
                                  if (currentDays.includes(index)) {
                                    setValue(
                                      "rules.0.daysOfWeek",
                                      currentDays.filter(
                                        (d) => d !== index,
                                      ),
                                    );
                                  } else {
                                    setValue("rules.0.daysOfWeek", [
                                      ...currentDays,
                                      index,
                                    ]);
                                  }
                                }}
                              >
                                {day}
                              </Button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Priority (1-10)</Label>
                          <Input
                            type="number"
                            min={1}
                            max={10}
                            {...register("rules.0.priority")}
                            className="w-24"
                          />
                          <p className="text-sm text-gray-500">
                            Higher priority configurations override lower
                            priority ones
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center space-x-2 pt-2">
                    <Switch
                      id="isActive"
                      checked={watch("isActive")}
                      onCheckedChange={(checked) =>
                        setValue("isActive", checked)
                      }
                    />
                    <Label htmlFor="isActive">Active</Label>
                  </div>
                </div>
              </div>

              {/* Right Panel - Preview */}
              <div>
                <h3 className="mb-4 text-base font-semibold">Preview</h3>
                <TimeBlockPreviewPanel blocks={previewBlocks} />
              </div>
            </div>
            </div>

            <DialogFooter className="p-6 pt-4 border-t shrink-0 flex-row justify-end gap-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ManageTemplatesDialog
        isOpen={isManageTemplatesOpen}
        onClose={() => setIsManageTemplatesOpen(false)}
        templates={localTemplates}
        onSave={handleTemplatesChange}
        selectedTemplateId={selectedTemplate?.id}
        onTemplateSelect={handleTemplateSelect}
      />
    </>
  );
}
