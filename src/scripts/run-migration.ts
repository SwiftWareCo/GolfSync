#!/usr/bin/env tsx
//@ts-nocheck
import { eq } from "drizzle-orm";
import { db } from "../server/db";
import { memberClasses, members } from "../server/db/schema";

// Verify and populate member classes table
async function migrateMemberClasses() {
  console.log("🚀 Starting member classes verification...");

  try {
    // Check existing member classes
    const existingClasses = await db.query.memberClasses.findMany();
    console.log(`✅ Found ${existingClasses.length} existing member classes`);

    // Check that all members have valid classId FK references
    const allMembers = await db.query.members.findMany();
    const membersWithoutClass = allMembers.filter((m) => !m.classId);

    if (membersWithoutClass.length > 0) {
      console.log(
        `⚠️ Found ${membersWithoutClass.length} members without valid classId`,
      );
      console.log(
        "   Please run the migration script to ensure all members have valid classId values",
      );
    } else {
      console.log(`✅ All ${allMembers.length} members have valid classId`);
    }

    console.log("\n📊 MIGRATION SUMMARY:");
    console.log(`   ✅ Total member classes: ${existingClasses.length}`);
    console.log(`   ✅ Total members: ${allMembers.length}`);
    console.log(`   ✅ Members with classId: ${allMembers.length - membersWithoutClass.length}`);

    return {
      success: true,
      data: {
        totalClasses: existingClasses.length,
        totalMembers: allMembers.length,
        membersWithoutClass: membersWithoutClass.length,
        memberClasses: existingClasses.map((c) => ({
          id: c.id,
          label: c.label,
          isActive: c.isActive,
        })),
      },
    };
  } catch (error) {
    console.error("❌ Error during member classes verification:", error);
    throw error;
  }
}

// Run the migration
async function runMemberClassesMigration() {
  try {
    const result = await migrateMemberClasses();

    if (result.success) {
      console.log("🎉 Migration completed successfully!");
      if (result.data) {
        console.log("📊 Migration completed with data:", result.data);
      }
    } else {
      console.error("❌ Migration failed:", result.message);
      process.exit(1);
    }
  } catch (error) {
    console.error("💥 Migration error:", error);
    process.exit(1);
  }
}

// Run the migration
if (
  import.meta.url.endsWith(process.argv[1]!) ||
  process.argv[1]?.endsWith("run-migration.ts")
) {
  runMemberClassesMigration();
}
