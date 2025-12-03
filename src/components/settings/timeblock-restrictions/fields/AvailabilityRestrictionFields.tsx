"use client";

import { useState } from "react";
import {
  type Control,
  type UseFormSetValue,
  type UseFormWatch,
  type UseFormRegister,
  type FieldErrors,
} from "react-hook-form";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { DatePicker } from "~/components/ui/date-picker";
import { Switch } from "~/components/ui/switch";
import { type TimeblockRestrictionInsert } from "~/server/db/schema";
import { preserveDate } from "~/lib/utils";

interface AvailabilityRestrictionFieldsProps {
  control: Control<TimeblockRestrictionInsert>;
  setValue: UseFormSetValue<TimeblockRestrictionInsert>;
  watch: UseFormWatch<TimeblockRestrictionInsert>;
  register: UseFormRegister<TimeblockRestrictionInsert>;
  errors: FieldErrors<TimeblockRestrictionInsert>;
}

export function AvailabilityRestrictionFields({
  control,
  setValue,
  watch,
  register,
  errors,
}: AvailabilityRestrictionFieldsProps) {
  // Keep isFullDay as local UI state (not a form field)
  const [isFullDay, setIsFullDay] = useState(false);

  // Update start/end time when isFullDay changes
  const handleFullDayChange = (checked: boolean) => {
    setIsFullDay(checked);
    if (checked) {
      // Clear times when switching to full day
      setValue("startTime", "");
      setValue("endTime", "");
    }
  };

  return (
    <div className="space-y-4 rounded-md border p-4">
      {/* Full Day Toggle */}
      <div className="flex flex-row items-center justify-between rounded-md border p-4">
        <div className="space-y-0.5">
          <Label className="text-base">Full Day Restriction</Label>
          <p className="text-muted-foreground text-sm">
            Apply restriction for the entire day (no specific time window)
          </p>
        </div>
        <Switch checked={isFullDay} onCheckedChange={handleFullDayChange} />
      </div>

      {/* Time Range (only shown if not full day) */}
      {!isFullDay && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startTime">Start Time</Label>
            <Input
              id="startTime"
              type="time"
              {...register("startTime")}
            />
            {errors.startTime && (
              <span className="text-xs text-red-500">
                {errors.startTime.message as string}
              </span>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="endTime">End Time</Label>
            <Input
              id="endTime"
              type="time"
              {...register("endTime")}
            />
            {errors.endTime && (
              <span className="text-xs text-red-500">
                {errors.endTime.message as string}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Date Range */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col space-y-2">
          <Label>Start Date</Label>
          <DatePicker
            date={watch("startDate") ? preserveDate(watch("startDate")!) : undefined}
            setDate={(date?: Date) => {
              if (date) {
                // Ensure selected date doesn't get timezone-shifted
                setValue("startDate", preserveDate(date) as any);
              } else {
                setValue("startDate", null);
              }
            }}
            placeholder="Select start date"
          />
          {errors.startDate && (
            <span className="text-xs text-red-500">
              {errors.startDate.message as string}
            </span>
          )}
        </div>

        <div className="flex flex-col space-y-2">
          <Label>End Date</Label>
          <DatePicker
            date={watch("endDate") ? preserveDate(watch("endDate")!) : undefined}
            setDate={(date?: Date) => {
              if (date) {
                // Ensure selected date doesn't get timezone-shifted
                setValue("endDate", preserveDate(date) as any);
              } else {
                setValue("endDate", null);
              }
            }}
            placeholder="Select end date"
          />
          {errors.endDate && (
            <span className="text-xs text-red-500">
              {errors.endDate.message as string}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
