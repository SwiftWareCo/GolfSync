"use client";

import { useForm, type UseFormReturn, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { teesheetConfigSchema } from "~/server/db/schema/teesheetConfigs.schema";
import { useActionState, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { ConfigPreview } from "./ConfigPreview";
import type { TeesheetConfigWithBlocks } from "~/server/db/schema";
import {
  createTeesheetConfigAction,
  updateTeesheetConfigAction,
} from "~/server/settings/actions";
import toast from "react-hot-toast";

interface ConfigEditorProps {
  mode: "create" | "edit";
  config?: TeesheetConfigWithBlocks;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ConfigEditor({
  mode,
  config,
  onSuccess,
  onCancel,
}: ConfigEditorProps) {
  const form = useForm({
    resolver: zodResolver(teesheetConfigSchema),
    defaultValues: {
      name: config?.name || "",
      startTime: config?.startTime || "08:00",
      endTime: config?.endTime || "17:00",
      interval: config?.interval || 30,
      maxMembersPerBlock: config?.maxMembersPerBlock || 4,
      isActive: config?.isActive ?? true,
      disallowMemberBooking: config?.disallowMemberBooking ?? false,
    },
  });

  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(
    config?.rules?.[0]?.daysOfWeek || []
  );

  const actionToUse =
    mode === "create" ? createTeesheetConfigAction : updateTeesheetConfigAction;
  const [, action, isPending] = useActionState(actionToUse, null);

  const handleSubmit = async (data: any) => {
    try {
      if (mode === "edit" && config) {
        await action({ id: config.id, ...data });
      } else {
        await action(data);
      }
      toast.success(
        mode === "create"
          ? "Configuration created successfully"
          : "Configuration updated successfully"
      );
      onSuccess();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save configuration"
      );
    }
  };

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      {/* Left Panel - Form Inputs */}
      <div className="space-y-6 overflow-y-auto pr-4">
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Configuration Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Configuration Name</Label>
            <Input
              id="name"
              placeholder="e.g., Morning Shotgun"
              {...form.register("name")}
              className="w-full"
            />
            {form.formState.errors.name && (
              <span className="text-xs text-red-500">
                {form.formState.errors.name.message as string}
              </span>
            )}
          </div>

          {/* Time Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                id="startTime"
                type="time"
                {...form.register("startTime")}
              />
              {form.formState.errors.startTime && (
                <span className="text-xs text-red-500">
                  {form.formState.errors.startTime.message as string}
                </span>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time</Label>
              <Input
                id="endTime"
                type="time"
                {...form.register("endTime")}
              />
              {form.formState.errors.endTime && (
                <span className="text-xs text-red-500">
                  {form.formState.errors.endTime.message as string}
                </span>
              )}
            </div>
          </div>

          {/* Interval & Max Players */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="interval">Interval (minutes)</Label>
              <Input
                id="interval"
                type="number"
                min={5}
                max={60}
                {...form.register("interval", { valueAsNumber: true })}
              />
              {form.formState.errors.interval && (
                <span className="text-xs text-red-500">
                  {form.formState.errors.interval.message as string}
                </span>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxMembersPerBlock">Max Players per Block</Label>
              <Input
                id="maxMembersPerBlock"
                type="number"
                {...form.register("maxMembersPerBlock", { valueAsNumber: true })}
              />
              {form.formState.errors.maxMembersPerBlock && (
                <span className="text-xs text-red-500">
                  {form.formState.errors.maxMembersPerBlock.message as string}
                </span>
              )}
            </div>
          </div>

          {/* Days of Week */}
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
              ].map((day, index) => {
                const isSelected = daysOfWeek.includes(index);
                return (
                  <Button
                    key={day}
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      if (isSelected) {
                        setDaysOfWeek(daysOfWeek.filter((d) => d !== index));
                      } else {
                        setDaysOfWeek([...daysOfWeek, index]);
                      }
                    }}
                  >
                    {day}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={form.watch("isActive")}
                onCheckedChange={(checked) =>
                  form.setValue("isActive", checked)
                }
              />
              <Label htmlFor="isActive">Active</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="disallowMemberBooking"
                checked={form.watch("disallowMemberBooking")}
                onCheckedChange={(checked) =>
                  form.setValue("disallowMemberBooking", checked)
                }
              />
              <Label htmlFor="disallowMemberBooking">
                Disable Member Booking
              </Label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 border-t pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isPending}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="flex-1"
            >
              {isPending
                ? "Saving..."
                : mode === "create"
                  ? "Create Configuration"
                  : "Update Configuration"}
            </Button>
          </div>
        </form>
      </div>

      {/* Right Panel - Live Preview */}
      <div className="hidden overflow-y-auto pr-4 lg:block">
        <ConfigPreview control={form.control} blocks={config?.blocks || []} />
      </div>

      {/* Mobile Preview - Below Form */}
      <div className="block lg:hidden">
        <ConfigPreview control={form.control} blocks={config?.blocks || []} />
      </div>
    </div>
  );
}
