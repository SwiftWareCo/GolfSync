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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { registerForEvent, checkMembersRegistrationStatus } from "~/server/events/actions";
import { MemberSearchInput } from "~/components/members/MemberSearchInput";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { Users, X, UserPlus } from "lucide-react";
import { type Event } from "~/app/types/events";
import { FillTypes } from "~/server/db/schema/fills.schema";

interface SearchMember {
  id: number;
  firstName: string;
  lastName: string;
  memberNumber: string;
}

interface Fill {
  id: string;
  fillType: string;
  customName?: string;
}

interface TeamRegistrationFormProps {
  event: Event;
  memberId: number;
  memberName: string;
  className?: string;
}

export default function TeamRegistrationForm({
  event,
  memberId,
  memberName,
  className,
}: TeamRegistrationFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notes, setNotes] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<SearchMember[]>([]);
  const [fills, setFills] = useState<Fill[]>([]);
  const [newFillType, setNewFillType] = useState<string>("");
  const [customFillName, setCustomFillName] = useState("");
  const router = useRouter();

  const requiredTeamSize = event.teamSize;
  const currentTeamSize = 1 + selectedMembers.length + fills.length; // 1 for captain
  const spotsRemaining = requiredTeamSize - currentTeamSize;
  const canRegister = currentTeamSize === requiredTeamSize;

  const handleMemberSelect = async (selectedMember: SearchMember | null) => {
    if (!selectedMember) return;

    if (selectedMember.id === memberId) {
      toast.error("You're already included as team captain");
      return;
    }

    if (selectedMembers.find((m) => m.id === selectedMember.id)) {
      toast.error("Member already added to team");
      return;
    }

    if (currentTeamSize >= requiredTeamSize) {
      toast.error(`Team is full (${requiredTeamSize} players maximum)`);
      return;
    }

    // Check if member is already registered for this event
    const checkResult = await checkMembersRegistrationStatus(event.id, [selectedMember.id]);
    if (checkResult.success && checkResult.registeredMembers.includes(selectedMember.id)) {
      toast.error(`${selectedMember.firstName} ${selectedMember.lastName} is already registered for this event`);
      return;
    }

    setSelectedMembers([...selectedMembers, selectedMember]);
  };

  const removeMember = (memberId: number) => {
    setSelectedMembers(selectedMembers.filter((m) => m.id !== memberId));
  };

  const addFill = () => {
    if (!newFillType) {
      toast.error("Please select a fill type");
      return;
    }

    if (newFillType === FillTypes.CUSTOM && !customFillName.trim()) {
      toast.error("Please enter a name for the custom fill");
      return;
    }

    if (currentTeamSize >= requiredTeamSize) {
      toast.error(`Team is full (${requiredTeamSize} players maximum)`);
      return;
    }

    const newFill: Fill = {
      id: `fill-${Date.now()}`,
      fillType: newFillType,
      customName: newFillType === FillTypes.CUSTOM ? customFillName : undefined,
    };

    setFills([...fills, newFill]);
    setNewFillType("");
    setCustomFillName("");
  };

  const removeFill = (fillId: string) => {
    setFills(fills.filter((f) => f.id !== fillId));
  };

  const handleRegister = async () => {
    if (!canRegister) {
      toast.error(`Please select exactly ${requiredTeamSize - 1} team members or fills`);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await registerForEvent(
        event.id,
        memberId,
        notes,
        selectedMembers.map((m) => m.id),
        fills.map((f) => ({ fillType: f.fillType, customName: f.customName }))
      );

      if (result.success) {
        toast.success(
          event.requiresApproval
            ? "Team registration submitted successfully. Awaiting approval."
            : "Your team has been registered for this event.",
        );
        setIsOpen(false);
        setSelectedMembers([]);
        setFills([]);
        setNotes("");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to register team");
      }
    } catch (error) {
      console.error("Error registering team:", error);
      toast.error("An error occurred while registering the team");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFillDisplayName = (fill: Fill) => {
    switch (fill.fillType) {
      case FillTypes.GUEST:
        return "Guest Fill";
      case FillTypes.RECIPROCAL:
        return "Reciprocal Fill";
      case FillTypes.CUSTOM:
        return fill.customName || "Custom Fill";
      default:
        return "Fill";
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
        disabled={!event.isActive}
      >
        Register Team for this Event
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Team Registration - {event.name}</DialogTitle>
            <DialogDescription>
              {event.requiresApproval
                ? "Your team registration will be submitted for approval."
                : "Register your team for this event."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Team Size Info */}
            <div className="bg-org-primary/5 border-org-primary/20 flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <Users className="text-org-primary h-5 w-5" />
                <div>
                  <div className="font-medium">
                    Team Size: {currentTeamSize} / {requiredTeamSize}
                  </div>
                  <div className="text-sm text-gray-600">
                    {spotsRemaining > 0 ? (
                      <span>Select {spotsRemaining} more {spotsRemaining === 1 ? "player" : "players"}</span>
                    ) : (
                      <span className="text-green-600">Team complete!</span>
                    )}
                  </div>
                </div>
              </div>
              {canRegister && (
                <Badge className="bg-green-100 text-green-800">Ready</Badge>
              )}
            </div>

            {/* Team Captain */}
            <div>
              <Label className="mb-2 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Team Captain (You)
              </Label>
              <div className="bg-org-primary/5 border-org-primary/20 flex items-center gap-3 rounded-lg border p-3">
                <div className="bg-org-primary text-white flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium">
                  {memberName.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{memberName}</div>
                  <div className="text-sm text-gray-600">Captain</div>
                </div>
              </div>
            </div>

            {/* Team Members Selection */}
            {spotsRemaining > 0 && (
              <>
                <Separator />
                <div>
                  <Label className="mb-2 flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Add Team Members
                  </Label>
                  <MemberSearchInput
                    onSelect={handleMemberSelect}
                    placeholder="Search for a member..."
                  />
                </div>
              </>
            )}

            {/* Selected Members */}
            {selectedMembers.length > 0 && (
              <div className="space-y-2">
                <Label>Selected Members</Label>
                {selectedMembers.map((member) => (
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
                      </div>
                      <div className="text-sm text-gray-500">
                        #{member.memberNumber}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMember(member.id)}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Fills Section - Only show if guests allowed */}
            {event.guestsAllowed && spotsRemaining > 0 && (
              <>
                <Separator />
                <div>
                  <Label className="mb-2">Add Fills (Optional)</Label>
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Select value={newFillType} onValueChange={setNewFillType}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select fill type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={FillTypes.GUEST}>Guest</SelectItem>
                          <SelectItem value={FillTypes.RECIPROCAL}>
                            Reciprocal
                          </SelectItem>
                          <SelectItem value={FillTypes.CUSTOM}>Custom</SelectItem>
                        </SelectContent>
                      </Select>
                      {newFillType === FillTypes.CUSTOM && (
                        <Input
                          placeholder="Fill name"
                          value={customFillName}
                          onChange={(e) => setCustomFillName(e.target.value)}
                          className="flex-1"
                        />
                      )}
                      <Button
                        type="button"
                        onClick={addFill}
                        disabled={
                          !newFillType ||
                          (newFillType === FillTypes.CUSTOM && !customFillName.trim())
                        }
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Display Fills */}
            {fills.length > 0 && (
              <div className="space-y-2">
                <Label>Fills</Label>
                {fills.map((fill) => (
                  <div
                    key={fill.id}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm font-medium">
                      F
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{getFillDisplayName(fill)}</div>
                      <div className="text-sm text-gray-500">Fill</div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFill(fill.id)}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Notes */}
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

            {event.requiresApproval && (
              <div className="text-muted-foreground rounded-lg bg-yellow-50 p-3 text-sm">
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
            <Button onClick={handleRegister} disabled={isSubmitting || !canRegister}>
              {isSubmitting
                ? "Registering..."
                : event.requiresApproval
                  ? "Submit Team Registration"
                  : "Register Team"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
