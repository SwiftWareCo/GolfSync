import { useQueryClient } from "@tanstack/react-query";
import { teesheetKeys } from "~/services/teesheet/keys";

interface TeesheetCacheData {
  teesheet: any;
  config: any;
  timeBlocks: any[];
}

/**
 * Hook for optimistic updates to teesheet cache
 * Updates the cache immediately for instant UI feedback while server processes the mutation
 * Cache is keyed by teesheetKeys.detail(dateString)
 */
export function useTeeblockOptimisticUpdate(
  dateString: string,
  timeBlockId: number,
) {
  const queryClient = useQueryClient();
  const queryKey = teesheetKeys.detail(dateString);

  const optimisticallyAddMember = (
    memberId: number,
    memberData: Partial<any>,
  ) => {
    const previousData = queryClient.getQueryData<TeesheetCacheData>(queryKey);

    queryClient.setQueryData<TeesheetCacheData>(queryKey, (old) => {
      if (!old) return old;

      return {
        ...old,
        timeBlocks: old.timeBlocks.map((block) => {
          if (block.id !== timeBlockId) return block;

          return {
            ...block,
            timeBlockMembers: [
              ...(block.timeBlockMembers || []),
              {
                id: -(Date.now()),
                memberId,
                timeBlockId: block.id,
                bookingDate: dateString,
                bookingTime: block.startTime,
                bagNumber: null,
                checkedIn: false,
                checkedInAt: null,
                createdAt: new Date(),
                ...memberData,
                member: memberData.member || {
                  id: memberId,
                  firstName: "",
                  lastName: "",
                  memberNumber: "",
                  username: "",
                  email: "",
                },
              },
            ],
          };
        }),
      };
    });

    return { previousData };
  };

  const optimisticallyRemoveMember = (memberId: number) => {
    const previousData = queryClient.getQueryData<TeesheetCacheData>(queryKey);

    queryClient.setQueryData<TeesheetCacheData>(queryKey, (old) => {
      if (!old) return old;

      return {
        ...old,
        timeBlocks: old.timeBlocks.map((block) => {
          if (block.id !== timeBlockId) return block;

          return {
            ...block,
            timeBlockMembers: (block.timeBlockMembers || []).filter(
              (m: any) => m.memberId !== memberId,
            ),
          };
        }),
      };
    });

    return { previousData };
  };

  const optimisticallyAddGuest = (
    guestId: number,
    invitingMemberId: number,
    guestData: Partial<any>,
  ) => {
    const previousData = queryClient.getQueryData<TeesheetCacheData>(queryKey);

    queryClient.setQueryData<TeesheetCacheData>(queryKey, (old) => {
      if (!old) return old;

      return {
        ...old,
        timeBlocks: old.timeBlocks.map((block) => {
          if (block.id !== timeBlockId) return block;

          return {
            ...block,
            timeBlockGuests: [
              ...(block.timeBlockGuests || []),
              {
                id: -(Date.now()),
                guestId,
                timeBlockId: block.id,
                checkedIn: false,
                checkedInAt: null,
                invitedByMemberId: invitingMemberId,
                createdAt: new Date(),
                ...guestData,
                guest: guestData.guest || {
                  id: guestId,
                  firstName: "",
                  lastName: "",
                  email: null,
                  phone: null,
                },
              },
            ],
          };
        }),
      };
    });

    return { previousData };
  };

  const optimisticallyRemoveGuest = (guestId: number) => {
    const previousData = queryClient.getQueryData<TeesheetCacheData>(queryKey);

    queryClient.setQueryData<TeesheetCacheData>(queryKey, (old) => {
      if (!old) return old;

      return {
        ...old,
        timeBlocks: old.timeBlocks.map((block) => {
          if (block.id !== timeBlockId) return block;

          return {
            ...block,
            timeBlockGuests: (block.timeBlockGuests || []).filter(
              (g: any) => g.guestId !== guestId,
            ),
          };
        }),
      };
    });

    return { previousData };
  };

  const optimisticallyAddFill = (
    fillType: string,
    customName?: string,
  ) => {
    const previousData = queryClient.getQueryData<TeesheetCacheData>(queryKey);

    // Generate a temporary ID for the fill (negative to distinguish from server IDs)
    const tempId = -(Date.now());

    queryClient.setQueryData<TeesheetCacheData>(queryKey, (old) => {
      if (!old) return old;

      return {
        ...old,
        timeBlocks: old.timeBlocks.map((block) => {
          if (block.id !== timeBlockId) return block;

          return {
            ...block,
            fills: [
              ...(block.fills || []),
              {
                id: tempId,
                relatedType: "timeblock" as const,
                relatedId: block.id,
                fillType,
                customName: customName || null,
                createdAt: new Date(),
                updatedAt: null,
              },
            ],
          };
        }),
      };
    });

    return { previousData };
  };

  const optimisticallyRemoveFill = (fillId: number) => {
    const previousData = queryClient.getQueryData<TeesheetCacheData>(queryKey);

    queryClient.setQueryData<TeesheetCacheData>(queryKey, (old) => {
      if (!old) return old;

      return {
        ...old,
        timeBlocks: old.timeBlocks.map((block) => {
          if (block.id !== timeBlockId) return block;

          return {
            ...block,
            fills: (block.fills || []).filter((f: any) => f.id !== fillId),
          };
        }),
      };
    });

    return { previousData };
  };

  const rollback = (previousData: TeesheetCacheData | undefined) => {
    if (previousData) {
      queryClient.setQueryData(queryKey, previousData);
    }
  };

  return {
    optimisticallyAddMember,
    optimisticallyRemoveMember,
    optimisticallyAddGuest,
    optimisticallyRemoveGuest,
    optimisticallyAddFill,
    optimisticallyRemoveFill,
    rollback,
  };
}
