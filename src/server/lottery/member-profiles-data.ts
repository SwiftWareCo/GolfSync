import "server-only";
import { db } from "~/server/db";
import { memberFairnessScores, members } from "~/server/db/schema";
import { eq, desc } from "drizzle-orm";
import { format } from "date-fns";

/**
 * Get all member profiles with both speed and fairness data, plus aggregated statistics
 */
export async function getMemberProfilesWithFairness() {
  const currentMonth = format(new Date(), "yyyy-MM");

  const profiles = await db.query.members.findMany({
    with: {
      memberClass: true,
      memberSpeedProfile: true,
      memberFairnessScores: {
        where: eq(memberFairnessScores.currentMonth, currentMonth),
        limit: 1,
      },
    },
    orderBy: [desc(members.lastName)],
  });

  const transformed = profiles.map((profile) => ({
    ...profile,
    memberName: `${profile.firstName} ${profile.lastName}`,
    memberClassName: profile.memberClass?.label ?? "",
    memberSpeedProfile: profile.memberSpeedProfile ?? null,
    fairnessScore: profile.memberFairnessScores[0] ?? null,
  }));

  // Calculate stats from the same data (server-side for weak clients)
  const stats = {
    totalMembers: transformed.length,
    speedTiers: {
      fast: transformed.filter(
        (p) => p.memberSpeedProfile?.speedTier === "FAST"
      ).length,
      average: transformed.filter(
        (p) => p.memberSpeedProfile?.speedTier === "AVERAGE"
      ).length,
      slow: transformed.filter(
        (p) => p.memberSpeedProfile?.speedTier === "SLOW"
      ).length,
    },
    fairnessScores: {
      highPriority: transformed.filter(
        (p) => (p.fairnessScore?.fairnessScore ?? 0) > 20
      ).length,
      mediumPriority: transformed.filter((p) => {
        const score = p.fairnessScore?.fairnessScore ?? 0;
        return score >= 10 && score <= 20;
      }).length,
      lowPriority: transformed.filter(
        (p) => (p.fairnessScore?.fairnessScore ?? 0) < 10
      ).length,
      averageFulfillmentRate:
        transformed.length > 0
          ? transformed.reduce(
              (sum, p) =>
                sum + (p.fairnessScore?.preferenceFulfillmentRate ?? 0),
              0
            ) / transformed.length
          : 0,
    },
    adminAdjustments: {
      positive: transformed.filter(
        (p) => (p.memberSpeedProfile?.adminPriorityAdjustment ?? 0) > 0
      ).length,
      negative: transformed.filter(
        (p) => (p.memberSpeedProfile?.adminPriorityAdjustment ?? 0) < 0
      ).length,
      neutral: transformed.filter(
        (p) => (p.memberSpeedProfile?.adminPriorityAdjustment ?? 0) === 0
      ).length,
    },
  };

  return { profiles: transformed, stats };
}
