import { queryOptions } from "@tanstack/react-query";

import { queryKeys } from "./query-keys";

import { searchGuestsAction, getMemberFrequentGuestsAction } from "~/server/guests/actions";



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
        return results.map((result: Guest) => ({
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

  // Get frequently played guests for buddy system
  frequentGuests: (memberId: number) =>
    queryOptions({
      queryKey: queryKeys.guests.frequent(memberId),
      queryFn: () => getMemberFrequentGuestsAction(memberId),
      staleTime: 10 * 60 * 1000, // 10 min - buddy list changes rarely
      gcTime: 30 * 60 * 1000, // 30 min cache
    }),
};
