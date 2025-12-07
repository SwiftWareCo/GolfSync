import "server-only";

import { db } from "~/server/db";
import { members, memberClasses } from "~/server/db/schema";
import { eq } from "drizzle-orm";

export interface PushStats {
  totalMembers: number;
  subscribedMembers: number;
  validSubscriptions: number;
  subscriptionRate: number;
}

export interface ClassCount {
  classId: number;
  classLabel: string;
  totalCount: number;
  subscribedCount: number;
}

/**
 * Get push notification statistics for admin dashboard
 */
export async function getPushNotificationStats(): Promise<PushStats> {
  const totalMembers = await db.$count(members);

  const subscribedMembers = await db.$count(
    members,
    eq(members.pushNotificationsEnabled, true),
  );

  const membersWithSubscriptions = await db.query.members.findMany({
    where: eq(members.pushNotificationsEnabled, true),
    columns: {
      id: true,
      pushSubscription: true,
    },
  });

  const validSubscriptions = membersWithSubscriptions.filter(
    (member) => member.pushSubscription,
  ).length;

  return {
    totalMembers,
    subscribedMembers,
    validSubscriptions,
    subscriptionRate:
      totalMembers > 0 ? (subscribedMembers / totalMembers) * 100 : 0,
  };
}

/**
 * Get member counts by class for targeted notifications
 */
export async function getMembersCountByClass(): Promise<ClassCount[]> {
  // Get all member classes
  const allClasses = await db.query.memberClasses.findMany({
    where: eq(memberClasses.isActive, true),
    orderBy: (mc, { asc }) => [asc(mc.sortOrder)],
  });

  // Get all members with their subscription status
  const allMembers = await db.query.members.findMany({
    columns: {
      classId: true,
      pushNotificationsEnabled: true,
    },
  });

  // Build counts per class
  return allClasses.map((mc) => {
    const classMembers = allMembers.filter((m) => m.classId === mc.id);
    return {
      classId: mc.id,
      classLabel: mc.label,
      totalCount: classMembers.length,
      subscribedCount: classMembers.filter((m) => m.pushNotificationsEnabled)
        .length,
    };
  });
}
