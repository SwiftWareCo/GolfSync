import "server-only";
import { db } from "~/server/db";
import {
  memberSpeedProfiles,
  memberFairnessScores,
  members,
} from "~/server/db/schema";
import { eq, sql, desc, and } from "drizzle-orm";

export interface MemberProfile {
  id: number;
  memberId: number;
  memberName: string;
  memberNumber: string;
  memberClass: string;
  // Speed profile data
  averageMinutes: number | null;
  speedTier: "FAST" | "AVERAGE" | "SLOW";
  adminPriorityAdjustment: number;
  manualOverride: boolean;
  lastCalculated: Date | null;
  notes: string | null;
  // Fairness score data (flattened)
  fairnessCurrentMonth: string | null;
  fairnessTotalEntriesMonth: number;
  fairnessPreferencesGrantedMonth: number;
  fairnessPreferenceFulfillmentRate: number;
  fairnessDaysWithoutGoodTime: number;
  fairnessScore: number;
  fairnessLastUpdated: Date | null;
}

export interface MemberProfileStats {
  totalMembers: number;
  speedTiers: {
    fast: number;
    average: number;
    slow: number;
  };
  fairnessScores: {
    highPriority: number; // fairness score > 20
    mediumPriority: number; // fairness score 10-20
    lowPriority: number; // fairness score < 10
    averageFulfillmentRate: number;
  };
  adminAdjustments: {
    positive: number;
    negative: number;
    neutral: number;
  };
}

/**
 * Get all member profiles with both speed and fairness data
 */
export async function getMemberProfilesWithFairness(): Promise<
  MemberProfile[]
> {
  const currentMonth = new Date().toISOString().slice(0, 7); // "2025-01"

  const profiles = await db
    .select({
      id: members.id,
      memberId: members.id,
      memberName: sql<string>`${members.firstName} || ' ' || ${members.lastName}`,
      memberNumber: members.memberNumber,
      memberClass: members.class,
      // Speed profile data
      averageMinutes: memberSpeedProfiles.averageMinutes,
      speedTier: memberSpeedProfiles.speedTier,
      adminPriorityAdjustment: memberSpeedProfiles.adminPriorityAdjustment,
      manualOverride: memberSpeedProfiles.manualOverride,
      lastCalculated: memberSpeedProfiles.lastCalculated,
      notes: memberSpeedProfiles.notes,
      // Fairness score data (flattened)
      fairnessCurrentMonth: memberFairnessScores.currentMonth,
      fairnessTotalEntriesMonth: memberFairnessScores.totalEntriesMonth,
      fairnessPreferencesGrantedMonth:
        memberFairnessScores.preferencesGrantedMonth,
      fairnessPreferenceFulfillmentRate:
        memberFairnessScores.preferenceFulfillmentRate,
      fairnessDaysWithoutGoodTime: memberFairnessScores.daysWithoutGoodTime,
      fairnessScore: memberFairnessScores.fairnessScore,
      fairnessLastUpdated: memberFairnessScores.lastUpdated,
    })
    .from(members)
    .leftJoin(
      memberSpeedProfiles,
      eq(members.id, memberSpeedProfiles.memberId),
    )
    .leftJoin(
      memberFairnessScores,
      and(
        eq(members.id, memberFairnessScores.memberId),
        eq(memberFairnessScores.currentMonth, currentMonth),
      ),
    )
    .orderBy(
      desc(memberSpeedProfiles.adminPriorityAdjustment),
      desc(memberFairnessScores.fairnessScore),
      members.lastName,
    );

  // Type assertion needed because drizzle doesn't know about SQL concatenation
  return profiles as MemberProfile[];
}

/**
 * Get combined statistics for member profiles
 */
export async function getMemberProfileStats(): Promise<MemberProfileStats> {
  const currentMonth = new Date().toISOString().slice(0, 7);

  // Get speed tier counts
  const speedStats = await db
    .select({
      speedTier: memberSpeedProfiles.speedTier,
      count: sql<number>`count(*)::int`,
    })
    .from(memberSpeedProfiles)
    .groupBy(memberSpeedProfiles.speedTier);

  // Get fairness score stats
  const fairnessStats = await db
    .select({
      highPriority: sql<number>`count(case when fairness_score > 20 then 1 end)::int`,
      mediumPriority: sql<number>`count(case when fairness_score between 10 and 20 then 1 end)::int`,
      lowPriority: sql<number>`count(case when fairness_score < 10 then 1 end)::int`,
      avgFulfillment: sql<number>`avg(preference_fulfillment_rate)`,
    })
    .from(memberFairnessScores)
    .where(eq(memberFairnessScores.currentMonth, currentMonth));

  // Get admin adjustment stats
  const adminStats = await db
    .select({
      positive: sql<number>`count(case when admin_priority_adjustment > 0 then 1 end)::int`,
      negative: sql<number>`count(case when admin_priority_adjustment < 0 then 1 end)::int`,
      neutral: sql<number>`count(case when admin_priority_adjustment = 0 then 1 end)::int`,
    })
    .from(memberSpeedProfiles);

  // Get total member count
  const totalMembers = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(members);

  const speedTierCounts = {
    fast: 0,
    average: 0,
    slow: 0,
  };

  if (speedStats && Array.isArray(speedStats)) {
    speedStats.forEach((stat) => {
      if (!stat || !stat.speedTier) return;
      switch (stat.speedTier) {
        case "FAST":
          speedTierCounts.fast = stat.count ?? 0;
          break;
        case "AVERAGE":
          speedTierCounts.average = stat.count ?? 0;
          break;
        case "SLOW":
          speedTierCounts.slow = stat.count ?? 0;
          break;
      }
    });
  }

  const fairnessData = fairnessStats[0];
  const adminData = adminStats[0];

  return {
    totalMembers: totalMembers[0]?.count ?? 0,
    speedTiers: speedTierCounts,
    fairnessScores: {
      highPriority: fairnessData?.highPriority ?? 0,
      mediumPriority: fairnessData?.mediumPriority ?? 0,
      lowPriority: fairnessData?.lowPriority ?? 0,
      averageFulfillmentRate: fairnessData?.avgFulfillment ?? 0,
    },
    adminAdjustments: {
      positive: adminData?.positive ?? 0,
      negative: adminData?.negative ?? 0,
      neutral: adminData?.neutral ?? 0,
    },
  };
}
