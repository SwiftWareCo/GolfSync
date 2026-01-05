"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useActionState, useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { ConfigPreview } from "./ConfigPreview";
import type {
  TeesheetConfigWithBlocks,
  TeesheetConfigWithBlocksInsert,
  ConfigBlockInsert,
} from "~/server/db/schema";
import {
  createTeesheetConfig,
  updateTeesheetConfig,
} from "~/server/settings/actions";
import toast from "react-hot-toast";
import { TeesheetConfigWithBlocksInsertSchema } from "~/server/db/schema/teesheetConfigs.schema";
import { startTransition } from "react";
import { Zap } from "lucide-react";
import { Checkbox } from "~/components/ui/checkbox";

type BlockWithId = Omit<ConfigBlockInsert, "id"> & { id: string | number };

interface ConfigEditorProps {
  mode: "create" | "edit";
  config?: TeesheetConfigWithBlocks;
  onSuccess: () => void;
  onCancel: () => void;
}

function generateBlocks(
  startTime: string,
  endTime: string,
  intervalA: number,
  intervalB?: number,
  displayName?: string,
): BlockWithId[] {
  const blocks: BlockWithId[] = [];
  const timeParts = startTime.split(":");
  const startHour = Number(timeParts[0]);
  const startMin = Number(timeParts[1]);

  const endTimeParts = endTime.split(":");
  const endHour = Number(endTimeParts[0]);
  const endMin = Number(endTimeParts[1]);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  let currentMinutes = startMinutes;
  let sortOrder = 0;
  let useFirstInterval = true;

  while (currentMinutes < endMinutes) {
    const hour = Math.floor(currentMinutes / 60);
    const min = currentMinutes % 60;
    const timeStr = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;

    blocks.push({
      id: `block-${Date.now()}-${sortOrder}`,
      startTime: timeStr,
      maxPlayers: 4,
      sortOrder,
      displayName: displayName || undefined,
      configId: 0, // temporary, will be set by server
    });

    // Alternate between intervals if intervalB is provided
    if (intervalB !== undefined) {
      currentMinutes += useFirstInterval ? intervalA : intervalB;
      useFirstInterval = !useFirstInterval;
    } else {
      currentMinutes += intervalA;
    }
    sortOrder++;
  }

  return blocks;
}

export function ConfigEditor({
  mode,
  config,
  onSuccess,
  onCancel,
}: ConfigEditorProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TeesheetConfigWithBlocksInsert>({
    resolver: zodResolver(TeesheetConfigWithBlocksInsertSchema),
    defaultValues: {
      name: config?.name || "",
      blocks: config?.blocks || [],
      daysOfWeek: config?.daysOfWeek || [],
      isActive: config?.isActive || false,
      maxWindowDurationMinutes: config?.maxWindowDurationMinutes ?? 60,
    },
  });

  const blocks = watch("blocks");
  const daysOfWeek = watch("daysOfWeek");
  const maxWindowDurationMinutes = watch("maxWindowDurationMinutes");

  // Generator state (uncontrolled inputs)
  const [generatorState, setGeneratorState] = useState({
    startTime: "08:00",
    endTime: "18:00",
    intervalA: 6,
    intervalB: 7,
    useAlternating: true,
    displayName: "",
  });

  const actionToUse =
    mode === "create" ? createTeesheetConfig : updateTeesheetConfig;

  const [state, formAction, isPending] = useActionState(actionToUse, null);

  const handleGenerate = () => {
    if (
      !generatorState.startTime ||
      !generatorState.endTime ||
      !generatorState.intervalA
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    const newBlocks = generateBlocks(
      generatorState.startTime,
      generatorState.endTime,
      generatorState.intervalA,
      generatorState.useAlternating ? generatorState.intervalB : undefined,
      generatorState.displayName || undefined,
    );

    setValue("blocks", newBlocks);
    toast.success(`Generated ${newBlocks.length} blocks`);
  };

  // Handle state changes from server action
  useEffect(() => {
    if (state?.success) {
      toast.success(
        mode === "create"
          ? "Configuration created successfully"
          : "Configuration updated successfully",
      );
      onSuccess();
    } else if (state?.error) {
      toast.error(state.error);
    }
  }, [state, mode, onSuccess]);

  const onSubmit = handleSubmit(
    async (data: TeesheetConfigWithBlocksInsert) => {
      startTransition(async () => {
        if (mode === "edit" && config) {
          await formAction({ id: config.id, ...data });
        } else {
          await formAction({ id: 0, ...data });
        }
      });
    },
  );

  return (
    <div className="grid grid-cols-3 gap-8">
      {/* Left Panel - Form (1 column) */}

      <div className="overflow-y-auto p-2">
        <div className="mb-6 border-b pb-6">
          {mode === "create" ? (
            <div>
              <h2 className="text-org-primary mb-2 text-xl leading-none font-semibold tracking-tight">
                Create New Configuration
              </h2>
              <p className="text-sm text-gray-500">
                Set up a new teesheet configuration
              </p>
            </div>
          ) : (
            <div>
              <h2 className="text-org-primary mb-2 text-xl leading-none font-semibold tracking-tight">
                Edit: {config?.name}
              </h2>
              <p className="text-sm text-gray-500">
                Modify this teesheet configuration
              </p>
            </div>
          )}
        </div>
        <form onSubmit={onSubmit} className="space-y-6">
          {/* Configuration Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Configuration Name</Label>
            <Input
              id="name"
              placeholder="e.g., Morning Shotgun"
              {...register("name")}
              className="w-full"
            />
            {errors.name && (
              <span className="text-xs text-red-500">
                {errors.name.message as string}
              </span>
            )}
          </div>
          {/* Generator Section - Top */}
          <div>
            <h3 className="mb-3 text-sm font-semibold">Generate Blocks</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label htmlFor="genStartTime" className="text-xs">
                    Start
                  </Label>
                  <Input
                    id="genStartTime"
                    type="time"
                    value={generatorState.startTime}
                    onChange={(e) =>
                      setGeneratorState({
                        ...generatorState,
                        startTime: e.target.value,
                      })
                    }
                    className="text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="genEndTime" className="text-xs">
                    End
                  </Label>
                  <Input
                    id="genEndTime"
                    type="time"
                    value={generatorState.endTime}
                    onChange={(e) =>
                      setGeneratorState({
                        ...generatorState,
                        endTime: e.target.value,
                      })
                    }
                    className="text-sm"
                  />
                </div>
              </div>

              {/* Alternating toggle */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="alternating-toggle"
                  checked={generatorState.useAlternating}
                  onCheckedChange={(checked) =>
                    setGeneratorState({
                      ...generatorState,
                      useAlternating: checked === true,
                    })
                  }
                />
                <Label htmlFor="alternating-toggle" className="text-xs font-normal cursor-pointer">
                  Use alternating intervals (e.g., 6-7-6-7)
                </Label>
              </div>

              {/* Interval inputs */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label htmlFor="genIntervalA" className="text-xs">
                    {generatorState.useAlternating ? "Interval A (min)" : "Interval (min)"}
                  </Label>
                  <Input
                    id="genIntervalA"
                    type="number"
                    min={5}
                    max={60}
                    value={generatorState.intervalA}
                    onChange={(e) =>
                      setGeneratorState({
                        ...generatorState,
                        intervalA: parseInt(e.target.value) || 6,
                      })
                    }
                    className="text-sm"
                  />
                </div>

                {generatorState.useAlternating ? (
                  <div className="space-y-2">
                    <Label htmlFor="genIntervalB" className="text-xs">
                      Interval B (min)
                    </Label>
                    <Input
                      id="genIntervalB"
                      type="number"
                      min={5}
                      max={60}
                      value={generatorState.intervalB}
                      onChange={(e) =>
                        setGeneratorState({
                          ...generatorState,
                          intervalB: parseInt(e.target.value) || 7,
                        })
                      }
                      className="text-sm"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="genDisplayName" className="text-xs">
                      Display Name
                    </Label>
                    <Input
                      id="genDisplayName"
                      type="text"
                      placeholder="Optional"
                      value={generatorState.displayName}
                      onChange={(e) =>
                        setGeneratorState({
                          ...generatorState,
                          displayName: e.target.value,
                        })
                      }
                      className="text-sm"
                    />
                  </div>
                )}
              </div>

              {/* Display name when alternating (moved below) */}
              {generatorState.useAlternating && (
                <div className="space-y-2">
                  <Label htmlFor="genDisplayNameAlt" className="text-xs">
                    Display Name
                  </Label>
                  <Input
                    id="genDisplayNameAlt"
                    type="text"
                    placeholder="Optional"
                    value={generatorState.displayName}
                    onChange={(e) =>
                      setGeneratorState({
                        ...generatorState,
                        displayName: e.target.value,
                      })
                    }
                    className="text-sm"
                  />
                </div>
              )}

              <Button
                type="button"
                size="sm"
                onClick={handleGenerate}
                className="w-full"
              >
                <Zap className="mr-2 h-4 w-4" />
                Generate
              </Button>
            </div>
            {errors.blocks && (
              <span className="text-xs text-red-500">
                {errors.blocks.message as string}
              </span>
            )}
          </div>

          {/* Days of Week */}
          <div className="space-y-2">
            <Label>Days of Week</Label>
            <div className="grid grid-cols-7 gap-1">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                (day, index) => {
                  const isSelected = (daysOfWeek || []).includes(index);
                  return (
                    <Button
                      key={day}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        if (isSelected) {
                          setValue(
                            "daysOfWeek",
                            (daysOfWeek || []).filter((d) => d !== index),
                          );
                        } else {
                          setValue("daysOfWeek", [
                            ...(daysOfWeek || []),
                            index,
                          ]);
                        }
                      }}
                    >
                      {day}
                    </Button>
                  );
                },
              )}
            </div>
            {errors.daysOfWeek && (
              <span className="text-xs text-red-500">
                {errors.daysOfWeek.message as string}
              </span>
            )}
          </div>

          {/* Lottery Window Duration */}
          <div className="space-y-2">
            <Label htmlFor="maxWindowDurationMinutes">
              Lottery Time Window Duration
            </Label>
            <Select
              value={maxWindowDurationMinutes?.toString() ?? "60"}
              onValueChange={(value) =>
                setValue("maxWindowDurationMinutes", parseInt(value))
              }
            >
              <SelectTrigger id="maxWindowDurationMinutes">
                <SelectValue placeholder="Select duration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="45">45 minutes</SelectItem>
                <SelectItem value="60">60 minutes (default)</SelectItem>
                <SelectItem value="90">90 minutes</SelectItem>
                <SelectItem value="120">2 hours</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              Time windows are auto-generated for the lottery based on this
              duration. Shorter durations create more specific windows.
            </p>
          </div>

          {/* Toggles */}
          <div className="flex items-center space-x-2">
            <Switch
              id="isActive"
              checked={watch("isActive")}
              onCheckedChange={(checked) => setValue("isActive", checked)}
            />
            <Label htmlFor="isActive">Active</Label>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isPending}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="flex-1">
              {isPending
                ? "Saving..."
                : mode === "create"
                  ? "Create"
                  : "Update"}
            </Button>
          </div>
        </form>
      </div>

      {/* Right Panel - Blocks Preview (2 columns) */}
      <div className="col-span-2 overflow-y-auto">
        <ConfigPreview
          blocks={blocks}
          onBlocksChange={(newBlocks) => setValue("blocks", newBlocks)}
        />
      </div>
    </div>
  );
}
