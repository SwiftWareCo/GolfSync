import { queryOptions } from "@tanstack/react-query";
import { queryKeys } from "./query-keys";
import {
  getMemberClassesAction,
  getAllMemberClassesAction,
  getMemberClassByIdAction,
} from "~/server/member-classes/actions";

/**
 * Query options for member class data
 *
 * Member classes define different types of memberships (e.g., Regular, Senior, Junior)
 * and are used for booking restrictions and display purposes
 */

export const memberClassesQueryOptions = {
  /**
   * Get all active member classes
   * Used in dropdowns, filters, and member-facing pages
   */
  active: () =>
    queryOptions({
      queryKey: queryKeys.memberClasses.active(),
      queryFn: async () => {
        const result = await getMemberClassesAction();
        if (!result.success) {
          throw new Error(result.error || "Failed to load member classes");
        }
        return result.data;
      },
      staleTime: 10 * 60 * 1000, // 10 minutes - rarely changes
      gcTime: 30 * 60 * 1000,
    }),

  /**
   * Get all member classes including inactive ones
   * Used in admin settings
   */
  all: () =>
    queryOptions({
      queryKey: queryKeys.memberClasses.all(),
      queryFn: async () => {
        const result = await getAllMemberClassesAction();
        if (!result.success) {
          throw new Error(result.error || "Failed to load member classes");
        }
        return result.data;
      },
      staleTime: 10 * 60 * 1000, // 10 minutes - rarely changes
      gcTime: 30 * 60 * 1000,
    }),

  /**
   * Get a specific member class by ID
   */
  byId: (id: number) =>
    queryOptions({
      queryKey: queryKeys.memberClasses.byId(id),
      queryFn: async () => {
        const result = await getMemberClassByIdAction(id);
        if (!result.success) {
          throw new Error(result.error || "Member class not found");
        }
        return result.data;
      },
      staleTime: 10 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      enabled: id > 0, // Only fetch if we have a valid ID
    }),
};
