import { queryOptions } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "./query-keys";
import type { QueryOptions, MutationOptions, ActionResult } from "./types";
import {
  searchGuestsAction,
  createGuest,
  removeGuestFromTimeBlock,
} from "~/server/guests/actions";
import type { GuestFormValues } from "~/app/types/GuestTypes";

// Guest type for search results
export type Guest = {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
};

// Query Options
export const guestQueryOptions = {
  // Search guests
  search: (query: string) =>
    queryOptions({
      queryKey: queryKeys.guests.search(query),
      queryFn: async (): Promise<Guest[]> => {
        if (!query.trim()) {
          return [];
        }

        const results = await searchGuestsAction(query);

        // Map results to match the Guest type with all required properties
        return results.map((result: any) => ({
          id: result.id,
          firstName: result.firstName,
          lastName: result.lastName,
          email: result.email,
          phone: result.phone,
        }));
      },
      enabled: !!query.trim(), // Only run query if there's a search term
      staleTime: 5 * 60 * 1000, // 5 minutes - guest data doesn't change often
      gcTime: 10 * 60 * 1000, // 10 minutes
    }),
};

// Mutation Options
export const guestMutationOptions = {
  // Create new guest
  createGuest: (queryClient: QueryClient): MutationOptions<
    ActionResult<Guest>,
    Error,
    GuestFormValues
  > => ({
    mutationFn: async (values: GuestFormValues) => createGuest(values),
    onSuccess: (data) => {
      // Invalidate guest searches to include the new guest in future searches
      queryClient.invalidateQueries({
        queryKey: queryKeys.guests.all(),
      });
    },
  }),

  // Remove guest (legacy - kept for backward compatibility)
  removeGuest: (queryClient: QueryClient): MutationOptions<
    ActionResult,
    Error,
    { timeBlockId: number; guestId: number }
  > => ({
    mutationFn: async ({ timeBlockId, guestId }) =>
      removeGuestFromTimeBlock(timeBlockId, guestId),
    onSuccess: () => {
      // Invalidate teesheet queries to reflect the change
      queryClient.invalidateQueries({
        queryKey: queryKeys.teesheets.all(),
      });
    },
  }),
};