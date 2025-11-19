"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "react-hot-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "~/components/ui/form";
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
import { TeesheetConfig } from "~/server/db/schema";
import { FillTypes } from "~/app/types/TeeSheetTypes";
import {
  calculateDynamicTimeWindows,
  isLotteryAvailableForConfig,
} from "~/lib/lottery-utils";

// For the member search results
interface SearchMember {
  id: number;
  firstName: string;
  lastName: string;
  memberNumber: string;
}

const adminLotteryEntrySchema = z.object({
  organizerId: z.number().min(1, "Please select an organizer"),
  preferredWindow: z.string().min(1, "Please select a preferred time window"),
  alternateWindow: z.string().optional(),
  memberIds: z.array(z.number()).optional(),
});

type FormData = z.infer<typeof adminLotteryEntrySchema>;

interface AdminLotteryEntryFormProps {
  lotteryDate: string;
  config: TeesheetConfig;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function AdminLotteryEntryForm({
  lotteryDate,
  config,
  onSuccess,
  onCancel,
}: AdminLotteryEntryFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [organizer, setOrganizer] = useState<SearchMember | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<SearchMember[]>([]);
  const [fills, setFills] = useState<
    Array<{ id: string; fillType: FillType; customName?: string }>
  >([]);

  // Calculate dynamic time windows based on config
  const timeWindows = calculateDynamicTimeWindows(config);
  const isLotteryAvailable = isLotteryAvailableForConfig(config);

  const form = useForm<FormData>({
    resolver: zodResolver(adminLotteryEntrySchema),
    defaultValues: {
      organizerId: 0,
      preferredWindow: "",
      alternateWindow: "",
      memberIds: [],
    },
  });

  const selectedWindow = form.watch("preferredWindow");
  const alternateWindow = form.watch("alternateWindow");

  const handleOrganizerSelect = (selectedMember: SearchMember | null) => {
    if (!selectedMember) return;

    setOrganizer(selectedMember);
    form.setValue("organizerId", selectedMember.id);

    // Remove organizer from additional members if they were added
    const newMembers = selectedMembers.filter(
      (m) => m.id !== selectedMember.id,
    );
    setSelectedMembers(newMembers);
    form.setValue(
      "memberIds",
      newMembers.map((m) => m.id),
    );

    // Reset fills when organizer changes
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

    if (selectedMembers.length >= 3) {
      toast.error("Maximum 4 players per group (including organizer)");
      return;
    }

    setSelectedMembers([...selectedMembers, selectedMember]);
    form.setValue("memberIds", [
      ...selectedMembers.map((m) => m.id),
      selectedMember.id,
    ]);
  };

  const removeMember = (memberId: number) => {
    const newMembers = selectedMembers.filter((m) => m.id !== memberId);
    setSelectedMembers(newMembers);
    form.setValue(
      "memberIds",
      newMembers.map((m) => m.id),
    );
  };

  const removeOrganizer = () => {
    setOrganizer(null);
    form.setValue("organizerId", 0);
    // Reset fills when organizer is removed
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

  const resetForm = () => {
    setOrganizer(null);
    setSelectedMembers([]);
    setFills([]);
    form.reset();
  };

  const handleCancel = () => {
    resetForm();
    onCancel?.();
  };

  const onSubmit = async (data: FormData) => {
    if (!organizer) {
      toast.error("Please select an organizer");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData: LotteryEntryFormData = {
        lotteryDate,
        preferredWindow: data.preferredWindow as TimeWindow,
        alternateWindow: data.alternateWindow as TimeWindow | undefined,
        memberIds: data.memberIds,
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
        resetForm();
        onSuccess?.();
      } else {
        toast.error(result.error || "Failed to create lottery entry");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalPlayers = selectedMembers.length + 1 + fills.length; // +1 for the organizer

  // Show message if lottery is not available for this config
  if (!isLotteryAvailable || timeWindows.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100">
              <Dice1 className="h-6 w-6 text-gray-600" />
            </div>
            <div>
              <CardTitle className="text-xl">Lottery Not Available</CardTitle>
              <CardDescription>
                {formatDate(lotteryDate, "EEEE, MMMM do")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
            <div className="mb-2 font-medium text-yellow-800">
              Custom Teesheet Configuration
            </div>
            <p className="text-sm text-yellow-700">
              This date uses a custom teesheet configuration. Lottery entries
              are only available for regular scheduled dates.
            </p>
          </div>
          <Button variant="outline" onClick={onCancel} className="w-full">
            Close
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="w-full">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="bg-org-primary/10 flex h-12 w-12 items-center justify-center rounded-lg">
              <Dice1 className="text-org-primary h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl">Create Lottery Entry</CardTitle>
              <CardDescription>
                {formatDate(lotteryDate, "EEEE, MMMM do")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                  <FormField
                    control={form.control}
                    name="preferredWindow"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2 font-medium">
                          <Clock className="h-4 w-4" />
                          Preferred Time Window
                        </FormLabel>
                        <FormDescription className="text-sm">
                          Choose the preferred part of the day
                        </FormDescription>
                        <div className="grid gap-3">
                          {timeWindows.map((window) => (
                            <div
                              key={window.value}
                              className={`cursor-pointer rounded-lg border-2 p-3 transition-all ${
                                field.value === window.value
                                  ? "border-org-primary bg-org-primary/5"
                                  : "border-gray-200 hover:border-gray-300"
                              }`}
                              onClick={() => field.onChange(window.value)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">{window.icon}</span>
                                  <div>
                                    <div className="font-medium">
                                      {window.label}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                      {window.timeRange}
                                    </div>
                                  </div>
                                </div>
                                {field.value === window.value && (
                                  <CheckCircle className="text-org-primary h-5 w-5" />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Backup Window */}
                  {selectedWindow && (
                    <FormField
                      control={form.control}
                      name="alternateWindow"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Backup Window (Optional)</FormLabel>
                          <FormDescription>
                            Alternative if preferred time isn't available
                          </FormDescription>
                          <div className="grid gap-2">
                            {timeWindows
                              .filter((w) => w.value !== selectedWindow)
                              .map((window) => (
                                <div
                                  key={window.value}
                                  className={`cursor-pointer rounded-lg border p-2 transition-all ${
                                    field.value === window.value
                                      ? "border-org-primary bg-org-primary/5"
                                      : "border-gray-200 hover:border-gray-300"
                                  }`}
                                  onClick={() =>
                                    field.onChange(
                                      field.value === window.value
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
                                    {field.value === window.value && (
                                      <CheckCircle className="text-org-primary h-4 w-4" />
                                    )}
                                  </div>
                                </div>
                              ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              )}

              <Separator />

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  type="submit"
                  disabled={isSubmitting || !organizer || !selectedWindow}
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
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isSubmitting}
                  size="lg"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
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
