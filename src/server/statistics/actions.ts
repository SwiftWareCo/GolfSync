"use server";

import { getMemberById } from "./data";

/**
 * Server action to get member by ID for client components
 */
export async function getMemberByIdAction(id: number) {
  return await getMemberById(id);
}

