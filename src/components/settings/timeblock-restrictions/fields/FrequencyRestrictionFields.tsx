"use client";

import {
  type Control,
  type UseFormSetValue,
  type UseFormWatch,
  type UseFormRegister,
  type FieldErrors,
} from "react-hook-form";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import { type TimeblockRestrictionInsert } from "~/server/db/schema";

interface FrequencyRestrictionFieldsProps {
  control: Control<TimeblockRestrictionInsert>;
  setValue: UseFormSetValue<TimeblockRestrictionInsert>;
  watch: UseFormWatch<TimeblockRestrictionInsert>;
  register: UseFormRegister<TimeblockRestrictionInsert>;
  errors: FieldErrors<TimeblockRestrictionInsert>;
  restrictionCategory?: "MEMBER_CLASS" | "GUEST" | "LOTTERY";
}

export function FrequencyRestrictionFields({
  control,
  setValue,
  watch,
  register,
  errors,
  restrictionCategory,
}: FrequencyRestrictionFieldsProps) {
  const applyCharge = watch("applyCharge");
  return (
    <div className="space-y-4 rounded-md border p-4">
      <h3 className="text-lg font-medium">Frequency Settings</h3>

      {/* Maximum Count */}
      <div className="space-y-2">
        <Label htmlFor="maxCount">Maximum Count</Label>
        <Input
          id="maxCount"
          type="number"
          placeholder="e.g. 3"
          {...register("maxCount", {
            setValueAs: (value) => (value ? Number(value) : null),
          })}
        />
        {errors.maxCount && (
          <span className="text-xs text-red-500">
            {errors.maxCount.message as string}
          </span>
        )}
      </div>

      {/* Period Days */}
      <div className="space-y-2">
        <Label htmlFor="periodDays">Period (Days)</Label>
        <Input
          id="periodDays"
          type="number"
          placeholder="e.g. 7"
          {...register("periodDays", {
            setValueAs: (value) => (value ? Number(value) : null),
          })}
        />
        {errors.periodDays && (
          <span className="text-xs text-red-500">
            {errors.periodDays.message as string}
          </span>
        )}
      </div>

      {/* Apply Charge - Only show for MEMBER_CLASS restrictions, not LOTTERY */}
      {restrictionCategory === "MEMBER_CLASS" && (
        <>
          <div className="flex flex-row items-start space-y-0 space-x-3 rounded-md border p-4">
            <Checkbox
              id="applyCharge"
              checked={applyCharge || false}
              onCheckedChange={(checked) => {
                setValue("applyCharge", checked === true, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }}
            />
            <div className="space-y-1 leading-none">
              <Label htmlFor="applyCharge" className="cursor-pointer">
                Apply Charge for Exceeding Limit
              </Label>
            </div>
          </div>

          {/* Charge Amount */}
          {applyCharge && (
            <div className="space-y-2">
              <Label htmlFor="chargeAmount">Charge Amount</Label>
              <Input
                id="chargeAmount"
                type="text"
                placeholder="e.g. 25.00 or 30% of green fee"
                {...register("chargeAmount")}
              />
              {errors.chargeAmount && (
                <span className="text-xs text-red-500">
                  {errors.chargeAmount.message as string}
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
