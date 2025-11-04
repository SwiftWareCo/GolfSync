import { queryOptions } from "@tanstack/react-query";
import { queryKeys } from "./query-keys";
import type { QueryOptions, MutationOptions, ActionResult } from "./types";
import {
  getTeesheetDataAction,
  removeTimeBlockMember,
  removeTimeBlockGuest,
  checkInMember,
  checkInGuest,
  checkInAllTimeBlockParticipants,
  updateTimeBlockNotes,
  removeFillFromTimeBlock,
  addFillToTimeBlock,
  populateTimeBlocksWithRandomMembers,
} from "~/server/teesheet/actions";
import { addMemberToTimeBlock } from "~/server/members/actions";
import { addGuestToTimeBlock } from "~/server/guests/actions";
import type {
  TeeSheet,
  TimeBlockWithMembers,
  FillType,
} from "~/app/types/TeeSheetTypes";
import { getBCNow } from "~/lib/dates";
import type { QueryClient } from "@tanstack/react-query";

// Types
export type TeesheetData = {
  teesheet: TeeSheet;
  config: any;
  timeBlocks: TimeBlockWithMembers[];
  availableConfigs: any[];
  paceOfPlayData: any[];
  lotterySettings?: any;
  date: string;
};

// Query Options
export const teesheetQueryOptions = {
  // Get teesheet data by date
  byDate: (date: string) =>
    queryOptions({
      queryKey: queryKeys.teesheets.byDate(date),
      queryFn: async (): Promise<TeesheetData> => {
        const result = await getTeesheetDataAction(date);
        if (!result.success || !result.data) {
          throw new Error(result.error || "Failed to load teesheet data");
        }
        return result.data;
      },
      staleTime: 2 * 60 * 1000, // 2 minutes - balance between freshness and performance
      gcTime: 5 * 60 * 1000, // 5 minutes
    }),
};

// Mutation Options
export const teesheetMutationOptions = {
  // Remove member from timeblock
  removeMember: (): MutationOptions<
    ActionResult,
    Error,
    { timeBlockId: number; memberId: number }
  > => ({
    mutationFn: async ({ timeBlockId, memberId }) =>
      removeTimeBlockMember(timeBlockId, memberId),
  }),

  // Remove guest from timeblock
  removeGuest: (): MutationOptions<
    ActionResult,
    Error,
    { timeBlockId: number; guestId: number }
  > => ({
    mutationFn: async ({ timeBlockId, guestId }) =>
      removeTimeBlockGuest(timeBlockId, guestId),
  }),

  // Check in member
  checkInMember: (): MutationOptions<
    ActionResult,
    Error,
    { timeBlockId: number; memberId: number; isCheckedIn: boolean }
  > => ({
    mutationFn: async ({ timeBlockId, memberId, isCheckedIn }) =>
      checkInMember(timeBlockId, memberId, isCheckedIn),
  }),

  // Check in guest
  checkInGuest: (): MutationOptions<
    ActionResult,
    Error,
    { timeBlockId: number; guestId: number; isCheckedIn: boolean }
  > => ({
    mutationFn: async ({ timeBlockId, guestId, isCheckedIn }) =>
      checkInGuest(timeBlockId, guestId, isCheckedIn),
  }),

  // Check in all participants
  checkInAllParticipants: (): MutationOptions<
    ActionResult,
    Error,
    { timeBlockId: number; isCheckedIn: boolean }
  > => ({
    mutationFn: async ({ timeBlockId, isCheckedIn }) =>
      checkInAllTimeBlockParticipants(timeBlockId, isCheckedIn),
  }),

  // Update timeblock notes
  updateNotes: (): MutationOptions<
    ActionResult,
    Error,
    { timeBlockId: number; notes: string }
  > => ({
    mutationFn: async ({ timeBlockId, notes }) =>
      updateTimeBlockNotes(timeBlockId, notes),
  }),

  // Remove fill
  removeFill: (): MutationOptions<
    ActionResult,
    Error,
    { timeBlockId: number; fillId: number }
  > => ({
    mutationFn: async ({ timeBlockId, fillId }) =>
      removeFillFromTimeBlock(timeBlockId, fillId),
  }),

  // Add member to timeblock
  addMember: (): MutationOptions<
    ActionResult,
    Error,
    { timeBlockId: number; memberId: number }
  > => ({
    mutationFn: async ({ timeBlockId, memberId }) =>
      addMemberToTimeBlock(timeBlockId, memberId),
  }),

  // Add guest to timeblock
  addGuest: (): MutationOptions<
    ActionResult,
    Error,
    { timeBlockId: number; guestId: number; invitingMemberId: number }
  > => ({
    mutationFn: async ({ timeBlockId, guestId, invitingMemberId }) =>
      addGuestToTimeBlock(timeBlockId, guestId, invitingMemberId),
  }),

  // Add fill to timeblock
  addFill: (): MutationOptions<
    ActionResult,
    Error,
    { timeBlockId: number; fillType: FillType; customName?: string }
  > => ({
    mutationFn: async ({ timeBlockId, fillType, customName }) =>
      addFillToTimeBlock(timeBlockId, fillType, 1, customName),
  }),

  // Populate timeblocks with random members (debug feature)
  populateTimeblocks: (queryClient: QueryClient) => ({
    mutationFn: async ({ teesheetId, date }: { teesheetId: number; date: string }) => {
      const result = await populateTimeBlocksWithRandomMembers(teesheetId, date);
      if (!result.success) {
        throw new Error(result.error || "Failed to populate timeblocks");
      }
      return result;
    },
    onSuccess: (_result: ActionResult, variables: { teesheetId: number; date: string }) => {
      // Invalidate teesheet queries to refresh the data
      queryClient.invalidateQueries({ queryKey: queryKeys.teesheets.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.teesheets.byDate(variables.date) });
    },
    onError: (error: Error) => {
      console.error("Failed to populate timeblocks:", error);
    },
  }),
};