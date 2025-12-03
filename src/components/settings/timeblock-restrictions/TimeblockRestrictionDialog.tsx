"use client";

import { useState, useActionState, startTransition } from "react";
import type {
  TimeblockRestriction,
  TimeblockRestrictionInsert,
  MemberClass,
} from "~/server/db/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { TimeRestrictionFields } from "./fields/TimeRestrictionFields";
import { FrequencyRestrictionFields } from "./fields/FrequencyRestrictionFields";
import { AvailabilityRestrictionFields } from "./fields/AvailabilityRestrictionFields";
import {
  createTimeblockRestriction,
  updateTimeblockRestriction,
} from "~/server/timeblock-restrictions/actions";
import toast from "react-hot-toast";
import { MultiSelect } from "~/components/ui/multi-select";
import { timeblockRestrictionsInsertSchema } from "~/server/db/schema/restrictions/restrictions.schema";
import { cn } from "~/lib/utils";

type TabType = "basic" | "schedule" | "frequency" | "members";

interface TimeblockRestrictionDialogProps {
  mode: "create" | "edit";
  existingRestriction?: TimeblockRestriction;
  memberClasses?: MemberClass[];
  restrictionCategory: "MEMBER_CLASS" | "GUEST" | "COURSE_AVAILABILITY";
  onSuccess: () => void;
  onCancel: () => void;
}

export function TimeblockRestrictionDialog({
  mode,
  existingRestriction,
  memberClasses = [],
  restrictionCategory,
  onSuccess,
  onCancel,
}: TimeblockRestrictionDialogProps) {
  const [activeTab, setActiveTab] = useState<TabType>("basic");

  // Get default values
  const getDefaultValues = (): Partial<TimeblockRestrictionInsert> => {
    if (existingRestriction) {
      return {
        name: existingRestriction.name,
        description: existingRestriction.description,
        restrictionCategory: existingRestriction.restrictionCategory as
          | "MEMBER_CLASS"
          | "GUEST"
          | "COURSE_AVAILABILITY",
        restrictionType: existingRestriction.restrictionType as
          | "TIME"
          | "FREQUENCY"
          | "AVAILABILITY",
        memberClassIds: existingRestriction.memberClassIds || [],
        isActive: existingRestriction.isActive,
        priority: existingRestriction.priority,
        canOverride: existingRestriction.canOverride,
        startTime: existingRestriction.startTime || "06:00",
        endTime: existingRestriction.endTime || "18:00",
        daysOfWeek: existingRestriction.daysOfWeek || [],
        startDate: existingRestriction.startDate || null,
        endDate: existingRestriction.endDate || null,
        maxCount: existingRestriction.maxCount,
        periodDays: existingRestriction.periodDays,
        applyCharge: existingRestriction.applyCharge || false,
        chargeAmount: existingRestriction.chargeAmount,
      };
    }

    return {
      name: "",
      description: "",
      restrictionCategory,
      restrictionType:
        restrictionCategory === "COURSE_AVAILABILITY" ? "AVAILABILITY" : "TIME",
      memberClassIds: [],
      isActive: true,
      priority: 0,
      canOverride: true,
      startTime: "06:00",
      endTime: "18:00",
      daysOfWeek: [],
      startDate: null,
      endDate: null,
      maxCount: null,
      periodDays: null,
      applyCharge: false,
      chargeAmount: null,
    };
  };

  const form = useForm<TimeblockRestrictionInsert>({
    resolver: zodResolver(timeblockRestrictionsInsertSchema),
    defaultValues: getDefaultValues(),
  });

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    register,
  } = form;

  const watchRestrictionType = watch("restrictionType");
  const daysOfWeek = watch("daysOfWeek");

  const actionToUse =
    mode === "edit" ? updateTimeblockRestriction : createTimeblockRestriction;

  const [error, action, isPending] = useActionState(actionToUse, null);

  const onSubmit = handleSubmit(async (data: TimeblockRestrictionInsert) => {
    try {
      if (mode === "edit") {
        if (!existingRestriction || !existingRestriction.id) {
          toast.error("Invalid restriction data for update");
          return;
        }

        startTransition(async () => {
          await action({ id: existingRestriction.id, ...data });

          toast.success("Restriction updated successfully");
          onSuccess();
        });
      } else {
        // Create mode - don't pass id at all
        startTransition(async () => {
          await action({ id: 0, ...data });
          toast.success("Restriction created successfully");
          onSuccess();
        });
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save restriction",
      );
    }
  });

  const tabs: { id: TabType; label: string; show: boolean }[] = [
    { id: "basic", label: "Basic Info", show: true },
    {
      id: "schedule",
      label: "Schedule",
      show: watchRestrictionType !== "FREQUENCY",
    },
    {
      id: "frequency",
      label: "Frequency",
      show: watchRestrictionType === "FREQUENCY",
    },
    {
      id: "members",
      label: "Member Classes",
      show: restrictionCategory === "MEMBER_CLASS",
    },
  ];

  const visibleTabs = tabs.filter((t) => t.show);

  return (
    <form onSubmit={onSubmit} className="flex flex-1 flex-col overflow-hidden">
      <div className="grid flex-1 grid-cols-[200px_1fr] gap-6 overflow-hidden px-6">
        {/* Sidebar Navigation */}
        <nav className="space-y-1 border-r pr-4">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full cursor-pointer rounded-md px-3 py-2 text-left text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-org-primary text-white"
                  : "hover:bg-org-primary/10",
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Form Content */}
        <div className="space-y-6 overflow-y-auto p-2">
          {activeTab === "basic" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="Enter restriction name"
                  {...register("name")}
                />
                {errors.name && (
                  <span className="text-xs text-red-500">
                    {errors.name.message as string}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Enter restriction description"
                  {...register("description")}
                />
                {errors.description && (
                  <span className="text-xs text-red-500">
                    {errors.description.message as string}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="restrictionType">Restriction Type</Label>
                <Select
                  onValueChange={(value) =>
                    setValue("restrictionType", value as any)
                  }
                  defaultValue={watch("restrictionType")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select restriction type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TIME">Time Restriction</SelectItem>
                    <SelectItem value="FREQUENCY">
                      Frequency Restriction
                    </SelectItem>
                    {restrictionCategory === "COURSE_AVAILABILITY" && (
                      <SelectItem value="AVAILABILITY">
                        Course Availability
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {errors.restrictionType && (
                  <span className="text-xs text-red-500">
                    {errors.restrictionType.message as string}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label className="text-base">Active</Label>
                    <div className="text-muted-foreground text-sm">
                      Enable this restriction
                    </div>
                  </div>
                  <Switch
                    checked={watch("isActive")}
                    onCheckedChange={(checked) => setValue("isActive", checked)}
                  />
                </div>

                <div className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label className="text-base">Can Override</Label>
                    <div className="text-muted-foreground text-sm">
                      Allow admin override
                    </div>
                  </div>
                  <Switch
                    checked={watch("canOverride")}
                    onCheckedChange={(checked) =>
                      setValue("canOverride", checked)
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Input
                  id="priority"
                  type="number"
                  placeholder="0"
                  {...register("priority", {
                    setValueAs: (value) => parseInt(value) || 0,
                  })}
                />
                {errors.priority && (
                  <span className="text-xs text-red-500">
                    {errors.priority.message as string}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Schedule Tab */}
          {activeTab === "schedule" && watchRestrictionType === "TIME" && (
            <TimeRestrictionFields
              control={control}
              setValue={setValue}
              daysOfWeek={daysOfWeek || []}
              restrictionCategory={restrictionCategory}
              register={register}
              errors={errors}
            />
          )}

          {activeTab === "schedule" &&
            watchRestrictionType === "AVAILABILITY" && (
              <AvailabilityRestrictionFields
                control={control}
                setValue={setValue}
                watch={watch}
                register={register}
                errors={errors}
              />
            )}

          {/* Frequency Tab */}
          {activeTab === "frequency" &&
            watchRestrictionType === "FREQUENCY" && (
              <FrequencyRestrictionFields
                control={control}
                setValue={setValue}
                watch={watch}
                register={register}
                errors={errors}
              />
            )}

          {/* Member Classes Tab */}
          {activeTab === "members" &&
            restrictionCategory === "MEMBER_CLASS" && (
              <div className="space-y-4 rounded-md border p-4">
                <Label>Member Classes</Label>
                <MultiSelect
                  options={memberClasses.map((mc) => ({
                    label: mc.label,
                    value: mc.id.toString(),
                  }))}
                  selected={(watch("memberClassIds") || []).map(String)}
                  onChange={(values) =>
                    setValue("memberClassIds", values.map(Number))
                  }
                  placeholder="Select member classes"
                />
                {errors.memberClassIds && (
                  <span className="text-xs text-red-500">
                    {errors.memberClassIds.message as string}
                  </span>
                )}
              </div>
            )}
        </div>
      </div>

      <div className="flex gap-3 border-t px-6 pt-4 pb-6">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isPending}
          className="bg-org-primary hover:bg-org-primary/90"
        >
          {isPending
            ? "Saving..."
            : mode === "edit"
              ? "Update Restriction"
              : "Create Restriction"}
        </Button>
      </div>
    </form>
  );
}
