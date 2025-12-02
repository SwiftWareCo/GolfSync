"use client";

import { useState } from "react";
import { X, UserPlus, UserCheck } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { createEventRegistrationAsAdmin } from "~/server/events/actions";
import { searchMembersAction, getMembersByIds } from "~/server/members/actions";
import { searchGuestsAction, createGuest } from "~/server/guests/actions";
import toast from "react-hot-toast";
import { AddGuestDialog } from "~/components/guests/AddGuestDialog";
import type { GuestFormValues } from "~/app/types/GuestTypes";

interface AddRegistrationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: number;
  eventName: string;
  teamSize: number;
  guestsAllowed: boolean;
  requiresApproval: boolean;
  onSuccess: () => void;
  existingRegistrations?: any[]; // Array of existing registrations
}

type Member = {
  id: number;
  firstName: string;
  lastName: string;
  memberNumber: string;
  classId: number;
  memberClass: {
    id: number;
    label: string;
    isActive: boolean;
  };
};

type Guest = {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
};

type Fill = {
  fillType: string;
  customName?: string;
};

export function AddRegistrationDialog({
  isOpen,
  onOpenChange,
  eventId,
  eventName,
  teamSize,
  guestsAllowed,
  requiresApproval,
  onSuccess,
  existingRegistrations = [],
}: AddRegistrationDialogProps) {
  const [captain, setCaptain] = useState<Member | null>(null);
  const [teamMembers, setTeamMembers] = useState<Member[]>([]);
  const [fills, setFills] = useState<Fill[]>([]);
  const [notes, setNotes] = useState("");
  const [registrationStatus, setRegistrationStatus] = useState<string>("APPROVED");
  const [isProcessing, setIsProcessing] = useState(false);

  // Search states
  const [captainSearchQuery, setCaptainSearchQuery] = useState("");
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [guestSearchQuery, setGuestSearchQuery] = useState("");
  const [captainSearchResults, setCaptainSearchResults] = useState<Member[]>([]);
  const [memberSearchResults, setMemberSearchResults] = useState<Member[]>([]);
  const [guestSearchResults, setGuestSearchResults] = useState<Guest[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Guest creation
  const [showAddGuestDialog, setShowAddGuestDialog] = useState(false);

  // Fill type selection
  const [fillType, setFillType] = useState<string>("GUEST");
  const [customFillName, setCustomFillName] = useState("");

  // Build a set of already registered member IDs from existing registrations
  const registeredMemberIds = new Set<number>();
  existingRegistrations.forEach((reg: any) => {
    registeredMemberIds.add(reg.memberId);
    if (reg.teamMemberIds && Array.isArray(reg.teamMemberIds)) {
      reg.teamMemberIds.forEach((id: number) => registeredMemberIds.add(id));
    }
  });

  // Calculate current people count
  const currentPeople = (captain ? 1 : 0) + teamMembers.length + fills.length;
  const maxPeople = teamSize;
  const isFull = currentPeople >= maxPeople;

  // Check if a member is already registered
  const isMemberAlreadyRegistered = (memberId: number) => {
    return registeredMemberIds.has(memberId);
  };

  // Reset form
  const resetForm = () => {
    setCaptain(null);
    setTeamMembers([]);
    setFills([]);
    setNotes("");
    setRegistrationStatus("APPROVED");
    setCaptainSearchQuery("");
    setMemberSearchQuery("");
    setGuestSearchQuery("");
    setCaptainSearchResults([]);
    setMemberSearchResults([]);
    setGuestSearchResults([]);
    setCustomFillName("");
  };

  // Search for captain
  const handleCaptainSearch = async (query: string) => {
    setCaptainSearchQuery(query);
    if (query.trim().length < 2) {
      setCaptainSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchMembersAction(query);
      if (results) {
        setCaptainSearchResults(results);
      }
    } catch (error) {
      console.error("Error searching captain:", error);
      toast.error("Failed to search members");
    } finally {
      setIsSearching(false);
    }
  };

  // Search for members
  const handleMemberSearch = async (query: string) => {
    setMemberSearchQuery(query);
    if (query.trim().length < 2) {
      setMemberSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchMembersAction(query);
      if (results) {
        // Filter out captain and already added team members
        const filtered = results.filter(
          (m: Member) =>
            m.id !== captain?.id &&
            !teamMembers.some((tm) => tm.id === m.id)
        );
        setMemberSearchResults(filtered);
      }
    } catch (error) {
      console.error("Error searching members:", error);
      toast.error("Failed to search members");
    } finally {
      setIsSearching(false);
    }
  };

  // Search for guests
  const handleGuestSearch = async (query: string) => {
    setGuestSearchQuery(query);
    if (query.trim().length < 2) {
      setGuestSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchGuestsAction(query);
      if (results) {
        setGuestSearchResults(results);
      }
    } catch (error) {
      console.error("Error searching guests:", error);
      toast.error("Failed to search guests");
    } finally {
      setIsSearching(false);
    }
  };

  // Select captain
  const handleSelectCaptain = (member: Member) => {
    if (isMemberAlreadyRegistered(member.id)) {
      toast.error(`${member.firstName} ${member.lastName} is already registered for this event`);
      return;
    }
    setCaptain(member);
    setCaptainSearchQuery("");
    setCaptainSearchResults([]);
    toast.success(`Selected ${member.firstName} ${member.lastName} as captain`);
  };

  // Remove captain
  const handleRemoveCaptain = () => {
    setCaptain(null);
    toast.success("Removed captain");
  };

  // Add team member
  const handleAddTeamMember = (member: Member) => {
    if (isFull) {
      toast.error(`Maximum ${maxPeople} people allowed`);
      return;
    }

    if (isMemberAlreadyRegistered(member.id)) {
      toast.error(`${member.firstName} ${member.lastName} is already registered for this event`);
      return;
    }

    setTeamMembers([...teamMembers, member]);
    setMemberSearchQuery("");
    setMemberSearchResults([]);
    toast.success(`Added ${member.firstName} ${member.lastName}`);
  };

  // Remove team member
  const handleRemoveTeamMember = (memberId: number) => {
    setTeamMembers(teamMembers.filter((m) => m.id !== memberId));
    toast.success("Removed team member");
  };

  // Add guest fill
  const handleAddGuestFill = (guest: Guest) => {
    if (isFull) {
      toast.error(`Maximum ${maxPeople} people allowed`);
      return;
    }

    const newFill: Fill = {
      fillType: "GUEST",
      customName: `${guest.firstName} ${guest.lastName}`,
    };

    setFills([...fills, newFill]);
    setGuestSearchQuery("");
    setGuestSearchResults([]);
    toast.success(`Added guest ${guest.firstName} ${guest.lastName}`);
  };

  // Add custom fill
  const handleAddCustomFill = () => {
    if (isFull) {
      toast.error(`Maximum ${maxPeople} people allowed`);
      return;
    }

    if (fillType === "GUEST" && !customFillName.trim()) {
      toast.error("Please enter a guest name");
      return;
    }

    const newFill: Fill = {
      fillType: fillType,
      customName: fillType === "GUEST" ? customFillName : undefined,
    };

    setFills([...fills, newFill]);
    setCustomFillName("");
    toast.success("Added fill");
  };

  // Remove fill
  const handleRemoveFill = (index: number) => {
    setFills(fills.filter((_, i) => i !== index));
    toast.success("Removed fill");
  };

  // Create guest and add as fill
  const handleCreateGuest = async (values: GuestFormValues) => {
    try {
      const result = await createGuest(values);
      if (result.success && result.data) {
        setShowAddGuestDialog(false);
        handleAddGuestFill(result.data);
      } else {
        toast.error(result.error || "Failed to create guest");
      }
    } catch (error) {
      console.error("Error creating guest:", error);
      toast.error("Failed to create guest");
    }
  };

  // Save registration
  const handleSave = async () => {
    if (!captain) {
      toast.error("Please select a team captain");
      return;
    }

    if (currentPeople !== maxPeople) {
      toast.error(`Please add exactly ${maxPeople} people (currently ${currentPeople})`);
      return;
    }

    setIsProcessing(true);
    try {
      const result = await createEventRegistrationAsAdmin(eventId, {
        captainId: captain.id,
        teamMemberIds: teamMembers.map((m) => m.id),
        fills: fills,
        notes: notes,
        status: registrationStatus as "APPROVED" | "PENDING" | "REJECTED",
      });

      if (result.success) {
        toast.success("Registration created successfully");
        resetForm();
        onSuccess();
        onOpenChange(false);
      } else {
        toast.error(result.error || "Failed to create registration");
      }
    } catch (error) {
      console.error("Error creating registration:", error);
      toast.error("An error occurred while creating registration");
    } finally {
      setIsProcessing(false);
    }
  };

  // Get fill display name
  const getFillDisplayName = (fill: Fill) => {
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

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open) resetForm();
        onOpenChange(open);
      }}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Registration</DialogTitle>
            <DialogDescription>
              Create a new registration for {eventName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Registration Status */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">
                Registration Status
              </Label>
              <Select value={registrationStatus} onValueChange={setRegistrationStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Captain Selection */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">
                Select Team Captain *
              </Label>
              {!captain ? (
                <div className="space-y-3">
                  <Input
                    placeholder="Search for captain by name or number..."
                    value={captainSearchQuery}
                    onChange={(e) => handleCaptainSearch(e.target.value)}
                  />
                  {isSearching && (
                    <p className="text-sm text-gray-500">Searching...</p>
                  )}
                  {captainSearchResults.length > 0 && (
                    <div className="max-h-48 overflow-y-auto border rounded-md">
                      {captainSearchResults.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                          onClick={() => handleSelectCaptain(member)}
                        >
                          <div>
                            <div className="font-medium text-sm">
                              {member.firstName} {member.lastName}
                            </div>
                            <div className="text-xs text-gray-500">
                              #{member.memberNumber} - {member.memberClass.label}
                            </div>
                          </div>
                          <UserCheck className="h-4 w-4 text-gray-400" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-lg border bg-org-primary/5 border-org-primary/20 p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-org-primary text-white font-medium">
                    {captain.firstName.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">
                      {captain.firstName} {captain.lastName}
                    </div>
                    <div className="text-sm text-gray-500">
                      #{captain.memberNumber}
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                    onClick={handleRemoveCaptain}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Current People Count */}
            {captain && (
              <div className="flex items-center justify-between rounded-lg border bg-gray-50 p-3">
                <span className="text-sm font-medium">People in Registration:</span>
                <Badge variant={isFull ? "default" : currentPeople === 0 ? "destructive" : "secondary"}>
                  {currentPeople} / {maxPeople}
                </Badge>
              </div>
            )}

            {/* Team Members Section */}
            {captain && !isFull && (
              <div>
                <Label className="text-sm font-semibold mb-2 block">
                  Add Team Members
                </Label>
                <div className="space-y-3">
                  <Input
                    placeholder="Search members by name or number..."
                    value={memberSearchQuery}
                    onChange={(e) => handleMemberSearch(e.target.value)}
                  />
                  {isSearching && (
                    <p className="text-sm text-gray-500">Searching...</p>
                  )}
                  {memberSearchResults.length > 0 && (
                    <div className="max-h-48 overflow-y-auto border rounded-md">
                      {memberSearchResults.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                          onClick={() => handleAddTeamMember(member)}
                        >
                          <div>
                            <div className="font-medium text-sm">
                              {member.firstName} {member.lastName}
                            </div>
                            <div className="text-xs text-gray-500">
                              #{member.memberNumber} - {member.memberClass.label}
                            </div>
                          </div>
                          <UserPlus className="h-4 w-4 text-gray-400" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Current Team Members */}
            {teamMembers.length > 0 && (
              <div>
                <Label className="text-sm font-semibold mb-2 block">
                  Playing with ({teamMembers.length})
                </Label>
                <div className="space-y-2">
                  {teamMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 rounded-lg border p-3"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-medium">
                        {member.firstName.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm">
                          {member.firstName} {member.lastName}
                        </div>
                        <div className="text-xs text-gray-500">
                          #{member.memberNumber}
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                        onClick={() => handleRemoveTeamMember(member.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fills Section (only if guests allowed) */}
            {captain && guestsAllowed && !isFull && (
              <div>
                <Label className="text-sm font-semibold mb-2 block">
                  Add Fills/Guests
                </Label>
                <Tabs defaultValue="search" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="search">Search Guest</TabsTrigger>
                    <TabsTrigger value="create">Create Guest</TabsTrigger>
                    <TabsTrigger value="fill">Add Fill</TabsTrigger>
                  </TabsList>

                  <TabsContent value="search" className="space-y-3">
                    <Input
                      placeholder="Search guests by name..."
                      value={guestSearchQuery}
                      onChange={(e) => handleGuestSearch(e.target.value)}
                    />
                    {guestSearchResults.length > 0 && (
                      <div className="max-h-48 overflow-y-auto border rounded-md">
                        {guestSearchResults.map((guest) => (
                          <div
                            key={guest.id}
                            className="flex items-center justify-between p-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                            onClick={() => handleAddGuestFill(guest)}
                          >
                            <div>
                              <div className="font-medium text-sm">
                                {guest.firstName} {guest.lastName}
                              </div>
                              <div className="text-xs text-gray-500">
                                {guest.email || guest.phone || "No contact info"}
                              </div>
                            </div>
                            <UserPlus className="h-4 w-4 text-gray-400" />
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="create">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowAddGuestDialog(true)}
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      Create New Guest
                    </Button>
                  </TabsContent>

                  <TabsContent value="fill" className="space-y-3">
                    <div className="space-y-2">
                      <Label>Fill Type</Label>
                      <select
                        className="w-full rounded-md border p-2 text-sm"
                        value={fillType}
                        onChange={(e) => setFillType(e.target.value)}
                      >
                        <option value="GUEST">Guest</option>
                        <option value="RECIPROCAL">Reciprocal</option>
                        <option value="CUSTOM">Custom</option>
                      </select>
                    </div>
                    {fillType === "GUEST" && (
                      <div className="space-y-2">
                        <Label>Guest Name</Label>
                        <Input
                          placeholder="Enter guest name..."
                          value={customFillName}
                          onChange={(e) => setCustomFillName(e.target.value)}
                        />
                      </div>
                    )}
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleAddCustomFill}
                    >
                      Add Fill
                    </Button>
                  </TabsContent>
                </Tabs>
              </div>
            )}

            {/* Current Fills */}
            {fills.length > 0 && (
              <div>
                <Label className="text-sm font-semibold mb-2 block">
                  Fills ({fills.length})
                </Label>
                <div className="space-y-2">
                  {fills.map((fill, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 rounded-lg border p-3"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-medium">
                        F
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm">
                          {getFillDisplayName(fill)}
                        </div>
                        <div className="text-xs text-gray-500">{fill.fillType}</div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600"
                        onClick={() => handleRemoveFill(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {captain && (
              <div>
                <Label className="text-sm font-semibold mb-2 block">
                  Notes (Optional)
                </Label>
                <Textarea
                  placeholder="Add any notes about this registration..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isProcessing || !captain || currentPeople !== maxPeople}>
              {isProcessing ? "Creating..." : "Create Registration"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Guest Dialog */}
      <AddGuestDialog
        open={showAddGuestDialog}
        onOpenChange={setShowAddGuestDialog}
        onSubmit={handleCreateGuest}
      />
    </>
  );
}
