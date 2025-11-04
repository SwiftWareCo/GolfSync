"use server";

import { db } from "~/server/db";
import { memberClasses, members } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { type MemberClassInsert } from "~/server/db/schema";
import { getMemberClasses, getAllMemberClasses, getMemberClassById } from "./data";

export interface ActionResult {
  success: boolean;
  error?: string;
  data?: any;
}

// Query actions for client components
export async function getMemberClassesAction() {
  try {
    const classes = await getMemberClasses();
    return { success: true, data: classes };
  } catch (error) {
    console.error("Error fetching member classes:", error);
    return { success: false, error: "Failed to fetch member classes", data: [] };
  }
}

export async function getAllMemberClassesAction() {
  try {
    const classes = await getAllMemberClasses();
    return { success: true, data: classes };
  } catch (error) {
    console.error("Error fetching all member classes:", error);
    return { success: false, error: "Failed to fetch member classes", data: [] };
  }
}

export async function getMemberClassByIdAction(id: number) {
  try {
    const memberClass = await getMemberClassById(id);
    if (!memberClass) {
      return { success: false, error: "Member class not found" };
    }
    return { success: true, data: memberClass };
  } catch (error) {
    console.error("Error fetching member class:", error);
    return { success: false, error: "Failed to fetch member class" };
  }
}

// Create new member class
export async function createMemberClassAction(
  data: Omit<MemberClassInsert, "id" | "createdAt" | "updatedAt">,
): Promise<ActionResult> {
  try {
    const [memberClass] = await db
      .insert(memberClasses)
      .values(data)
      .returning();
    if (!memberClass) {
      throw new Error("Failed to create member class");
    }
    return { success: true, data: memberClass };
  } catch (error) {
    console.error("Error creating member class:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create member class",
    };
  }
}

// Update member class
export async function updateMemberClassAction(
  id: number,
  data: Partial<Omit<MemberClassInsert, "id" | "createdAt" | "updatedAt">>,
): Promise<ActionResult> {
  try {
    const [memberClass] = await db
      .update(memberClasses)
      .set(data)
      .where(eq(memberClasses.id, id))
      .returning();

    if (!memberClass) {
      throw new Error("Failed to update member class");
    }
    return { success: true, data: memberClass };
  } catch (error) {
    console.error("Error updating member class:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update member class",
    };
  }
}

// Delete member class
export async function deleteMemberClassAction(
  id: number,
): Promise<ActionResult> {
  try {
    // Get member class to check if system generated
    const memberClass = await db.query.memberClasses.findFirst({
      where: eq(memberClasses.id, id),
    });

    if (!memberClass) {
      throw new Error("Member class not found");
    }

    if (memberClass.isSystemGenerated) {
      throw new Error("Cannot delete system generated member class");
    }

    // Check if any members are using this class (by label)
    const membersUsingClass = await db.query.members.findFirst({
      where: eq(members.class, memberClass.label),
    });

    if (membersUsingClass) {
      throw new Error("Cannot delete member class that is in use by members");
    }

    const result = await db
      .delete(memberClasses)
      .where(eq(memberClasses.id, id));
    const success = result.rowCount > 0;
    return { success, data: success };
  } catch (error) {
    console.error("Error deleting member class:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to delete member class",
    };
  }
}
