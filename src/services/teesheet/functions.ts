import { populateTimeBlocksWithRandomMembers } from "~/server/teesheet/actions";

export async function getTeesheet(date: string) {
  const response = await fetch(`/api/teesheet/${date}`);
  if (!response.ok) {
    throw new Error("Failed to fetch teesheet");
  }
  return response.json();
}

export async function populateTeesheet(teesheetId: number, date: string) {
  return await populateTimeBlocksWithRandomMembers(teesheetId, date);
}
