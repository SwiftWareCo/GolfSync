import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTeesheet, populateTeesheet } from "./functions";
import { teesheetKeys } from "./keys";
import { toast } from "react-hot-toast";

export function useTeesheet(date: string) {
  return useQuery({
    queryKey: teesheetKeys.detail(date),
    queryFn: () => getTeesheet(date),
    refetchInterval: 30000, // Poll every 30 seconds
  });
}

export function usePopulateTeesheet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ teesheetId, date }: { teesheetId: number; date: string }) =>
      populateTeesheet(teesheetId, date),
    onSuccess: (result, { date }) => {
      if (result.success) {
        toast.success(result.message || "Successfully populated timeblocks");
        queryClient.invalidateQueries({ queryKey: teesheetKeys.detail(date) });
      } else {
        toast.error(result.error || "Failed to populate timeblocks");
      }
    },
    onError: (error) => {
      console.error(error);
      toast.error("An unexpected error occurred");
    },
  });
}
