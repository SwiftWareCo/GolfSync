import "server-only";

import { db } from "~/server/db";
import { members } from "~/server/db/schema";
import { eq, inArray, and } from "drizzle-orm";

export interface PushStats {
  totalMembers: number;
  subscribedMembers: number;
  validSubscriptions: number;
  subscriptionRate: number;
}

export interface ClassCount {
  class: string;
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
export async function getMembersCountByClass(
  targetClasses: string[],
): Promise<ClassCount[]> {
  const allMembers = await db.query.members.findMany({
    columns: {
      class: true,
      pushNotificationsEnabled: true,
    },
  });

  // Filter by target classes if provided
  const filteredMembers =
    targetClasses.length > 0
      ? allMembers.filter((m) => targetClasses.includes(m.class))
      : allMembers;

  // Group by class and count totals and subscribed
  const classCounts = new Map<string, ClassCount>();

  for (const member of filteredMembers) {
    if (!classCounts.has(member.class)) {
      classCounts.set(member.class, {
        class: member.class,
        totalCount: 0,
        subscribedCount: 0,
      });
    }

    const count = classCounts.get(member.class)!;
    count.totalCount++;
    if (member.pushNotificationsEnabled) {
      count.subscribedCount++;
    }
  }

  return Array.from(classCounts.values());
}

/**
 * Get all subscribed members for notifications
 */
export async function getSubscribedMembers() {
  return await db.query.members.findMany({
    where: eq(members.pushNotificationsEnabled, true),
    columns: {
      id: true,
      pushSubscription: true,
      firstName: true,
      lastName: true,
    },
  });
}

/**
 * Get subscribed members by class for targeted notifications
 */
export async function getSubscribedMembersByClass(targetClasses: string[]) {
  const whereCondition =
    targetClasses.length === 0
      ? eq(members.pushNotificationsEnabled, true)
      : and(
          eq(members.pushNotificationsEnabled, true),
          inArray(members.class, targetClasses),
        );

  return await db.query.members.findMany({
    where: whereCondition,
    columns: {
      id: true,
      firstName: true,
      lastName: true,
      class: true,
    },
  });
}

/**
 * Get member push subscription details
 */
export async function getMemberPushSubscription(memberId: number) {
  return await db.query.members.findFirst({
    where: eq(members.id, memberId),
    columns: {
      pushNotificationsEnabled: true,
      pushSubscription: true,
    },
  });
}
