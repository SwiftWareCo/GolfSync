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
  bookMultiplePlayersAction,
  cancelTeeTime,
  addGuestFillAction,
} from "~/server/members-teesheet-client/actions";
import { AlertCircle, CheckCircle, X } from "lucide-react";
import { DatePicker } from "./DatePicker";
import { PlayerDetailsDrawer } from "./PlayerDetailsDrawer";
import { DateNavigationHeader } from "./DateNavigationHeader";
import { TeesheetGrid } from "./TeesheetGrid";
import { BookingDialogs } from "./BookingDialogs";
import { BookingPartyModal } from "./BookingPartyModal";
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
  showBookingModal: boolean;
  editingTimeBlockId: number | null;
  isEditMode: boolean;
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
  | { type: "SET_SWIPE_LOADING"; payload: boolean }
  | { type: "SHOW_BOOKING_MODAL"; payload: number }
  | { type: "HIDE_BOOKING_MODAL" }
  | { type: "SHOW_EDIT_MODAL"; payload: number }
  | { type: "HIDE_EDIT_MODAL" };

const initialState: BookingState = {
  loading: false,
  bookingTimeBlockId: null,
  cancelTimeBlockId: null,
  showDatePicker: false,
  showPlayerDetails: false,
  selectedTimeBlock: null,
  swipeLoading: false,
  showBookingModal: false,
  editingTimeBlockId: null,
  isEditMode: false,
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
    case "SHOW_BOOKING_MODAL":
      return {
        ...state,
        showBookingModal: true,
        bookingTimeBlockId: action.payload,
        isEditMode: false,
      };
    case "HIDE_BOOKING_MODAL":
      return {
        ...state,
        showBookingModal: false,
        bookingTimeBlockId: null,
        editingTimeBlockId: null,
        isEditMode: false,
      };
    case "SHOW_EDIT_MODAL":
      return {
        ...state,
        showBookingModal: true,
        editingTimeBlockId: action.payload,
        bookingTimeBlockId: action.payload,
        isEditMode: true,
      };
    case "HIDE_EDIT_MODAL":
      return {
        ...state,
        showBookingModal: false,
        editingTimeBlockId: null,
        bookingTimeBlockId: null,
        isEditMode: false,
      };
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
  lotteryRestrictionViolation = null,
}: {
  teesheet: any;
  config: any;
  timeBlocks: ClientTimeBlock[];
  selectedDate: string | Date;
  member: ClientMember;
  lotteryEntry?: LotteryEntryData;
  isLotteryEligible?: boolean;
  lotterySettings?: any;
  lotteryRestrictionViolation?: {
    hasViolation: boolean;
    message: string;
    violations: any[];
  } | null;
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
    showBookingModal,
    editingTimeBlockId,
    isEditMode,
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

  // Multi-player booking handler for modal
  const handleBookingConfirm = useCallback(
    async (
      players: Array<{
        type: string;
        id: number;
        firstName: string;
        lastName: string;
      }>,
      fillCount?: number,
    ) => {
      if (!bookingTimeBlockId) return;

      dispatch({ type: "SET_LOADING", payload: true });
      try {
        const result = await bookMultiplePlayersAction(
          bookingTimeBlockId,
          players as any,
          member.id,
        );

        if (result.success) {
          // Add guest fills if any were requested
          if (fillCount && fillCount > 0) {
            for (let i = 0; i < fillCount; i++) {
              const fillResult = await addGuestFillAction(
                bookingTimeBlockId,
                member.id,
              );
              if (!fillResult.success) {
                console.error("Failed to add guest fill:", fillResult.error);
              }
            }
          }

          toast.success("Tee time booked successfully!", {
            icon: <CheckCircle className="h-5 w-5 text-green-500" />,
            id: `book-${bookingTimeBlockId}`,
            duration: 3000,
          });
          dispatch({ type: "HIDE_BOOKING_MODAL" });
        } else {
          toast.error(result.error || "Failed to book tee time", {
            icon: <X className="h-5 w-5 text-red-500" />,
            id: `book-error-${bookingTimeBlockId}`,
          });
          // Refresh data so UI shows updated capacity
          router.refresh();
        }
      } catch (error) {
        console.error("Error booking tee time", error);
        toast.error("An unexpected error occurred", {
          icon: <AlertCircle className="h-5 w-5 text-red-500" />,
          id: `book-error-unexpected-${bookingTimeBlockId}`,
        });
        // Refresh data in case of error
        router.refresh();
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    },
    [bookingTimeBlockId, member.id, router],
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

  // Cancel handler
  const handleCancelTeeTime = useCallback(() => {
    if (cancelTimeBlockId) {
      debouncedCancelling(cancelTimeBlockId);
    }
  }, [cancelTimeBlockId, debouncedCancelling]);

  // Show player details handler
  const handleShowPlayerDetails = useCallback((timeBlock: ClientTimeBlock) => {
    dispatch({ type: "SHOW_PLAYER_DETAILS", payload: timeBlock });
  }, []);

  // Edit booking handler
  const handleEditBooking = useCallback((timeBlockId: number) => {
    dispatch({ type: "SHOW_EDIT_MODAL", payload: timeBlockId });
    // Refresh data in background to get latest capacity
    router.refresh();
  }, [router]);

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

        // AVAILABILITY restrictions are no longer used

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
          dispatch({ type: "SHOW_BOOKING_MODAL", payload: timeBlockId });
          // Refresh data in background to get latest capacity
          router.refresh();
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
        // No restrictions, proceed with booking modal
        dispatch({ type: "SHOW_BOOKING_MODAL", payload: timeBlockId });
        // Refresh data in background to get latest capacity
        router.refresh();
      }
    },
    [timeBlocks, router],
  );

  // Memoized utility functions
  const isTimeBlockBooked = useCallback(
    (timeBlock: ClientTimeBlock) => {
      if (!member || !timeBlock?.members) return false;
      return timeBlock.members.some((m) => m.id === member.id);
    },
    [member],
  );

  // Check if member has any booking on this day (used to disable Book buttons)
  const hasExistingBookingOnDay = useMemo(() => {
    if (!member || !timeBlocks) return false;
    return timeBlocks.some((tb) => tb.members?.some((m) => m.id === member.id));
  }, [member, timeBlocks]);

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

  // Course availability restrictions are no longer used

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
  // Allow showing lottery if:
  // 1. Teesheet is not public AND
  // 2. Date is lottery eligible AND
  // 3. Lottery is enabled AND
  // 4. Either no restriction violation OR member has an existing entry (can edit even if limit reached)
  const shouldShowLottery =
    !isTeesheetPublic &&
    isLotteryEligible &&
    isLotteryEnabled &&
    (!lotteryRestrictionViolation?.hasViolation || !!lotteryEntry);

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
          lotteryRestrictionViolation={lotteryRestrictionViolation}
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
                {lotteryRestrictionViolation?.hasViolation
                  ? "Lottery Entry Limit Reached"
                  : "Not Available"}
              </h3>
            </div>
            <div className="p-4">
              <div className="border-l-4 border-orange-500 pl-4 text-sm leading-relaxed text-orange-700">
                {lotteryRestrictionViolation?.hasViolation
                  ? lotteryRestrictionViolation.message
                  : isLotteryEligible && !isLotteryEnabled
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

          {/* Tee Sheet Grid */}
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
            onEdit={handleEditBooking}
            onShowDetails={handleShowPlayerDetails}
            isTimeBlockBooked={isTimeBlockBooked}
            isTimeBlockAvailable={isTimeBlockAvailable}
            isTimeBlockInPast={isTimeBlockInPast}
            hasExistingBookingOnDay={hasExistingBookingOnDay}
          />

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

          {/* Booking Party Modal */}
          <BookingPartyModal
            open={showBookingModal}
            onOpenChange={(open) => {
              if (!open) dispatch({ type: "HIDE_BOOKING_MODAL" });
            }}
            currentMember={{
              id: member.id,
              firstName: member.firstName,
              lastName: member.lastName,
              memberNumber: (member as any).memberNumber,
            }}
            maxPlayers={4}
            timeBlockCurrentCapacity={(() => {
              const timeBlockId = isEditMode
                ? editingTimeBlockId
                : bookingTimeBlockId;
              const timeBlock = timeBlocks.find((tb) => tb.id === timeBlockId);
              if (!timeBlock) return 0;
              return (
                timeBlock.members.length +
                ((timeBlock as any).guests?.length || 0) +
                (timeBlock.fills?.length || 0)
              );
            })()}
            onConfirm={handleBookingConfirm}
            mode={isEditMode ? "edit" : "create"}
            timeBlockId={editingTimeBlockId ?? undefined}
            existingParty={
              isEditMode && editingTimeBlockId
                ? (() => {
                    const timeBlock = timeBlocks.find(
                      (tb) => tb.id === editingTimeBlockId,
                    );
                    if (!timeBlock) return undefined;

                    // Find current member's booking record
                    const currentMemberRecord = timeBlock.members.find(
                      (m) => m.id === member.id,
                    );
                    if (!currentMemberRecord) return undefined;

                    // Determine the organizer ID (who booked this party)
                    const organizerId =
                      currentMemberRecord.bookedByMemberId ?? member.id;

                    // Show ALL members in the same party
                    const yourMembers = timeBlock.members
                      .filter((m) => {
                        // Handle admin-booked (null bookedByMemberId)
                        if (m.bookedByMemberId === null) {
                          return m.id === member.id; // Only show self
                        }
                        // Include all members with same organizer
                        return m.bookedByMemberId === organizerId;
                      })
                      .map((m) => ({
                        id: m.id,
                        firstName: m.firstName,
                        lastName: m.lastName,
                        memberNumber: (m as any).memberNumber,
                        bookedByMemberId: (m as any).bookedByMemberId,
                      }));

                    // Show guests invited by the organizer
                    const yourGuests = ((timeBlock as any).guests || []).filter(
                      (g: any) => g.invitedByMemberId === organizerId,
                    );

                    // Show fills added by the organizer
                    const yourFills = (timeBlock.fills || []).filter(
                      (f: any) => f.addedByMemberId === organizerId,
                    );

                    return {
                      members: yourMembers,
                      guests: yourGuests,
                      fills: yourFills,
                    };
                  })()
                : undefined
            }
          />

          {/* Cancel Confirmation */}
          <BookingDialogs
            bookingTimeBlockId={null}
            cancelTimeBlockId={cancelTimeBlockId}
            loading={loading}
            onBookConfirm={() => {}}
            onCancelConfirm={handleCancelTeeTime}
            onBookingClose={() => {}}
            onCancelClose={() => dispatch({ type: "CLEAR_CANCELLING" })}
          />
        </div>
      )}
    </div>
  );
}
