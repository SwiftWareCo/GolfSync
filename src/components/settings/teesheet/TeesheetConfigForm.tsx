"use client";

import { useState, useEffect, useRef } from "react";
import { useActionState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import type {
  TeesheetConfigWithRules,
  Templates,
} from "~/server/db/schema";
import { TimeBlockPreviewPanel } from "./TimeBlockPreviewPanel";
import { generateTimeBlocks } from "~/lib/utils";
import type { TimeBlock } from "~/app/types/TeeSheetTypes";
import toast from "react-hot-toast";

interface TemplateBlock {
  displayName: string | null;
  startTime: string;
  maxPlayers: number;
}

interface Template extends Omit<Templates, "blocks"> {
  blocks?: TemplateBlock[];
}

export interface TeesheetConfigFormData {
  name: string;
  type: "REGULAR" | "CUSTOM";
  startTime?: string;
  endTime?: string;
  interval?: number;
  maxMembersPerBlock?: number;
  isActive: boolean;
  disallowMemberBooking?: boolean;
  templateId?: number;
  blocks?: TemplateBlock[];
  hasScheduleRules?: boolean;
  rules: Array<{
    daysOfWeek: number[] | null;
    startDate: string | null;
    endDate: string | null;
  }>;
}

interface TeesheetConfigFormProps {
  initialData?: TeesheetConfigWithRules;
  templates: Template[];
  action: (formData: FormData) => Promise<void>;
  onSuccess?: () => void;
}

/**
 * Helper: Convert database config to form state
 */
function mapConfigToState(config: TeesheetConfigWithRules) {
  const isRegularConfig = config.type === "REGULAR";

  return {
    name: config.name,
    type: config.type as "REGULAR" | "CUSTOM",
    startTime: isRegularConfig && config.startTime ? config.startTime : "07:00",
    endTime: isRegularConfig && config.endTime ? config.endTime : "19:00",
    interval: isRegularConfig && config.interval ? config.interval : 15,
    maxMembersPerBlock:
      isRegularConfig && config.maxMembersPerBlock ? config.maxMembersPerBlock : 4,
    isActive: config.isActive,
    disallowMemberBooking: config.disallowMemberBooking ?? false,
    templateId: !isRegularConfig ? config.templateId ?? undefined : undefined,
    hasScheduleRules: (config.rules ?? []).length > 0,
    daysOfWeek: config.rules?.[0]?.daysOfWeek ?? [],
  };
}

export function TeesheetConfigForm({
  initialData,
  templates,
  action,
  onSuccess,
}: TeesheetConfigFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [previewBlocks, setPreviewBlocks] = useState<TimeBlock[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [configType, setConfigType] = useState<"REGULAR" | "CUSTOM">("REGULAR");
  const [startTime, setStartTime] = useState("07:00");
  const [endTime, setEndTime] = useState("19:00");
  const [interval, setInterval] = useState(15);
  const [maxMembersPerBlock, setMaxMembersPerBlock] = useState(4);
  const [isActive, setIsActive] = useState(true);
  const [disallowMemberBooking, setDisallowMemberBooking] = useState(false);
  const [hasScheduleRules, setHasScheduleRules] = useState(false);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);

  // Server action with useActionState
  const [, formAction, isPending] = useActionState(
    async (_: any, formData: FormData) => {
      try {
        await action(formData);
        toast.success(
          initialData
            ? "Configuration updated successfully"
            : "Configuration created successfully"
        );
        onSuccess?.();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to save configuration";
        toast.error(message);
      }
    },
    null
  );

  // Initialize form with data
  useEffect(() => {
    if (initialData) {
      const state = mapConfigToState(initialData);
      setName(state.name);
      setConfigType(state.type);
      setStartTime(state.startTime);
      setEndTime(state.endTime);
      setInterval(state.interval);
      setMaxMembersPerBlock(state.maxMembersPerBlock);
      setIsActive(state.isActive);
      setDisallowMemberBooking(state.disallowMemberBooking);
      setHasScheduleRules(state.hasScheduleRules);
      setDaysOfWeek(state.daysOfWeek);

      if (state.type === "CUSTOM" && state.templateId) {
        const template = templates.find((t) => t.id === state.templateId);
        if (template) {
          setSelectedTemplate(template);
        }
      }
    }
  }, [initialData, templates]);

  // Update preview blocks when form values change
  useEffect(() => {
    if (configType === "REGULAR" && startTime && endTime && interval) {
      const blocks = generateTimeBlocks(startTime, endTime, interval);
      setPreviewBlocks(
        blocks.map((time, index) => ({
          id: index,
          teesheetId: 0,
          startTime: time,
          endTime: blocks[index + 1] || endTime,
          maxMembers: maxMembersPerBlock,
          sortOrder: index,
          type: "REGULAR" as const,
          createdAt: new Date(),
          updatedAt: null,
        })) as TimeBlock[]
      );
    } else if (configType === "CUSTOM" && selectedTemplate?.blocks) {
      setPreviewBlocks(
        selectedTemplate.blocks.map((block, index) => ({
          id: index,
          teesheetId: 0,
          startTime: block.startTime,
          endTime: block.startTime,
          maxMembers: block.maxPlayers,
          displayName: block.displayName,
          sortOrder: index,
          type: "CUSTOM" as const,
          createdAt: new Date(),
          updatedAt: null,
        })) as TimeBlock[]
      );
    }
  }, [configType, startTime, endTime, interval, maxMembersPerBlock, selectedTemplate]);

  const handleTemplateSelect = (templateId: number) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setSelectedTemplate(template);
      setConfigType("CUSTOM");
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append("name", name);
    formData.append("type", configType);
    formData.append("isActive", String(isActive));

    if (configType === "REGULAR") {
      formData.append("startTime", startTime);
      formData.append("endTime", endTime);
      formData.append("interval", String(interval));
      formData.append("maxMembersPerBlock", String(maxMembersPerBlock));

      if (hasScheduleRules && daysOfWeek.length > 0) {
        formData.append("daysOfWeek", JSON.stringify(daysOfWeek));
      }
    } else {
      formData.append("templateId", String(selectedTemplate?.id ?? ""));
      formData.append("disallowMemberBooking", String(disallowMemberBooking));
    }

    // Add config ID for updates
    if (initialData) {
      formData.append("configId", String(initialData.id));
    }

    formAction(formData);
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="p-6 pt-4">
      <div className="grid grid-cols-2 gap-8">
        {/* Left Panel - Configuration */}
        <div className="space-y-6">
          <div className="space-y-4">
            {/* Basic Info */}
            <div className="space-y-2">
              <Label htmlFor="name">Configuration Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Morning Shotgun"
                className="w-full"
                required
              />
            </div>

            {/* Configuration Type */}
            <div className="space-y-2">
              <Label>Configuration Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={configType === "REGULAR" ? "default" : "outline"}
                  onClick={() => setConfigType("REGULAR")}
                  className={
                    configType === "REGULAR"
                      ? "w-full bg-[#1e3a5f] text-white hover:bg-[#1e3a5f]/90"
                      : "w-full"
                  }
                >
                  Regular Intervals
                </Button>
                <Button
                  type="button"
                  variant={configType === "CUSTOM" ? "default" : "outline"}
                  onClick={() => setConfigType("CUSTOM")}
                  className={
                    configType === "CUSTOM"
                      ? "w-full bg-[#1e3a5f] text-white hover:bg-[#1e3a5f]/90"
                      : "w-full"
                  }
                >
                  Custom Blocks
                </Button>
              </div>
            </div>

            {/* Type-specific Settings */}
            {configType === "REGULAR" ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startTime">Start Time</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endTime">End Time</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      required
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
                      value={interval}
                      onChange={(e) => setInterval(Number(e.target.value))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxMembers">Max Players per Time</Label>
                    <Input
                      id="maxMembers"
                      type="number"
                      min={1}
                      max={8}
                      value={maxMembersPerBlock}
                      onChange={(e) =>
                        setMaxMembersPerBlock(Number(e.target.value))
                      }
                      required
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <Label>Template Selection</Label>
                <div className="space-y-2">
                  {templates.map((template) => (
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

                  {templates.length === 0 && (
                    <div className="rounded-lg border border-dashed p-4 text-center text-sm text-gray-500">
                      <p className="mb-2">No templates available.</p>
                      <p className="text-xs">
                        Go to the Templates tab in settings to create one.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {configType === "CUSTOM" && (
              <div className="flex items-center space-x-2 pt-4">
                <Switch
                  id="disallowMemberBooking"
                  checked={disallowMemberBooking}
                  onCheckedChange={setDisallowMemberBooking}
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

            {/* Schedule Rules Toggle - Only show for Regular config */}
            {configType === "REGULAR" && (
              <>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="hasScheduleRules"
                    checked={hasScheduleRules}
                    onCheckedChange={setHasScheduleRules}
                  />
                  <Label htmlFor="hasScheduleRules">Enable Schedule Rules</Label>
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
                              className={`w-full ${
                                daysOfWeek.includes(index)
                                  ? "bg-[#1e3a5f] text-white"
                                  : ""
                              }`}
                              onClick={() => {
                                setDaysOfWeek((current) =>
                                  current.includes(index)
                                    ? current.filter((d) => d !== index)
                                    : [...current, index]
                                );
                              }}
                            >
                              {day}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="flex items-center space-x-2 pt-2">
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={setIsActive}
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

      {/* Submit Button */}
      <div className="mt-6 flex justify-end gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
