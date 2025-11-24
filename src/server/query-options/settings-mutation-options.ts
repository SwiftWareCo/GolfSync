import { queryKeys } from "./query-keys";
import {
  updateCourseInfo,
  updateTeesheetVisibility,
  updateLotterySettings,
} from "~/server/settings/actions";
import type { QueryClient } from "@tanstack/react-query";

/**
 * Mutation options for settings-related operations
 *
 * All mutations include proper cache invalidation to ensure
 * UI updates immediately after changes
 */

export const settingsMutations = {
  /**
   * Update course info (notes displayed to members)
   */
  updateCourseInfo: (queryClient: QueryClient) => ({
    mutationFn: async (data: { notes?: string }) => {
      const result = await updateCourseInfo(data);
      if (!result.success) {
        throw new Error(result.error || "Failed to update course info");
      }
      return result;
    },
    onSuccess: () => {
      // Invalidate course info query so members page updates
      queryClient.invalidateQueries({
        queryKey: queryKeys.settings.courseInfo(),
      });
    },
    onError: (error: Error) => {
      console.error("Failed to update course info:", error);
    },
  }),

  /**
   * Update teesheet visibility (public/private)
   */
  updateVisibility: (queryClient: QueryClient) => ({
    mutationFn: async ({
      teesheetId,
      isPublic,
      privateMessage,
    }: {
      teesheetId: number;
      isPublic: boolean;
      privateMessage?: string;
    }) => {
      const result = await updateTeesheetVisibility(
        teesheetId,
        isPublic,
        privateMessage,
      );
      return result;
    },
    onSuccess: (
      _: unknown,
      variables: {
        teesheetId: number;
        isPublic: boolean;
        privateMessage?: string;
      },
    ) => {
      // Invalidate the specific teesheet and related queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.settings.teesheetVisibility(variables.teesheetId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.teesheets.all() });
    },
    onError: (error: Error) => {
      console.error("Failed to update visibility:", error);
    },
  }),

  /**
   * Update lottery settings for a teesheet
   */
  updateLotterySettings: (queryClient: QueryClient) => ({
    mutationFn: async ({
      teesheetId,
      settings,
    }: {
      teesheetId: number;
      settings: {
        isLotteryEnabled: boolean;
        lotteryDisabledMessage?: string;
        lotteryCloseTime?: string;
        lotteryDrawTime?: string;
      };
    }) => {
      const result = await updateLotterySettings(teesheetId, {
        enabled: settings.isLotteryEnabled,
        disabledMessage: settings.lotteryDisabledMessage,
      });

      return result;
    },
    onSuccess: () => {
      // Invalidate teesheet and lottery queries since we updated teesheet directly
      queryClient.invalidateQueries({ queryKey: queryKeys.lottery.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.teesheets.all() });
    },
    onError: (error: Error) => {
      console.error("Failed to update lottery settings:", error);
    },
  }),
};
