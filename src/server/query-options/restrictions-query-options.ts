import { queryOptions } from "@tanstack/react-query";
import { queryKeys } from "./query-keys";
import {
  getTimeblockRestrictionsAction,
  getTimeblockRestrictionsByCategoryAction,
  getTimeblockRestrictionByIdAction,
  getTimeblockOverridesAction,
} from "~/server/timeblock-restrictions/actions";

/**
 * Query options for timeblock restrictions data
 *
 * Timeblock restrictions control when members and guests can book tee times
 * based on time, frequency, and course availability
 */

export const restrictionsQueryOptions = {
  /**
   * Get all timeblock restrictions
   */
  all: () =>
    queryOptions({
      queryKey: queryKeys.restrictions.timeblocks(),
      queryFn: async () => {
        const result = await getTimeblockRestrictionsAction();
        if (!result.success) {
          throw new Error(result.error || "Failed to load restrictions");
        }
        return result.data;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000,
    }),

  /**
   * Get timeblock restrictions by category
   */
  byCategory: (category: "MEMBER_CLASS" | "GUEST" | "COURSE_AVAILABILITY") =>
    queryOptions({
      queryKey: [...queryKeys.restrictions.timeblocks(), 'category', category] as const,
      queryFn: async () => {
        const result = await getTimeblockRestrictionsByCategoryAction(category);
        if (!result.success) {
          throw new Error(result.error || "Failed to load restrictions");
        }
        return result.data;
      },
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    }),

  /**
   * Get a specific timeblock restriction by ID
   */
  byId: (id: number) =>
    queryOptions({
      queryKey: [...queryKeys.restrictions.timeblocks(), 'byId', id] as const,
      queryFn: async () => {
        const result = await getTimeblockRestrictionByIdAction(id);
        if (!result.success) {
          throw new Error(result.error || "Failed to load restriction");
        }
        return result.data;
      },
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      enabled: id > 0, // Only fetch if we have a valid ID
    }),

  /**
   * Get timeblock overrides with optional filtering
   */
  overrides: (params?: {
    restrictionId?: number;
    timeBlockId?: number;
    memberId?: number;
    guestId?: number;
    startDate?: Date;
    endDate?: Date;
    searchTerm?: string;
  }) =>
    queryOptions({
      queryKey: params
        ? [...queryKeys.restrictions.overrides(), params] as const
        : queryKeys.restrictions.overrides(),
      queryFn: async () => {
        const result = await getTimeblockOverridesAction(params);
        if (!result.success) {
          throw new Error(result.error || "Failed to load overrides");
        }
        return result.data;
      },
      staleTime: 2 * 60 * 1000, // 2 minutes - more real-time for overrides
      gcTime: 5 * 60 * 1000,
    }),
};
