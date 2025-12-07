"use server";

import webpush from "web-push";
import { auth } from "@clerk/nextjs/server";
import { db } from "~/server/db";
import { members } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { getMemberData } from "~/server/members-teesheet-client/data";
import {
  createBroadcastNotification,
  createNotificationsForMembers,
} from "~/server/notifications/actions";

webpush.setVapidDetails(
  "mailto:swiftwareco@gmail.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

// Helper function to handle subscription expiration
async function handleExpiredSubscription(memberId: number, error: any) {
  try {
    console.log(`Push subscription expired for member ${memberId}:`, {
      statusCode: error.statusCode,
      endpoint: error.endpoint,
      body: error.body,
    });

    await db
      .update(members)
      .set({
        pushNotificationsEnabled: false,
        pushSubscription: null,
      })
      .where(eq(members.id, memberId));

    console.log(`Disabled expired push subscription for member ${memberId}`);
  } catch (dbError) {
    console.error(
      `Failed to disable expired subscription for member ${memberId}:`,
      dbError,
    );
  }
}

// Helper function to check if error is a subscription expiration
function isSubscriptionExpired(error: any): boolean {
  return (
    error.statusCode === 410 ||
    (error.statusCode === 400 && error.body?.includes("unsubscribed")) ||
    error.body?.includes("expired") ||
    error.body?.includes("invalid")
  );
}

export async function subscribeUserToPushNotifications(subscription: any) {
  try {
    const { sessionClaims } = await auth();
    if (!sessionClaims?.userId) {
      return { success: false, error: "Not authenticated" };
    }

    const member = await getMemberData(sessionClaims.userId as string);
    if (!member?.id) {
      return { success: false, error: "Member not found" };
    }

    await db
      .update(members)
      .set({
        pushNotificationsEnabled: true,
        pushSubscription: subscription,
      })
      .where(eq(members.id, member.id));

    return { success: true };
  } catch (error) {
    console.error("Error subscribing user to push notifications:", error);
    return { success: false, error: "Failed to subscribe to notifications" };
  }
}

export async function unsubscribeUserFromPushNotifications() {
  try {
    const { sessionClaims } = await auth();
    if (!sessionClaims?.userId) {
      return { success: false, error: "Not authenticated" };
    }

    const member = await getMemberData(sessionClaims.userId as string);
    if (!member?.id) {
      return { success: false, error: "Member not found" };
    }

    await db
      .update(members)
      .set({
        pushNotificationsEnabled: false,
        pushSubscription: null,
      })
      .where(eq(members.id, member.id));

    return { success: true };
  } catch (error) {
    console.error("Error unsubscribing user from push notifications:", error);
    return {
      success: false,
      error: "Failed to unsubscribe from notifications",
    };
  }
}

export async function sendNotificationToMember(
  memberId: number,
  title: string,
  body: string,
  data?: any,
) {
  try {
    const member = await db.query.members.findFirst({
      where: eq(members.id, memberId),
      columns: {
        pushNotificationsEnabled: true,
        pushSubscription: true,
      },
    });

    if (!member?.pushNotificationsEnabled || !member.pushSubscription) {
      return {
        success: false,
        error: "Member not subscribed to push notifications",
        shouldRetry: false,
      };
    }

    const payload = JSON.stringify({
      title,
      body,
      icon: "/icon-192x192.png",
      badge: "/icon-192x192.png",
      data,
    });

    await webpush.sendNotification(member.pushSubscription as any, payload);

    return { success: true };
  } catch (error: any) {
    if (isSubscriptionExpired(error)) {
      await handleExpiredSubscription(memberId, error);
      return {
        success: false,
        error: "Push subscription has expired and has been removed",
        expired: true,
        shouldRetry: false,
      };
    }

    console.error("Error sending push notification:", error);
    return {
      success: false,
      error: "Failed to send notification",
      shouldRetry: true,
    };
  }
}

export async function sendNotificationToAllMembers(
  title: string,
  body: string,
  data?: any,
) {
  try {
    const subscribedMembers = await db.query.members.findMany({
      where: eq(members.pushNotificationsEnabled, true),
      columns: {
        id: true,
        pushSubscription: true,
      },
    });

    const payload = JSON.stringify({
      title,
      body,
      icon: "/icon-192x192.png",
      badge: "/icon-192x192.png",
      data,
    });

    const results = await Promise.allSettled(
      subscribedMembers
        .filter((member) => member.pushSubscription)
        .map(async (member) => {
          try {
            await webpush.sendNotification(
              member.pushSubscription as any,
              payload,
            );
            return { memberId: member.id, success: true };
          } catch (error: any) {
            if (isSubscriptionExpired(error)) {
              await handleExpiredSubscription(member.id, error);
              return {
                memberId: member.id,
                success: false,
                expired: true,
                error: error.body || "Subscription expired",
              };
            }
            return {
              memberId: member.id,
              success: false,
              error: error.message || "Unknown error",
            };
          }
        }),
    );

    const successful = results.filter(
      (result) => result.status === "fulfilled" && result.value.success,
    ).length;
    const expired = results.filter(
      (result) => result.status === "fulfilled" && result.value.expired,
    ).length;
    const failed = results.filter(
      (result) =>
        result.status === "rejected" ||
        (result.status === "fulfilled" &&
          !result.value.success &&
          !result.value.expired),
    ).length;

    console.log(
      `Push notification batch complete: ${successful} sent, ${expired} expired, ${failed} failed`,
    );

    // Also create in-app broadcast notification
    await createBroadcastNotification(title, body, "broadcast", data);

    return {
      success: true,
      sent: successful,
      expired,
      failed,
    };
  } catch (error) {
    console.error("Error sending push notifications to all members:", error);
    return { success: false, error: "Failed to send notifications" };
  }
}

export async function cleanupExpiredSubscriptions() {
  try {
    const subscribedMembers = await db.query.members.findMany({
      where: eq(members.pushNotificationsEnabled, true),
      columns: {
        id: true,
        pushSubscription: true,
        firstName: true,
        lastName: true,
      },
    });

    console.log(
      `Checking ${subscribedMembers.length} subscriptions for expiration...`,
    );

    let expiredCount = 0;
    const testPayload = JSON.stringify({
      title: "Test",
      body: "Subscription test",
      icon: "/icon-192x192.png",
      badge: "/icon-192x192.png",
    });

    for (const member of subscribedMembers) {
      if (!member.pushSubscription) continue;

      try {
        await webpush.sendNotification(
          member.pushSubscription as any,
          testPayload,
        );
      } catch (error: any) {
        if (isSubscriptionExpired(error)) {
          await handleExpiredSubscription(member.id, error);
          expiredCount++;
          console.log(
            `Cleaned up expired subscription for ${member.firstName} ${member.lastName} (ID: ${member.id})`,
          );
        }
      }
    }

    console.log(
      `Cleanup complete: removed ${expiredCount} expired subscriptions`,
    );
    return { success: true, cleanedUp: expiredCount };
  } catch (error) {
    console.error("Error during subscription cleanup:", error);
    return { success: false, error: "Failed to cleanup subscriptions" };
  }
}

export async function getMemberPushNotificationStatus() {
  try {
    const { sessionClaims } = await auth();
    if (!sessionClaims?.userId) {
      return { success: false, error: "Not authenticated" };
    }

    const member = await getMemberData(sessionClaims.userId as string);
    if (!member?.id) {
      return { success: false, error: "Member not found" };
    }

    const memberData = await db.query.members.findFirst({
      where: eq(members.id, member.id),
      columns: {
        pushNotificationsEnabled: true,
      },
    });

    return {
      success: true,
      enabled: memberData?.pushNotificationsEnabled ?? false,
    };
  } catch (error) {
    console.error("Error getting member push notification status:", error);
    return { success: false, error: "Failed to get notification status" };
  }
}

/**
 * Send targeted notification to members by class IDs
 */
export async function sendTargetedNotification(
  title: string,
  body: string,
  targetClassIds: number[],
  data?: any,
) {
  try {
    const allSubscribedMembers = await db.query.members.findMany({
      where: eq(members.pushNotificationsEnabled, true),
      columns: {
        id: true,
        firstName: true,
        lastName: true,
        classId: true,
        pushSubscription: true,
      },
    });

    // Filter by class IDs if provided
    const subscribedMembers =
      targetClassIds.length > 0
        ? allSubscribedMembers.filter((m) => targetClassIds.includes(m.classId))
        : allSubscribedMembers;

    if (subscribedMembers.length === 0) {
      return {
        success: false,
        error: "No subscribed members found in the selected classes",
      };
    }

    const payload = JSON.stringify({
      title,
      body,
      icon: "/icon-192x192.png",
      badge: "/icon-192x192.png",
      data,
    });

    const results = await Promise.allSettled(
      subscribedMembers
        .filter((member) => member.pushSubscription)
        .map(async (member) => {
          try {
            await webpush.sendNotification(
              member.pushSubscription as any,
              payload,
            );
            return {
              memberId: member.id,
              memberName: `${member.firstName} ${member.lastName}`,
              success: true,
            };
          } catch (error: any) {
            if (isSubscriptionExpired(error)) {
              await handleExpiredSubscription(member.id, error);
              return {
                memberId: member.id,
                success: false,
                expired: true,
                error: error.body || "Subscription expired",
              };
            }
            return {
              memberId: member.id,
              success: false,
              error: error.message || "Unknown error",
            };
          }
        }),
    );

    const successful = results.filter(
      (result) => result.status === "fulfilled" && result.value.success,
    ).length;
    const expired = results.filter(
      (result) => result.status === "fulfilled" && result.value.expired,
    ).length;
    const failed = results.filter(
      (result) =>
        result.status === "rejected" ||
        (result.status === "fulfilled" &&
          !result.value.success &&
          !result.value.expired),
    ).length;

    console.log(
      `Targeted notification complete: ${successful} sent, ${expired} expired, ${failed} failed`,
    );

    // Also create in-app notifications for all targeted members (not just subscribers)
    const allMembersInClasses = await db.query.members.findMany({
      where: (m, { inArray }) => inArray(m.classId, targetClassIds),
      columns: { id: true },
    });
    const memberIdsToNotify = allMembersInClasses.map((m) => m.id);
    await createNotificationsForMembers(
      memberIdsToNotify,
      title,
      body,
      "broadcast",
      data,
    );

    return {
      success: true,
      sent: successful,
      expired,
      failed,
      totalTargeted: subscribedMembers.length,
    };
  } catch (error) {
    console.error("Error sending targeted notification:", error);
    return { success: false, error: "Failed to send targeted notification" };
  }
}

/**
 * Run maintenance tasks for push notifications (cleanup expired subscriptions)
 */
export async function runPushNotificationMaintenance() {
  try {
    console.log("Starting push notification maintenance...");

    const cleanupResult = await cleanupExpiredSubscriptions();

    if (!cleanupResult.success) {
      throw new Error(cleanupResult.error || "Cleanup failed");
    }

    // Get fresh stats
    const totalMembers = await db.$count(members);
    const subscribedMembers = await db.$count(
      members,
      eq(members.pushNotificationsEnabled, true),
    );

    console.log("Push notification maintenance completed successfully");

    return {
      success: true,
      cleanedUp: cleanupResult.cleanedUp,
      stats: {
        totalMembers,
        subscribedMembers,
        subscriptionRate:
          totalMembers > 0 ? (subscribedMembers / totalMembers) * 100 : 0,
      },
    };
  } catch (error) {
    console.error("Error during push notification maintenance:", error);
    return {
      success: false,
      error: "Failed to run maintenance tasks",
    };
  }
}
