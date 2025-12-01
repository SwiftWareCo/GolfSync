import "server-only";
import { db } from "~/server/db";
import { memberClasses } from "~/server/db/schema";
import { eq, asc } from "drizzle-orm";
import type { MemberClass } from "~/server/db/schema";

// Get all member classes ordered by sortOrder then label
export async function getActiveMemberClasses(): Promise<MemberClass[]> {
  return await db.query.memberClasses.findMany({
    where: eq(memberClasses.isActive, true),
    orderBy: [asc(memberClasses.sortOrder), asc(memberClasses.label)],
  });
}

// Get all member classes including inactive ones (for admin)
export async function getAllMemberClasses(): Promise<MemberClass[]> {
  return await db.query.memberClasses.findMany({
    orderBy: [asc(memberClasses.sortOrder), asc(memberClasses.label)],
  });
}

// Get member class by ID
export async function getMemberClassById(
  id: number,
): Promise<MemberClass | null> {
  const result = await db.query.memberClasses.findFirst({
    where: eq(memberClasses.id, id),
  });
  return result || null;
}

// Get member class by label
export async function getMemberClassByLabel(
  label: string,
): Promise<MemberClass | null> {
  const result = await db.query.memberClasses.findFirst({
    where: eq(memberClasses.label, label),
  });
  return result || null;
}
