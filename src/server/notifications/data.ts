import "server-only";

import { db } from "~/server/db";
import { notifications } from "~/server/db/schema";
import { eq, or, isNull, desc, and, isNotNull, lt, sql } from "drizzle-orm";

/**
 * Get unread notifications for a member
 * Includes both member-specific and broadcast (member_id = NULL) notifications
 * Only returns unread notifications (read_at IS NULL)
 */
export async function getUnreadNotifications(
  memberId: number,
  limit: number = 20,
) {
  return await db.query.notifications.findMany({
    where: and(
      or(eq(notifications.memberId, memberId), isNull(notifications.memberId)),
      isNull(notifications.readAt),
    ),
    orderBy: [desc(notifications.createdAt)],
    limit,
  });
}

/**
 * Get unread notification count for badge display
 */
export async function getUnreadNotificationCount(memberId: number) {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(
      and(
        or(
          eq(notifications.memberId, memberId),
          isNull(notifications.memberId),
        ),
        isNull(notifications.readAt),
      ),
    );

  return result[0]?.count ?? 0;
}

/**
 * Get all notifications for a member (for history view)
 */
export async function getNotificationHistory(
  memberId: number,
  limit: number = 50,
) {
  return await db.query.notifications.findMany({
    where: or(
      eq(notifications.memberId, memberId),
      isNull(notifications.memberId),
    ),
    orderBy: [desc(notifications.createdAt)],
    limit,
  });
}

/**
 * Cleanup old read notifications (delete notifications read before target date)
 * This should be run via cron or end-of-day maintenance
 */
export async function cleanupOldNotifications() {
  // Delete read notifications older than 24 hours
  const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const result = await db
    .delete(notifications)
    .where(
      and(
        isNotNull(notifications.readAt),
        lt(notifications.readAt, cutoffDate),
      ),
    )
    .returning({ id: notifications.id });

  return { deletedCount: result.length };
}
