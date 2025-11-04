import { queryOptions } from "@tanstack/react-query";
import { queryKeys } from "./query-keys";
import {
  getTeesheetConfigsAction,
  getCourseInfoAction,
  getTemplatesAction,
  getLotterySettingsAction,
} from "~/server/settings/actions";

/**
 * Query options for settings-related data
 *
 * These query options provide centralized configuration for:
 * - Teesheet configurations
 * - Course info (notes)
 * - Templates
 * - Lottery settings
 */

export const settingsQueryOptions = {
  /**
   * Get all teesheet configurations
   */
  teesheetConfigs: () =>
    queryOptions({
      queryKey: queryKeys.settings.teesheetConfigs(),
      queryFn: async () => {
        const result = await getTeesheetConfigsAction();
        if (!result.success) {
          throw new Error(result.error || "Failed to load teesheet configs");
        }
        return result.data;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes - configs don't change frequently
      gcTime: 10 * 60 * 1000, // 10 minutes
    }),

  /**
   * Get course info (notes displayed to members)
   */
  courseInfo: () =>
    queryOptions({
      queryKey: queryKeys.settings.courseInfo(),
      queryFn: async () => {
        const result = await getCourseInfoAction();
        if (!result.success) {
          throw new Error(result.error || "Failed to load course info");
        }
        return result.data;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000,
    }),

  /**
   * Get all templates
   */
  templates: () =>
    queryOptions({
      queryKey: queryKeys.settings.templates(),
      queryFn: async () => {
        const result = await getTemplatesAction();
        if (!result.success) {
          throw new Error(result.error || "Failed to load templates");
        }
        return result.data;
      },
      staleTime: 10 * 60 * 1000, // 10 minutes - templates rarely change
      gcTime: 30 * 60 * 1000,
    }),

  /**
   * Get lottery settings for a specific teesheet
   */
  lotterySettings: (teesheetId: number) =>
    queryOptions({
      queryKey: queryKeys.settings.lotterySettings(teesheetId),
      queryFn: async () => {
        const result = await getLotterySettingsAction(teesheetId);
        if (!result.success) {
          throw new Error(result.error || "Failed to load lottery settings");
        }
        return result.data;
      },
      staleTime: 2 * 60 * 1000, // 2 minutes - more real-time for lottery
      gcTime: 5 * 60 * 1000,
      enabled: teesheetId > 0, // Only fetch if we have a valid ID
    }),
};
