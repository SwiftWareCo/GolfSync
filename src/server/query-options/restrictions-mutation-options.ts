import { queryKeys } from "./query-keys";
import {
  createTimeblockRestriction,
  updateTimeblockRestriction,
  deleteTimeblockRestriction,
  recordTimeblockRestrictionOverride,
} from "~/server/timeblock-restrictions/actions";
import type { QueryClient } from "@tanstack/react-query";

/**
 * Mutation options for timeblock restrictions operations
 *
 * All mutations include proper cache invalidation to ensure
 * UI updates immediately after changes
 */

export const restrictionsMutations = {
  /**
   * Create a new timeblock restriction
   */
  create: (queryClient: QueryClient) => ({
    mutationFn: async (data: any) => {
      const result = await createTimeblockRestriction(data);
      if (result && typeof result === 'object' && 'error' in result) {
        throw new Error(result.error || "Failed to create restriction");
      }
      return result;
    },
    onSuccess: () => {
      // Invalidate restrictions queries
      queryClient.invalidateQueries({ queryKey: queryKeys.restrictions.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.restrictions.timeblocks() });
      // Also invalidate teesheets since restrictions affect booking availability
      queryClient.invalidateQueries({ queryKey: queryKeys.teesheets.all() });
    },
    onError: (error: Error) => {
      console.error("Failed to create restriction:", error);
    },
  }),

  /**
   * Update an existing timeblock restriction
   */
  update: (queryClient: QueryClient) => ({
    mutationFn: async (data: { id: number; [key: string]: any }) => {
      const result = await updateTimeblockRestriction(data);
      if (result && typeof result === 'object' && 'error' in result) {
        throw new Error(result.error || "Failed to update restriction");
      }
      return result;
    },
    onSuccess: (_: unknown, variables: { id: number; [key: string]: any }) => {
      // Invalidate restrictions queries
      queryClient.invalidateQueries({ queryKey: queryKeys.restrictions.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.restrictions.timeblocks() });
      // Invalidate the specific restriction
      if (variables.id) {
        queryClient.invalidateQueries({
          queryKey: [...queryKeys.restrictions.timeblocks(), 'byId', variables.id],
        });
      }
      // Also invalidate teesheets since restrictions affect booking availability
      queryClient.invalidateQueries({ queryKey: queryKeys.teesheets.all() });
    },
    onError: (error: Error) => {
      console.error("Failed to update restriction:", error);
    },
  }),

  /**
   * Delete a timeblock restriction
   */
  delete: (queryClient: QueryClient) => ({
    mutationFn: async (id: number) => {
      const result = await deleteTimeblockRestriction(id);
      if (result && typeof result === 'object' && 'error' in result) {
        throw new Error(result.error || "Failed to delete restriction");
      }
      return result;
    },
    onSuccess: () => {
      // Invalidate restrictions queries
      queryClient.invalidateQueries({ queryKey: queryKeys.restrictions.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.restrictions.timeblocks() });
      // Also invalidate teesheets and overrides
      queryClient.invalidateQueries({ queryKey: queryKeys.teesheets.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.restrictions.overrides() });
    },
    onError: (error: Error) => {
      console.error("Failed to delete restriction:", error);
    },
  }),

  /**
   * Record a restriction override
   */
  recordOverride: (queryClient: QueryClient) => ({
    mutationFn: async (params: {
      restrictionId: number;
      restrictionCategory: "MEMBER_CLASS" | "GUEST" | "COURSE_AVAILABILITY";
      entityId?: string | null;
      reason: string;
    }) => {
      const result = await recordTimeblockRestrictionOverride(params);
      if (result && typeof result === 'object' && 'error' in result) {
        throw new Error(result.error || "Failed to record override");
      }
      return result;
    },
    onSuccess: () => {
      // Invalidate overrides queries
      queryClient.invalidateQueries({ queryKey: queryKeys.restrictions.overrides() });
    },
    onError: (error: Error) => {
      console.error("Failed to record override:", error);
    },
  }),
};
