import { teesheetKeys } from "./keys";
import { addMemberToTimeBlock } from "~/server/members/actions";
import {
  removeTimeBlockMember,
  removeTimeBlockGuest,
  removeFillFromTimeBlock,
  checkInMember,
  checkInGuest,
  addFillToTimeBlock,
} from "~/server/teesheet/actions";
import { addGuestToTimeBlock } from "~/server/guests/actions";
import type { Member, Guest } from "~/server/db/schema";

/**
 * Mutation factory functions for teesheet operations
 *
 * These factories create mutation configurations that:
 * 1. Use context.client for RSC/CSR compatibility
 * 2. Implement cancelQueries to prevent race conditions
 * 3. Provide proper optimistic updates with rollback
 * 4. Always run onError/onSettled even if component unmounts
 */

/**
 * Creates a mutation for adding a member to a timeblock
 * Includes optimistic update and automatic rollback on error
 */
export function createAddMemberMutation(
  dateString: string,
  timeBlockId: number,
) {
  return {
    mutationFn: (memberId: number) =>
      addMemberToTimeBlock(timeBlockId, memberId),

    onMutate: async (memberId: number, context: any) => {
      const queryKey = teesheetKeys.detail(dateString);

      // Cancel any outgoing refetches to prevent race conditions
      await context.client.cancelQueries({ queryKey });

      // Snapshot the previous value for rollback
      const previous = context.client.getQueryData(queryKey);

      // Optimistically update the cache
      context.client.setQueryData(queryKey, (old: any) => {
        if (!old) return old;

        return {
          ...old,
          timeBlocks: old.timeBlocks.map((block: any) =>
            block.id === timeBlockId
              ? {
                  ...block,
                  timeBlockMembers: [
                    ...(block.timeBlockMembers || []),
                    {
                      id: -Date.now(), // Temporary ID
                      memberId,
                      timeBlockId,
                      bagNumber: null,
                      checkedIn: false,
                      checkedInAt: null,
                      bookingDate: dateString,
                      bookingTime: block.startTime,
                      createdAt: new Date(),
                      member: {
                        id: memberId,
                        firstName: "",
                        lastName: "",
                        memberNumber: "",
                        username: "",
                        email: "",
                      } as Member,
                    },
                  ],
                }
              : block,
          ),
        };
      });

      return { previous };
    },

    onError: (err: any, vars: any, result: any, context: any) => {
      // Rollback on error - runs even if component unmounts
      if (result?.previous) {
        context.client.setQueryData(
          teesheetKeys.detail(dateString),
          result.previous,
        );
      }
    },

    onSettled: (
      data: any,
      error: any,
      variables: any,
      onMutateResult: any,
      context: any,
    ) => {
      // Always refetch to sync with server
      context.client.invalidateQueries({
        queryKey: teesheetKeys.detail(dateString),
      });
    },
  };
}

/**
 * Creates a mutation for removing a member from a timeblock
 */
export function createRemoveMemberMutation(
  dateString: string,
  timeBlockId: number,
) {
  return {
    mutationFn: (memberId: number) =>
      removeTimeBlockMember(timeBlockId, memberId),

    onMutate: async (memberId: number, context: any) => {
      const queryKey = teesheetKeys.detail(dateString);

      await context.client.cancelQueries({ queryKey });
      const previous = context.client.getQueryData(queryKey);

      context.client.setQueryData(queryKey, (old: any) => {
        if (!old) return old;

        return {
          ...old,
          timeBlocks: old.timeBlocks.map((block: any) =>
            block.id === timeBlockId
              ? {
                  ...block,
                  timeBlockMembers: (block.timeBlockMembers || []).filter(
                    (m: any) => m.memberId !== memberId,
                  ),
                }
              : block,
          ),
        };
      });

      return { previous };
    },

    onError: (err: any, vars: any, result: any, context: any) => {
      if (result?.previous) {
        context.client.setQueryData(
          teesheetKeys.detail(dateString),
          result.previous,
        );
      }
    },

    onSettled: (
      data: any,
      error: any,
      variables: any,
      onMutateResult: any,
      context: any,
    ) => {
      context.client.invalidateQueries({
        queryKey: teesheetKeys.detail(dateString),
      });
    },
  };
}

/**
 * Creates a mutation for adding a guest to a timeblock
 */
export function createAddGuestMutation(
  dateString: string,
  timeBlockId: number,
) {
  return {
    mutationFn: ({
      guestId,
      invitingMemberId,
    }: {
      guestId: number;
      invitingMemberId: number;
    }) => addGuestToTimeBlock(timeBlockId, guestId, invitingMemberId),

    onMutate: async (
      {
        guestId,
        invitingMemberId,
      }: { guestId: number; invitingMemberId: number },
      context: any,
    ) => {
      const queryKey = teesheetKeys.detail(dateString);

      await context.client.cancelQueries({ queryKey });
      const previous = context.client.getQueryData(queryKey);

      context.client.setQueryData(queryKey, (old: any) => {
        if (!old) return old;

        return {
          ...old,
          timeBlocks: old.timeBlocks.map((block: any) =>
            block.id === timeBlockId
              ? {
                  ...block,
                  timeBlockGuests: [
                    ...(block.timeBlockGuests || []),
                    {
                      id: -Date.now(),
                      guestId,
                      timeBlockId,
                      invitedByMemberId: invitingMemberId,
                      checkedIn: false,
                      checkedInAt: null,
                      bookingDate: dateString,
                      bookingTime: block.startTime,
                      createdAt: new Date(),
                      guest: {
                        id: guestId,
                        firstName: "",
                        lastName: "",
                        email: null,
                        phone: null,
                      } as Guest,
                      invitedByMember: {} as Member,
                    },
                  ],
                }
              : block,
          ),
        };
      });

      return { previous };
    },

    onError: (err: any, vars: any, result: any, context: any) => {
      if (result?.previous) {
        context.client.setQueryData(
          teesheetKeys.detail(dateString),
          result.previous,
        );
      }
    },

    onSettled: (
      data: any,
      error: any,
      variables: any,
      onMutateResult: any,
      context: any,
    ) => {
      context.client.invalidateQueries({
        queryKey: teesheetKeys.detail(dateString),
      });
    },
  };
}

/**
 * Creates a mutation for removing a guest from a timeblock
 */
export function createRemoveGuestMutation(
  dateString: string,
  timeBlockId: number,
) {
  return {
    mutationFn: (guestId: number) => removeTimeBlockGuest(timeBlockId, guestId),

    onMutate: async (guestId: number, context: any) => {
      const queryKey = teesheetKeys.detail(dateString);

      await context.client.cancelQueries({ queryKey });
      const previous = context.client.getQueryData(queryKey);

      context.client.setQueryData(queryKey, (old: any) => {
        if (!old) return old;

        return {
          ...old,
          timeBlocks: old.timeBlocks.map((block: any) =>
            block.id === timeBlockId
              ? {
                  ...block,
                  timeBlockGuests: (block.timeBlockGuests || []).filter(
                    (g: any) => g.guestId !== guestId,
                  ),
                }
              : block,
          ),
        };
      });

      return { previous };
    },

    onError: (err: any, vars: any, result: any, context: any) => {
      if (result?.previous) {
        context.client.setQueryData(
          teesheetKeys.detail(dateString),
          result.previous,
        );
      }
    },

    onSettled: (
      data: any,
      error: any,
      variables: any,
      onMutateResult: any,
      context: any,
    ) => {
      context.client.invalidateQueries({
        queryKey: teesheetKeys.detail(dateString),
      });
    },
  };
}

/**
 * Creates a mutation for adding a fill to a timeblock
 */
export function createAddFillMutation(dateString: string, timeBlockId: number) {
  return {
    mutationFn: ({
      fillType,
      customName,
    }: {
      fillType: string;
      customName?: string;
    }) => addFillToTimeBlock(timeBlockId, fillType, 1, customName),

    onMutate: async (
      { fillType, customName }: { fillType: string; customName?: string },
      context: any,
    ) => {
      const queryKey = teesheetKeys.detail(dateString);

      await context.client.cancelQueries({ queryKey });
      const previous = context.client.getQueryData(queryKey);

      context.client.setQueryData(queryKey, (old: any) => {
        if (!old) return old;

        return {
          ...old,
          timeBlocks: old.timeBlocks.map((block: any) =>
            block.id === timeBlockId
              ? {
                  ...block,
                  fills: [
                    ...(block.fills || []),
                    {
                      id: -Date.now(),
                      relatedType: "timeblock" as const,
                      relatedId: timeBlockId,
                      fillType,
                      customName: customName || null,
                      createdAt: new Date(),
                      updatedAt: null,
                    },
                  ],
                }
              : block,
          ),
        };
      });

      return { previous };
    },

    onError: (err: any, vars: any, result: any, context: any) => {
      if (result?.previous) {
        context.client.setQueryData(
          teesheetKeys.detail(dateString),
          result.previous,
        );
      }
    },

    onSettled: (
      data: any,
      error: any,
      variables: any,
      onMutateResult: any,
      context: any,
    ) => {
      context.client.invalidateQueries({
        queryKey: teesheetKeys.detail(dateString),
      });
    },
  };
}

/**
 * Creates a mutation for removing a fill from a timeblock
 */
export function createRemoveFillMutation(
  dateString: string,
  timeBlockId: number,
) {
  return {
    mutationFn: (fillId: number) =>
      removeFillFromTimeBlock(timeBlockId, fillId),

    onMutate: async (fillId: number, context: any) => {
      const queryKey = teesheetKeys.detail(dateString);

      await context.client.cancelQueries({ queryKey });
      const previous = context.client.getQueryData(queryKey);

      context.client.setQueryData(queryKey, (old: any) => {
        if (!old) return old;

        return {
          ...old,
          timeBlocks: old.timeBlocks.map((block: any) =>
            block.id === timeBlockId
              ? {
                  ...block,
                  fills: (block.fills || []).filter(
                    (f: any) => f.id !== fillId,
                  ),
                }
              : block,
          ),
        };
      });

      return { previous };
    },

    onError: (err: any, vars: any, result: any, context: any) => {
      if (result?.previous) {
        context.client.setQueryData(
          teesheetKeys.detail(dateString),
          result.previous,
        );
      }
    },

    onSettled: (
      data: any,
      error: any,
      variables: any,
      onMutateResult: any,
      context: any,
    ) => {
      context.client.invalidateQueries({
        queryKey: teesheetKeys.detail(dateString),
      });
    },
  };
}

/**
 * Creates a mutation for checking in/out members and guests
 */
export function createCheckInMutation(
  dateString: string,
  timeBlockId: number,
  type: "member" | "guest",
) {
  return {
    mutationFn: ({
      playerId,
      isCheckedIn,
    }: {
      playerId: number;
      isCheckedIn: boolean;
    }) => {
      if (type === "member") {
        return checkInMember(timeBlockId, playerId, !isCheckedIn);
      } else {
        return checkInGuest(timeBlockId, playerId, !isCheckedIn);
      }
    },

    onMutate: async (
      { playerId, isCheckedIn }: { playerId: number; isCheckedIn: boolean },
      context: any,
    ) => {
      const queryKey = teesheetKeys.detail(dateString);

      await context.client.cancelQueries({ queryKey });
      const previous = context.client.getQueryData(queryKey);

      context.client.setQueryData(queryKey, (old: any) => {
        if (!old) return old;

        return {
          ...old,
          timeBlocks: old.timeBlocks.map((block: any) => {
            if (block.id !== timeBlockId) return block;

            if (type === "member") {
              return {
                ...block,
                timeBlockMembers: (block.timeBlockMembers || []).map(
                  (m: any) =>
                    m.memberId === playerId
                      ? {
                          ...m,
                          checkedIn: !isCheckedIn,
                          checkedInAt: !isCheckedIn ? new Date() : null,
                        }
                      : m,
                ),
              };
            } else {
              return {
                ...block,
                timeBlockGuests: (block.timeBlockGuests || []).map((g: any) =>
                  g.guestId === playerId
                    ? {
                        ...g,
                        checkedIn: !isCheckedIn,
                        checkedInAt: !isCheckedIn ? new Date() : null,
                      }
                    : g,
                ),
              };
            }
          }),
        };
      });

      return { previous };
    },

    onError: (err: any, vars: any, result: any, context: any) => {
      if (result?.previous) {
        context.client.setQueryData(
          teesheetKeys.detail(dateString),
          result.previous,
        );
      }
    },

    onSettled: (
      data: any,
      error: any,
      variables: any,
      onMutateResult: any,
      context: any,
    ) => {
      context.client.invalidateQueries({
        queryKey: teesheetKeys.detail(dateString),
      });
    },
  };
}
