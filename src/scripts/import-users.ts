//@ts-nocheck
import { parse } from "csv-parse";
import { createReadStream } from "fs";
import { db } from "../server/db";
import { members, memberClasses } from "../server/db/schema";
import { eq } from "drizzle-orm";
import path from "path";

async function importMembers() {
  const duplicateTracker = new Map<string, number>();
  const importedMembers = new Set<string>();
  const classCache = new Map<string, number>(); // Cache class name -> ID mapping

  // Create a read stream from the CSV file
  const parser = createReadStream(
    path.join(process.cwd(), "csvdata/users_updated.csv"),
  ).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
    }),
  );

  for await (const record of parser) {
    let memberNumber = record.memberNumber || "";

    // If this member number has been seen before
    if (importedMembers.has(memberNumber)) {
      // Get the current count for this number
      const count = duplicateTracker.get(memberNumber) || 1;
      // Update the member number with a suffix
      memberNumber = `${memberNumber}_${count}`;
      // Increment the count for next time
      duplicateTracker.set(record.memberNumber, count + 1);
    }

    // Add to set of imported members
    importedMembers.add(memberNumber);

    // Get or lookup the classId from memberClasses table
    const className = String(record.class || "");
    let classId: number | null = classCache.get(className) ?? null;

    if (classId === null && className) {
      // Lookup the class ID from the database
      const memberClass = await db.query.memberClasses.findFirst({
        where: eq(memberClasses.label, className),
      });
      classId = memberClass?.id ?? null;

      if (classId) {
        classCache.set(className, classId);
      }
    }

    // Skip members with no valid class ID
    if (!classId) {
      console.warn(
        `Skipping member ${memberNumber}: class "${className}" not found in memberClasses table`,
      );
      continue;
    }

    // Transform CSV data to match our schema
    const member = {
      classId,
      memberNumber: String(memberNumber),
      firstName: String(record.firstName || ""),
      lastName: String(record.lastName || ""),
      username: String(record.username || ""),
      email: String(record.email || `noemail_${memberNumber}@placeholder.com`),
      gender: record.gender?.toLowerCase().charAt(0) || null,
      dateOfBirth: record.dateOfBirth || null,
      handicap: record.handicap || null,
      bagNumber: record.bagNumber || null,
    };

    try {
      await db.insert(members).values(member);
      console.log(
        `Imported member: ${member.firstName} ${member.lastName} (${member.memberNumber}) - Class: ${className}`,
      );
    } catch (error) {
      console.error(
        `Failed to import member: ${member.firstName} ${member.lastName} (${member.memberNumber})`,
        error,
      );
    }
  }

  console.log("Import completed!");
  console.log(`Total members imported: ${importedMembers.size}`);
  console.log(`Duplicate numbers handled: ${duplicateTracker.size}`);
}

// Run the import
importMembers().catch(console.error);
