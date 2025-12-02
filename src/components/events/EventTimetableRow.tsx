"use client";

import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Separator } from "~/components/ui/separator";
import type { Event } from "~/server/events/data";
import {
  formatDate,
  formatTime12Hour,
  parseDate,
  isSameDay,
  isPast,
} from "~/lib/dates";
import { Calendar, Clock, MapPin, Users, Bell } from "lucide-react";
import { cn } from "~/lib/utils";
import RegisterForEventButton from "./members/RegisterForEventButton";

interface EventTimetableRowProps {
  event: Event;
  memberId?: number;
  isRegistered?: boolean;
  registrationStatus?: string;
}

// Get registration status badge and custom class
const getRegistrationStatusBadge = (status: string) => {
  switch (status) {
    case "APPROVED":
      return { variant: "default", className: "" };
    case "PENDING":
      return {
        variant: "outline",
        className: "bg-amber-100 text-amber-800 border-amber-200",
      };
    case "REJECTED":
      return { variant: "destructive", className: "" };
    default:
      return { variant: "secondary", className: "" };
  }
};

// Determine badge text based on status
const getRegistrationStatusText = (status: string) => {
  switch (status) {
    case "APPROVED":
      return "Registered";
    case "PENDING":
      return "Pending";
    case "REJECTED":
      return "Rejected";
    default:
      return "Unknown";
  }
};

// Get team size label
const getTeamSizeLabel = (teamSize: number) => {
  switch (teamSize) {
    case 1:
      return "Individual";
    case 2:
      return "Pairs";
    case 4:
      return "Foursome";
    default:
      return `${teamSize} players`;
  }
};

export function EventTimetableRow({
  event,
  memberId,
  isRegistered = false,
  registrationStatus,
}: EventTimetableRowProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  // Format date and time
  const startDate = parseDate(event.startDate) || new Date();
  const endDate = parseDate(event.endDate) || new Date();
  const registrationDeadline = event.registrationDeadline
    ? parseDate(event.registrationDeadline)
    : undefined;

  const isSingleDay = isSameDay(startDate, endDate);
  const isRegistrationClosed = registrationDeadline
    ? isPast(registrationDeadline)
    : false;
  const isAtCapacity = event.capacity
    ? (event.registrationsCount || 0) >= event.capacity
    : false;

  const dateDisplay = formatDate(startDate, "MMM dd");
  const timeDisplay = event.startTime
    ? formatTime12Hour(event.startTime)
    : null;

  return (
    <>
      <div
        onClick={() => setDialogOpen(true)}
        className="flex items-center justify-between gap-4 border-b border-gray-200 py-3 px-2 cursor-pointer hover:bg-gray-50 transition-colors"
      >
        {/* Event Name + Badge */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm font-medium text-gray-900 truncate">
            {event.name}
          </span>
          {isRegistered && registrationStatus && (
            <Badge
              variant={
                getRegistrationStatusBadge(registrationStatus).variant as any
              }
              className={cn(
                "px-1.5 py-0.5 text-xs shrink-0",
                getRegistrationStatusBadge(registrationStatus).className,
              )}
            >
              {getRegistrationStatusText(registrationStatus)}
            </Badge>
          )}
        </div>

        {/* Time (if available) */}
        {timeDisplay && (
          <span className="text-sm text-gray-600 shrink-0 w-20 text-right">
            {timeDisplay}
          </span>
        )}

        {/* Date */}
        <span className="text-sm text-gray-600 shrink-0 w-16 text-right">
          {dateDisplay}
        </span>
      </div>

      {/* Event Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1">
                <DialogTitle className="text-org-primary text-xl leading-tight font-bold sm:text-2xl">
                  {event.name}
                </DialogTitle>
                <DialogDescription className="mt-1 text-base">
                  Event Details
                </DialogDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!event.isActive && (
                  <Badge variant="outline" className="border-red-200 text-red-600">
                    Inactive
                  </Badge>
                )}
                {isRegistered && registrationStatus && (
                  <Badge
                    variant={
                      getRegistrationStatusBadge(registrationStatus)
                        .variant as any
                    }
                    className={cn(
                      "font-medium",
                      getRegistrationStatusBadge(registrationStatus).className,
                    )}
                  >
                    {getRegistrationStatusText(registrationStatus)}
                  </Badge>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6 pt-4">
            {/* Mobile-optimized event info card */}
            <div className="from-org-primary/5 rounded-lg border bg-gradient-to-br to-transparent p-5">
              <div className="grid grid-cols-1 gap-4">
                <div className="flex items-start gap-3">
                  <Calendar className="text-org-primary mt-0.5 h-5 w-5 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="text-xs font-semibold tracking-wide text-gray-600 uppercase">
                      Date
                    </span>
                    <p className="mt-1 font-semibold text-gray-900">
                      {isSingleDay
                        ? formatDate(startDate, "EEEE, MMMM do, yyyy")
                        : `${formatDate(startDate)} - ${formatDate(endDate)}`}
                    </p>
                  </div>
                </div>

                {(event.startTime || event.endTime) && (
                  <div className="flex items-start gap-3">
                    <Clock className="text-org-primary mt-0.5 h-5 w-5 flex-shrink-0" />
                    <div className="flex-1">
                      <span className="text-xs font-semibold tracking-wide text-gray-600 uppercase">
                        Time
                      </span>
                      <p className="mt-1 font-semibold text-gray-900">
                        {event.startTime && event.endTime
                          ? `${formatTime12Hour(event.startTime)} - ${formatTime12Hour(event.endTime)}`
                          : event.startTime
                            ? formatTime12Hour(event.startTime)
                            : event.endTime
                              ? formatTime12Hour(event.endTime)
                              : ""}
                      </p>
                    </div>
                  </div>
                )}

                {event.location && (
                  <div className="flex items-start gap-3">
                    <MapPin className="text-org-primary mt-0.5 h-5 w-5 flex-shrink-0" />
                    <div className="flex-1">
                      <span className="text-xs font-semibold tracking-wide text-gray-600 uppercase">
                        Location
                      </span>
                      <p className="mt-1 font-semibold text-gray-900">
                        {event.location}
                      </p>
                    </div>
                  </div>
                )}

                {event.capacity && (
                  <div className="flex items-start gap-3">
                    <Users className="text-org-primary mt-0.5 h-5 w-5 flex-shrink-0" />
                    <div className="flex-1">
                      <span className="text-xs font-semibold tracking-wide text-gray-600 uppercase">
                        Capacity
                      </span>
                      <p className="mt-1 font-semibold text-gray-900">
                        {event.registrationsCount || 0} / {event.capacity}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <Users className="text-org-primary mt-0.5 h-5 w-5 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="text-xs font-semibold tracking-wide text-gray-600 uppercase">
                      Team Size
                    </span>
                    <p className="mt-1 font-semibold text-gray-900">
                      {getTeamSizeLabel(event.teamSize)}
                    </p>
                  </div>
                </div>

                {registrationDeadline && (
                  <div className="flex items-start gap-3">
                    <Bell className="text-org-primary mt-0.5 h-5 w-5 flex-shrink-0" />
                    <div className="flex-1">
                      <span className="text-xs font-semibold tracking-wide text-gray-600 uppercase">
                        Registration Deadline
                      </span>
                      <p className="mt-1 font-semibold text-gray-900">
                        {formatDate(registrationDeadline)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="mb-3 text-sm font-bold tracking-wide text-gray-900 uppercase">
                  Description
                </h3>
                <p className="text-sm leading-relaxed whitespace-pre-line text-gray-700">
                  {event.description}
                </p>
              </div>

              {event.details &&
                Object.values(event.details).some((val) => val !== null) && (
                  <>
                    <Separator />
                    <div className="mt-4">
                      <h3 className="mb-2 text-sm font-medium">
                        Additional Details
                      </h3>

                      {event.details.format && (
                        <div className="mb-2">
                          <h4 className="text-xs font-medium text-gray-600">
                            Format
                          </h4>
                          <p className="text-sm">{event.details.format}</p>
                        </div>
                      )}

                      {event.details.rules && (
                        <div className="mb-2">
                          <h4 className="text-xs font-medium text-gray-600">
                            Rules
                          </h4>
                          <p className="text-sm whitespace-pre-line">
                            {event.details.rules}
                          </p>
                        </div>
                      )}

                      {event.details.prizes && (
                        <div className="mb-2">
                          <h4 className="text-xs font-medium text-gray-600">
                            Prizes
                          </h4>
                          <p className="text-sm whitespace-pre-line">
                            {event.details.prizes}
                          </p>
                        </div>
                      )}

                      {event.details.entryFee !== null &&
                        event.details.entryFee !== undefined && (
                          <div className="mb-2">
                            <h4 className="text-xs font-medium text-gray-600">
                              Entry Fee
                            </h4>
                            <p className="text-sm">
                              ${event.details.entryFee.toFixed(2)}
                            </p>
                          </div>
                        )}

                      {event.details.additionalInfo && (
                        <div className="mb-2">
                          <h4 className="text-xs font-medium text-gray-600">
                            Additional Information
                          </h4>
                          <p className="text-sm whitespace-pre-line">
                            {event.details.additionalInfo}
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}
            </div>
          </div>

          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            {!isRegistered && memberId && (
              <RegisterForEventButton
                eventId={event.id}
                memberId={memberId}
                disabled={
                  !event.isActive || isRegistrationClosed || isAtCapacity
                }
                requiresApproval={event.requiresApproval ?? false}
                className="w-full"
                event={{
                  id: event.id,
                  name: event.name,
                  teamSize: event.teamSize,
                  guestsAllowed: event.guestsAllowed ?? false,
                  requiresApproval: event.requiresApproval ?? false,
                  isActive: event.isActive ?? true,
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
