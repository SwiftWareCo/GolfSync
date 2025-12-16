import "server-only";
import { db } from "~/server/db";
import { eq, and, sql, gte, lte, desc } from "drizzle-orm";
import { timeblockRestrictions, lotteryEntries } from "~/server/db/schema";
import { addDays, parseDate, formatDateToYYYYMMDD } from "~/lib/dates";

/**
 * Check lottery restrictions for a member submitting a lottery entry
 * Returns violations if the member has exceeded their lottery entry limit
 */
export async function checkLotteryRestrictions(
  memberId: number,
  memberClassId: number,
  lotteryDateStr: string,
): Promise<{
  hasViolations: boolean;
  violations: any[];
  preferredReason?: string;
}> {
  const violations: any[] = [];

  const lotteryRestrictions = await db.query.timeblockRestrictions.findMany({
    where: and(
      eq(timeblockRestrictions.restrictionCategory, "LOTTERY"),
      eq(timeblockRestrictions.restrictionType, "FREQUENCY"),
      eq(timeblockRestrictions.isActive, true),
    ),
    orderBy: [desc(timeblockRestrictions.priority)],
  });

  for (const restriction of lotteryRestrictions) {
    // Check if restriction applies to this member class
    const memberClassesApplies =
      !restriction.memberClassIds?.length ||
      restriction.memberClassIds?.includes(memberClassId);

    if (!memberClassesApplies) {
      continue;
    }

    if (
      restriction.restrictionType === "FREQUENCY" &&
      restriction.maxCount &&
      restriction.periodDays
    ) {
      /**
       * Rolling Window Period Logic:
       *
       * The restriction period works as a rolling window that ends on the lottery date.
       * For each lottery date, we calculate a window that goes backwards by periodDays.
       *
       * Example with "1 entry every 3 days" restriction:
       * - If member books on Jan 13:
       *   - Jan 14 window: Jan 11-14 (includes Jan 13 entry) → BLOCKED
       *   - Jan 15 window: Jan 12-15 (includes Jan 13 entry) → BLOCKED
       *   - Jan 16 window: Jan 13-16 (includes Jan 13 entry) → BLOCKED
       *   - Jan 17 window: Jan 14-17 (doesn't include Jan 13) → ALLOWED
       *
       * - If member books on Jan 28:
       *   - Jan 29 window: Jan 26-29 (includes Jan 28 entry) → BLOCKED
       *   - Jan 30 window: Jan 27-30 (includes Jan 28 entry) → BLOCKED
       *   - Jan 31 window: Jan 28-31 (includes Jan 28 entry) → BLOCKED
       *   - Feb 1 window: Jan 29-Feb 1 (doesn't include Jan 28) → ALLOWED
       *
       * This ensures consistent restriction enforcement regardless of when entries
       * are submitted, as the window shifts forward each day.
       */
      // Calculate the period window: periodDays before the lottery date
      const lotteryDate = parseDate(lotteryDateStr);
      const periodStartDate = addDays(lotteryDate, -restriction.periodDays);
      const periodStartStr = formatDateToYYYYMMDD(periodStartDate);
      const periodEndStr = lotteryDateStr; // Up to and including the lottery date

      // Count existing lottery entries where member is organizer within the period
      const existingEntries = await db
        .select({ count: sql<number>`cast(count(*) as integer)` })
        .from(lotteryEntries)
        .where(
          and(
            eq(lotteryEntries.organizerId, memberId),
            gte(lotteryEntries.lotteryDate, periodStartStr),
            lte(lotteryEntries.lotteryDate, periodEndStr),
            // Only count entries that are not cancelled
            sql`${lotteryEntries.status} != 'CANCELLED'`,
          ),
        );

      const currentEntryCount = Number(existingEntries[0]?.count || 0);
      const newTotalCount = currentEntryCount + 1; // Including this new entry

      if (newTotalCount > restriction.maxCount) {
        const periodLabel =
          restriction.periodDays === 7
            ? "week"
            : restriction.periodDays === 30
              ? "month"
              : `${restriction.periodDays} days`;

        violations.push({
          restrictionId: restriction.id,
          restrictionName: restriction.name,
          restrictionDescription: restriction.description,
          restrictionCategory: "LOTTERY",
          entityId: memberId.toString(),
          memberClassId,
          type: "FREQUENCY",
          message: `You have reached your lottery entry limit (${currentEntryCount}/${restriction.maxCount} entries in the last ${periodLabel})`,
          canOverride: restriction.canOverride,
          frequencyInfo: {
            currentCount: currentEntryCount,
            maxCount: restriction.maxCount,
            periodDays: restriction.periodDays,
            periodLabel,
          },
        });
      }
    }
  }

  // Determine preferred reason
  let preferredReason = "";
  if (violations.length > 0) {
    preferredReason =
      violations[0].restrictionDescription &&
      violations[0].restrictionDescription.trim() !== ""
        ? violations[0].restrictionDescription
        : violations[0].message;
  }

  return {
    hasViolations: violations.length > 0,
    violations,
    preferredReason,
  };
}
