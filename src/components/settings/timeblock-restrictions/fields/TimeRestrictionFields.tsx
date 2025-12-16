"use client";

import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";
import {
  type Control,
  type UseFormSetValue,
  type UseFormRegister,
  type FieldErrors,
} from "react-hook-form";
import { DatePicker } from "~/components/ui/date-picker";
import type { TimeblockRestrictionInsert } from "~/server/db/schema";
import { preserveDate } from "~/lib/utils";

interface TimeRestrictionFieldsProps {
  control: Control<TimeblockRestrictionInsert>;
  setValue: UseFormSetValue<TimeblockRestrictionInsert>;
  daysOfWeek?: number[];
  restrictionCategory?: "MEMBER_CLASS" | "GUEST" | "LOTTERY";
  register: UseFormRegister<TimeblockRestrictionInsert>;
  errors: FieldErrors<TimeblockRestrictionInsert>;
}

export function TimeRestrictionFields({
  control,
  setValue,
  daysOfWeek,
  restrictionCategory,
  register,
  errors,
}: TimeRestrictionFieldsProps) {
  // Use the daysOfWeek prop passed from parent
  const daysOfWeekValue = daysOfWeek || [];

  return (
    <div className="space-y-4 rounded-md border p-4">
      <h3 className="text-lg font-medium">Time-based Settings</h3>

      {/* Time Range */}
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

      {/* Days of Week */}
      <div className="space-y-2">
        <Label>Days of Week</Label>
        <div className="grid grid-cols-7 gap-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
            (day, index) => {
              const isSelected = daysOfWeekValue?.includes(index) ?? false;
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
                        daysOfWeekValue.filter((d) => d !== index),
                        { shouldDirty: true, shouldValidate: true },
                      );
                    } else {
                      setValue("daysOfWeek", [...daysOfWeekValue, index], {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
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
    </div>
  );
}
