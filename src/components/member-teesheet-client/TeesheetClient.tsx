"use client";

import React, { useMemo, useCallback, useReducer, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { addDays } from "date-fns";
import { useDebounce } from "use-debounce";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  bookTeeTime,
  cancelTeeTime,
} from "~/server/members-teesheet-client/actions";
import { AlertCircle, CheckCircle, X } from "lucide-react";
import { DatePicker } from "./DatePicker";
import { PlayerDetailsDrawer } from "./PlayerDetailsDrawer";
import { DateNavigationHeader } from "./DateNavigationHeader";
import { TeesheetGrid } from "./TeesheetGrid";
import { BookingDialogs } from "./BookingDialogs";
import { LotteryView } from "../lottery/MemberLotteryView";
import toast from "react-hot-toast";
import { isPast, getDateForDB } from "~/lib/dates";
import { parse } from "date-fns";

import type { LotteryEntryData } from "~/server/db/schema/lottery/lottery-entries.schema";
import type { Fill } from "~/server/db/schema";

// Member type for client-side usage - matches server response shape
type ClientMember = {
  id: number;
  classId: number;
  firstName: string;
  lastName: string;
  memberClass?: { id: number; label: string } | null;
  [key: string]: any;
};

// Member view type for flattened timeblock members
type TimeBlockMemberView = {
  id: number;
  firstName: string;
  lastName: string;
  checkedIn: boolean | null;
  checkedInAt?: Date | null;
  memberClass?: { label: string } | null;
  [key: string]: any;
};

// Define proper types that match TimeBlockItem requirements
type ClientTimeBlock = {
  id: number;
  startTime: string;
  endTime: string;
  members: TimeBlockMemberView[];
  fills: Fill[];
  maxMembers: number;
  restriction?: {
    isRestricted: boolean;
    reason: string;
    violations: any[];
  };
  [key: string]: any;
};

type BookingState = {
  loading: boolean;
  bookingTimeBlockId: number | null;
  cancelTimeBlockId: number | null;
  showDatePicker: boolean;
  showPlayerDetails: boolean;
  selectedTimeBlock: ClientTimeBlock | null;
  swipeLoading: boolean;
};

type BookingAction =
  | { type: "START_BOOKING"; payload: number }
  | { type: "START_CANCELLING"; payload: number }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "CLEAR_BOOKING" }
  | { type: "CLEAR_CANCELLING" }
  | { type: "TOGGLE_DATE_PICKER"; payload?: boolean }
  | { type: "SHOW_PLAYER_DETAILS"; payload: ClientTimeBlock }
  | { type: "HIDE_PLAYER_DETAILS" }
  | { type: "SET_SWIPE_LOADING"; payload: boolean };

const initialState: BookingState = {
  loading: false,
  bookingTimeBlockId: null,
  cancelTimeBlockId: null,
  showDatePicker: false,
  showPlayerDetails: false,
  selectedTimeBlock: null,
  swipeLoading: false,
};

function bookingReducer(
  state: BookingState,
  action: BookingAction,
): BookingState {
  switch (action.type) {
    case "START_BOOKING":
      return { ...state, bookingTimeBlockId: action.payload };
    case "START_CANCELLING":
      return { ...state, cancelTimeBlockId: action.payload };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "CLEAR_BOOKING":
      return { ...state, bookingTimeBlockId: null, loading: false };
    case "CLEAR_CANCELLING":
      return { ...state, cancelTimeBlockId: null, loading: false };
    case "TOGGLE_DATE_PICKER":
      return {
        ...state,
        showDatePicker: action.payload ?? !state.showDatePicker,
      };
    case "SHOW_PLAYER_DETAILS":
      return {
        ...state,
        showPlayerDetails: true,
        selectedTimeBlock: action.payload,
      };
    case "HIDE_PLAYER_DETAILS":
      return {
        ...state,
        showPlayerDetails: false,
        selectedTimeBlock: null,
      };
    case "SET_SWIPE_LOADING":
      return { ...state, swipeLoading: action.payload };
    default:
      return state;
  }
}

// Client component to handle interactive elements
export default function TeesheetClient({
  teesheet,
  config,
  timeBlocks: initialTimeBlocks,
  selectedDate,
  member,
  lotteryEntry = null,
  isLotteryEligible = false,
  lotterySettings = null,
}: {
  teesheet: any;
  config: any;
  timeBlocks: ClientTimeBlock[];
  selectedDate: string | Date;
  member: ClientMember;
  lotteryEntry?: LotteryEntryData;
  isLotteryEligible?: boolean;
  lotterySettings?: any;
}) {
  const [state, dispatch] = useReducer(bookingReducer, initialState);
  const {
    loading,
    bookingTimeBlockId,
    cancelTimeBlockId,
    showDatePicker,
    showPlayerDetails,
    selectedTimeBlock,
    swipeLoading,
  } = state;

  // Use sorted timeBlocks from server
  const timeBlocks = initialTimeBlocks;

  // Touch handling for swipe navigation
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Memoize date parsing to prevent unnecessary recalculations
  const date = useMemo(() => {
    return typeof selectedDate === "string"
      ? parse(selectedDate, "yyyy-MM-dd", new Date())
      : selectedDate;
  }, [selectedDate]);

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Navigation functions wrapped in useCallback
  const navigateToDate = useCallback(
    (newDate: Date) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("date", getDateForDB(newDate));
      router.replace(`${pathname}?${params.toString()}`);
    },
    [pathname, searchParams, router],
  );

  // Handle lottery data changes
  const handleDataChange = useCallback(() => {
    router.refresh();
  }, [router]);

  const goToPreviousDay = useCallback(() => {
    dispatch({ type: "SET_SWIPE_LOADING", payload: true });
    const newDate = addDays(date, -1);
    // Set to start of day to avoid timezone issues
    const adjustedDate = new Date(
      newDate.getFullYear(),
      newDate.getMonth(),
      newDate.getDate(),
      0,
      0,
      0,
      0,
    );
    navigateToDate(adjustedDate);
    // Clear loading after navigation completes
    requestAnimationFrame(() => {
      dispatch({ type: "SET_SWIPE_LOADING", payload: false });
    });
  }, [date, navigateToDate]);

  const goToNextDay = useCallback(() => {
    dispatch({ type: "SET_SWIPE_LOADING", payload: true });
    const newDate = addDays(date, 1);
    // Set to start of day to avoid timezone issues
    const adjustedDate = new Date(
      newDate.getFullYear(),
      newDate.getMonth(),
      newDate.getDate(),
      0,
      0,
      0,
      0,
    );
    navigateToDate(adjustedDate);
    // Clear loading after navigation completes
    requestAnimationFrame(() => {
      dispatch({ type: "SET_SWIPE_LOADING", payload: false });
    });
  }, [date, navigateToDate]);

  const handleDateChange = useCallback(
    (newDate: Date) => {
      // Set to start of day to avoid timezone issues
      const adjustedDate = new Date(
        newDate.getFullYear(),
        newDate.getMonth(),
        newDate.getDate(),
        0,
        0,
        0,
        0,
      );
      navigateToDate(adjustedDate);
      dispatch({ type: "TOGGLE_DATE_PICKER", payload: false });
    },
    [navigateToDate],
  );

  // Touch/Swipe handlers for date navigation
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) {
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    }
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current) return;

      const touch = e.changedTouches[0];
      if (!touch) return;

      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;

      // Only trigger if horizontal swipe is dominant
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
        if (deltaX > 0) {
          // Swipe right - go to previous day
          goToPreviousDay();
        } else {
          // Swipe left - go to next day
          goToNextDay();
        }
      }

      touchStartRef.current = null;
    },
    [goToPreviousDay, goToNextDay],
  );

  // Debounced booking handlers with cleanup
  const [debouncedBooking] = useDebounce(
    useCallback(
      async (timeBlockId: number) => {
        if (!timeBlockId) return;

        dispatch({ type: "SET_LOADING", payload: true });
        try {
          const result = await bookTeeTime(timeBlockId, member);

          if (result.success) {
            toast.success("Tee time booked successfully!", {
              icon: <CheckCircle className="h-5 w-5 text-green-500" />,
              id: `book-${timeBlockId}`,
              duration: 3000,
            });
          } else {
            toast.error(result.error || "Failed to book tee time", {
              icon: <X className="h-5 w-5 text-red-500" />,
              id: `book-error-${timeBlockId}`,
            });
          }
        } catch (error) {
          console.error("Error booking tee time", error);
          toast.error("An unexpected error occurred", {
            icon: <AlertCircle className="h-5 w-5 text-red-500" />,
            id: `book-error-unexpected-${timeBlockId}`,
          });
        } finally {
          dispatch({ type: "CLEAR_BOOKING" });
        }
      },
      [member],
    ),
    300,
  );

  const [debouncedCancelling] = useDebounce(
    useCallback(
      async (timeBlockId: number) => {
        if (!timeBlockId) return;

        dispatch({ type: "SET_LOADING", payload: true });
        try {
          const result = await cancelTeeTime(timeBlockId, member);

          if (result.success) {
            toast.success("Tee time cancelled successfully!", {
              icon: <CheckCircle className="h-5 w-5 text-green-500" />,
              id: `cancel-${timeBlockId}`,
              duration: 3000,
            });
          } else {
            toast.error(result.error || "Failed to cancel tee time", {
              icon: <X className="h-5 w-5 text-red-500" />,
              id: `cancel-error-${timeBlockId}`,
            });
          }
        } catch (error) {
          console.error("Error cancelling tee time", error);
          toast.error("An unexpected error occurred", {
            icon: <AlertCircle className="h-5 w-5 text-red-500" />,
            id: `cancel-error-unexpected-${timeBlockId}`,
          });
        } finally {
          dispatch({ type: "CLEAR_CANCELLING" });
        }
      },
      [member],
    ),
    300,
  );

  // Booking handlers
  const handleBookTeeTime = useCallback(() => {
    if (bookingTimeBlockId) {
      debouncedBooking(bookingTimeBlockId);
    }
  }, [bookingTimeBlockId, debouncedBooking]);

  const handleCancelTeeTime = useCallback(() => {
    if (cancelTimeBlockId) {
      debouncedCancelling(cancelTimeBlockId);
    }
  }, [cancelTimeBlockId, debouncedCancelling]);

  // Show player details handler
  const handleShowPlayerDetails = useCallback((timeBlock: ClientTimeBlock) => {
    dispatch({ type: "SHOW_PLAYER_DETAILS", payload: timeBlock });
  }, []);

  // Check for booking restrictions
  const checkBookingRestrictions = useCallback(
    (timeBlockId: number) => {
      if (!timeBlockId) return;

      const timeBlock = timeBlocks.find((tb) => tb.id === timeBlockId);
      if (!timeBlock) return;

      // First check if the timeblock is at capacity
      if (!isTimeBlockAvailable(timeBlock)) {
        toast.error("This time slot is full and cannot be booked", {
          icon: <AlertCircle className="h-5 w-5 text-orange-500" />,
          id: `full-timeblock-${timeBlockId}`,
        });
        return;
      }

      // Check if the timeblock is restricted (pre-checked from server)
      if (timeBlock.restriction?.isRestricted) {
        const violations = timeBlock.restriction.violations || [];

        // Check for AVAILABILITY restrictions first (highest priority)
        const availabilityViolation = violations.find(
          (v: any) => v.type === "AVAILABILITY",
        );

        if (availabilityViolation) {
          // AVAILABILITY restrictions block booking completely
          toast.error(
            timeBlock.restriction.reason ||
              "Course is not available during this time",
            {
              icon: <AlertCircle className="h-5 w-5 text-red-500" />,
              id: `availability-restriction-${timeBlockId}`,
            },
          );
          return;
        }

        // Check for TIME restrictions second (high priority)
        const timeViolation = violations.find((v: any) => v.type === "TIME");

        if (timeViolation) {
          // TIME restrictions block booking completely
          toast.error(
            timeBlock.restriction.reason ||
              "This time slot is restricted for your member class",
            {
              icon: <AlertCircle className="h-5 w-5 text-red-500" />,
              id: `time-restriction-${timeBlockId}`,
            },
          );
          return;
        }

        // Check for FREQUENCY restrictions (lower priority)
        const frequencyViolation = violations.find(
          (v: any) => v.type === "FREQUENCY",
        );

        if (frequencyViolation) {
          // For frequency restrictions, show a friendly warning but allow booking
          const frequencyInfo = frequencyViolation.frequencyInfo;

          if (frequencyInfo) {
            toast(
              `You've played ${frequencyInfo.currentCount}/${frequencyInfo.maxCount} times this month.`,
              {
                icon: <AlertCircle className="h-5 w-5 text-yellow-500" />,
                id: `frequency-warning-${timeBlockId}`,
                duration: 4000,
                style: {
                  background: "#FEF3C7",
                  border: "1px solid #F59E0B",
                  color: "#92400E",
                },
              },
            );
          }
          // Proceed with booking despite frequency limit
          dispatch({ type: "START_BOOKING", payload: timeBlockId });
        } else {
          // For other restrictions, block the booking
          toast.error(
            timeBlock.restriction.reason ||
              "This timeblock is not available for booking",
            {
              icon: <AlertCircle className="h-5 w-5 text-red-500" />,
              id: `restriction-${timeBlockId}`,
            },
          );
          return;
        }
      } else {
        // No restrictions, proceed with booking
        dispatch({ type: "START_BOOKING", payload: timeBlockId });
      }
    },
    [timeBlocks],
  );

  // Memoized utility functions
  const isTimeBlockBooked = useCallback(
    (timeBlock: ClientTimeBlock) => {
      if (!member || !timeBlock?.members) return false;
      return timeBlock.members.some((m) => m.id === member.id);
    },
    [member],
  );

  const isTimeBlockAvailable = useCallback((timeBlock: ClientTimeBlock) => {
    if (!timeBlock?.members) return true;
    const maxMembers = timeBlock.maxMembers || 4;
    const totalPeople =
      timeBlock.members.length + (timeBlock.fills?.length || 0);
    return totalPeople < maxMembers;
  }, []);

  const isTimeBlockInPast = useCallback(
    (timeBlock: ClientTimeBlock) => {
      if (!timeBlock?.startTime) return false;
      // Use both date and time parameters for accurate past checking
      return isPast(selectedDate, timeBlock.startTime);
    },
    [selectedDate],
  );

  // Check for COURSE AVAILABILITY restrictions that should hide the entire teesheet
  const hasFullDayRestriction = useMemo(() => {
    return timeBlocks.some((timeBlock) => {
      if (!timeBlock.restriction?.isRestricted) return false;

      const violations = timeBlock.restriction.violations || [];
      // Any AVAILABILITY violation should hide the teesheet
      return violations.some((v: any) => v.type === "AVAILABILITY");
    });
  }, [timeBlocks]);

  // Get course availability restriction message
  const fullDayRestrictionMessage = useMemo(() => {
    if (!hasFullDayRestriction) return "";

    const restrictedTimeBlock = timeBlocks.find((timeBlock) => {
      if (!timeBlock.restriction?.isRestricted) return false;

      const violations = timeBlock.restriction.violations || [];
      return violations.some((v: any) => v.type === "AVAILABILITY");
    });

    return (
      restrictedTimeBlock?.restriction?.reason ||
      "Course is not available today"
    );
  }, [hasFullDayRestriction, timeBlocks]);

  // Determine what to show based on visibility and lottery settings
  const isTeesheetPublic = teesheet?.isPublic || false;
  const isLotteryEnabled = lotterySettings?.enabled !== false; // Default to enabled if no settings
  const lotteryDisabledMessage =
    lotterySettings?.disabledMessage ||
    "Lottery signup is disabled for this date";
  const privateMessage =
    teesheet?.privateMessage ||
    "This teesheet is not yet available for booking.";

  // Determine which view to render based on settings
  const shouldShowLottery =
    !isTeesheetPublic &&
    isLotteryEligible &&
    isLotteryEnabled &&
    !hasFullDayRestriction;

  const shouldShowNotAvailable = !isTeesheetPublic && !shouldShowLottery;

  return (
    <div
      className="min-h-screen"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Case 1: Show Lottery View */}
      {shouldShowLottery && (
        <LotteryView
          selectedDate={selectedDate}
          lotteryEntry={lotteryEntry}
          member={member}
          date={date}
          config={config}
          showDatePicker={showDatePicker}
          swipeLoading={swipeLoading}
          onPreviousDay={goToPreviousDay}
          onNextDay={goToNextDay}
          onDatePickerToggle={() => dispatch({ type: "TOGGLE_DATE_PICKER" })}
          onDataChange={handleDataChange}
          onDateChange={handleDateChange}
        />
      )}

      {/* Case 2: Show "Not Available" Message */}
      {shouldShowNotAvailable && (
        <div className="space-y-4 px-3 pb-6">
          <DateNavigationHeader
            date={date}
            onPreviousDay={goToPreviousDay}
            onNextDay={goToNextDay}
            onDatePickerToggle={() => dispatch({ type: "TOGGLE_DATE_PICKER" })}
            loading={loading}
            swipeLoading={swipeLoading}
          />

          <div className="overflow-hidden rounded-xl border border-orange-200 bg-white shadow-sm">
            <div className="border-b border-orange-200 bg-orange-50 p-4">
              <h3 className="flex items-center gap-2 text-lg font-bold text-orange-900">
                <AlertCircle className="h-5 w-5 text-orange-600" />
                Not Available
              </h3>
            </div>
            <div className="p-4">
              <div className="border-l-4 border-orange-500 pl-4 text-sm leading-relaxed text-orange-700">
                {isLotteryEligible && !isLotteryEnabled
                  ? lotteryDisabledMessage
                  : privateMessage}
              </div>
            </div>
          </div>

          {showDatePicker && (
            <Dialog
              open={showDatePicker}
              onOpenChange={() => dispatch({ type: "TOGGLE_DATE_PICKER" })}
            >
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Select Date</DialogTitle>
                </DialogHeader>
                <DatePicker selected={date} onChange={handleDateChange} />
              </DialogContent>
            </Dialog>
          )}
        </div>
      )}

      {/* Case 3: Show Public Teesheet */}
      {isTeesheetPublic && (
        <div className="space-y-4 px-3 pb-6">
          {/* Date Navigation Header */}
          <DateNavigationHeader
            date={date}
            onPreviousDay={goToPreviousDay}
            onNextDay={goToNextDay}
            onDatePickerToggle={() => dispatch({ type: "TOGGLE_DATE_PICKER" })}
            loading={loading}
            swipeLoading={swipeLoading}
          />

          {/* General Notes Section */}
          {teesheet?.generalNotes && (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 bg-blue-50 p-4">
                <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900">
                  <AlertCircle className="h-5 w-5 text-blue-600" />
                  Important Information
                </h3>
              </div>
              <div className="p-4">
                <div className="border-l-4 border-blue-500 pl-4 text-sm leading-relaxed text-gray-700">
                  {teesheet.generalNotes}
                </div>
              </div>
            </div>
          )}

          {/* Full Day Restriction Alert or Tee Sheet Grid */}
          {hasFullDayRestriction ? (
            <div className="overflow-hidden rounded-xl border border-red-200 bg-white shadow-sm">
              <div className="border-b border-red-200 bg-red-50 p-4">
                <h3 className="flex items-center gap-2 text-lg font-bold text-red-900">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  Course Not Available
                </h3>
              </div>
              <div className="p-4">
                <div className="border-l-4 border-red-500 pl-4 text-sm leading-relaxed text-red-700">
                  {fullDayRestrictionMessage}
                </div>
              </div>
            </div>
          ) : (
            <TeesheetGrid
              date={date}
              timeBlocks={timeBlocks}
              config={config}
              member={member}
              loading={loading}
              selectedDate={selectedDate}
              onBook={checkBookingRestrictions}
              onCancel={(timeBlockId) =>
                dispatch({ type: "START_CANCELLING", payload: timeBlockId })
              }
              onShowDetails={handleShowPlayerDetails}
              isTimeBlockBooked={isTimeBlockBooked}
              isTimeBlockAvailable={isTimeBlockAvailable}
              isTimeBlockInPast={isTimeBlockInPast}
            />
          )}

          {/* Date Picker Dialog */}
          {showDatePicker && (
            <Dialog
              open={showDatePicker}
              onOpenChange={() => dispatch({ type: "TOGGLE_DATE_PICKER" })}
            >
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Select Date</DialogTitle>
                </DialogHeader>
                <DatePicker selected={date} onChange={handleDateChange} />
              </DialogContent>
            </Dialog>
          )}

          {/* Player Details Drawer */}
          <PlayerDetailsDrawer
            isOpen={showPlayerDetails}
            onClose={() => dispatch({ type: "HIDE_PLAYER_DETAILS" })}
            timeBlock={selectedTimeBlock}
          />

          {/* Booking Dialogs */}
          <BookingDialogs
            bookingTimeBlockId={bookingTimeBlockId}
            cancelTimeBlockId={cancelTimeBlockId}
            loading={loading}
            onBookConfirm={handleBookTeeTime}
            onCancelConfirm={handleCancelTeeTime}
            onBookingClose={() => dispatch({ type: "CLEAR_BOOKING" })}
            onCancelClose={() => dispatch({ type: "CLEAR_CANCELLING" })}
          />
        </div>
      )}
    </div>
  );
}
