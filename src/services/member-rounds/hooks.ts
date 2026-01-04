"use client";

import { useQuery } from "@tanstack/react-query";
import { getMemberRounds } from "./functions";
import { memberRoundsKeys } from "./keys";

export function useMemberRounds() {
  return useQuery({
    queryKey: memberRoundsKeys.all,
    queryFn: getMemberRounds,
    refetchInterval: 60000, // 60 seconds
  });
}

export function useMemberActiveRound() {
  const { data, ...rest } = useMemberRounds();
  return {
    data: data?.activeRound ?? null,
    ...rest,
  };
}

export function useMemberRoundsHistory() {
  const { data, ...rest } = useMemberRounds();
  return {
    data: data?.history ?? [],
    ...rest,
  };
}
