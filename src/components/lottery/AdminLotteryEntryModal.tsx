"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { Clock, Dice1, CheckCircle, Users, X } from "lucide-react";
import { formatDate } from "~/lib/dates";
import { submitLotteryEntry } from "~/server/lottery/actions";
import { MemberSearchInput } from "~/components/members/MemberSearchInput";
import { LotteryFillSelector } from "~/components/lottery/LotteryFillSelector";
import type {
  TimeWindow,
  LotteryEntryFormData,
} from "~/app/types/LotteryTypes";
import type { FillType } from "~/app/types/TeeSheetTypes";
import { FillTypes } from "~/app/types/TeeSheetTypes";
import { calculateDynamicTimeWindows } from "~/lib/lottery-utils";
import type { Teesheet, TeesheetConfigWithBlocks } from "~/server/db/schema";
import {
  lotteryEntryWithFillsSchema,
  type LotteryFormInput,
} from "~/server/db/schema/lottery";

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
  // Form management with React Hook Form - using destructuring pattern
  const {
    handleSubmit,
    setValue,
    watch,
    setError,
    reset,
    formState: { errors },
  } = useForm<LotteryFormInput>({
    resolver: zodResolver(lotteryEntryWithFillsSchema),
    mode: "onChange",
    defaultValues: {
      organizerId: 0,
      preferredWindow: "",
      alternateWindow: "",
      fills: [],
      memberIds: [],
      lotteryDate: teesheet.date,
    },
  });

  // Display state for member information (minimal UI state)
  const [selectedMembersDisplay, setSelectedMembersDisplay] = useState<
    SearchMember[]
  >([]);
  const [organizerDisplay, setOrganizerDisplay] = useState<SearchMember | null>(
    null,
  );

  // Derived state from form
  const timeWindows = calculateDynamicTimeWindows(config);
  const isLotteryAvailable = teesheet.lotteryEnabled;
  const organizerId = watch("organizerId");
  const memberIds = watch("memberIds");
  const formFills = watch("fills") || [];
  const preferredWindow = watch("preferredWindow");
  const alternateWindow = watch("alternateWindow");
  const totalPlayers =
    (organizerId ? 1 : 0) + memberIds.length + formFills.length;

  // Mutation for submitting lottery entry
  const submitMutation = useMutation({
    mutationFn: async (formData: LotteryEntryFormData) => {
      return submitLotteryEntry(organizerId, formData);
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Lottery entry created successfully!");
        onSuccess?.();
        handleClose();
      } else {
        toast.error(result.error || "Failed to create lottery entry");
      }
    },
    onError: (error) => {
      console.error(error);
      toast.error("An unexpected error occurred");
    },
  });

  const handleClose = () => {
    reset();
    setOrganizerDisplay(null);
    setSelectedMembersDisplay([]);
    onOpenChange(false);
  };

  const handleOrganizerSelect = (selectedMember: SearchMember | null) => {
    if (!selectedMember) return;

    setValue("organizerId", selectedMember.id);
    setOrganizerDisplay(selectedMember);

    // Remove organizer from additional members if they were added
    const newMemberIds = memberIds.filter((id) => id !== selectedMember.id);
    setValue("memberIds", newMemberIds);
    setSelectedMembersDisplay(
      selectedMembersDisplay.filter((m) => m.id !== selectedMember.id),
    );

    // Reset fills when organizer changes (as per original logic)
    setValue("fills", []);
  };

  const handleMemberSelect = (selectedMember: SearchMember | null) => {
    if (!selectedMember) return;

    if (organizerId && selectedMember.id === organizerId) {
      setError("memberIds", {
        message: "This member is already the organizer",
      });
      return;
    }

    if (memberIds.find((id) => id === selectedMember.id)) {
      setError("memberIds", {
        message: "Member already added",
      });
      return;
    }

    if (totalPlayers >= 4) {
      setError("memberIds", {
        message: "Maximum 4 players per group (including organizer)",
      });
      return;
    }

    setValue("memberIds", [...memberIds, selectedMember.id]);
    setSelectedMembersDisplay([...selectedMembersDisplay, selectedMember]);
  };

  const removeMember = (memberId: number) => {
    setValue(
      "memberIds",
      memberIds.filter((id) => id !== memberId),
    );
    setSelectedMembersDisplay(
      selectedMembersDisplay.filter((m) => m.id !== memberId),
    );
  };

  const removeOrganizer = () => {
    setValue("organizerId", 0);
    setValue("fills", []);
    setOrganizerDisplay(null);
  };

  const addFill = (fillType: FillType, customName?: string) => {
    if (totalPlayers >= 4) {
      setError("fills", { message: "Maximum 4 players per group" });
      return;
    }
    const newFills = [...(formFills || []), { fillType, customName }];
    setValue("fills", newFills);
  };

  const removeFill = (index: number) => {
    const newFills = (formFills || []).filter((_, i: number) => i !== index);
    setValue("fills", newFills);
  };

  const onSubmit = async (data: LotteryFormInput) => {
    if (!organizerId) {
      setError("organizerId", { message: "Please select an organizer" });
      return;
    }

    const formData: LotteryEntryFormData = {
      lotteryDate: teesheet.date,
      preferredWindow: data.preferredWindow as TimeWindow,
      alternateWindow: data.alternateWindow
        ? (data.alternateWindow as TimeWindow)
        : undefined,
      // Additional members (organizer will be added server-side)
      memberIds: data.memberIds,
      // Fills can be added to any entry (individual or group)
      fills: data.fills && data.fills.length > 0 ? data.fills : undefined,
    };

    await submitMutation.mutateAsync(formData);
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
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dice1 className="h-5 w-5" />
            Create Lottery Entry
          </DialogTitle>
          <DialogDescription>
            {formatDate(teesheet.date, "EEEE, MMMM do")}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col overflow-hidden"
        >
          <div className="space-y-6 overflow-y-auto px-6">
            {/* Organizer Selection */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <h3 className="font-medium">Entry Organizer</h3>
              </div>

              {!organizerDisplay ? (
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
                    {organizerDisplay.firstName[0]}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">
                      {organizerDisplay.firstName} {organizerDisplay.lastName}
                    </div>
                    <div className="text-sm text-gray-500">
                      Organizer • #{organizerDisplay.memberNumber}
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
            {!!organizerId && (
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
                    {errors.memberIds && (
                      <p className="text-sm text-red-600">
                        {errors.memberIds.message}
                      </p>
                    )}
                  </div>
                )}

                {/* Display all players (members and fills) together */}
                {selectedMembersDisplay.map((selectedMember) => (
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
                {formFills.map((fill, index) => (
                  <div
                    key={index}
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
                      onClick={() => removeFill(index)}
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

            {!!organizerId && <Separator />}

            {/* Time Preferences */}
            {!!organizerId && (
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
                        onClick={() =>
                          setValue("preferredWindow", window.value)
                        }
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
                              setValue(
                                "alternateWindow",
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
          </div>

          <DialogFooter className="flex gap-3 pt-6">
            <Button
              type="submit"
              disabled={
                submitMutation.isPending || !organizerId || !preferredWindow
              }
              className="bg-org-primary hover:bg-org-primary/90 flex-1"
              size="lg"
            >
              {submitMutation.isPending ? (
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
              disabled={submitMutation.isPending}
              size="lg"
            >
              Cancel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
