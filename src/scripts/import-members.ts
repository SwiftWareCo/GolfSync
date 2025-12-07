/**
 * Member Import Script v2
 * Consolidated script for importing members from CSV
 *
 * Usage:
 *   pnpm run import-members              # Default: upsert mode
 *   pnpm run import-members -- --upsert  # Update existing, insert new
 *   pnpm run import-members -- --clear   # Clear all members first (DESTRUCTIVE)
 *   pnpm run import-members -- --dry-run # Validate without changes
 */

import csvParser from "csv-parser";
import { createReadStream } from "fs";
import path from "path";
import { db } from "../server/db";
import { members, memberClasses } from "../server/db/schema";
import { eq } from "drizzle-orm";

// ============================================================================
// Types
// ============================================================================

interface CSVMember {
  id: string;
  Class: string;
  "Member Number": string;
  "First Name": string;
  "Last Name": string;
  Username: string;
  Email: string;
  Gender: string;
  "Date of Birth": string;
  Handicap: string;
  "Bag Number": string;
}

interface ProcessedMember {
  memberNumber: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  gender: string | null;
  dateOfBirth: string | null;
  handicap: string | null;
  bagNumber: string | null;
  classId: number;
  className: string;
}

interface SkippedRow {
  row: number;
  name: string;
  reason: string;
}

interface Report {
  totalRows: number;
  processed: ProcessedMember[];
  skipped: SkippedRow[];
  inserted: number;
  updated: number;
  failed: { row: number; name: string; error: string }[];
  duplicateMemberNumbers: Map<string, number>;
}

// ============================================================================
// Course Sponsored Member
// ============================================================================

const COURSE_SPONSORED_MEMBER = {
  id: -1,
  memberNumber: "COURSE",
  firstName: "Course",
  lastName: "Sponsored",
  username: "course_sponsored",
  email: "admin@golfcourse.com",
  gender: "O" as string,
  dateOfBirth: null as string | null,
  handicap: null as string | null,
  bagNumber: "000",
  classId: 98 as number, // Default, will be looked up dynamically
};

// ============================================================================
// Utility Functions
// ============================================================================

function parseArgs(): { mode: "upsert" | "clear"; dryRun: boolean } {
  const args = process.argv.slice(2);
  return {
    mode: args.includes("--clear") ? "clear" : "upsert",
    dryRun: args.includes("--dry-run"),
  };
}

function normalizeGender(gender: string): string | null {
  if (!gender) return null;
  const first = gender.trim().toLowerCase().charAt(0);
  if (first === "m" || first === "f") return first;
  return null;
}

function normalizeDate(dateStr: string): string | null {
  if (!dateStr || dateStr.trim() === "") return null;
  // Try to parse the date - return as-is if it looks like YYYY-MM-DD
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  // Try to parse other formats
  const date = new Date(trimmed);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split("T")[0] || null;
  }
  return null;
}

function normalizeEmail(email: string, memberNumber: string): string {
  if (email && email.trim() && !email.includes("@x.com") && email !== "x") {
    return email.trim();
  }
  return `noemail_${memberNumber}@placeholder.com`;
}

// ============================================================================
// Main Import Logic
// ============================================================================

async function loadMemberClasses(): Promise<Map<string, number>> {
  console.log("📋 Loading member classes from database...");
  const classes = await db.query.memberClasses.findMany();
  const classMap = new Map<string, number>();

  for (const cls of classes) {
    // Store both exact label and uppercase version for matching
    classMap.set(cls.label, cls.id);
    classMap.set(cls.label.toUpperCase(), cls.id);
  }

  console.log(`   ✅ Loaded ${classes.length} member classes`);
  return classMap;
}

async function readCSV(filePath: string): Promise<CSVMember[]> {
  return new Promise((resolve, reject) => {
    const results: CSVMember[] = [];
    createReadStream(filePath)
      .pipe(csvParser())
      .on("data", (data: CSVMember) => results.push(data))
      .on("end", () => resolve(results))
      .on("error", reject);
  });
}

function processMemberNumber(
  rawNumber: string,
  className: string,
  duplicateTracker: Map<string, number>,
): string {
  const isStaff = className.toUpperCase().includes("STAFF");
  const isResigned = className.toUpperCase().includes("RESIGNED");
  const isEmpty = !rawNumber || rawNumber.trim() === "" || rawNumber === "0";

  let memberNumber: string;

  if (isEmpty) {
    // Generate unique EMPTY number
    const emptyCount = duplicateTracker.get("EMPTY") || 0;
    memberNumber = emptyCount === 0 ? "EMPTY" : `EMPTY_${emptyCount}`;
    duplicateTracker.set("EMPTY", emptyCount + 1);
  } else if (isStaff && !rawNumber.startsWith("S-")) {
    memberNumber = `S-${rawNumber}`;
  } else if (isResigned && !rawNumber.startsWith("R-")) {
    memberNumber = `R-${rawNumber}`;
  } else {
    memberNumber = rawNumber.trim();
  }

  // Check for duplicates and append suffix if needed
  const existingCount = duplicateTracker.get(memberNumber) || 0;
  if (existingCount > 0) {
    memberNumber = `${memberNumber}_${existingCount}`;
  }
  duplicateTracker.set(memberNumber, existingCount + 1);

  return memberNumber;
}

async function processCSVData(
  csvData: CSVMember[],
  classMap: Map<string, number>,
): Promise<Report> {
  const report: Report = {
    totalRows: csvData.length,
    processed: [],
    skipped: [],
    inserted: 0,
    updated: 0,
    failed: [],
    duplicateMemberNumbers: new Map(),
  };

  for (let i = 0; i < csvData.length; i++) {
    const row = csvData[i]!;
    const rowNum = i + 2; // +2 for 1-indexed and header row
    const firstName = row["First Name"]?.trim() || "";
    const lastName = row["Last Name"]?.trim() || "";
    const fullName = `${firstName} ${lastName}`.trim() || "(empty)";

    // Skip rows with no first name AND no last name
    if (!firstName && !lastName) {
      report.skipped.push({
        row: rowNum,
        name: fullName,
        reason: "Empty first name and last name",
      });
      continue;
    }

    // Get class name and look up class ID
    const className = row.Class?.trim() || "";
    const classId =
      classMap.get(className) || classMap.get(className.toUpperCase());

    if (!classId) {
      report.skipped.push({
        row: rowNum,
        name: fullName,
        reason: `Class "${className}" not found in memberClasses`,
      });
      continue;
    }

    // Process member number
    const rawMemberNumber = row["Member Number"]?.trim() || "";
    const memberNumber = processMemberNumber(
      rawMemberNumber,
      className,
      report.duplicateMemberNumbers,
    );

    // Build the processed member
    const processedMember: ProcessedMember = {
      memberNumber,
      firstName,
      lastName,
      username: row.Username?.trim() || memberNumber,
      email: normalizeEmail(row.Email, memberNumber),
      gender: normalizeGender(row.Gender),
      dateOfBirth: normalizeDate(row["Date of Birth"]),
      handicap: row.Handicap?.trim() || null,
      bagNumber: row["Bag Number"]?.trim() || null,
      classId,
      className,
    };

    report.processed.push(processedMember);
  }

  return report;
}

async function ensureCourseSponsored(
  classMap: Map<string, number>,
): Promise<void> {
  console.log("\n🏌️ Ensuring Course Sponsored member exists...");

  // Check if Course Sponsored member exists
  const existing = await db.query.members.findFirst({
    where: eq(members.memberNumber, COURSE_SPONSORED_MEMBER.memberNumber),
  });

  if (existing) {
    console.log(
      "   ✅ Course Sponsored member already exists (ID: " + existing.id + ")",
    );
    return;
  }

  // Create it - need to find the correct class ID for a suitable class
  // Looking for a generic class that would work for system members
  let classId = COURSE_SPONSORED_MEMBER.classId;

  // Try to find the class by looking for common candidates
  const candidateLabels = [
    "MGMT / PRO",
    "MANAGEMENT",
    "STAFF PLAY",
    "HONORARY MALE",
  ];
  for (const label of candidateLabels) {
    const foundId = classMap.get(label);
    if (foundId) {
      classId = foundId;
      break;
    }
  }

  await db.insert(members).values({
    memberNumber: COURSE_SPONSORED_MEMBER.memberNumber,
    firstName: COURSE_SPONSORED_MEMBER.firstName,
    lastName: COURSE_SPONSORED_MEMBER.lastName,
    username: COURSE_SPONSORED_MEMBER.username,
    email: COURSE_SPONSORED_MEMBER.email,
    gender: COURSE_SPONSORED_MEMBER.gender,
    bagNumber: COURSE_SPONSORED_MEMBER.bagNumber,
    classId,
  });

  console.log("   ✅ Created Course Sponsored member");
}

async function executeImport(
  report: Report,
  mode: "upsert" | "clear",
  dryRun: boolean,
): Promise<void> {
  if (dryRun) {
    console.log("\n🔍 DRY RUN - No changes will be made");
    return;
  }

  if (mode === "clear") {
    console.log("\n🗑️  CLEAR MODE: Deleting all existing members...");
    await db.delete(members);
    console.log("   ✅ All members deleted");
  }

  console.log("\n📥 Importing members...");

  for (const member of report.processed) {
    try {
      if (mode === "upsert") {
        // Check if member exists by member number
        const existing = await db.query.members.findFirst({
          where: eq(members.memberNumber, member.memberNumber),
        });

        if (existing) {
          // Update existing member
          await db
            .update(members)
            .set({
              firstName: member.firstName,
              lastName: member.lastName,
              username: member.username,
              email: member.email,
              gender: member.gender,
              dateOfBirth: member.dateOfBirth,
              handicap: member.handicap,
              bagNumber: member.bagNumber,
              classId: member.classId,
            })
            .where(eq(members.id, existing.id));
          report.updated++;
        } else {
          // Insert new member
          await db.insert(members).values({
            memberNumber: member.memberNumber,
            firstName: member.firstName,
            lastName: member.lastName,
            username: member.username,
            email: member.email,
            gender: member.gender,
            dateOfBirth: member.dateOfBirth,
            handicap: member.handicap,
            bagNumber: member.bagNumber,
            classId: member.classId,
          });
          report.inserted++;
        }
      } else {
        // Clear mode - just insert
        await db.insert(members).values({
          memberNumber: member.memberNumber,
          firstName: member.firstName,
          lastName: member.lastName,
          username: member.username,
          email: member.email,
          gender: member.gender,
          dateOfBirth: member.dateOfBirth,
          handicap: member.handicap,
          bagNumber: member.bagNumber,
          classId: member.classId,
        });
        report.inserted++;
      }
    } catch (error) {
      report.failed.push({
        row: 0, // We don't track row number after processing
        name: `${member.firstName} ${member.lastName}`,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

function printReport(report: Report, mode: string, dryRun: boolean): void {
  console.log("\n" + "=".repeat(60));
  console.log("                    MEMBER IMPORT REPORT");
  console.log("=".repeat(60));

  console.log(`\n📥 Source: csvdata/users (latest export).csv`);
  console.log(`   Mode: ${mode.toUpperCase()}${dryRun ? " (DRY RUN)" : ""}`);
  console.log(`   Total Rows: ${report.totalRows}`);

  console.log("\n✅ Successfully Processed: " + report.processed.length);
  if (!dryRun) {
    console.log(`   - Inserted: ${report.inserted}`);
    console.log(`   - Updated: ${report.updated}`);
  }

  if (report.skipped.length > 0) {
    console.log(`\n⚠️  Skipped: ${report.skipped.length}`);
    // Show all skipped rows
    for (const skip of report.skipped) {
      console.log(`   Row ${skip.row}: "${skip.name}" - ${skip.reason}`);
    }
  }

  if (report.failed.length > 0) {
    console.log(`\n❌ Failed: ${report.failed.length}`);
    for (const fail of report.failed) {
      console.log(`   "${fail.name}" - ${fail.error}`);
    }
  }

  // Summary
  console.log("\n" + "-".repeat(60));
  console.log("📊 Summary:");
  console.log(`   Total processed: ${report.processed.length}`);
  console.log(`   Total skipped: ${report.skipped.length}`);
  console.log(`   Total failed: ${report.failed.length}`);

  if (!dryRun) {
    console.log(`   Inserted: ${report.inserted}`);
    console.log(`   Updated: ${report.updated}`);
  }

  console.log("=".repeat(60) + "\n");
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<void> {
  const { mode, dryRun } = parseArgs();

  console.log("\n🚀 Member Import Script v2");
  console.log(`   Mode: ${mode.toUpperCase()}${dryRun ? " (DRY RUN)" : ""}`);

  if (mode === "clear" && !dryRun) {
    console.log("\n⚠️  WARNING: Clear mode will DELETE all existing members!");
    console.log("   Press Ctrl+C within 3 seconds to cancel...");
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  try {
    // Load member classes
    const classMap = await loadMemberClasses();

    // Read CSV
    const csvPath = path.join(
      process.cwd(),
      "csvdata",
      "users (latest export).csv",
    );
    console.log(`\n📂 Reading CSV: ${csvPath}`);
    const csvData = await readCSV(csvPath);
    console.log(`   ✅ Read ${csvData.length} rows`);

    // Process data
    console.log("\n⚙️  Processing data...");
    const report = await processCSVData(csvData, classMap);

    // Execute import
    await executeImport(report, mode, dryRun);

    // Ensure Course Sponsored member exists
    if (!dryRun) {
      await ensureCourseSponsored(classMap);
    }

    // Print report
    printReport(report, mode, dryRun);

    // Verify final count
    if (!dryRun) {
      const finalCount = await db.query.members.findMany();
      console.log(`✅ Final member count in database: ${finalCount.length}`);

      // Verify Course Sponsored
      const courseSponsored = await db.query.members.findFirst({
        where: eq(members.memberNumber, "COURSE"),
      });
      if (courseSponsored) {
        console.log("✅ Course Sponsored member verified");
      } else {
        console.log("⚠️  Course Sponsored member NOT found - please check!");
      }
    }
  } catch (error) {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  }
}

// Run
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
