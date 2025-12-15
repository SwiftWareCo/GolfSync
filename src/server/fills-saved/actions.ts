"use server";

import { db } from "~/server/db";
import { fillsSaved } from "~/server/db/schema";
import { eq, ilike } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * Search saved fills by name
 */
export async function searchFillsSavedAction(query: string) {
  if (!query.trim()) {
    // Return all saved fills if no query
    return await db.query.fillsSaved.findMany({
      orderBy: (t, { asc }) => [asc(t.name)],
      limit: 20,
    });
  }

  return await db.query.fillsSaved.findMany({
    where: ilike(fillsSaved.name, `%${query.trim()}%`),
    orderBy: (t, { asc }) => [asc(t.name)],
    limit: 20,
  });
}

/**
 * Get all saved fills
 */
export async function getFillsSavedAction() {
  return await db.query.fillsSaved.findMany({
    orderBy: (t, { asc }) => [asc(t.name)],
  });
}

/**
 * Create a new saved fill
 */
export async function createFillSavedAction(name: string) {
  try {
    // Check for duplicate
    const existing = await db.query.fillsSaved.findFirst({
      where: ilike(fillsSaved.name, name.trim()),
    });

    if (existing) {
      return {
        success: false,
        error: `A saved fill named "${name}" already exists`,
      };
    }

    const [created] = await db
      .insert(fillsSaved)
      .values({ name: name.trim() })
      .returning();

    revalidatePath("/admin");
    return { success: true, data: created };
  } catch (error) {
    console.error("Error creating saved fill:", error);
    return { success: false, error: "Failed to create saved fill" };
  }
}

/**
 * Delete a saved fill
 */
export async function deleteFillSavedAction(id: number) {
  try {
    await db.delete(fillsSaved).where(eq(fillsSaved.id, id));
    revalidatePath("/admin");
    return { success: true };
  } catch (error) {
    console.error("Error deleting saved fill:", error);
    return { success: false, error: "Failed to delete saved fill" };
  }
}
