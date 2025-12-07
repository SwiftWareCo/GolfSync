"use server";

import { db } from "~/server/db";
import {
  notifications,
  type NotificationType,
  type NotificationInsert,
} from "~/server/db/schema";
import { eq, or, isNull, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * Create a notification for a specific member
 */
export async function createNotification(
  memberId: number,
  title: string,
  body: string,
  type: NotificationType = "system",
  data?: Record<string, any>,
) {
  try {
    const [notification] = await db
      .insert(notifications)
      .values({
        memberId,
        title,
        body,
        type,
        data: data ? JSON.stringify(data) : null,
      })
      .returning();

    return { success: true, notification };
  } catch (error) {
    console.error("Error creating notification:", error);
    return { success: false, error: "Failed to create notification" };
  }
}

/**
 * Create a broadcast notification (visible to all members)
 */
export async function createBroadcastNotification(
  title: string,
  body: string,
  type: NotificationType = "broadcast",
  data?: Record<string, any>,
) {
  try {
    const [notification] = await db
      .insert(notifications)
      .values({
        memberId: null, // NULL means broadcast to all
        title,
        body,
        type,
        data: data ? JSON.stringify(data) : null,
      })
      .returning();

    return { success: true, notification };
  } catch (error) {
    console.error("Error creating broadcast notification:", error);
    return { success: false, error: "Failed to create broadcast notification" };
  }
}

/**
 * Mark a specific notification as read
 */
export async function markNotificationAsRead(notificationId: number) {
  try {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(eq(notifications.id, notificationId));

    return { success: true };
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return { success: false, error: "Failed to mark notification as read" };
  }
}

/**
 * Mark all unread notifications as read for a member
 * This is called when member views the notification list
 */
export async function markAllNotificationsAsRead(memberId: number) {
  try {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          or(
            eq(notifications.memberId, memberId),
            isNull(notifications.memberId),
          ),
          isNull(notifications.readAt),
        ),
      );

    revalidatePath("/members");
    return { success: true };
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    return { success: false, error: "Failed to mark notifications as read" };
  }
}

/**
 * Create notifications for multiple members (batch operation)
 * Used when sending targeted notifications to specific member classes
 */
export async function createNotificationsForMembers(
  memberIds: number[],
  title: string,
  body: string,
  type: NotificationType = "system",
  data?: Record<string, any>,
) {
  try {
    if (memberIds.length === 0) {
      return { success: true, created: 0 };
    }

    const notificationsToInsert: NotificationInsert[] = memberIds.map(
      (memberId) => ({
        memberId,
        title,
        body,
        type,
        data: data ? JSON.stringify(data) : null,
      }),
    );

    const result = await db
      .insert(notifications)
      .values(notificationsToInsert)
      .returning({ id: notifications.id });

    return { success: true, created: result.length };
  } catch (error) {
    console.error("Error creating notifications for members:", error);
    return { success: false, error: "Failed to create notifications" };
  }
}
