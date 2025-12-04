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
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { Clock, Dice1, CheckCircle, Users, Plus, X, Eye } from "lucide-react";
import { formatDate } from "~/lib/dates";
import { submitLotteryEntry } from "~/server/lottery/actions";
import { MemberSearchInput } from "~/components/members/MemberSearchInput";
import type { Member } from "~/app/types/MemberTypes";
import { calculateDynamicTimeWindows } from "~/lib/lottery-utils";
import {
  TeesheetConfigWithBlocks,
  type LotteryEntry,
} from "~/server/db/schema";
import { type LotteryFormInput } from "~/server/db/schema/lottery";

// For the member search results
interface SearchMember {
  id: number;
  firstName: string;
  lastName: string;
  memberNumber: string;
}

const lotteryEntrySchema = z.object({
  preferredWindow: z.string().min(1, "Please select a preferred time window"),
  alternateWindow: z.string().optional(),
  memberIds: z.array(z.number()).optional(),
});

type FormData = z.infer<typeof lotteryEntrySchema>;

interface LotteryEntryFormProps {
  lotteryDate: string;
  member: Member;
  config: TeesheetConfigWithBlocks;
  existingEntry?: LotteryEntry | null;
  onSuccess?: () => void;
}

export function MemberLotteryEntryForm({
  lotteryDate,
  member,
  config,
  existingEntry,
  onSuccess,
}: LotteryEntryFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<SearchMember[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  // Calculate dynamic time windows based on config
  const timeWindows = calculateDynamicTimeWindows(config);
  //TODO: FIX THIS TO USE LOTTERY.ENABLED PROP
  const isLotteryAvailable = true;

  const form = useForm<FormData>({
    resolver: zodResolver(lotteryEntrySchema),
    defaultValues: {
      preferredWindow: existingEntry?.preferredWindow || "",
      alternateWindow: existingEntry?.alternateWindow || "",
      memberIds: [],
    },
  });

  const isEditing = !!existingEntry;
  const selectedWindow = form.watch("preferredWindow");
  const alternateWindow = form.watch("alternateWindow");

  const handleMemberSelect = (selectedMember: SearchMember | null) => {
    if (!selectedMember) return;

    if (selectedMember.id === member.id) {
      toast.error("You're already included in the entry");
      return;
    }

    if (selectedMembers.find((m) => m.id === selectedMember.id)) {
      toast.error("Member already added");
      return;
    }

    if (selectedMembers.length >= 3) {
      toast.error("Maximum 4 players per group (including yourself)");
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

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const formData: LotteryFormInput = {
        organizerId: member.id,
        lotteryDate,
        preferredWindow: data.preferredWindow,
        alternateWindow: data.alternateWindow || undefined,
        memberIds: data.memberIds || [],
      };

      const result = await submitLotteryEntry(member.id, formData);

      if (result.success) {
        toast.success(
          isEditing
            ? "Lottery entry updated successfully!"
            : "Lottery entry submitted successfully!",
        );
        onSuccess?.();
      } else {
        toast.error(result.error || "Failed to submit lottery entry");
      }
    } catch (error) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSelectedWindowInfo = () => {
    return timeWindows.find((w) => w.value === selectedWindow);
  };

  const getAlternateWindowInfo = () => {
    return timeWindows.find((w) => w.value === alternateWindow);
  };

  const isGroupEntry = selectedMembers.length > 0;
  const totalPlayers = selectedMembers.length + 1; // +1 for the submitting member

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
              are only available for regular scheduled dates. Please contact the
              pro shop for tee time bookings on this date.
            </p>
          </div>
          <Button variant="outline" onClick={onSuccess} className="w-full">
            Back to Teesheet
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
              <CardTitle className="text-xl">
                {isEditing ? "Edit Lottery Entry" : "Submit Lottery Entry"}
              </CardTitle>
              <CardDescription>
                {formatDate(lotteryDate, "EEEE, MMMM do")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Players Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <h3 className="font-medium">Players</h3>
                  <Badge variant="outline" className="ml-auto">
                    {totalPlayers} player{totalPlayers !== 1 ? "s" : ""}
                  </Badge>
                </div>

                {/* Current User */}
                <div className="border-org-primary/20 bg-org-primary/5 flex items-center gap-3 rounded-lg border p-3">
                  <div className="bg-org-primary/20 flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium">
                    {member.firstName[0]}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">
                      {member.firstName} {member.lastName}
                    </div>
                    <div className="text-sm text-gray-500">You (organizer)</div>
                  </div>
                </div>

                {/* Selected Members */}
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

                {/* Add Member */}
                {selectedMembers.length < 3 && (
                  <div className="space-y-2">
                    <div className="text-sm text-gray-600">
                      Add additional players:
                    </div>
                    <MemberSearchInput
                      onSelect={handleMemberSelect}
                      placeholder="Search for members to add..."
                    />
                  </div>
                )}
              </div>

              <Separator />

              {/* Time Preferences */}
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
                        Choose your preferred part of the day
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

              {/* Preview Toggle */}
              {selectedWindow && (
                <>
                  <Separator />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowPreview(!showPreview)}
                    className="w-full"
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    {showPreview ? "Hide" : "Show"} Preview
                  </Button>
                </>
              )}

              {/* Preview Section */}
              {showPreview && selectedWindow && (
                <Card className="border-org-primary/20 bg-org-primary/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Entry Preview</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <div className="text-sm font-medium text-gray-600">
                        Date
                      </div>
                      <div>{formatDate(lotteryDate, "EEEE, MMMM do")}</div>
                    </div>

                    <div>
                      <div className="text-sm font-medium text-gray-600">
                        Type
                      </div>
                      <div>
                        {isGroupEntry
                          ? `Group Entry (${totalPlayers} players)`
                          : "Individual Entry"}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm font-medium text-gray-600">
                        Preferred Time
                      </div>
                      <div className="flex items-center gap-2">
                        <span>{getSelectedWindowInfo()?.icon}</span>
                        <span>{getSelectedWindowInfo()?.label}</span>
                      </div>
                    </div>

                    {alternateWindow && (
                      <div>
                        <div className="text-sm font-medium text-gray-600">
                          Backup Window
                        </div>
                        <div className="flex items-center gap-2">
                          <span>{getAlternateWindowInfo()?.icon}</span>
                          <span>{getAlternateWindowInfo()?.label}</span>
                        </div>
                      </div>
                    )}

                    {isGroupEntry && (
                      <div>
                        <div className="text-sm font-medium text-gray-600">
                          Players
                        </div>
                        <div className="space-y-1">
                          <div className="text-sm">
                            • {member.firstName} {member.lastName} (you)
                          </div>
                          {selectedMembers.map((m) => (
                            <div key={m.id} className="text-sm">
                              • {m.firstName} {m.lastName}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <Separator />

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isSubmitting || !selectedWindow}
                className="bg-org-primary hover:bg-org-primary/90 w-full"
                size="lg"
              >
                {isSubmitting ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    {isEditing ? "Updating..." : "Submitting..."}
                  </>
                ) : (
                  <>
                    <Dice1 className="mr-2 h-4 w-4" />
                    {isEditing ? "Update Entry" : "Submit Entry"}
                  </>
                )}
              </Button>

              <div className="text-center">
                <Badge variant="outline" className="text-xs">
                  Entry can be modified until lottery processing begins
                </Badge>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
