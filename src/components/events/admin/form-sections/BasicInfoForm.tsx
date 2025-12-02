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
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { DatePicker } from "~/components/ui/date-picker";
import { type EventFormValues } from "../EventForm";
import { getDateForDB, parseDate, getBCToday } from "~/lib/dates";
import { MultiSelect } from "~/components/ui/multi-select";
import type { MemberClass } from "~/server/db/schema";

// Event types
const EVENT_TYPES = [
  { value: "TOURNAMENT", label: "Tournament" },
  { value: "DINNER", label: "Dinner" },
  { value: "SOCIAL", label: "Social Event" },
  { value: "MEETING", label: "Meeting" },
  { value: "OTHER", label: "Other" },
];

interface BasicInfoFormProps {
  form: UseFormReturn<EventFormValues>;
  memberClasses?: MemberClass[];
}

export function BasicInfoForm({ form, memberClasses }: BasicInfoFormProps) {
  // Convert member classes to options with ID values
  const memberClassOptions = (memberClasses || []).map((mc) => ({
    label: mc.label,
    value: mc.id.toString(),
  }));

  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Event Name</FormLabel>
            <FormControl>
              <Input placeholder="Enter event name" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Enter event description"
                className="min-h-[100px]"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="eventType"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Event Type</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select event type" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {EVENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField
          control={form.control}
          name="startDate"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Start Date</FormLabel>
              <DatePicker
                date={field.value || getBCToday()}
                setDate={(date) =>
                  field.onChange(date ? getDateForDB(date) : getBCToday())
                }
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="endDate"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>End Date</FormLabel>
              <DatePicker
                date={field.value || getBCToday()}
                setDate={(date) =>
                  field.onChange(date ? getDateForDB(date) : getBCToday())
                }
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="startTime"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Start Time (optional)</FormLabel>
              <FormControl>
                <Input type="time" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="endTime"
          render={({ field }) => (
            <FormItem>
              <FormLabel>End Time (optional)</FormLabel>
              <FormControl>
                <Input type="time" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="location"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Location (optional)</FormLabel>
            <FormControl>
              <Input placeholder="Enter event location" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="memberClassIds"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Member Classes</FormLabel>
            <FormControl>
              <MultiSelect
                selected={field.value.map(String)}
                options={memberClassOptions}
                onChange={(selected) => field.onChange(selected.map(Number))}
                placeholder="Select member classes"
              />
            </FormControl>
            <FormDescription>
              Leave empty to make this event available to all member classes
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
