import type {
  MemberActiveRound,
  MemberPaceOfPlayHistoryItem,
} from "~/server/pace-of-play/data";

export type MemberRoundsData = {
  activeRound: MemberActiveRound | null;
  history: MemberPaceOfPlayHistoryItem[];
};

export async function getMemberRounds(): Promise<MemberRoundsData> {
  const response = await fetch("/api/member/rounds");
  if (!response.ok) {
    throw new Error("Failed to fetch rounds");
  }
  const result = await response.json();
  return result.data;
}
