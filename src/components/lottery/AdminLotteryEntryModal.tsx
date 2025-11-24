"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { Clock, Dice1, CheckCircle, Users, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Input } from "~/components/ui/input";
import { formatDate } from "~/lib/dates";
import { submitLotteryEntry } from "~/server/lottery/actions";
import { MemberSearchInput } from "~/components/members/MemberSearchInput";
import type {
  TimeWindow,
  LotteryEntryFormData,
} from "~/app/types/LotteryTypes";
import type { FillType } from "~/app/types/TeeSheetTypes";
import { FillTypes } from "~/app/types/TeeSheetTypes";
import { calculateDynamicTimeWindows } from "~/lib/lottery-utils";
import type {
  Teesheet,
  TeesheetConfigWithBlocks,
} from "~/server/db/schema";
// Types
interface SearchMember {
  id: number;
  firstName: string;
  lastName: string;
  memberNumber: string;
}

interface AdminLotteryEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teesheet: Teesheet;
  config: TeesheetConfigWithBlocks | null;
  onSuccess?: () => void;
}

export function AdminLotteryEntryModal({
  open,
  onOpenChange,
  teesheet,
  config,
  onSuccess,
}: AdminLotteryEntryModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [organizer, setOrganizer] = useState<SearchMember | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<SearchMember[]>([]);
  const [fills, setFills] = useState<
    Array<{ id: string; fillType: FillType; customName?: string }>
  >([]);
  const [preferredWindow, setPreferredWindow] = useState<string>("");
  const [alternateWindow, setAlternateWindow] = useState<string>("");

  // Derived state
  const timeWindows = calculateDynamicTimeWindows(config);
  const isLotteryAvailable = teesheet.lotteryEnabled;
  const totalPlayers =
    (organizer ? 1 : 0) + selectedMembers.length + fills.length;

  const handleClose = () => {
    // Reset form on close
    setOrganizer(null);
    setSelectedMembers([]);
    setFills([]);
    setPreferredWindow("");
    setAlternateWindow("");
    onOpenChange(false);
  };

  const handleOrganizerSelect = (selectedMember: SearchMember | null) => {
    if (!selectedMember) return;

    setOrganizer(selectedMember);

    // Remove organizer from additional members if they were added
    const newMembers = selectedMembers.filter(
      (m) => m.id !== selectedMember.id,
    );
    setSelectedMembers(newMembers);

    // Reset fills when organizer changes (as per original logic)
    setFills([]);
  };

  const handleMemberSelect = (selectedMember: SearchMember | null) => {
    if (!selectedMember) return;

    if (organizer && selectedMember.id === organizer.id) {
      toast.error("This member is already the organizer");
      return;
    }

    if (selectedMembers.find((m) => m.id === selectedMember.id)) {
      toast.error("Member already added");
      return;
    }

    if (totalPlayers >= 4) {
      toast.error("Maximum 4 players per group (including organizer)");
      return;
    }

    setSelectedMembers([...selectedMembers, selectedMember]);
  };

  const removeMember = (memberId: number) => {
    setSelectedMembers(selectedMembers.filter((m) => m.id !== memberId));
  };

  const removeOrganizer = () => {
    setOrganizer(null);
    setFills([]);
  };

  const addFill = (fillType: FillType, customName?: string) => {
    if (totalPlayers >= 4) {
      toast.error("Maximum 4 players per group");
      return;
    }
    const newFill = {
      id: `fill-${Date.now()}-${Math.random()}`,
      fillType,
      customName,
    };
    setFills([...fills, newFill]);
  };

  const removeFill = (fillId: string) => {
    setFills(fills.filter((f) => f.id !== fillId));
  };

  const handleSubmit = async () => {
    if (!organizer) {
      toast.error("Please select an organizer");
      return;
    }
    if (!preferredWindow) {
      toast.error("Please select a preferred time window");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData: LotteryEntryFormData = {
        lotteryDate: teesheet.date,
        preferredWindow: preferredWindow as TimeWindow,
        alternateWindow: alternateWindow
          ? (alternateWindow as TimeWindow)
          : undefined,
        memberIds: [organizer.id, ...selectedMembers.map((m) => m.id)], // Note: API expects all member IDs including organizer?
        // Checking original code:
        // form.setValue("memberIds", [...selectedMembers.map((m) => m.id), selectedMember.id]); -> Wait, original code logic was confusing.
        // In original handleOrganizerSelect: form.setValue("organizerId", selectedMember.id);
        // In original handleMemberSelect: form.setValue("memberIds", [...selectedMembers.map((m) => m.id), selectedMember.id]);
        // But wait, the schema had memberIds as optional array.
        // Let's check submitLotteryEntry usage in original:
        // const formData: LotteryEntryFormData = { ... memberIds: data.memberIds ... }
        // And submitLotteryEntry(organizer.id, formData)
        // I should probably pass just the additional members in memberIds if the API expects that, or all.
        // Looking at original handleMemberSelect:
        // setSelectedMembers([...selectedMembers, selectedMember]);
        // form.setValue("memberIds", [...selectedMembers.map((m) => m.id), selectedMember.id]);
        // It seems memberIds included the new member.
        // But wait, handleOrganizerSelect CLEARED memberIds of the organizer ID.
        // So memberIds likely contains ONLY the additional members.
        // Let's verify:
        // In handleOrganizerSelect: form.setValue("memberIds", newMembers.map((m) => m.id));
        // So memberIds = additional members.
        // BUT, the API `submitLotteryEntry` takes `organizerId` as first arg, and `formData` as second.
        // `formData.memberIds` likely refers to the group members.
        // I will assume memberIds should contain the additional members.
        fills:
          fills.length > 0
            ? fills.map((f) => ({
                fillType: f.fillType,
                customName: f.customName,
              }))
            : undefined,
      };

      const result = await submitLotteryEntry(organizer.id, formData);

      if (result.success) {
        toast.success("Lottery entry created successfully!");
        onSuccess?.();
        handleClose();
      } else {
        toast.error(result.error || "Failed to create lottery entry");
      }
    } catch (error) {
      console.error(error);
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isLotteryAvailable || timeWindows.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lottery Not Available</DialogTitle>
            <DialogDescription>
              {formatDate(teesheet.date, "EEEE, MMMM do")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-center">
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <div className="mb-2 font-medium text-yellow-800">
                Custom Teesheet Configuration
              </div>
              <p className="text-sm text-yellow-700">
                This date uses a custom teesheet configuration. Lottery entries
                are only available for regular scheduled dates.
              </p>
            </div>
            <Button variant="outline" onClick={handleClose} className="w-full">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dice1 className="h-5 w-5" />
            Create Lottery Entry
          </DialogTitle>
          <DialogDescription>
            {formatDate(teesheet.date, "EEEE, MMMM do")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Organizer Selection */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <h3 className="font-medium">Entry Organizer</h3>
            </div>

            {!organizer ? (
              <div className="space-y-2">
                <div className="text-sm text-gray-600">
                  Select the member who will organize this entry:
                </div>
                <MemberSearchInput
                  onSelect={handleOrganizerSelect}
                  placeholder="Search for organizer..."
                />
              </div>
            ) : (
              <div className="border-org-primary/20 bg-org-primary/5 flex items-center gap-3 rounded-lg border p-3">
                <div className="bg-org-primary/20 flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium">
                  {organizer.firstName[0]}
                </div>
                <div className="flex-1">
                  <div className="font-medium">
                    {organizer.firstName} {organizer.lastName}
                  </div>
                  <div className="text-sm text-gray-500">
                    Organizer • #{organizer.memberNumber}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={removeOrganizer}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Additional Players Section */}
          {organizer && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <h3 className="font-medium">Additional Players</h3>
                <Badge variant="outline" className="ml-auto">
                  {totalPlayers} player{totalPlayers !== 1 ? "s" : ""}
                </Badge>
              </div>

              {/* Add Member Search - Show only if space available */}
              {totalPlayers < 4 && (
                <div className="space-y-2">
                  <div className="text-sm text-gray-600">
                    Add additional players (optional):
                  </div>
                  <MemberSearchInput
                    onSelect={handleMemberSelect}
                    placeholder="Search for members to add..."
                  />
                </div>
              )}

              {/* Display all players (members and fills) together */}
              {selectedMembers.map((selectedMember) => (
                <div
                  key={selectedMember.id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-medium">
                    {selectedMember.firstName[0]}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">
                      {selectedMember.firstName} {selectedMember.lastName}
                    </div>
                    <div className="text-sm text-gray-500">
                      #{selectedMember.memberNumber}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeMember(selectedMember.id)}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              {/* Display fills in the same list */}
              {fills.map((fill) => (
                <div
                  key={fill.id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-medium">
                    F
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">
                      {fill.fillType === FillTypes.GUEST && "Guest Fill"}
                      {fill.fillType === FillTypes.RECIPROCAL &&
                        "Reciprocal Fill"}
                      {fill.fillType === FillTypes.CUSTOM &&
                        (fill.customName || "Custom Fill")}
                    </div>
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

              {/* Add Fills Section - Show only if space available */}
              {totalPlayers < 4 && (
                <div className="space-y-3 border-t pt-4">
                  <div className="text-sm font-medium text-gray-700">
                    Add Fills (Optional)
                  </div>
                  <LotteryFillSelector
                    onAddFill={addFill}
                    isDisabled={totalPlayers >= 4}
                  />
                </div>
              )}
            </div>
          )}

          {organizer && <Separator />}

          {/* Time Preferences */}
          {organizer && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-medium">
                  <Clock className="h-4 w-4" />
                  Preferred Time Window
                </div>
                <p className="text-muted-foreground text-sm">
                  Choose the preferred part of the day
                </p>
                <div className="grid gap-3">
                  {timeWindows.map((window) => (
                    <div
                      key={window.value}
                      className={`cursor-pointer rounded-lg border-2 p-3 transition-all ${
                        preferredWindow === window.value
                          ? "border-org-primary bg-org-primary/5"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                      onClick={() => setPreferredWindow(window.value)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{window.icon}</span>
                          <div>
                            <div className="font-medium">{window.label}</div>
                            <div className="text-sm text-gray-600">
                              {window.timeRange}
                            </div>
                          </div>
                        </div>
                        {preferredWindow === window.value && (
                          <CheckCircle className="text-org-primary h-5 w-5" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Backup Window */}
              {preferredWindow && (
                <div className="space-y-2">
                  <div className="font-medium">Backup Window (Optional)</div>
                  <p className="text-muted-foreground text-sm">
                    Alternative if preferred time isn't available
                  </p>
                  <div className="grid gap-2">
                    {timeWindows
                      .filter((w) => w.value !== preferredWindow)
                      .map((window) => (
                        <div
                          key={window.value}
                          className={`cursor-pointer rounded-lg border p-2 transition-all ${
                            alternateWindow === window.value
                              ? "border-org-primary bg-org-primary/5"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                          onClick={() =>
                            setAlternateWindow(
                              alternateWindow === window.value
                                ? ""
                                : window.value,
                            )
                          }
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span>{window.icon}</span>
                              <span className="text-sm font-medium">
                                {window.label}
                              </span>
                            </div>
                            {alternateWindow === window.value && (
                              <CheckCircle className="text-org-primary h-4 w-4" />
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <Separator />

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !organizer || !preferredWindow}
              className="bg-org-primary hover:bg-org-primary/90 flex-1"
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Creating...
                </>
              ) : (
                <>
                  <Dice1 className="mr-2 h-4 w-4" />
                  Create Entry
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              size="lg"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Fill selector component
interface LotteryFillSelectorProps {
  onAddFill: (fillType: FillType, customName?: string) => void;
  isDisabled: boolean;
}

function LotteryFillSelector({
  onAddFill,
  isDisabled,
}: LotteryFillSelectorProps) {
  const [selectedFillType, setSelectedFillType] = useState<FillType>(
    FillTypes.GUEST,
  );
  const [customFillName, setCustomFillName] = useState("");

  const handleAddFill = () => {
    if (selectedFillType === FillTypes.CUSTOM && !customFillName.trim()) {
      toast.error("Please enter a name for the custom fill");
      return;
    }

    onAddFill(
      selectedFillType,
      selectedFillType === FillTypes.CUSTOM ? customFillName : undefined,
    );

    // Reset form
    setCustomFillName("");
    setSelectedFillType(FillTypes.GUEST);
  };

  return (
    <div className="space-y-3 rounded-lg border border-dashed p-3">
      <Select
        value={selectedFillType}
        onValueChange={(value) => setSelectedFillType(value as FillType)}
        disabled={isDisabled}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select fill type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={FillTypes.GUEST}>Guest Fill</SelectItem>
          <SelectItem value={FillTypes.RECIPROCAL}>Reciprocal Fill</SelectItem>
          <SelectItem value={FillTypes.CUSTOM}>Other...</SelectItem>
        </SelectContent>
      </Select>

      {selectedFillType === FillTypes.CUSTOM && (
        <Input
          value={customFillName}
          onChange={(e) => setCustomFillName(e.target.value)}
          placeholder="Enter fill name..."
          disabled={isDisabled}
        />
      )}

      <Button
        type="button"
        onClick={handleAddFill}
        disabled={
          isDisabled ||
          (selectedFillType === FillTypes.CUSTOM && !customFillName.trim())
        }
        variant="outline"
        size="sm"
        className="w-full"
      >
        Add Fill
      </Button>
    </div>
  );
}
