"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { registerForEvent } from "~/server/events/actions";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import TeamRegistrationForm from "./TeamRegistrationForm";

interface ExtendedRegisterForEventButtonProps {
  event?: {
    id: number;
    name: string;
    teamSize: number;
    guestsAllowed: boolean;
    requiresApproval: boolean;
    isActive: boolean;
  };
  memberName?: string;
  eventId: number;
  memberId: number;
  disabled?: boolean;
  requiresApproval?: boolean;
  className?: string;
}

export default function RegisterForEventButton({
  eventId,
  memberId,
  disabled = false,
  requiresApproval = false,
  className,
  event,
  memberName,
}: ExtendedRegisterForEventButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notes, setNotes] = useState("");
  const router = useRouter();

  // If event requires team registration, use TeamRegistrationForm
  if (event && event.teamSize > 1) {
    return (
      <TeamRegistrationForm
        event={event as any}
        memberId={memberId}
        memberName={memberName || "You"}
        className={className}
      />
    );
  }

  const handleRegister = async () => {
    setIsSubmitting(true);
    try {
      const result = await registerForEvent(eventId, memberId, notes);
      if (result.success) {
        toast.success(
          requiresApproval
            ? "Registration submitted successfully. Awaiting approval."
            : "You have been registered for this event.",
        );
        setIsOpen(false);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to register for event");
      }
    } catch (error) {
      console.error("Error registering for event:", error);
      toast.error("An error occurred while registering for the event");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button
        className={className || "w-full"}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        disabled={disabled}
      >
        Register for this Event
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register for Event</DialogTitle>
            <DialogDescription>
              {requiresApproval
                ? "Your registration will be submitted for approval."
                : "Complete your registration for this event."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="notes">Registration Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes or special requests"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1"
              />
            </div>

            {requiresApproval && (
              <div className="text-muted-foreground text-sm">
                <p>This event requires approval from the administrators.</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleRegister} disabled={isSubmitting}>
              {isSubmitting
                ? "Registering..."
                : requiresApproval
                  ? "Submit Registration"
                  : "Register Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
