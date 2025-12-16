"use client";

import { useState } from "react";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { MemberLotteryEntryForm } from "./MemberLotteryEntryForm";
import { MemberLotteryEntryView } from "./MemberLotteryEntryView";
import type { LotteryEntryData } from "~/server/db/schema/lottery/lottery-entries.schema";
import type { TeesheetConfigWithBlocks } from "~/server/db/schema";

// Member type for client-side usage
type ClientMember = {
  id: number;
  classId: number;
  firstName: string;
  lastName: string;
  memberClass?: { id: number; label: string } | null;
  [key: string]: any;
};

interface LotteryInterfaceProps {
  lotteryDate: string;
  lotteryEntry?: LotteryEntryData;
  member: ClientMember;
  config: TeesheetConfigWithBlocks;
  error?: string | null;
  onDataChange?: () => void;
  lotteryRestrictionViolation?: {
    hasViolation: boolean;
    message: string;
    violations: any[];
  } | null;
}

export function LotteryInterface({
  lotteryDate,
  lotteryEntry = null,
  member,
  config,
  error = null,
  onDataChange,
  lotteryRestrictionViolation,
}: LotteryInterfaceProps) {
  // Initialize showForm based on whether there's an existing entry
  // If entry exists, start in view mode (showForm = false)
  // If no entry, start in form mode (showForm = true)
  const [showForm, setShowForm] = useState(!lotteryEntry);

  const handleFormSuccess = () => {
    setShowForm(false);
    // Trigger data refresh from parent
    onDataChange?.();
  };

  const handleEdit = () => {
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    // Trigger data refresh from parent
    onDataChange?.();
  };

  const handleBackToView = () => {
    setShowForm(false);
  };

  if (error) {
    return (
      <Card className="mx-auto w-full max-w-2xl">
        <CardContent className="py-12">
          <div className="space-y-4 text-center">
            <div className="text-lg font-medium text-red-600">Error</div>
            <p className="text-gray-600">{error}</p>
            <Button onClick={() => setShowForm(true)} variant="outline">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show existing entry view - allow viewing/editing even if restriction violation exists
  // Only show view if not in edit mode (showForm is false)
  if (lotteryEntry && !showForm) {
    return (
      <MemberLotteryEntryView
        lotteryDate={lotteryDate}
        entry={lotteryEntry.entry}
        entryType={lotteryEntry.type}
        member={member}
        config={config}
        onEdit={lotteryEntry.type !== "group_member" ? handleEdit : undefined}
        onCancel={handleCancel}
      />
    );
  }

  // Show form (new entry or editing existing entry)
  if (showForm) {
    return (
      <div className="space-y-4">
        {lotteryEntry && (
          <div className="text-center">
            <Button variant="outline" onClick={handleBackToView}>
              ← Back to Entry
            </Button>
          </div>
        )}
        <MemberLotteryEntryForm
          lotteryDate={lotteryDate}
          member={member}
          config={config}
          existingEntry={
            lotteryEntry?.type === "individual" ? lotteryEntry.entry : null
          }
          onSuccess={handleFormSuccess}
        />
      </div>
    );
  }

  // Show restriction message if violation exists AND no existing entry
  // (if they have an entry, they can edit it even if they've reached the limit)
  if (lotteryRestrictionViolation?.hasViolation) {
    return (
      <Card className="mx-auto w-full max-w-2xl">
        <CardContent className="py-12">
          <div className="space-y-4 text-center">
            <div className="text-lg font-medium text-orange-600">
              Lottery Entry Limit Reached
            </div>
            <p className="text-gray-600">
              {lotteryRestrictionViolation.message}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Default: Show the form directly
  return (
    <MemberLotteryEntryForm
      lotteryDate={lotteryDate}
      member={member}
      config={config}
      existingEntry={null}
      onSuccess={handleFormSuccess}
    />
  );
}
