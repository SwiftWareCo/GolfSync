"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Clock, Plus, ArrowDown } from "lucide-react";
import { formatTime12Hour } from "~/lib/dates";
import type { TimeBlockWithRelations } from "~/server/db/schema";

const insertTimeBlockSchema = z.object({
  startTime: z.string().min(1, "Start time is required"),
  displayName: z.string().optional(),
  maxMembers: z.coerce.number().min(1).max(8),
});

type FormData = {
  startTime: string;
  displayName?: string;
  maxMembers: number;
};

interface InsertTimeBlockDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (data: FormData & { endTime: string }) => void;
  afterTimeBlock?: TimeBlockWithRelations;
}

export function InsertTimeBlockDialog({
  isOpen,
  onClose,
  onInsert,
  afterTimeBlock,
}: InsertTimeBlockDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(insertTimeBlockSchema) as any,
    defaultValues: {
      startTime: "",
      displayName: "",
      maxMembers: 4,
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      // Add endTime = startTime for the parent component
      await onInsert({
        ...data,
        endTime: data.startTime,
      });
      form.reset();
    } catch (error) {
      console.error("Error inserting timeblock:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  // Generate suggested time based on after timeblock
  const getSuggestedTime = () => {
    if (!afterTimeBlock?.startTime) return "";

    try {
      // Parse the start time (assuming format like "09:30")
      const timeParts = afterTimeBlock.startTime.split(":");
      const hours = parseInt(timeParts[0] || "0", 10);
      const minutes = parseInt(timeParts[1] || "0", 10);

      // Add 10 minutes as default interval
      let newMinutes = minutes + 10;
      let newHours = hours;

      if (newMinutes >= 60) {
        newMinutes -= 60;
        newHours += 1;
      }

      // Format back to HH:MM
      return `${newHours.toString().padStart(2, "0")}:${newMinutes.toString().padStart(2, "0")}`;
    } catch (error) {
      return "";
    }
  };

  const handleUseSuggestedTime = () => {
    const suggestedTime = getSuggestedTime();
    if (suggestedTime) {
      form.setValue("startTime", suggestedTime);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Insert New Timeblock
          </DialogTitle>
          <DialogDescription>
            {afterTimeBlock ? (
              <div className="space-y-2">
                <div>Add a new timeblock after:</div>
                <div className="flex items-center gap-2 rounded bg-gray-50 p-2">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">
                    {formatTime12Hour(afterTimeBlock.startTime)}
                  </span>
                  {afterTimeBlock.displayName && (
                    <Badge variant="outline" className="text-xs">
                      {afterTimeBlock.displayName}
                    </Badge>
                  )}
                </div>
                <ArrowDown className="mx-auto h-4 w-4 text-gray-400" />
              </div>
            ) : (
              "Add a new timeblock to the teesheet"
            )}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Suggested Time Button */}
            {afterTimeBlock && (
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleUseSuggestedTime}
                  className="text-xs"
                >
                  Use suggested time:{" "}
                  {getSuggestedTime() && formatTime12Hour(getSuggestedTime())}
                </Button>
              </div>
            )}

            <FormField
              control={form.control}
              name="startTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Time</FormLabel>
                  <FormControl>
                    <Input type="time" placeholder="09:00" {...field} />
                  </FormControl>
                  <FormDescription className="text-xs">
                    End time will be set to the same as start time
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Shotgun Start, Tournament"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional label to distinguish this timeblock
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="maxMembers"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max Participants</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      max="8"
                      placeholder="4"
                      {...field}
                      value={field.value?.toString() || "4"}
                    />
                  </FormControl>
                  <FormDescription>
                    Maximum number of members, guests, and fills (1-8)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Inserting...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Insert Timeblock
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
