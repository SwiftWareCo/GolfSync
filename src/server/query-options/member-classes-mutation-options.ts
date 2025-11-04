import { queryKeys } from "./query-keys";
import {
  createMemberClassAction,
  updateMemberClassAction,
  deleteMemberClassAction,
} from "~/server/member-classes/actions";
import type { MemberClassInsert } from "~/server/db/schema";
import type { QueryClient } from "@tanstack/react-query";

/**
 * Mutation options for member class operations
 *
 * All mutations include proper cache invalidation to ensure
 * UI updates immediately after changes
 */

export const memberClassesMutations = {
  /**
   * Create a new member class
   */
  create: (queryClient: QueryClient) => ({
    mutationFn: async (
      data: Omit<MemberClassInsert, "id" | "createdAt" | "updatedAt">
    ) => {
      const result = await createMemberClassAction(data);
      if (!result.success) {
        throw new Error(result.error || "Failed to create member class");
      }
      return result.data;
    },
    onSuccess: () => {
      // Invalidate member classes queries
      queryClient.invalidateQueries({ queryKey: queryKeys.memberClasses.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.memberClasses.active() });
      // Also invalidate restrictions since they may reference member classes
      queryClient.invalidateQueries({ queryKey: queryKeys.restrictions.all() });
    },
    onError: (error: Error) => {
      console.error("Failed to create member class:", error);
    },
  }),

  /**
   * Update an existing member class
   */
  update: (queryClient: QueryClient) => ({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: Partial<Omit<MemberClassInsert, "id" | "createdAt" | "updatedAt">>;
    }) => {
      const result = await updateMemberClassAction(id, data);
      if (!result.success) {
        throw new Error(result.error || "Failed to update member class");
      }
      return result.data;
    },
    onSuccess: (_: unknown, variables: {
      id: number;
      data: Partial<Omit<MemberClassInsert, "id" | "createdAt" | "updatedAt">>;
    }) => {
      // Invalidate member classes queries
      queryClient.invalidateQueries({ queryKey: queryKeys.memberClasses.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.memberClasses.active() });
      queryClient.invalidateQueries({ queryKey: queryKeys.memberClasses.byId(variables.id) });
      // Also invalidate restrictions since they may reference member classes
      queryClient.invalidateQueries({ queryKey: queryKeys.restrictions.all() });
    },
    onError: (error: Error) => {
      console.error("Failed to update member class:", error);
    },
  }),

  /**
   * Delete a member class
   */
  delete: (queryClient: QueryClient) => ({
    mutationFn: async (id: number) => {
      const result = await deleteMemberClassAction(id);
      if (!result.success) {
        throw new Error(result.error || "Failed to delete member class");
      }
      return result.data;
    },
    onSuccess: () => {
      // Invalidate member classes queries
      queryClient.invalidateQueries({ queryKey: queryKeys.memberClasses.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.memberClasses.active() });
      // Also invalidate restrictions since they may reference member classes
      queryClient.invalidateQueries({ queryKey: queryKeys.restrictions.all() });
    },
    onError: (error: Error) => {
      console.error("Failed to delete member class:", error);
    },
  }),
};
