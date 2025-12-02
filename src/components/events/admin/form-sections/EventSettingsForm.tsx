"use client";

import { type UseFormReturn } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { DatePicker } from "~/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { type EventFormValues } from "../EventForm";
import { getDateForDB } from "~/lib/dates";

interface EventSettingsFormProps {
  form: UseFormReturn<EventFormValues>;
}

export function EventSettingsForm({ form }: EventSettingsFormProps) {
  return (
    <>
      <FormField
        control={form.control}
        name="capacity"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Capacity</FormLabel>
            <FormControl>
              <Input
                type="number"
                placeholder="Maximum number of attendees"
                {...field}
                value={field.value || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  field.onChange(
                    value === "" ? undefined : parseInt(value, 10),
                  );
                }}
              />
            </FormControl>
            <FormDescription>
              Leave blank for unlimited capacity
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="requiresApproval"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <FormLabel className="text-base">Require Approval</FormLabel>
              <FormDescription>
                Registrations will need to be approved by administrators
              </FormDescription>
            </div>
            <FormControl>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="registrationDeadline"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Registration Deadline</FormLabel>
            <DatePicker
              date={field.value}
              setDate={(date) =>
                field.onChange(date ? getDateForDB(date) : undefined)
              }
            />
            <FormDescription>
              Optional. After this date, registration will be closed.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="isActive"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <FormLabel className="text-base">Active Status</FormLabel>
              <FormDescription>
                Inactive events will not be visible to members
              </FormDescription>
            </div>
            <FormControl>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="teamSize"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Team Size</FormLabel>
            <Select
              onValueChange={(value) => field.onChange(parseInt(value, 10))}
              value={field.value?.toString()}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select team size" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="1">Individual (1 player)</SelectItem>
                <SelectItem value="2">Pairs (2 players)</SelectItem>
                <SelectItem value="4">Foursome (4 players)</SelectItem>
              </SelectContent>
            </Select>
            <FormDescription>
              Number of players per team entry
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="guestsAllowed"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <FormLabel className="text-base">Guests Allowed</FormLabel>
              <FormDescription>
                Guests are allowed or not allowed for this event
              </FormDescription>
            </div>
            <FormControl>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
          </FormItem>
        )}
      />
    </>
  );
}
