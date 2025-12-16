// Statistics data types and mock data generator for development

export interface StatisticsSummary {
  totalRounds: number;
  activeMemberCount: number;
  avgRoundDuration: number; // in minutes
  guestRounds: number;
  powerCartRentals: number;
  eventRegistrations: number;
  lotteryEntriesAsOrganizer: number;
  lotteryEntriesAsGroupMember: number;
  lotteryMostPreferredWindow: string | null;
  powerCartSolo: number;
  powerCartSplit: number;
  powerCart9Holes: number;
  powerCart18Holes: number;
}

export interface RoundsOverTime {
  date: string;
  memberRounds: number;
  guestRounds: number;
}

export interface BookingsBySlot {
  slot: string;
  count: number;
}

export interface BookingsByDayOfWeek {
  day: string;
  count: number;
}

export interface MemberClassDistribution {
  className: string;
  count: number;
}

export interface PaceOfPlayTrend {
  date: string;
  avgMinutes: number;
  onTimePercentage: number;
}

export interface PowerCartUsage {
  solo9: number;
  solo18: number;
  split9: number;
  split18: number;
}

export interface TopPlayer {
  memberId: number;
  memberName: string;
  roundsPlayed: number;
}

export interface StatisticsData {
  summary: StatisticsSummary;
  roundsOverTime: RoundsOverTime[];
  bookingsBySlot: BookingsBySlot[];
  bookingsByDayOfWeek: BookingsByDayOfWeek[];
  memberClassDistribution: MemberClassDistribution[];
  paceOfPlayTrend: PaceOfPlayTrend[];
  powerCartUsage: PowerCartUsage;
  topPlayers: TopPlayer[];
}

export interface StatisticsFilters {
  memberId?: number;
  startDate: string;
  endDate: string;
}

// Seeded random number generator for reproducible mock data
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Generate dates between start and end
function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    dates.push(current.toISOString().split("T")[0]!);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Generate mock statistics data for development
 * Matches the same shape as real data from getStatisticsData
 */
export function generateMockStatisticsData(
  filters: StatisticsFilters,
): StatisticsData {
  // Use a combination of dates to create a consistent seed
  const seed =
    filters.startDate.charCodeAt(0) +
    filters.endDate.charCodeAt(0) +
    (filters.memberId || 0);

  const dates = generateDateRange(filters.startDate, filters.endDate);
  const dayCount = dates.length;

  // Generate rounds over time
  const roundsOverTime: RoundsOverTime[] = dates.map((date, i) => {
    const baseMemberRounds = 20 + Math.floor(seededRandom(seed + i) * 30);
    const baseGuestRounds = 2 + Math.floor(seededRandom(seed + i + 1000) * 8);
    // Add weekend boost
    const dayOfWeek = new Date(date).getDay();
    const weekendBoost = dayOfWeek === 0 || dayOfWeek === 6 ? 1.5 : 1;

    return {
      date,
      memberRounds: filters.memberId
        ? Math.floor(seededRandom(seed + i * 2) * 2)
        : Math.floor(baseMemberRounds * weekendBoost),
      guestRounds: filters.memberId
        ? Math.floor(seededRandom(seed + i * 3) * 1)
        : Math.floor(baseGuestRounds * weekendBoost),
    };
  });

  // Calculate totals from rounds over time
  const totalMemberRounds = roundsOverTime.reduce(
    (sum, r) => sum + r.memberRounds,
    0,
  );
  const totalGuestRounds = roundsOverTime.reduce(
    (sum, r) => sum + r.guestRounds,
    0,
  );

  // Generate bookings by slot
  const slots = [
    "06:00",
    "06:30",
    "07:00",
    "07:30",
    "08:00",
    "08:30",
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "12:00",
    "12:30",
    "13:00",
    "13:30",
    "14:00",
    "14:30",
    "15:00",
    "15:30",
    "16:00",
    "16:30",
  ];

  const bookingsBySlot: BookingsBySlot[] = slots.map((slot, i) => {
    // Peak times around 9am-11am
    const hour = parseInt(slot.split(":")[0]!);
    let baseCount = 50;
    if (hour >= 7 && hour <= 10) baseCount = 150;
    else if (hour >= 11 && hour <= 13) baseCount = 100;
    else if (hour >= 14 && hour <= 16) baseCount = 80;

    return {
      slot,
      count: Math.floor(baseCount * (0.7 + seededRandom(seed + i * 5) * 0.6)),
    };
  });

  // Generate bookings by day of week
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const bookingsByDayOfWeek: BookingsByDayOfWeek[] = days.map((day, i) => ({
    day,
    count: Math.floor(
      (i === 0 || i === 6 ? 180 : 120) *
        (0.8 + seededRandom(seed + i * 7) * 0.4),
    ),
  }));

  // Generate member class distribution
  const memberClasses = [
    "Full Member",
    "Associate Member",
    "Junior Member",
    "Senior Member",
    "Charter Member",
  ];
  const memberClassDistribution: MemberClassDistribution[] = memberClasses.map(
    (className, i) => ({
      className,
      count: Math.floor(
        [200, 150, 50, 180, 30][i]! * (0.8 + seededRandom(seed + i * 9) * 0.4),
      ),
    }),
  );

  // Generate pace of play trend
  const paceOfPlayTrend: PaceOfPlayTrend[] = dates
    .filter((_, i) => i % 7 === 0 || i === dates.length - 1) // Weekly data points
    .map((date, i) => ({
      date,
      avgMinutes: 240 + Math.floor(seededRandom(seed + i * 11) * 30 - 15), // 225-255 min
      onTimePercentage: 70 + Math.floor(seededRandom(seed + i * 13) * 25), // 70-95%
    }));

  // Generate power cart usage
  const powerCartUsage: PowerCartUsage = {
    solo9: Math.floor(dayCount * 3 * (0.8 + seededRandom(seed + 100) * 0.4)),
    solo18: Math.floor(dayCount * 5 * (0.8 + seededRandom(seed + 101) * 0.4)),
    split9: Math.floor(dayCount * 2 * (0.8 + seededRandom(seed + 102) * 0.4)),
    split18: Math.floor(dayCount * 4 * (0.8 + seededRandom(seed + 103) * 0.4)),
  };

  // Generate top players
  const firstNames = [
    "James",
    "Robert",
    "Michael",
    "David",
    "William",
    "Richard",
    "Joseph",
    "Thomas",
    "Charles",
    "Daniel",
  ];
  const lastNames = [
    "Smith",
    "Johnson",
    "Williams",
    "Brown",
    "Jones",
    "Garcia",
    "Miller",
    "Davis",
    "Rodriguez",
    "Martinez",
  ];

  const topPlayers: TopPlayer[] = Array.from({ length: 10 }, (_, i) => ({
    memberId: 100 + i,
    memberName: `${firstNames[Math.floor(seededRandom(seed + i * 15) * firstNames.length)]} ${lastNames[Math.floor(seededRandom(seed + i * 17) * lastNames.length)]}`,
    roundsPlayed: Math.floor(20 - i * 1.5 + seededRandom(seed + i * 19) * 5),
  })).sort((a, b) => b.roundsPlayed - a.roundsPlayed);

  // Calculate summary
  const summary: StatisticsSummary = {
    totalRounds: totalMemberRounds + totalGuestRounds,
    activeMemberCount: filters.memberId
      ? 1
      : Math.floor(
          memberClassDistribution.reduce((sum, c) => sum + c.count, 0) * 0.7,
        ),
    avgRoundDuration:
      paceOfPlayTrend.length > 0
        ? Math.floor(
            paceOfPlayTrend.reduce((sum, p) => sum + p.avgMinutes, 0) /
              paceOfPlayTrend.length,
          )
        : 240,
    guestRounds: totalGuestRounds,
    powerCartRentals:
      powerCartUsage.solo9 +
      powerCartUsage.solo18 +
      powerCartUsage.split9 +
      powerCartUsage.split18,
    eventRegistrations: Math.floor(
      dayCount * 0.5 * (0.8 + seededRandom(seed + 200) * 0.4),
    ),
    lotteryEntriesAsOrganizer: filters.memberId
      ? Math.floor(dayCount * 0.3 * (0.5 + seededRandom(seed + 300) * 0.5))
      : 0,
    lotteryEntriesAsGroupMember: filters.memberId
      ? Math.floor(dayCount * 0.2 * (0.3 + seededRandom(seed + 301) * 0.4))
      : 0,
    lotteryMostPreferredWindow: filters.memberId
      ? ["MORNING", "MIDDAY", "AFTERNOON", "EVENING"][
          Math.floor(seededRandom(seed + 303) * 4)
        ]!
      : null,
    powerCartSolo: filters.memberId
      ? Math.floor(
          (powerCartUsage.solo9 + powerCartUsage.solo18) *
            (0.8 + seededRandom(seed + 304) * 0.4),
        )
      : 0,
    powerCartSplit: filters.memberId
      ? Math.floor(
          (powerCartUsage.split9 + powerCartUsage.split18) *
            (0.8 + seededRandom(seed + 305) * 0.4),
        )
      : 0,
    powerCart9Holes: filters.memberId
      ? Math.floor(
          (powerCartUsage.solo9 + powerCartUsage.split9) *
            (0.8 + seededRandom(seed + 306) * 0.4),
        )
      : 0,
    powerCart18Holes: filters.memberId
      ? Math.floor(
          (powerCartUsage.solo18 + powerCartUsage.split18) *
            (0.8 + seededRandom(seed + 307) * 0.4),
        )
      : 0,
  };

  return {
    summary,
    roundsOverTime,
    bookingsBySlot,
    bookingsByDayOfWeek,
    memberClassDistribution,
    paceOfPlayTrend,
    powerCartUsage,
    topPlayers,
  };
}
