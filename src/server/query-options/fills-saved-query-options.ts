import { queryOptions } from "@tanstack/react-query";
import { queryKeys } from "./query-keys";
import {
  searchFillsSavedAction,
  getFillsSavedAction,
} from "~/server/fills-saved/actions";
import type { FillSaved } from "~/server/db/schema";

export const fillSavedQueryOptions = {
  // Get all saved fills
  all: () =>
    queryOptions({
      queryKey: queryKeys.fillsSaved.all(),
      queryFn: async (): Promise<FillSaved[]> => {
        const results = await getFillsSavedAction();
        return results as FillSaved[];
      },
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    }),

  // Search saved fills
  search: (query: string) =>
    queryOptions({
      queryKey: queryKeys.fillsSaved.search(query),
      queryFn: async (): Promise<FillSaved[]> => {
        const results = await searchFillsSavedAction(query);
        return results as FillSaved[];
      },
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    }),
};
