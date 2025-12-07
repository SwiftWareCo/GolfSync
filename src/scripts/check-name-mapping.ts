#!/usr/bin/env tsx
//@ts-nocheck
import { eq, and } from "drizzle-orm";
import fs from "fs";
import csv from "csv-parser";
import path from "path";
import { db } from "../server/db";
import { members } from "../server/db/schema";

interface CSVRow {
  "Player 1": string;
  "Player 2": string;
  "Player 3": string;
  "Player 4": string;
}

// Parse CSV and extract unique player names
async function extractPlayerNames(): Promise<Set<string>> {
  return new Promise((resolve, reject) => {
    const playerNames = new Set<string>();
    const csvPath = path.join(
      process.cwd(),
      "csvdata",
      "pace_of_play (34).csv",
    );

    if (!fs.existsSync(csvPath)) {
      reject(new Error(`CSV file not found at: ${csvPath}`));
      return;
    }

    fs.createReadStream(csvPath)
      .pipe(csv())
      .on("data", (row: CSVRow) => {
        [
          row["Player 1"],
          row["Player 2"],
          row["Player 3"],
          row["Player 4"],
        ].forEach((player) => {
          if (player && player.trim() !== "") {
            playerNames.add(player.trim());
          }
        });
      })
      .on("end", () => {
        console.log(`Found ${playerNames.size} unique player names in CSV`);
        resolve(playerNames);
      })
      .on("error", reject);
  });
}

// Get all members from database
async function getAllMembers() {
  return await db.query.members.findMany({
    columns: {
      id: true,
      firstName: true,
      lastName: true,
      memberNumber: true,
    },
    orderBy: (members, { asc }) => [
      asc(members.lastName),
      asc(members.firstName),
    ],
  });
}

// Try to match a CSV player name to a member
function findMemberMatch(playerName: string, members: any[]) {
  const trimmedName = playerName.trim();

  // Try exact match first: "FirstName LastName"
  const exactMatch = members.find(
    (member) => `${member.firstName} ${member.lastName}` === trimmedName,
  );

  if (exactMatch) return exactMatch;

  // Try case-insensitive match
  const caseInsensitiveMatch = members.find(
    (member) =>
      `${member.firstName} ${member.lastName}`.toLowerCase() ===
      trimmedName.toLowerCase(),
  );

  if (caseInsensitiveMatch)
    return { ...caseInsensitiveMatch, matchType: "case-insensitive" };

  // Try partial matches (last name only, first name only, etc.)
  const [csvFirst, ...csvLastParts] = trimmedName.split(" ");
  const csvLast = csvLastParts.join(" ");

  if (csvFirst && csvLast) {
    const partialMatch = members.find(
      (member) =>
        member.firstName.toLowerCase() === csvFirst.toLowerCase() ||
        member.lastName.toLowerCase() === csvLast.toLowerCase(),
    );

    if (partialMatch) return { ...partialMatch, matchType: "partial" };
  }

  return null;
}

// Main function
async function checkNameMapping() {
  try {
    console.log(
      "🔍 Checking player name mapping between CSV and database...\n",
    );

    // Get data
    const csvPlayerNames = await extractPlayerNames();
    const dbMembers = await getAllMembers();

    console.log(`📊 Database has ${dbMembers.length} members`);
    console.log(`📊 CSV has ${csvPlayerNames.size} unique player names\n`);

    // Track results
    const exactMatches: Array<{ csvName: string; member: any }> = [];
    const fuzzyMatches: Array<{
      csvName: string;
      member: any;
      matchType: string;
    }> = [];
    const noMatches: string[] = [];

    // Check each CSV name
    for (const playerName of csvPlayerNames) {
      const match = findMemberMatch(playerName, dbMembers);

      if (match) {
        if (match.matchType) {
          fuzzyMatches.push({
            csvName: playerName,
            member: match,
            matchType: match.matchType,
          });
        } else {
          exactMatches.push({ csvName: playerName, member: match });
        }
      } else {
        noMatches.push(playerName);
      }
    }

    // Report results
    console.log("✅ EXACT MATCHES:");
    console.log(`   Found ${exactMatches.length} exact matches`);
    exactMatches.forEach(({ csvName, member }) => {
      console.log(
        `   "${csvName}" → ${member.firstName} ${member.lastName} (#${member.memberNumber})`,
      );
    });

    console.log("\n🔍 FUZZY MATCHES:");
    console.log(`   Found ${fuzzyMatches.length} fuzzy matches`);
    fuzzyMatches.forEach(({ csvName, member, matchType }) => {
      console.log(
        `   "${csvName}" → ${member.firstName} ${member.lastName} (#${member.memberNumber}) [${matchType}]`,
      );
    });

    console.log("\n❌ NO MATCHES FOUND:");
    console.log(`   ${noMatches.length} names couldn't be matched`);
    noMatches.forEach((name) => {
      console.log(`   "${name}"`);
    });

    // Create mapping file
    const mappingData = {
      exactMatches: exactMatches.map(({ csvName, member }) => ({
        csvName,
        memberId: member.id,
        memberName: `${member.firstName} ${member.lastName}`,
        memberNumber: member.memberNumber,
      })),
      fuzzyMatches: fuzzyMatches.map(({ csvName, member, matchType }) => ({
        csvName,
        memberId: member.id,
        memberName: `${member.firstName} ${member.lastName}`,
        memberNumber: member.memberNumber,
        matchType,
      })),
      unmatchedNames: noMatches,
    };

    // Write mapping file
    const mappingPath = path.join(
      process.cwd(),
      "scripts",
      "name-mapping.json",
    );
    fs.writeFileSync(mappingPath, JSON.stringify(mappingData, null, 2));

    console.log(`\n📝 Mapping data written to: ${mappingPath}`);

    // Summary
    console.log("\n📊 SUMMARY:");
    console.log(`   Total CSV names: ${csvPlayerNames.size}`);
    console.log(
      `   Exact matches: ${exactMatches.length} (${Math.round((exactMatches.length / csvPlayerNames.size) * 100)}%)`,
    );
    console.log(
      `   Fuzzy matches: ${fuzzyMatches.length} (${Math.round((fuzzyMatches.length / csvPlayerNames.size) * 100)}%)`,
    );
    console.log(
      `   No matches: ${noMatches.length} (${Math.round((noMatches.length / csvPlayerNames.size) * 100)}%)`,
    );

    if (noMatches.length > 0) {
      console.log(
        "\n⚠️  You may need to manually map the unmatched names or add missing members to the database.",
      );
    }
  } catch (error) {
    console.error("❌ Error checking name mapping:", error);
    process.exit(1);
  }
}

// Run the check
async function main() {
  console.log("🚀 Starting name mapping check...");
  try {
    await checkNameMapping();
  } catch (error) {
    console.error("❌ Script failed:", error);
    console.error("Full error:", error);
    process.exit(1);
  }
}

// Check if this script is being run directly
if (
  import.meta.url.endsWith(process.argv[1]!) ||
  process.argv[1]?.endsWith("check-name-mapping.ts")
) {
  main();
}
