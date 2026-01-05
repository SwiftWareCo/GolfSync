"use client";

import { LotteryInterface } from "~/components/lottery/MemberLotteryInterface";
import { DateNavigationHeader } from "../member-teesheet-client/DateNavigationHeader";
import { DatePicker } from "../member-teesheet-client/DatePicker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { getDateForDB } from "~/lib/dates";
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

interface LotteryViewProps {
  selectedDate: string | Date;
  lotteryEntry?: LotteryEntryData;
  member: ClientMember;
  date: Date;
  config: TeesheetConfigWithBlocks;
  showDatePicker: boolean;
  swipeLoading: boolean;
  onPreviousDay: () => void;
  onNextDay: () => void;
  onDatePickerToggle: () => void;
  onDateChange: (date: Date) => void;
  onDataChange?: () => void;
  lotteryRestrictionViolation?: {
    hasViolation: boolean;
    message: string;
    violations: any[];
  } | null;
  initialWindowRestrictions?: Array<{
    windowIndex: number;
    isFullyRestricted: boolean;
    reasons: string[];
  }>;
}

export function LotteryView({
  selectedDate,
  lotteryEntry = null,
  member,
  date,
  config,
  showDatePicker,
  swipeLoading,
  onPreviousDay,
  onNextDay,
  onDatePickerToggle,
  onDateChange,
  onDataChange,
  lotteryRestrictionViolation,
  initialWindowRestrictions = [],
}: LotteryViewProps) {
  return (
    <div className="space-y-6 pb-6">
      {/* Date Navigation Header */}
      <DateNavigationHeader
        date={date}
        onPreviousDay={onPreviousDay}
        onNextDay={onNextDay}
        onDatePickerToggle={onDatePickerToggle}
        swipeLoading={swipeLoading}
      />

      {/* Lottery Interface */}
      <LotteryInterface
        lotteryDate={
          typeof selectedDate === "string"
            ? selectedDate
            : getDateForDB(selectedDate)
        }
        lotteryEntry={lotteryEntry}
        member={member}
        config={config}
        onDataChange={onDataChange}
        lotteryRestrictionViolation={lotteryRestrictionViolation}
        initialWindowRestrictions={initialWindowRestrictions}
      />

      {/* Date Picker Dialog */}
      {showDatePicker && (
        <Dialog open={showDatePicker} onOpenChange={onDatePickerToggle}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Select Date</DialogTitle>
            </DialogHeader>
            <DatePicker selected={date} onChange={onDateChange} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
