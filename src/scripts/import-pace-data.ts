#!/usr/bin/env tsx

import { eq } from "drizzle-orm";
import fs from "fs";
import csv from "csv-parser";
import path from "path";
import { db } from "../server/db";
import {
  memberSpeedProfiles,
  members,
  lotteryAlgorithmConfig,
} from "../server/db/schema";

// Default thresholds if no config exists
const DEFAULT_FAST_THRESHOLD = 235;
const DEFAULT_AVERAGE_THRESHOLD = 245;

// Inline getAlgorithmConfig to avoid server-only import
async function getAlgorithmConfig() {
  const config = await db.query.lotteryAlgorithmConfig.findFirst({
    where: eq(lotteryAlgorithmConfig.id, 1),
  });

  return {
    fastThresholdMinutes:
      config?.fastThresholdMinutes ?? DEFAULT_FAST_THRESHOLD,
    averageThresholdMinutes:
      config?.averageThresholdMinutes ?? DEFAULT_AVERAGE_THRESHOLD,
  };
}

// Constants for validation
const MIN_ROUND_MINUTES = 180; // 3 hours
const MAX_ROUND_MINUTES = 360; // 6 hours

// Get CSV path from command line argument or use default
const CSV_PATH = process.argv[2] || "csvdata/pace_of_play.csv";

interface CSVRow {
  "Res. Date": string;
  "Res. Time": string;
  "Start Time": string;
  "Turn Time": string;
  "Finish Time": string;
  "Total Round Time": string;
  "Player 1": string;
  "Player 2": string;
  "Player 3": string;
  "Player 4": string;
}

interface RoundData {
  date: string;
  reservationTime: string;
  totalMinutes: number;
  players: string[];
}

// Build name lookup directly from database
async function buildNameLookupFromDB(): Promise<Map<string, number>> {
  console.log("📋 Loading members from database...");
  const allMembers = await db.query.members.findMany({
    columns: { id: true, firstName: true, lastName: true },
  });

  const lookup = new Map<string, number>();

  for (const member of allMembers) {
    // Create variations of the name for matching
    const fullName = `${member.firstName} ${member.lastName}`.toLowerCase();
    const reverseName = `${member.lastName} ${member.firstName}`.toLowerCase();

    lookup.set(fullName, member.id);
    lookup.set(reverseName, member.id);

    // Also try with middle names removed (common in CSV: "John A Smith" -> "John Smith")
    const firstNameOnly = member.firstName.split(" ")[0]?.toLowerCase() || "";
    const simpleFullName = `${firstNameOnly} ${member.lastName.toLowerCase()}`;
    if (!lookup.has(simpleFullName)) {
      lookup.set(simpleFullName, member.id);
    }
  }

  console.log(
    `   ✅ Loaded ${allMembers.length} members, created ${lookup.size} name variations`,
  );
  return lookup;
}

// Parse total round time like "3:40" to minutes
function parseTotalRoundTime(totalTime: string): number | null {
  if (!totalTime || totalTime === "N/A") return null;

  const parts = totalTime.split(":");
  const hours = parts[0];
  const minutes = parts[1];
  if (hours && minutes) {
    return parseInt(hours) * 60 + parseInt(minutes);
  }
  return null;
}

// Parse time like "10:30 AM" to minutes since midnight
function parseTimeToMinutes(timeStr: string): number | null {
  if (!timeStr || timeStr === "N/A") return null;

  const timeMatch = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!timeMatch || timeMatch.length < 4) return null;

  const hoursStr = timeMatch[1];
  const minutesStr = timeMatch[2];
  const periodStr = timeMatch[3];

  if (!hoursStr || !minutesStr || !periodStr) return null;

  let hours = parseInt(hoursStr);
  const minutes = parseInt(minutesStr);
  const period = periodStr.toUpperCase();

  // Convert to 24-hour format
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

// Calculate duration between start and finish times
function calculateActualDuration(
  startTime: string,
  finishTime: string,
): number | null {
  const startMinutes = parseTimeToMinutes(startTime);
  const finishMinutes = parseTimeToMinutes(finishTime);

  if (startMinutes === null || finishMinutes === null) return null;

  let duration = finishMinutes - startMinutes;

  // Handle overnight rounds (very rare but possible)
  if (duration < 0) {
    duration += 24 * 60; // Add 24 hours
  }

  return duration;
}

// Validate if a round time is realistic for 18 holes
function isRealisticRoundTime(minutes: number): boolean {
  return minutes >= MIN_ROUND_MINUTES && minutes <= MAX_ROUND_MINUTES;
}

// Format date from CSV to YYYY-MM-DD
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const isoString = date.toISOString();
  const parts = isoString.split("T");
  return parts[0]!;
}

// Parse CSV and extract round data
async function parseCSVRounds(): Promise<RoundData[]> {
  return new Promise((resolve, reject) => {
    const rounds: RoundData[] = [];
    const csvPath = path.join(process.cwd(), CSV_PATH);

    console.log(`   📁 Reading from: ${csvPath}`);

    if (!fs.existsSync(csvPath)) {
      reject(new Error(`CSV file not found at: ${csvPath}`));
      return;
    }

    fs.createReadStream(csvPath)
      .pipe(csv())
      .on("data", (row: CSVRow) => {
        try {
          const players = [
            row["Player 1"],
            row["Player 2"],
            row["Player 3"],
            row["Player 4"],
          ].filter((p) => p && p.trim() !== "");

          if (players.length === 0) return;

          // Try to calculate actual duration from start and finish times first
          let actualDuration: number | null = null;
          if (row["Start Time"] && row["Finish Time"]) {
            actualDuration = calculateActualDuration(
              row["Start Time"],
              row["Finish Time"],
            );
          }

          // Fall back to "Total Round Time" if actual calculation fails
          if (!actualDuration) {
            actualDuration = parseTotalRoundTime(row["Total Round Time"]);
          }

          // Only process rounds with realistic time data
          if (!actualDuration || !isRealisticRoundTime(actualDuration)) {
            // console.log(
            //   `⚠️  Skipping unrealistic round: ${actualDuration}min for ${players[0]} on ${row["Res. Date"]}`,
            // );
            return;
          }

          rounds.push({
            date: formatDate(row["Res. Date"]),
            reservationTime: row["Res. Time"],
            totalMinutes: actualDuration,
            players,
          });
        } catch (error) {
          console.warn(`Error parsing row:`, row, error);
        }
      })
      .on("end", () => {
        console.log(`✅ Parsed ${rounds.length} valid rounds from CSV`);
        resolve(rounds);
      })
      .on("error", reject);
  });
}

// Calculate average pace for each member
function calculateMemberAverages(
  rounds: RoundData[],
  nameLookup: Map<string, number>,
): Map<number, { totalTime: number; roundCount: number }> {
  const memberStats = new Map<
    number,
    { totalTime: number; roundCount: number }
  >();
  const unmatchedNames = new Set<string>();

  for (const round of rounds) {
    for (const playerName of round.players) {
      // Normalize name to lowercase for matching
      const normalizedName = playerName.toLowerCase().trim();
      const memberId = nameLookup.get(normalizedName);

      if (memberId) {
        const current = memberStats.get(memberId) || {
          totalTime: 0,
          roundCount: 0,
        };
        current.totalTime += round.totalMinutes;
        current.roundCount += 1;
        memberStats.set(memberId, current);
      } else {
        unmatchedNames.add(playerName);
      }
    }
  }

  if (unmatchedNames.size > 0) {
    console.log(`   ⚠️  ${unmatchedNames.size} unique names not matched:`);
    // Show first 10 unmatched
    const sample = Array.from(unmatchedNames).slice(0, 10);
    sample.forEach((name) => console.log(`      - ${name}`));
    if (unmatchedNames.size > 10) {
      console.log(`      ... and ${unmatchedNames.size - 10} more`);
    }
  }

  return memberStats;
}

// Create or update member speed profiles
async function updateMemberSpeedProfiles(
  memberStats: Map<number, { totalTime: number; roundCount: number }>,
) {
  console.log("\n🏃 Creating member speed profiles...");

  // Get algorithm config for thresholds
  const config = await getAlgorithmConfig();
  console.log(
    `   ⚙️  Using thresholds: Fast <= ${config.fastThresholdMinutes}m, Average <= ${config.averageThresholdMinutes}m`,
  );

  let created = 0;
  let updated = 0;

  for (const [memberId, stats] of memberStats) {
    const averageMinutes = Math.round(stats.totalTime / stats.roundCount);

    // Determine speed tier based on config thresholds
    let speedTier: "FAST" | "AVERAGE" | "SLOW" = "AVERAGE";
    if (averageMinutes <= config.fastThresholdMinutes) {
      speedTier = "FAST";
    } else if (averageMinutes <= config.averageThresholdMinutes) {
      speedTier = "AVERAGE";
    } else {
      speedTier = "SLOW";
    }

    // Check if profile already exists
    const existing = await db.query.memberSpeedProfiles.findFirst({
      where: eq(memberSpeedProfiles.memberId, memberId),
    });

    if (existing) {
      // Update existing profile - use cumulative data
      await db
        .update(memberSpeedProfiles)
        .set({
          averageMinutes,
          totalMinutes: stats.totalTime,
          roundCount: stats.roundCount,
          hasData: true,
          speedTier,
          lastCalculated: new Date(),
          notes: `Imported from CSV - ${stats.roundCount} rounds`,
        })
        .where(eq(memberSpeedProfiles.memberId, memberId));
      updated++;
    } else {
      // Create new profile
      await db.insert(memberSpeedProfiles).values({
        memberId,
        averageMinutes,
        totalMinutes: stats.totalTime,
        roundCount: stats.roundCount,
        hasData: true,
        speedTier,
        lastCalculated: new Date(),
        notes: `Imported from CSV - ${stats.roundCount} rounds`,
      });
      created++;
    }
  }

  console.log(`\n✅ Speed profiles: ${created} created, ${updated} updated`);
}

// Main import function
async function importPaceData() {
  try {
    console.log("🏌️  Starting pace data import...\n");
    console.log(`   Using CSV: ${CSV_PATH}\n`);

    // Build name lookup directly from database
    const nameLookup = await buildNameLookupFromDB();

    // Parse CSV rounds
    console.log("\n📖 Parsing CSV data...");
    const rounds = await parseCSVRounds();

    // Calculate member averages
    console.log("🧮 Calculating member averages...");
    const memberStats = calculateMemberAverages(rounds, nameLookup);

    console.log(`   📊 Found pace data for ${memberStats.size} members`);

    // Update speed profiles
    await updateMemberSpeedProfiles(memberStats);

    // Summary report
    console.log("\n📊 IMPORT SUMMARY:");
    console.log(`   ✅ Processed ${rounds.length} rounds`);
    console.log(`   🏃 Created speed profiles for ${memberStats.size} members`);
  } catch (error) {
    console.error("❌ Import failed:", error);
    process.exit(1);
  }
}

// Run the import
if (
  import.meta.url.endsWith(process.argv[1]!) ||
  process.argv[1]?.endsWith("import-pace-data.ts")
) {
  importPaceData();
}
