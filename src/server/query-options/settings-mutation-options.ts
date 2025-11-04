import { queryKeys } from "./query-keys";
import {
  createTeesheetConfig,
  updateTeesheetConfig,
  deleteTeesheetConfig,
  updateCourseInfo,
  updateTeesheetVisibility,
  updateLotterySettings,
  updateTeesheetConfigForDate,
} from "~/server/settings/actions";
import type { TeesheetConfigInput } from "~/app/types/TeeSheetTypes";
import type { QueryClient } from "@tanstack/react-query";

/**
 * Mutation options for settings-related operations
 *
 * All mutations include proper cache invalidation to ensure
 * UI updates immediately after changes
 */

export const settingsMutations = {
  /**
   * Create a new teesheet configuration
   */
  createConfig: (queryClient: QueryClient) => ({
    mutationFn: async (data: TeesheetConfigInput) => {
      const result = await createTeesheetConfig(data);
      if (!result.success) {
        throw new Error(result.error || "Failed to create configuration");
      }
      return result.data;
    },
    onSuccess: () => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.teesheetConfigs() });
      queryClient.invalidateQueries({ queryKey: queryKeys.configs.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.teesheets.all() });
    },
    onError: (error: Error) => {
      console.error("Failed to create config:", error);
    },
  }),

  /**
   * Update an existing teesheet configuration
   */
  updateConfig: (queryClient: QueryClient) => ({
    mutationFn: async ({ id, data }: { id: number; data: TeesheetConfigInput }) => {
      const result = await updateTeesheetConfig(id, data);
      if (!result.success) {
        throw new Error(result.error || "Failed to update configuration");
      }
      return result.data;
    },
    onSuccess: () => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.teesheetConfigs() });
      queryClient.invalidateQueries({ queryKey: queryKeys.configs.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.teesheets.all() });
    },
    onError: (error: Error) => {
      console.error("Failed to update config:", error);
    },
  }),

  /**
   * Delete a teesheet configuration
   */
  deleteConfig: (queryClient: QueryClient) => ({
    mutationFn: async (id: number) => {
      const result = await deleteTeesheetConfig(id);
      if (!result.success) {
        throw new Error(result.error || "Failed to delete configuration");
      }
      return result;
    },
    onSuccess: () => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.teesheetConfigs() });
      queryClient.invalidateQueries({ queryKey: queryKeys.configs.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.teesheets.all() });
    },
    onError: (error: Error) => {
      console.error("Failed to delete config:", error);
    },
  }),

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
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.courseInfo() });
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
      const result = await updateTeesheetVisibility(teesheetId, isPublic, privateMessage);
      if (!result.success) {
        throw new Error(result.error || "Failed to update visibility");
      }
      return result;
    },
    onSuccess: (_: unknown, variables: { teesheetId: number; isPublic: boolean; privateMessage?: string }) => {
      // Invalidate the specific teesheet and related queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.settings.teesheetVisibility(variables.teesheetId)
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
      if (!result.success) {
        throw new Error(result.error || "Failed to update lottery settings");
      }
      return result;
    },
    onSuccess: (_: unknown, variables: { teesheetId: number; settings: { isLotteryEnabled: boolean; lotteryDisabledMessage?: string; lotteryCloseTime?: string; lotteryDrawTime?: string } }) => {
      // Invalidate lottery settings for this specific teesheet
      queryClient.invalidateQueries({
        queryKey: queryKeys.settings.lotterySettings(variables.teesheetId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.lottery.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.teesheets.all() });
    },
    onError: (error: Error) => {
      console.error("Failed to update lottery settings:", error);
    },
  }),

  /**
   * Update teesheet configuration for a specific date
   */
  updateConfigForDate: (queryClient: QueryClient) => ({
    mutationFn: async ({
      teesheetId,
      configId,
    }: {
      teesheetId: number;
      configId: number | null;
    }) => {
      const result = await updateTeesheetConfigForDate(teesheetId, configId ?? 0);
      if (!result.success) {
        throw new Error(result.error || "Failed to update teesheet configuration");
      }
      return result.data;
    },
    onSuccess: () => {
      // Invalidate all teesheet-related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.teesheets.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.configs.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.teesheetConfigs() });
    },
    onError: (error: Error) => {
      console.error("Failed to update config for date:", error);
    },
  }),
};
