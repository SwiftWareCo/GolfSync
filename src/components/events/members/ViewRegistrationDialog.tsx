"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { Users, User, UserCheck } from "lucide-react";
import { type EventRegistration } from "~/app/types/events";

interface ViewRegistrationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  registration: EventRegistration | null;
  currentMemberId: number;
  teamMembers?: Array<{
    id: number;
    firstName: string;
    lastName: string;
    memberNumber: string;
  }>;
}

export function ViewRegistrationDialog({
  isOpen,
  onOpenChange,
  registration,
  currentMemberId,
  teamMembers = [],
}: ViewRegistrationDialogProps) {
  if (!registration) return null;

  const isTeamCaptain = registration.memberId === currentMemberId;
  const captain = registration.member;

  // Get fill display name
  const getFillDisplayName = (fill: { fillType: string; customName?: string }) => {
    switch (fill.fillType) {
      case "GUEST":
        return fill.customName || "Guest Fill";
      case "RECIPROCAL":
        return "Reciprocal Fill";
      case "CUSTOM":
        return fill.customName || "Custom Fill";
      default:
        return "Fill";
    }
  };

  // Get status badge styling
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return { variant: "default" as const, text: "Approved" };
      case "PENDING":
        return { variant: "outline" as const, text: "Pending Approval", className: "bg-amber-100 text-amber-800 border-amber-200" };
      case "REJECTED":
        return { variant: "destructive" as const, text: "Rejected" };
      default:
        return { variant: "secondary" as const, text: status };
    }
  };

  const statusBadge = getStatusBadge(registration.status);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl">Registration Details</DialogTitle>
              <DialogDescription>
                {isTeamCaptain ? "You registered this team" : `Registered by ${captain.firstName} ${captain.lastName}`}
              </DialogDescription>
            </div>
            <Badge variant={statusBadge.variant} className={statusBadge.className}>
              {statusBadge.text}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Team Captain Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <UserCheck className="h-5 w-5 text-org-primary" />
              <h3 className="font-semibold">Registered by</h3>
            </div>
            <div className="flex items-center gap-3 rounded-lg border bg-org-primary/5 border-org-primary/20 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-org-primary text-white text-lg font-medium">
                {captain.firstName.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="font-medium text-lg">
                  {captain.firstName} {captain.lastName}
                  {isTeamCaptain && <span className="text-sm text-gray-600 ml-2">(You)</span>}
                </div>
                <div className="text-sm text-gray-600">#{captain.memberNumber}</div>
              </div>
            </div>
          </div>

          {/* Team Members Section */}
          {teamMembers.length > 0 && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-5 w-5 text-org-primary" />
                  <h3 className="font-semibold">Playing with</h3>
                  <Badge variant="secondary">{teamMembers.length}</Badge>
                </div>
                <div className="space-y-2">
                  {teamMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 rounded-lg border p-3"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm font-medium">
                        {member.firstName.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">
                          {member.firstName} {member.lastName}
                          {member.id === currentMemberId && <span className="text-sm text-gray-600 ml-2">(You)</span>}
                        </div>
                        <div className="text-sm text-gray-500">#{member.memberNumber}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Fills Section */}
          {registration.fills && Array.isArray(registration.fills) && registration.fills.length > 0 && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <User className="h-5 w-5 text-org-primary" />
                  <h3 className="font-semibold">Fills</h3>
                  <Badge variant="secondary">{registration.fills.length}</Badge>
                </div>
                <div className="space-y-2">
                  {registration.fills.map((fill: { fillType: string; customName?: string }, index: number) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 rounded-lg border p-3"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm font-medium">
                        F
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{getFillDisplayName(fill)}</div>
                        <div className="text-sm text-gray-500">{fill.fillType}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Registration Notes */}
          {registration.notes && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2">Registration Notes</h3>
                <div className="rounded-lg bg-gray-50 p-3 text-sm whitespace-pre-line">
                  {registration.notes}
                </div>
              </div>
            </>
          )}

          {/* Registration Date */}
          <div className="text-sm text-gray-500">
            Registered on {new Date(registration.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
