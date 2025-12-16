import "server-only";
import { db } from "../db";
import { eq, gte, lte, and, count } from "drizzle-orm";
import {
  type StatisticsFilters,
  type StatisticsData,
  type StatisticsSummary,
  type RoundsOverTime,
  type BookingsBySlot,
  type BookingsByDayOfWeek,
  type MemberClassDistribution,
  type PaceOfPlayTrend,
  type PowerCartUsage,
  type TopPlayer,
} from "~/lib/statistics/mock-data";
import {
  timeBlockMembers,
  timeBlockGuests,
  members,
  memberClasses,
  powerCartCharges,
  paceOfPlay,
  eventRegistrations,
  timeBlocks,
  teesheets,
  lotteryEntries,
} from "../db/schema";

export async function getStatisticsData(filters: StatisticsFilters) {
  // Real DB queries
  const { startDate, endDate, memberId } = filters;

  // If memberId provided, fetch member-specific data
  if (memberId) {
    return await getMemberStatisticsData(memberId, startDate, endDate);
  }

  // Otherwise fetch club-wide data
  return await getClubStatisticsData(startDate, endDate);
}

async function getClubStatisticsData(
  startDate: string,
  endDate: string,
): Promise<StatisticsData> {
  // 1. Fetch all bookings in date range with member info
  const memberBookings = await db
    .select({
      bookingDate: timeBlockMembers.bookingDate,
      bookingTime: timeBlockMembers.bookingTime,
      memberId: timeBlockMembers.memberId,
      classId: members.classId,
      firstName: members.firstName,
      lastName: members.lastName,
    })
    .from(timeBlockMembers)
    .leftJoin(members, eq(timeBlockMembers.memberId, members.id))
    .where(
      and(
        gte(timeBlockMembers.bookingDate, startDate),
        lte(timeBlockMembers.bookingDate, endDate),
      ),
    );

  // 2. Fetch guest bookings
  const guestBookings = await db
    .select({
      bookingDate: timeBlockGuests.bookingDate,
      bookingTime: timeBlockGuests.bookingTime,
      guestId: timeBlockGuests.guestId,
    })
    .from(timeBlockGuests)
    .where(
      and(
        gte(timeBlockGuests.bookingDate, startDate),
        lte(timeBlockGuests.bookingDate, endDate),
      ),
    );

  // 3. Fetch member classes for distribution
  const memberClassData = await db
    .select({
      id: memberClasses.id,
      className: memberClasses.label,
    })
    .from(memberClasses)
    .where(eq(memberClasses.isActive, true));

  // 3b. Fetch all members to count by class
  const allMembers = await db
    .select({
      classId: members.classId,
    })
    .from(members);

  // 4. Fetch cart charges
  const cartCharges = await db
    .select()
    .from(powerCartCharges)
    .where(
      and(
        gte(powerCartCharges.date, startDate),
        lte(powerCartCharges.date, endDate),
      ),
    );

  // 5. Fetch event registrations count
  const eventRegs = await db
    .select({ count: count() })
    .from(eventRegistrations)
    .where(
      and(
        gte(eventRegistrations.createdAt, new Date(startDate)),
        lte(eventRegistrations.createdAt, new Date(endDate)),
      ),
    );

  // 6. Fetch pace of play data
  const paceData = await db
    .select({
      expectedFinishTime: paceOfPlay.expectedFinishTime,
      finishTime: paceOfPlay.finishTime,
      startTime: paceOfPlay.startTime,
      expectedStartTime: paceOfPlay.expectedStartTime,
    })
    .from(paceOfPlay)
    .where(
      and(
        gte(paceOfPlay.expectedStartTime, new Date(startDate)),
        lte(paceOfPlay.expectedStartTime, new Date(endDate)),
      ),
    );

  // 7. Aggregate data
  const summary = calculateSummary(
    memberBookings,
    guestBookings,
    cartCharges,
    eventRegs[0]?.count ?? 0,
    paceData,
  );
  const roundsOverTime = aggregateRoundsByDate(memberBookings, guestBookings);
  const topPlayers = getTopPlayers(memberBookings);
  const memberClassDistribution = aggregateMembersByClass(
    allMembers,
    memberClassData,
  );
  const powerCartUsageData = aggregateCartUsage(cartCharges);
  const bookingsByDayOfWeek = aggregateBookingsByDay(
    memberBookings,
    guestBookings,
  );
  const bookingsBySlot = aggregateBookingsBySlot(memberBookings, guestBookings);
  const paceOfPlayTrend = aggregatePaceOfPlay(paceData);

  return {
    summary,
    roundsOverTime,
    topPlayers,
    memberClassDistribution,
    paceOfPlayTrend,
    powerCartUsage: powerCartUsageData,
    bookingsBySlot,
    bookingsByDayOfWeek,
  };
}

async function getMemberStatisticsData(
  memberId: number,
  startDate: string,
  endDate: string,
): Promise<StatisticsData> {
  // Fetch member-specific bookings
  const memberBookings = await db
    .select({
      bookingDate: timeBlockMembers.bookingDate,
      bookingTime: timeBlockMembers.bookingTime,
      memberId: timeBlockMembers.memberId,
      classId: members.classId,
      firstName: members.firstName,
      lastName: members.lastName,
    })
    .from(timeBlockMembers)
    .leftJoin(members, eq(timeBlockMembers.memberId, members.id))
    .where(
      and(
        eq(timeBlockMembers.memberId, memberId),
        gte(timeBlockMembers.bookingDate, startDate),
        lte(timeBlockMembers.bookingDate, endDate),
      ),
    );

  // Fetch guest bookings invited by this member
  const guestBookings = await db
    .select({
      bookingDate: timeBlockGuests.bookingDate,
      bookingTime: timeBlockGuests.bookingTime,
      guestId: timeBlockGuests.guestId,
    })
    .from(timeBlockGuests)
    .where(
      and(
        eq(timeBlockGuests.invitedByMemberId, memberId),
        gte(timeBlockGuests.bookingDate, startDate),
        lte(timeBlockGuests.bookingDate, endDate),
      ),
    );

  // Fetch member's cart charges
  const cartCharges = await db
    .select()
    .from(powerCartCharges)
    .where(
      and(
        eq(powerCartCharges.memberId, memberId),
        gte(powerCartCharges.date, startDate),
        lte(powerCartCharges.date, endDate),
      ),
    );

  // Fetch member's event registrations
  const eventRegs = await db
    .select({ count: count() })
    .from(eventRegistrations)
    .where(
      and(
        eq(eventRegistrations.memberId, memberId),
        gte(eventRegistrations.createdAt, new Date(startDate)),
        lte(eventRegistrations.createdAt, new Date(endDate)),
      ),
    );

  // Fetch member's lottery entries (as organizer)
  const lotteryEntriesAsOrganizer = await db
    .select({ count: count() })
    .from(lotteryEntries)
    .where(
      and(
        eq(lotteryEntries.organizerId, memberId),
        gte(lotteryEntries.lotteryDate, startDate),
        lte(lotteryEntries.lotteryDate, endDate),
      ),
    );

  // Fetch member's lottery entries (as group member, not organizer)
  const allLotteryEntries = await db
    .select()
    .from(lotteryEntries)
    .where(
      and(
        gte(lotteryEntries.lotteryDate, startDate),
        lte(lotteryEntries.lotteryDate, endDate),
      ),
    );

  const lotteryEntriesAsGroupMember = allLotteryEntries.filter(
    (entry) =>
      entry.memberIds.includes(memberId) &&
      entry.organizerId !== memberId &&
      entry.memberIds.length > 1,
  ).length;

  // Calculate most preferred window from lottery entries
  const memberLotteryEntries = allLotteryEntries.filter(
    (entry) =>
      entry.organizerId === memberId || entry.memberIds.includes(memberId),
  );
  const windowCounts: Record<string, number> = {};
  memberLotteryEntries.forEach((entry) => {
    const window = entry.preferredWindow;
    windowCounts[window] = (windowCounts[window] || 0) + 1;
  });
  const mostPreferredWindow =
    Object.keys(windowCounts).length > 0
      ? Object.entries(windowCounts).reduce((a, b) =>
          a[1]! > b[1]! ? a : b,
        )[0]
      : null;

  // Calculate power cart breakdown
  const powerCartSolo = cartCharges.filter(
    (c) => !c.isSplit && !c.splitWithMemberId,
  ).length;
  const powerCartSplit = cartCharges.filter(
    (c) => c.isSplit || c.splitWithMemberId !== null,
  ).length;
  const powerCart9Holes = cartCharges.filter((c) => c.numHoles === 9).length;
  const powerCart18Holes = cartCharges.filter((c) => c.numHoles === 18).length;

  // Fetch member's pace of play data (join through timeBlocks)
  const paceData = await db
    .select({
      expectedFinishTime: paceOfPlay.expectedFinishTime,
      finishTime: paceOfPlay.finishTime,
      startTime: paceOfPlay.startTime,
      expectedStartTime: paceOfPlay.expectedStartTime,
    })
    .from(paceOfPlay)
    .innerJoin(timeBlocks, eq(paceOfPlay.timeBlockId, timeBlocks.id))
    .innerJoin(teesheets, eq(timeBlocks.teesheetId, teesheets.id))
    .innerJoin(
      timeBlockMembers,
      eq(timeBlocks.id, timeBlockMembers.timeBlockId),
    )
    .where(
      and(
        eq(timeBlockMembers.memberId, memberId),
        gte(teesheets.date, startDate),
        lte(teesheets.date, endDate),
      ),
    );

  // Calculate average round duration from pace data
  const completedRounds = paceData.filter((p) => p.startTime && p.finishTime);
  let avgRoundDuration = 240; // default
  if (completedRounds.length > 0) {
    const totalMinutes = completedRounds.reduce((sum, p) => {
      const duration =
        (p.finishTime!.getTime() - p.startTime!.getTime()) / (1000 * 60);
      return sum + duration;
    }, 0);
    avgRoundDuration = Math.round(totalMinutes / completedRounds.length);
  }

  const summary: StatisticsSummary = {
    totalRounds: memberBookings.length,
    activeMemberCount: 1,
    avgRoundDuration,
    guestRounds: guestBookings.length,
    powerCartRentals: cartCharges.length,
    eventRegistrations: eventRegs[0]?.count ?? 0,
    lotteryEntriesAsOrganizer: lotteryEntriesAsOrganizer[0]?.count ?? 0,
    lotteryEntriesAsGroupMember,
    lotteryMostPreferredWindow: mostPreferredWindow,
    powerCartSolo,
    powerCartSplit,
    powerCart9Holes,
    powerCart18Holes,
  };

  const roundsOverTime = aggregateRoundsByDate(memberBookings, guestBookings);
  const bookingsBySlot = aggregateBookingsBySlot(memberBookings, guestBookings);
  const paceOfPlayTrend = aggregatePaceOfPlay(paceData);

  return {
    summary,
    roundsOverTime,
    topPlayers: [],
    memberClassDistribution: [],
    paceOfPlayTrend,
    powerCartUsage: aggregateCartUsage(cartCharges),
    bookingsBySlot,
    bookingsByDayOfWeek: aggregateBookingsByDay(memberBookings, guestBookings),
  };
}

// Helper aggregation functions
function calculateSummary(
  memberBookings: Array<{ memberId: number | null }>,
  guestBookings: unknown[],
  cartCharges: unknown[],
  eventRegistrationsCount: number,
  paceData: Array<{
    expectedFinishTime: Date;
    finishTime: Date | null;
    startTime: Date | null;
    expectedStartTime: Date;
  }>,
): StatisticsSummary {
  const totalRounds = memberBookings.length + guestBookings.length;
  const uniqueMembers = new Set(
    memberBookings.filter((b) => b.memberId).map((b) => b.memberId),
  );
  const activeMemberCount = uniqueMembers.size;

  // Calculate average round duration from pace data
  let avgRoundDuration = 240; // default
  const completedRounds = paceData.filter((p) => p.startTime && p.finishTime);
  if (completedRounds.length > 0) {
    const totalMinutes = completedRounds.reduce((sum, p) => {
      const duration =
        (p.finishTime!.getTime() - p.startTime!.getTime()) / (1000 * 60);
      return sum + duration;
    }, 0);
    avgRoundDuration = Math.round(totalMinutes / completedRounds.length);
  }

  return {
    totalRounds,
    activeMemberCount,
    avgRoundDuration,
    guestRounds: guestBookings.length,
    powerCartRentals: cartCharges.length,
    eventRegistrations: eventRegistrationsCount,
    lotteryEntriesAsOrganizer: 0,
    lotteryEntriesAsGroupMember: 0,
    lotteryMostPreferredWindow: null,
    powerCartSolo: 0,
    powerCartSplit: 0,
    powerCart9Holes: 0,
    powerCart18Holes: 0,
  };
}

function aggregateRoundsByDate(
  memberBookings: Array<{ bookingDate: string }>,
  guestBookings: Array<{ bookingDate: string }>,
): RoundsOverTime[] {
  const byDate: Record<
    string,
    { date: string; memberRounds: number; guestRounds: number }
  > = {};

  memberBookings.forEach((b) => {
    if (!byDate[b.bookingDate]) {
      byDate[b.bookingDate] = {
        date: b.bookingDate,
        memberRounds: 0,
        guestRounds: 0,
      };
    }
    byDate[b.bookingDate]!.memberRounds++;
  });

  guestBookings.forEach((b) => {
    if (!byDate[b.bookingDate]) {
      byDate[b.bookingDate] = {
        date: b.bookingDate,
        memberRounds: 0,
        guestRounds: 0,
      };
    }
    byDate[b.bookingDate]!.guestRounds++;
  });

  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

function getTopPlayers(
  memberBookings: Array<{
    memberId: number | null;
    firstName: string | null;
    lastName: string | null;
  }>,
): TopPlayer[] {
  const roundsByMember: Record<
    number,
    { memberId: number; memberName: string; roundsPlayed: number }
  > = {};

  memberBookings
    .filter((b) => b.memberId && b.firstName && b.lastName)
    .forEach((b) => {
      const key = b.memberId!;
      if (!roundsByMember[key]) {
        roundsByMember[key] = {
          memberId: b.memberId!,
          memberName: `${b.firstName} ${b.lastName}`,
          roundsPlayed: 0,
        };
      }
      roundsByMember[key]!.roundsPlayed++;
    });

  return Object.values(roundsByMember)
    .sort((a, b) => b.roundsPlayed - a.roundsPlayed)
    .slice(0, 10);
}

function aggregateMembersByClass(
  allMembers: Array<{ classId: number | null }>,
  memberClassData: Array<{ id: number; className: string }>,
): MemberClassDistribution[] {
  // Initialize distribution with all classes
  const distribution: Record<number, { className: string; count: number }> = {};
  memberClassData.forEach((mc) => {
    distribution[mc.id] = {
      className: mc.className,
      count: 0,
    };
  });

  // Count all members by class
  allMembers
    .filter((m) => m.classId)
    .forEach((m) => {
      if (distribution[m.classId!]) {
        distribution[m.classId!]!.count++;
      }
    });

  return Object.values(distribution);
}

function aggregateCartUsage(
  cartCharges: Array<{
    numHoles: number;
    isSplit: boolean;
    splitWithMemberId: number | null;
  }>,
): PowerCartUsage {
  const usage = {
    solo9: 0,
    solo18: 0,
    split9: 0,
    split18: 0,
  };

  cartCharges.forEach((c) => {
    const isSplit = c.isSplit || c.splitWithMemberId !== null;
    if (c.numHoles === 9) {
      if (isSplit) {
        usage.split9++;
      } else {
        usage.solo9++;
      }
    } else if (c.numHoles === 18) {
      if (isSplit) {
        usage.split18++;
      } else {
        usage.solo18++;
      }
    }
  });

  return usage;
}

function aggregateBookingsByDay(
  memberBookings: Array<{ bookingDate: string }>,
  guestBookings: Array<{ bookingDate: string }>,
): BookingsByDayOfWeek[] {
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const counts = days.map((day) => ({ day, count: 0 }));

  [...memberBookings, ...guestBookings].forEach((b) => {
    const dayIndex = new Date(b.bookingDate).getDay();
    counts[dayIndex]!.count++;
  });

  return counts;
}

function aggregateBookingsBySlot(
  memberBookings: Array<{ bookingTime: string }>,
  guestBookings: Array<{ bookingTime: string }>,
): BookingsBySlot[] {
  const bySlot: Record<string, number> = {};

  [...memberBookings, ...guestBookings].forEach((b) => {
    if (!bySlot[b.bookingTime]) {
      bySlot[b.bookingTime] = 0;
    }
    bySlot[b.bookingTime]!++;
  });

  return Object.entries(bySlot)
    .map(([slot, count]) => ({ slot, count }))
    .sort((a, b) => a.slot.localeCompare(b.slot));
}

function aggregatePaceOfPlay(
  paceData: Array<{
    expectedFinishTime: Date;
    finishTime: Date | null;
    startTime: Date | null;
    expectedStartTime: Date;
  }>,
): PaceOfPlayTrend[] {
  // Group by date
  const byDate: Record<
    string,
    { totalMinutes: number; count: number; onTimeCount: number }
  > = {};

  paceData
    .filter((p) => p.startTime && p.finishTime)
    .forEach((p) => {
      const date = p.expectedStartTime.toISOString().split("T")[0]!;
      const duration =
        (p.finishTime!.getTime() - p.startTime!.getTime()) / (1000 * 60);
      const expectedDuration =
        (p.expectedFinishTime.getTime() - p.expectedStartTime.getTime()) /
        (1000 * 60);
      const isOnTime = duration <= expectedDuration + 15; // 15 min grace

      if (!byDate[date]) {
        byDate[date] = { totalMinutes: 0, count: 0, onTimeCount: 0 };
      }
      byDate[date]!.totalMinutes += duration;
      byDate[date]!.count++;
      if (isOnTime) {
        byDate[date]!.onTimeCount++;
      }
    });

  return Object.entries(byDate)
    .map(([date, data]) => ({
      date,
      avgMinutes: Math.round(data.totalMinutes / data.count),
      onTimePercentage: Math.round((data.onTimeCount / data.count) * 100),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getMemberById(id: number) {
  // Fetch basic member info for display in member lookup tab
  const member = await db.query.members.findFirst({
    where: (members, { eq }) => eq(members.id, id),
    columns: {
      id: true,
      firstName: true,
      lastName: true,
      memberNumber: true,
    },
  });

  return member;
}
