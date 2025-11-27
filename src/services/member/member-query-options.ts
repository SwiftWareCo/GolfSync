import { queryOptions } from "@tanstack/react-query";
import { searchMembersAction } from "~/server/members/actions";

/**
 * Member search query options for TanStack Query
 * Provides deduplication and caching of member search results
 */
export const memberQueryOptions = {
  search: (query: string) =>
    queryOptions({
      queryKey: ["members", "search", query],
      queryFn: () => searchMembersAction(query),
      staleTime: 0, // Immediate freshness, but cached response reused
      enabled: !!query.trim(), // Don't fetch if query empty
    }),
};
