"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { MemberLotteryEntryForm } from "./MemberLotteryEntryForm";
import { MemberLotteryEntryView } from "./MemberLotteryEntryView";
import type { LotteryEntryData } from "~/server/db/schema/lottery/lottery-entries.schema";
import type { Member } from "~/app/types/MemberTypes";
import type { TeesheetConfigWithBlocks } from "~/server/db/schema";

interface LotteryInterfaceProps {
  lotteryDate: string;
  lotteryEntry?: LotteryEntryData;
  member: Member;
  config: TeesheetConfigWithBlocks;
  error?: string | null;
  onDataChange?: () => void;
}

export function LotteryInterface({
  lotteryDate,
  lotteryEntry = null,
  member,
  config,
  error = null,
  onDataChange,
}: LotteryInterfaceProps) {
  const [showForm, setShowForm] = useState(false);

  // Set initial form state based on lotteryEntry in useEffect
  useEffect(() => {
    setShowForm(!lotteryEntry);
  }, [lotteryEntry]);

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

  // Show form (new entry or editing)
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

  // Show existing entry
  if (lotteryEntry) {
    return (
      <MemberLotteryEntryView
        lotteryDate={lotteryDate}
        entry={lotteryEntry.entry}
        entryType={lotteryEntry.type}
        member={member}
        onEdit={lotteryEntry.type !== "group_member" ? handleEdit : undefined}
        onCancel={handleCancel}
      />
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
