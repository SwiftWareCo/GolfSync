"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Plus } from "lucide-react";
import { EventForm } from "./EventForm";
import type { Event } from "~/server/events/data";
import type { MemberClass } from "~/server/db/schema";

interface EventDialogProps {
  existingEvent?: Event;
  triggerButton?: React.ReactNode;
  title?: string;
  description?: string;
  memberClasses: MemberClass[];
}

export function EventDialog({
  existingEvent,
  triggerButton,
  title = existingEvent ? "Edit Event" : "New Event",
  description = existingEvent
    ? "Update event details"
    : "Create a new event, tournament or social gathering",
  memberClasses,
}: EventDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            {existingEvent ? "Edit Event" : "Add Event"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <EventForm
          existingEvent={existingEvent}
          onSuccess={() => setOpen(false)}
          memberClasses={memberClasses}
        />
      </DialogContent>
    </Dialog>
  );
}
