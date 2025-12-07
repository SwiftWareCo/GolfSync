"use server";

import { db } from "~/server/db";
import {
  memberClasses,
  timeblockRestrictions,
  events,
} from "~/server/db/schema";
import { eq, sql } from "drizzle-orm";
import { type MemberClassInsert } from "~/server/db/schema";


export interface ActionResult {
  success: boolean;
  error?: string;
  data?: any;
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
    // Verify member class exists
    const memberClass = await db.query.memberClasses.findFirst({
      where: eq(memberClasses.id, id),
    });

    if (!memberClass) {
      return { success: false, error: "Member class not found" };
    }

    // Check if class is referenced in restriction/event arrays
    // (These are NOT FK constraints, so we must check manually to prevent orphaned IDs)
    const restrictionsUsingClass =
      await db.query.timeblockRestrictions.findFirst({
        where: sql`${id} = ANY(${timeblockRestrictions.memberClassIds})`,
      });

    if (restrictionsUsingClass) {
      return {
        success: false,
        error: "Cannot delete: class is used by timeblock restrictions",
      };
    }

    const eventsUsingClass = await db.query.events.findFirst({
      where: sql`${id} = ANY(${events.memberClassIds})`,
    });

    if (eventsUsingClass) {
      return {
        success: false,
        error: "Cannot delete: class is used by events",
      };
    }

    // Attempt delete - members.classId FK will throw if members exist
    await db.delete(memberClasses).where(eq(memberClasses.id, id));
    return { success: true };
  } catch (error) {
    console.error("Error deleting member class:", error);

    // Check for FK violation (members using this class)
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("violates foreign key constraint")) {
      return {
        success: false,
        error: "Cannot delete: class is assigned to members",
      };
    }

    return {
      success: false,
      error: "Failed to delete member class",
    };
  }
}
